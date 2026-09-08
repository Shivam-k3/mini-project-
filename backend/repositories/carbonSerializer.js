/**
 * Carbon entry serializer (Phase 3B).
 *
 * Maps a PostgreSQL `public.carbon_entries` row into the Mongo-document API
 * shape the frontend already consumes, so the HTTP response contract is
 * unchanged after migrating the data store:
 *
 *   id (uuid)                -> `_id`      (frontend keys lists by `e._id`)
 *   transport_personal       -> transportPersonal
 *   transport_household      -> transportHousehold
 *   mode_breakdown           -> modeBreakdown
 *   total_emissions          -> totalEmissions
 *   legacy / notes           -> legacy / notes
 *   created_at / updated_at  -> createdAt / updatedAt
 *
 * `breakdown: { transport: personal }` is synthesized for the legacy dashboard
 * trend / category aggregates that previously read the stored `breakdown`
 * object. `date` is kept as an ISO timestamp string; the frontend parses it
 * with `new Date()`.
 */
function toApiEntry(row) {
  if (!row) return null;
  const personal = Number(row.transport_personal) || 0;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    date: row.date,
    trips: row.trips || [],
    transportPersonal: personal,
    transportHousehold: Number(row.transport_household) || 0,
    modeBreakdown: row.mode_breakdown || {},
    totalEmissions: Number(row.total_emissions) || 0,
    legacy: row.legacy || {},
    notes: row.notes || '',
    breakdown: { transport: personal },
    organization_id: row.organization_id,
    department_id: row.department_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { toApiEntry };
