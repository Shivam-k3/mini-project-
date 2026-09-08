/**
 * Profile serializer (Phase 3G).
 *
 * Maps a PostgreSQL `public.profiles` row into the Mongo-User API shape the
 * college-admin / faculty frontend expects, so the response contract is
 * unchanged after the data store moves to PostgreSQL:
 *
 *   id            -> `_id`        (identifiers must stay `_id` for the UI)
 *   user_id       -> userId       (e.g. "CSE25001", "FAC001")
 *   organization_id-> collegeId
 *   department_id -> departmentId (POPULATED object { _id, name, code })
 *   first_login   -> firstLogin
 *   created_at    -> createdAt
 *   status / gamification preserved verbatim
 *
 * The frontend renders `u.departmentId.name` / `u.departmentId.code`, so a
 * resolved department is merged when available; otherwise departmentId is null
 * (the same "N/A" fallback the Mongo `.populate('departmentId')` produced when
 * a user had no department).
 */
function toApiUser(profile, dept) {
  if (!profile) return null;
  return {
    _id: profile.id,
    id: profile.id,
    userId: profile.user_id || '',
    name: profile.name || '',
    email: profile.email || '',
    role: profile.role || 'individual',
    collegeId: profile.organization_id || null,
    departmentId: dept ? { _id: dept.id, name: dept.name, code: dept.code } : null,
    semester: profile.semester || '',
    section: profile.section || '',
    firstLogin: !!profile.first_login,
    status: profile.status || 'active',
    profile: profile.profile || null,
    gamification: profile.gamification || {},
    createdAt: profile.created_at,
  };
}

module.exports = { toApiUser };
