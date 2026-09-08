/**
 * Mobility Twin serializer (Phase 3C).
 *
 * Maps a PostgreSQL `public.mobility_twins` row into the Mongo-document API
 * shape the frontend already consumes, so the HTTP response contract is
 * unchanged after migrating the data store:
 *
 *   id              -> `_id`
 *   user_id         -> `user`
 *   vehicle_profile -> vehicleProfile
 *   model_metadata  -> modelMetadata
 *   derived_at      -> derivedAt
 *   baseline        -> baseline (jsonb, already camelCase from the twin engine)
 *   scenarios       -> scenarios (jsonb array; each scenario keeps its `_id`)
 *   created_at      -> createdAt / updated_at -> updatedAt
 *
 * The `baseline` / `vehicleProfile` / `model_metadata` objects written by the
 * twin engine already use Mongo-camelCase keys, so they pass through verbatim.
 */
function toApiTwin(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    baseline: row.baseline || {},
    vehicleProfile: row.vehicle_profile || {},
    scenarios: row.scenarios || [],
    modelMetadata: row.model_metadata || {},
    derivedAt: row.derived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Assign a unique `_id` string to a saved scenario so the frontend (which keys
 * scenario lists by `s._id`) and the DELETE-by-scenarioId endpoint keep working
 * now that scenarios live in a jsonb array rather than Mongo subdocuments.
 */
function withScenarioId(scenario) {
  if (!scenario) return scenario;
  if (scenario._id) return scenario;
  return { ...scenario, _id: (scenario.gid || (globalThis.crypto && globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID()
    : `scn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)) };
}

module.exports = { toApiTwin, withScenarioId };
