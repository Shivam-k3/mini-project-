/**
 * Simulation serializer (Phase 3D).
 *
 * Maps a PostgreSQL `public.simulations` row into the Mongo-document API shape
 * the frontend/API contract expects, so the response contract is unchanged
 * after migrating the data store:
 *
 *   id         -> `_id`
 *   user_id    -> `user`
 *   baseline   -> baseline   (jsonb, structure preserved exactly)
 *   changes    -> changes    (jsonb, structure preserved exactly)
 *   results    -> results    (jsonb, structure preserved exactly)
 *   created_at -> createdAt
 */
function toApiSimulation(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    name: row.name,
    baseline: row.baseline || {},
    changes: row.changes || {},
    results: row.results || {},
    createdAt: row.created_at,
  };
}

module.exports = { toApiSimulation };
