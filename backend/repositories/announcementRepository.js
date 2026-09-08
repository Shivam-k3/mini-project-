/**
 * Announcement repository (Phase 3A).
 *
 * Maps the Mongo `Announcement` model to the `public.announcements` table.
 *
 * Field mapping (Mongo -> PostgreSQL):
 *   title        -> title
 *   content      -> content
 *   collegeId    -> organization_id (NULL = global/platform-wide) (NOTE: renamed)
 *   createdBy    -> created_by (profiles.id uuid)
 *   timestamps   -> created_at / updated_at
 *
 * Reads scope to platform + the actor's organization. The creator is always the
 * authenticated profile id — never a client-supplied value.
 */
const { client } = require('./supabaseClient');

const ANN_COLUMNS =
  'id, title, content, organization_id, created_by, created_at, updated_at';

function tenancyError(msg) {
  const e = new Error(msg);
  e.name = 'TenancyError';
  e.status = 403;
  return e;
}

/** List announcements visible to the actor: platform + their organization. */
async function listVisible(tenant, opts = {}) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  let q = client().from('announcements').select(ANN_COLUMNS).order('created_at', { ascending: false });
  if (tenant.organizationId) {
    q = q.or(`organization_id.is.null,organization_id.eq.${tenant.organizationId}`);
  } else {
    q = q.is('organization_id', null);
  }
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** List ALL announcements (admin/platform). */
async function listAll(opts = {}) {
  let q = client().from('announcements').select(ANN_COLUMNS).order('created_at', { ascending: false });
  if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Create an announcement. organization_id NULL = global. Creator is authenticated user. */
async function create(tenant, input) {
  if (!tenant?.profileId) throw tenancyError('Authenticated tenant context required');
  const organizationId = input.organizationId ?? tenant.organizationId ?? null;
  const { data, error } = await client().from('announcements').insert({
    title: input.title,
    content: input.content,
    organization_id: organizationId,
    created_by: tenant.profileId,
  }).select(ANN_COLUMNS).single();
  if (error) throw error;
  return data;
}

module.exports = { listVisible, listAll, create };
