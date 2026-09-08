-- ============================================================================
-- EcoGuardian — Emission factor seed (Migration 002)
-- ----------------------------------------------------------------------------
-- Source dataset: config/emission-factors.json (canonical, version 3.0.0).
-- Semantics: INSERT ... ON CONFLICT ... DO UPDATE — NEVER deletes rows, and
-- preserves any admin-curated/super-admin rows and manual edits by only
-- upserting the canonical keys. This mirrors the idempotent Mongo seeder
-- (backend/scripts/seedHelper.js -> seedEmissionFactors).
--
-- Emission factors are GLOBAL (no user/org/dept relationship).
-- Run AFTER 001_initial_schema.sql.
-- ============================================================================

-- ---- Generic mode-level factors (Level 3) ----------------------------------
insert into public.emission_factors
  (mode, manufacturer, model, variant, vehicle_category, fuel_type,
   co2_kg_per_km, kwh_per_km, source, source_url, source_year, region,
   confidence_level, active, dataset_version)
values
  ('walk', '', '', '', '', '', 0.0, NULL,
   'Zero tailpipe emissions (embodied/manufacturing emissions excluded)', '', NULL, 'IN', 'high', true, '3.0.0'),
  ('bicycle', '', '', '', '', '', 0.0, NULL,
   'Zero tailpipe emissions (embodied/manufacturing emissions excluded)', '', NULL, 'IN', 'high', true, '3.0.0'),
  ('car', '', '', '', '', '', 0.21, NULL,
   'Generic average petrol car; aligned with DEFRA conversion-factor ranges',
   'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting', 2024, 'IN', 'medium', true, '3.0.0'),
  ('motorcycle', '', '', '', '', '', 0.113, NULL,
   'Indicative average 100-150cc petrol motorcycle (midpoint of published ranges)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('auto_rickshaw', '', '', '', '', '', 0.075, NULL,
   'Indicative mixed CNG/petrol auto-rickshaw average', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('bus', '', '', '', '', '', 0.089, NULL,
   'Per-passenger urban bus average assuming typical occupancy; DEFRA-aligned',
   'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting', 2024, 'IN', 'medium', true, '3.0.0'),
  ('metro', '', '', '', '', '', 0.041, NULL,
   'Per-passenger metro rail intensity (Delhi Metro CDM/UNFCCC reporting order of magnitude)',
   'https://www.dmrc.org', 2023, 'IN', 'medium', true, '3.0.0'),
  ('flight', '', '', '', '', '', 0.255, NULL,
   'Indicative short-haul economy per-passenger factor; DEFRA-aligned upper bound',
   'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting', 2024, 'IN', 'low', true, '3.0.0'),
  ('ev', '', '', '', '', '', 0.107, NULL,
   'Computed: default 0.15 kWh/km x India grid factor 0.716 kgCO2/kWh (CEA v19)',
   'https://cea.nic.in/cdm-co2-baseline-database/', 2023, 'IN', 'medium', true, '3.0.0')
on conflict on constraint emission_factors_lookup_unique do update set
  co2_kg_per_km       = excluded.co2_kg_per_km,
  kwh_per_km          = excluded.kwh_per_km,
  source              = excluded.source,
  source_url          = excluded.source_url,
  source_year         = excluded.source_year,
  region              = excluded.region,
  confidence_level    = excluded.confidence_level,
  active              = excluded.active,
  dataset_version     = excluded.dataset_version;

-- ---- Grid electricity factor ----------------------------------------------
insert into public.emission_factors
  (mode, manufacturer, model, variant, vehicle_category, fuel_type,
   co2_kg_per_km, kwh_per_km, source, source_url, source_year, region,
   confidence_level, active, dataset_version)
values
  ('grid_electricity', '', '', '', '', '', 0.716, NULL,
   'Central Electricity Authority (India), CO2 Baseline Database v19, weighted average emission factor',
   'https://cea.nic.in/cdm-co2-baseline-database/', 2023, 'IN', 'medium', true, '3.0.0')
on conflict on constraint emission_factors_lookup_unique do update set
  co2_kg_per_km       = excluded.co2_kg_per_km,
  kwh_per_km          = excluded.kwh_per_km,
  source              = excluded.source,
  source_url          = excluded.source_url,
  source_year         = excluded.source_year,
  region              = excluded.region,
  confidence_level    = excluded.confidence_level,
  active              = excluded.active,
  dataset_version     = excluded.dataset_version;

-- ---- Category-level factors (Level 2) -------------------------------------
insert into public.emission_factors
  (mode, manufacturer, model, variant, vehicle_category, fuel_type,
   co2_kg_per_km, kwh_per_km, source, source_url, source_year, region,
   confidence_level, active, dataset_version)
values
  -- cars / petrol
  ('car', '', '', '', 'hatchback', 'petrol', 0.145, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('car', '', '', '', 'sedan',     'petrol', 0.165, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('car', '', '', '', 'suv',       'petrol', 0.200, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  -- cars / diesel
  ('car', '', '', '', 'hatchback', 'diesel', 0.140, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('car', '', '', '', 'sedan',     'diesel', 0.155, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('car', '', '', '', 'suv',       'diesel', 0.190, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  -- cars / cng
  ('car', '', '', '', 'hatchback', 'cng',    0.105, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('car', '', '', '', 'sedan',     'cng',    0.120, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  -- cars / electric (kWh per km, NOT computed from liquid-fuel efficiency)
  ('car', '', '', '', 'hatchback', 'electric', NULL, 0.140, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'medium', true, '3.0.0'),
  ('car', '', '', '', 'sedan',     'electric', NULL, 0.150, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'medium', true, '3.0.0'),
  ('car', '', '', '', 'suv',       'electric', NULL, 0.180, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'medium', true, '3.0.0'),
  -- motorcycles
  ('motorcycle', '', '', '', 'scooter',     'petrol', 0.098, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('motorcycle', '', '', '', 'standard',    'petrol', 0.113, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('motorcycle', '', '', '', 'performance', 'petrol', 0.140, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  -- auto rickshaws
  ('auto_rickshaw', '', '', '', 'standard', 'cng',    0.066, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0'),
  ('auto_rickshaw', '', '', '', 'standard', 'petrol', 0.089, NULL, 'Indicative category default (see dataset honesty policy)', '', NULL, 'IN', 'low', true, '3.0.0')
on conflict on constraint emission_factors_lookup_unique do update set
  co2_kg_per_km       = excluded.co2_kg_per_km,
  kwh_per_km          = excluded.kwh_per_km,
  source              = excluded.source,
  source_url          = excluded.source_url,
  source_year         = excluded.source_year,
  region              = excluded.region,
  confidence_level    = excluded.confidence_level,
  active              = excluded.active,
  dataset_version     = excluded.dataset_version;

-- ----------------------------------------------------------------------------
-- Privileges: factor catalog is read-only for authenticated direct clients.
-- (Grants already applied in 001 for this table.)
-- ----------------------------------------------------------------------------
