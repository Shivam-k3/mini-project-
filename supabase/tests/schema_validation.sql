-- ============================================================================
-- EcoGuardian — PostgreSQL schema validation (run AFTER migrations 001+002)
-- ----------------------------------------------------------------------------
-- Read-only diagnostic queries to verify the Phase 1 schema invariants.
-- Run as the `postgres` / `service_role` role (bypasses RLS) after applying
-- 001_initial_schema.sql and 002_emission_factors_seed.sql.
--
-- Each block prints a human-readable check result. Intended as a manual QA
-- gate; it does NOT mutate data and does NOT fail the migration.
-- ============================================================================

-- 1) Tables present (expect 9 application tables)
select 'tables' as check_name,
       (select count(*) from pg_tables
         where schemaname = 'public'
           and tablename in ('profiles','organizations','departments',
                             'carbon_entries','mobility_twins','simulations',
                             'challenges','announcements','emission_factors'))
       as rows;

-- 2) One-twin-per-user constraint is enforced: report any twin linked to the
--    same user more than once (expect 0).
select 'one_twin_per_user_violations' as check_name, count(*) as rows
from (select user_id from public.mobility_twins group by user_id having count(*) > 1) dup;

-- 3) Personal users carry NULL tenancy (role=individual must have both NULL).
select 'personal_role_with_tenancy_bad' as check_name, count(*) as rows
from public.profiles
where role = 'individual' and (organization_id is not null or department_id is not null);

-- 4) Organization roles must have an organization (student/faculty/college_admin).
select 'org_role_without_org_bad' as check_name, count(*) as rows
from public.profiles
where role in ('student','faculty','college_admin') and organization_id is null;

-- 5) carbon_entries tenancy consistency (personal rows NULL tenancy;
--    organization rows carry org). Flag disallowed mixes.
select 'carbon_entries_org_without_org_col' as check_name, count(*) as rows
from public.carbon_entries
where (organization_id is null and department_id is not null);

-- 6) Carbon entry department must belong to its organization (denormalized).
select 'carbon_entries_dept_not_in_org' as check_name, count(*) as rows
from public.carbon_entries ce
where ce.department_id is not null
  and not exists (
        select 1 from public.departments d
        where d.id = ce.department_id and d.organization_id = ce.organization_id);

-- 7) Emission factors carry NO tenancy columns (by design, global).
select 'emission_factors_has_tenant_fk' as check_name,
       count(*) as rows from information_schema.columns
where table_schema='public' and table_name='emission_factors'
  and column_name in ('user_id','organization_id','department_id');

-- 8) Emission-factor seed present (expect the generic + grid + 16 categories).
select 'emission_factors_rows' as check_name, count(*) as rows
from public.emission_factors;

-- 9) RLS is enabled on all nine tables (expect 9 True).
select 'rls_policies_count' as check_name,
       (select count(*) from pg_policies where schemaname='public') as rows;
select 'rls_enabled_tables' as check_name, count(*) as rows
from pg_tables
where schemaname='public'
  and relrowsecurity = true
  and tablename in ('profiles','organizations','departments','carbon_entries',
                    'mobility_twins','simulations','challenges','announcements',
                    'emission_factors');

-- 10) FK integrity scan (should be 0 orphans across all reference edges).
select 'orphan_profiles_org' as check_name, count(*) as rows
from public.profiles p left join public.organizations o on o.id = p.organization_id
where p.organization_id is not null and o.id is null;
select 'orphan_profiles_dept' as check_name, count(*) as rows
from public.profiles p left join public.departments d on d.id = p.department_id
where p.department_id is not null and d.id is null;
select 'orphan_departments' as check_name, count(*) as rows
from public.departments d left join public.organizations o on o.id = d.organization_id
where o.id is null;
select 'orphan_carbon_entries_user' as check_name, count(*) as rows
from public.carbon_entries ce left join public.profiles p on p.id = ce.user_id
where p.id is null;
