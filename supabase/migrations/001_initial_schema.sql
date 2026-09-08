-- ============================================================================
-- EcoGuardian — Supabase PostgreSQL initial schema (Migration 001)
-- ----------------------------------------------------------------------------
-- Source of truth: PHASE 0 MongoDB -> PostgreSQL migration audit.
-- This file creates the COMPLETE application schema for Phase 1 (schema only).
--
-- SCOPE (per PHASE 1 instructions):
--   * Creates tables, FKs, unique/check constraints, indexes, RLS.
--   * Links profiles.auth_user_id -> auth.users(id)  (Auth relationship only;
--     Supabase Auth integration happens in Phase 2/3).
--   * NO password column. Supabase Auth owns credentials.
--   * MongoDB/Mongoose remain the current working database.
--   * RLS is defense-in-depth for direct client connections; it does NOT
--     replace Express authorization, and it does NOT lock out the Express
--     backend (which connects via `service_role`, which BYPASSES RLS).
--
-- TENANCY RULES encoded at the schema level:
--   * PERSONAL  : role='individual', organization_id IS NULL, department_id IS NULL
--   * ORGANIZATION : organization_id NOT NULL (optional department_id)
--   * One Mobility Twin per user (user_id UNIQUE) for ALL user modes.
--   * carbon_entries denormalize organization_id/department_id for RLS +
--     org analytics; values are set by the backend from the authenticated
--     profile, never from client input.
-- ============================================================================

-- ---- Extensions ------------------------------------------------------------
create extension if not exists citext;   -- case-insensitive email/unique

-- ---- Timestamp helper (sets updated_at on UPDATE) ---------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
-- 1) ORGANIZATIONS  (was Mongo `College`)
-- ============================================================================
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  address     text not null default '',
  license     jsonb not null default '{}'::jsonb,      -- { plan, expiresAt, status }
  status      text not null default 'active'
              check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Organization codes are globally unique (enforced above via UNIQUE(code)).
  check (length(btrim(code)) > 0)
);

-- ============================================================================
-- 2) DEPARTMENTS  (was Mongo `Department`)
-- ============================================================================
create table public.departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A department code must be unique WITHIN a single organization.
  constraint departments_org_code_key unique (organization_id, code),
  -- Composite key enabling relational "department must belong to its org"
  -- checks (see profiles/carbon_entries/challenges composite FKs).
  constraint departments_id_org_key unique (id, organization_id)
);
-- ============================================================================
-- 3) PROFILES  (was Mongo `User`)
-- ----------------------------------------------------------------------------
-- auth_user_id links the application profile to Supabase Auth identity.
-- Never store passwords here — Supabase Auth owns credentials.
-- ============================================================================
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique not null references auth.users(id) on delete cascade,
  user_id         text not null unique,                 -- IND0001 / CSE25001 ...
  name            text not null,
  email           citext not null unique,
  role            text not null default 'individual'
                  check (role in ('super_admin', 'college_admin', 'faculty', 'student', 'individual')),
  -- Deleting an organization cascades to its member profiles (matches Mongo:
  -- super-admin college deletion removes its users). Deleting a department
  -- clears an association (matches Mongo college-admin department delete which
  -- sets departmentId = null on affected users).
  organization_id uuid references public.organizations(id) on delete cascade,
  department_id   uuid references public.departments(id) on delete set null,
  semester        text not null default '',
  section         text not null default '',
  first_login     boolean not null default true,
  status          text not null default 'active'
                  check (status in ('active', 'suspended')),
  profile         jsonb not null default '{}'::jsonb,   -- { avatar, location, bio, goal }
  gamification    jsonb not null default '{}'::jsonb,   -- { ecoScore, greenPoints, streak, lastActiveDate, badges[], completedChallenges[] }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- YES constraints:
  --   * individual  -> personal (no org, no dept)
  --   * super_admin -> platform-wide (org optional; the seeded super admin has none)
  --   * college_admin / faculty / student -> must belong to an organization
  constraint profiles_org_requires_role check (
    (role = 'individual' and organization_id is null and department_id is null)
    or (role = 'super_admin')
    or (role in ('college_admin', 'faculty', 'student') and organization_id is not null)
  ),
  -- A department cannot be set without an organization.
  constraint profiles_dept_requires_org check (
    (department_id is null) or (organization_id is not null)
  ),
  -- A department must belong to the SAME organization the profile belongs to.
  -- Enforced relationally (no subquery): (department_id, organization_id) must
  -- match a real departments(id, organization_id) row, so a profile can never
  -- reference department A + organization B. MATCH SIMPLE means NULL tenancy
  -- (personal users, or an org user with no department) is naturally allowed.
  constraint profiles_dept_in_org
    foreign key (department_id, organization_id)
    references public.departments(id, organization_id)
);
create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_department_id_idx on public.profiles (department_id);

-- ============================================================================
-- 4) CARBON ENTRIES  (was Mongo `CarbonEntry`)
-- ----------------------------------------------------------------------------
-- Primary shape is transportation trips[] (JSONB) + resolved provenance.
-- organization_id / department_id are DENORMALIZED from the authenticated
-- profile for RLS + org analytics (never client-supplied).
-- Legacy v2 lifestyle fields are archival and stored in `legacy` (JSONB);
-- they are NOT part of the ML pipeline.
-- ============================================================================
create table public.carbon_entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  date                 timestamptz not null default now(),
  -- Denormalized tenancy (from the authenticated profile at write time).
  -- Org delete cascades to owned rows; dept delete clears the association.
  organization_id      uuid references public.organizations(id) on delete cascade,
  department_id        uuid references public.departments(id) on delete set null,

  -- v3 canonical transportation data
  trips                jsonb not null default '[]'::jsonb,   -- [{ mode, distanceKm, occupants, tripFrequency, purpose, vehicle{...}, resolved{ provenance... }, tripTotalEmission, personalAllocatedEmission }]
  transport_personal   numeric not null default 0,           -- occupancy-allocated kg CO2
  transport_household  numeric not null default 0,           -- raw pre-allocation kg CO2
  mode_breakdown       jsonb not null default '{}'::jsonb,   -- { mode -> allocated kg CO2 }
  total_emissions      numeric not null default 0,           -- mono totalEmissions (aggregated in analytics)

  -- legacy v2 lifestyle + breakdowns (archival; not in ML pipeline)
  legacy               jsonb not null default '{}'::jsonb,

  notes                text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Personal entries carry NULL tenancy; organization entries carry their org.
  -- (Whether the tenancy matches the OWNING profile is an app-layer invariant
  -- enforced by Express at write time; it cannot be a CHECK constraint here.)
  constraint carbon_entries_tenancy_consistent check (
    (organization_id is null and department_id is null)
    or
    (organization_id is not null)
  ),
  -- Denormalized tenancy: a carbon entry's department must belong to the same
  -- organization as the entry (relational, no subquery). MATCH SIMPLE lets
  -- personal rows (both NULL) and org rows (org set, no dept) pass naturally.
  constraint carbon_entries_dept_in_org
    foreign key (department_id, organization_id)
    references public.departments(id, organization_id)
);

-- Primary user-scoped access pattern: (user_id, date DESC)
create index carbon_entries_user_date_idx on public.carbon_entries (user_id, date desc);
-- Org analytics (college/faculty/super admin aggregate over student sets)
create index carbon_entries_org_date_idx on public.carbon_entries (organization_id, date desc);
create index carbon_entries_dept_date_idx on public.carbon_entries (department_id, date desc);
-- GIN for trips.mode lookups (rare; matches Mongo 'trips.mode' index)
create index carbon_entries_trips_mode_idx on public.carbon_entries using gin ((trips -> 'mode'));
-- Ensure department belongs to org on denormalized tenancy (rules out few data)
create index carbon_entries_user_id_idx on public.carbon_entries (user_id);

-- ============================================================================
-- 5) MOBILITY TWINS  (was Mongo `MobilityTwin`) — ONE twin per user
-- ============================================================================
create table public.mobility_twins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles(id) on delete cascade,
  baseline        jsonb not null default '{}'::jsonb,    -- { windowDays, entryCount, dailyPersonalKg, ... modeBreakdown, occupancyProfile, dataQuality }
  vehicle_profile jsonb not null default '{}'::jsonb,    -- { mode, manufacturer, model, variant, category, fuelType, ..., co2GPerKm }
  scenarios       jsonb not null default '[]'::jsonb,    -- saved what-if scenarios
  model_metadata  jsonb not null default '{}'::jsonb,    -- { scope, scopeId, modelVersion, sampleCount, predictionMethod, syncedAt }
  derived_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- 6) SIMULATIONS  (was Mongo `Simulation`)
-- ============================================================================
create table public.simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  baseline    jsonb not null default '{}'::jsonb,
  changes     jsonb not null default '{}'::jsonb,
  results     jsonb not null default '{}'::jsonb,        -- { baselineTotal, scenarioTotal, reduction, reductionPercent }
  created_at  timestamptz not null default now()
);
create index simulations_user_id_idx on public.simulations (user_id, created_at desc);

-- ============================================================================
-- 7) CHALLENGES  (was Mongo `Challenge`)
-- ----------------------------------------------------------------------------
-- Scopes: NULL/NULL = platform/global; org + NULL dept = organization;
--         org + dept      = department-specific.
-- ============================================================================
create table public.challenges (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text not null,
  category          text not null default 'general'
                    check (category in ('transport', 'energy', 'food', 'waste', 'general')),
  points            integer not null default 50,
  target_reduction  numeric not null default 10,     -- percentage
  duration_days     integer not null default 7,
  badge             text not null default '',
  is_active         boolean not null default true,
  week_number       integer,
  organization_id   uuid references public.organizations(id) on delete cascade,
  department_id     uuid references public.departments(id) on delete set null,
  created_at        timestamptz not null default now(),
  -- department cannot be set without an organization
  constraint challenges_dept_requires_org check (
    (department_id is null) or (organization_id is not null)
  ),
  -- department must belong to the challenge's organization
  -- (relational, no subquery): (department_id, organization_id) must match a
  -- real departments(id, organization_id) row.
  constraint challenges_dept_in_org
    foreign key (department_id, organization_id)
    references public.departments(id, organization_id)
);
create index challenges_active_idx on public.challenges (is_active);
create index challenges_org_dept_idx on public.challenges (organization_id, department_id);

-- ============================================================================
-- 8) ANNOUNCEMENTS  (was Mongo `Announcement`)
-- ----------------------------------------------------------------------------
-- organization_id NULL = global/platform-wide.
-- ============================================================================
create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  content         text not null,
  organization_id uuid references public.organizations(id) on delete cascade,  -- NULL = global
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index announcements_org_idx on public.announcements (organization_id);

-- ============================================================================
-- 9) EMISSION FACTORS  (was Mongo `EmissionFactor`) — GLOBAL, no tenancy
-- ----------------------------------------------------------------------------
-- Canonical resolved intensity per row. Also carries kWh factor for EVs and
-- full provenance metadata. No user/org/dept relationship.
-- ============================================================================
create table public.emission_factors (
  id                 uuid primary key default gen_random_uuid(),
  mode               text not null
                     check (mode in ('car','motorcycle','auto_rickshaw','bus','metro','ev','bicycle','walk','flight','grid_electricity')),
  manufacturer       text not null default '',
  model              text not null default '',
  variant            text not null default '',
  vehicle_category   text not null default '',
  fuel_type          text not null default '',
  -- Nullable: EV rows may carry only kwh_per_km (CO2 is computed from grid
  -- intensity at resolve time). Matches the Mongo EmissionFactor model, which
  -- sets co2_kg_per_km without `required` (default 0).
  co2_kg_per_km      numeric default 0,
  kwh_per_km         numeric,
  source             text not null default '',
  source_url         text not null default '',
  source_year        integer,
  region             text not null default 'IN',
  confidence_level   text not null default 'low'
                     check (confidence_level in ('high', 'medium', 'low')),
  active             boolean not null default true,
  dataset_version    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- A factor row may combine manufacturer + category specifics; the three
  -- lookup tiers (exact/category/generic) must not collide.
  constraint emission_factors_lookup_unique unique (
    mode, manufacturer, model, variant, vehicle_category, fuel_type
  )
);

-- Lookup indexes mirroring MongoDB (Levels 1/2/3):
--  Level 1 - exact vehicle (manufacturer/provider row)  -> partial index
create index emission_factors_exact_idx
  on public.emission_factors (mode, manufacturer, model, variant)
  where manufacturer <> '';
--  Level 2 - category (mode + vehicle_category + fuel_type)
create index emission_factors_category_idx
  on public.emission_factors (mode, vehicle_category, fuel_type)
  where vehicle_category <> '';
--  Level 3 - generic mode (one row per mode, empty category)
create index emission_factors_mode_idx
  on public.emission_factors (mode, vehicle_category);
create index emission_factors_active_idx on public.emission_factors (active);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger carbon_entries_set_updated_at before update on public.carbon_entries
  for each row execute function public.set_updated_at();
create trigger mobility_twins_set_updated_at before update on public.mobility_twins
  for each row execute function public.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();
create trigger emission_factors_set_updated_at before update on public.emission_factors
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (defense-in-depth)
-- ----------------------------------------------------------------------------
-- Principle:
--   * The Express backend is the business/API layer and connects via the
--     Supabase `service_role` (which has BYPASSRLS). Existing Express code is
--     therefore NEVER locked out, and remains the primary authorization layer.
--   * RLS adds a second perimeter so that any FUTURE direct-DB client is also
--     constrained to the same tenancy rules (own rows; org/dept scoping).
--   * Policies use the built-in `auth.uid()` -> profiles join (no custom
--     JWT claims are required yet). `anon` gets no access by default.
--   * `grant` statements grant DML to the standard Supabase roles; this is
--     required for policies to take effect for those roles.
-- ============================================================================

alter table public.organizations    enable row level security;
alter table public.departments      enable row level security;
alter table public.profiles         enable row level security;
alter table public.carbon_entries   enable row level security;
alter table public.mobility_twins   enable row level security;
alter table public.simulations      enable row level security;
alter table public.challenges       enable row level security;
alter table public.announcements    enable row level security;
alter table public.emission_factors enable row level security;

-- Helper: the public.profiles.id for the currently authenticated auth.uid(),
-- or NULL when not signed in.
create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1;
$$;

-- Grants: `service_role` bypasses RLS (keeps Express working). `authenticated`
-- gets the ability that the policies below constrain. `anon` gets nothing.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-------------------------------------------------------------------
-- ORGANIZATIONS / DEPARTMENTS -- readable by any authenticated user
-- (names are displayed in /me and admin UIs; writes stay in Express).
-------------------------------------------------------------------
grant select on public.organizations to authenticated;
grant select on public.departments   to authenticated;

create policy org_select_authenticated on public.organizations
  for select to authenticated using (true);
create policy dept_select_authenticated on public.departments
  for select to authenticated using (true);

-------------------------------------------------------------------
-- PROFILES -- user can read/update their own row.
-------------------------------------------------------------------
grant select, update (id, name, profile, gamification, semester, section, first_login, status) on public.profiles to authenticated;

create policy profiles_own_select on public.profiles
  for select to authenticated using (auth_user_id = auth.uid());
create policy profiles_own_update on public.profiles
  for update to authenticated using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-------------------------------------------------------------------
-- OWNED DATA (carbon_entries, simulations, mobility_twins)
-- User can read/write only rows whose user_id == their profile id.
-- Denormalized tenancy additionally constrains org rows.
-------------------------------------------------------------------
grant select, insert, update, delete on public.carbon_entries to authenticated;
grant select, insert, update, delete on public.simulations   to authenticated;
grant select, insert, update, delete on public.mobility_twins to authenticated;

-- Helper: current actor's profile id (recomputed per use).
-- carbon_entries: own rows OR (defense) rows within your org/dept.
create policy carbon_entries_own on public.carbon_entries
  for all to authenticated
  using (user_id = public.current_profile_id());
create policy carbon_entries_org_scope on public.carbon_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = public.current_profile_id()
        and me.organization_id is not null
        and public.carbon_entries.organization_id = me.organization_id
    )
  );

create policy simulations_own on public.simulations
  for all to authenticated
  using (user_id = public.current_profile_id());

create policy mobility_twins_own on public.mobility_twins
  for all to authenticated
  using (user_id = public.current_profile_id());

-------------------------------------------------------------------
-- CHALLENGES -- every authenticated user may read the catalog.
-- An individual sees only global (org IS NULL). A tenant user sees
-- global + their org + their dept. (Writes stay in Express/college admin.)
-------------------------------------------------------------------
grant select on public.challenges to authenticated;

-- Tenancy scoping inlined in the policy USING clause (PostgreSQL does not allow
-- a helper function with a `record` argument). Platform-wide challenges
-- (organization_id IS NULL) are visible to every authenticated user; tenant
-- challenges are visible only to members of their organization (and, when set,
-- their department).
create policy challenges_select on public.challenges
  for select to authenticated
  using (
    organization_id is null
    or (
      public.current_profile_id() is not null
      and exists (
        select 1 from public.profiles me
        where me.id = public.current_profile_id()
          and me.organization_id = challenges.organization_id
          and (challenges.department_id is null or me.department_id = challenges.department_id)
      )
    )
  );

-------------------------------------------------------------------
-- ANNOUNCEMENTS -- global (org NULL) visible to all; org-scoped only
-- to members of that org.
-------------------------------------------------------------------
grant select on public.announcements to authenticated;

create policy announcements_select on public.announcements
  for select to authenticated
  using (
    organization_id is null
    or exists (
      select 1 from public.profiles me
      where me.id = public.current_profile_id()
        and me.organization_id = announcements.organization_id
    )
  );

-------------------------------------------------------------------
-- EMISSION FACTORS -- global read-only catalog for any authenticated user.
-------------------------------------------------------------------
grant select on public.emission_factors to authenticated;

create policy emission_factors_select on public.emission_factors
  for select to authenticated using (true);
