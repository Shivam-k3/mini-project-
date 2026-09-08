/**
 * Repository/data-access layer index (Phase 3A).
 *
 * Central export point so route modules (and tests) import one seam instead of
 * scattering raw Supabase queries. Each repository enforces tenancy derived from
 * the authenticated profile context (see tenancyContext.js) — never from client
 * input.
 */
const supabaseClient = require('./supabaseClient');
const tenancyContext = require('./tenancyContext');

const profileRepository = require('./profileRepository');
const adminProfileRepository = require('./adminProfileRepository');
const organizationRepository = require('./organizationRepository');
const departmentRepository = require('./departmentRepository');
const carbonRepository = require('./carbonRepository');
const mobilityTwinRepository = require('./mobilityTwinRepository');
const simulationRepository = require('./simulationRepository');
const challengeRepository = require('./challengeRepository');
const gamificationRepository = require('./gamificationRepository');
const announcementRepository = require('./announcementRepository');
const emissionFactorRepository = require('./emissionFactorRepository');

module.exports = {
  supabaseClient,
  tenancyContext,
  profileRepository,
  adminProfileRepository,
  profileSerializer: require('./profileSerializer'),
  organizationRepository,
  departmentRepository,
  carbonRepository,
  mobilityTwinRepository,
  simulationRepository,
  challengeRepository,
  gamificationRepository,
  announcementRepository,
  emissionFactorRepository,
};
