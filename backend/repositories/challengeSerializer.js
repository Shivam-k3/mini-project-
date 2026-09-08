/**
 * Challenge serializer (Phase 3E).
 *
 * Maps a PostgreSQL `public.challenges` row into the Mongo-document API shape
 * the frontend/API contract expects, so the response contract is unchanged
 * after migrating the data store:
 *
 *   id              -> `_id`
 *   target_reduction-> targetReduction
 *   duration_days   -> duration
 *   is_active       -> isActive
 *   week_number     -> weekNumber
 *   organization_id -> collegeId
 *   department_id   -> departmentId
 *   created_at      -> createdAt
 *
 * title / description / category / points / badge are preserved verbatim.
 */
function toApiChallenge(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'general',
    points: row.points ?? 50,
    targetReduction: row.target_reduction ?? 10,
    duration: row.duration_days ?? 7,
    badge: row.badge || '',
    isActive: row.is_active ?? true,
    weekNumber: row.week_number ?? null,
    collegeId: row.organization_id ?? null,
    departmentId: row.department_id ?? null,
    createdAt: row.created_at,
  };
}

module.exports = { toApiChallenge };
