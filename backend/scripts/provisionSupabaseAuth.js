require('dotenv').config();

const supabase = require('../services/supabase');

// ---------------------------------------------------------------------------
// Controlled test-user provisioning (Phase 3H — Supabase Auth + PostgreSQL only).
//
// Reflects the accounts seedHelper used to mirror in Mongo; MongoDB is fully
// retired, so only the two live layers are written:
//   1. Supabase Auth  (auth.users)   — credential owner
//   2. PostgreSQL     (public.profiles) — application identity/tenancy
//
// Idempotent: existing users/profiles are updated in place, never duplicated,
// never deleted. PASSWORDS are only applied on first creation (Supabase does not
// let admins re-read old passwords), so use this as a provisioner, not a rotator.
//
// Usage (from backend/):
//   node scripts/provisionSupabaseAuth.js
//
// Requires backend/.env with SUPABASE_URL + SUPABASE_SECRET_KEY. Secrets are read
// from env only and never printed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mirrors of the Mongo seed accounts (see scripts/seedHelper.js). Keep these in
// sync with the account list documented for Playwright/manual testing.
// orgCode NULL => personal (individual). orgCode 'MIT' => organization member.
// ---------------------------------------------------------------------------
const ACCOUNTS = [
  {
    email: 'super@ecoguardian.ai',
    password: 'admin123',
    userId: 'SUPER001',
    name: 'Super Admin',
    role: 'super_admin',
    orgCode: null,
    deptCode: null,
    semester: '',
    section: '',
    firstLogin: false,
    status: 'active',
  },
  {
    email: 'admin@ecoguardian.ai',
    password: 'admin123',
    userId: 'ADMIN001',
    name: 'MIT Campus Admin',
    role: 'college_admin',
    orgCode: 'MIT',
    deptCode: null,
    semester: '',
    section: '',
    firstLogin: false,
    status: 'active',
  },
  {
    email: 'sarah@mit.edu',
    password: 'Temp@123',
    userId: 'FAC001',
    name: 'Dr. Sarah Smith',
    role: 'faculty',
    orgCode: 'MIT',
    deptCode: 'CSE',
    semester: '',
    section: '',
    firstLogin: true,
    status: 'active',
  },
  {
    email: 'demo@ecoguardian.ai',
    password: 'demo123',
    userId: 'CSE25001',
    name: 'Jane Doe',
    role: 'student',
    orgCode: 'MIT',
    deptCode: 'CSE',
    semester: '3',
    section: 'A',
    firstLogin: false,
    status: 'active',
  },
  {
    email: 'alex.personal@example.com',
    password: 'Test@12345',
    userId: 'PERSONAL001',
    name: 'Alex Personal',
    role: 'individual',
    orgCode: null,
    deptCode: null,
    semester: '',
    section: '',
    firstLogin: false,
    status: 'active',
  },
];

function ensureConfigured() {
  if (!supabase.isConfigured()) {
    console.error('Supabase not configured. Set SUPABASE_URL + SUPABASE_SECRET_KEY in backend/.env.');
    process.exit(1);
  }
}

/** Find a Supabase auth user id by email (idempotent lookup). */
async function findAuthUserIdByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const hit = (data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  return hit ? hit.id : null;
}

/** Create a Supabase auth user, returning its id (or existing id if present). */
async function ensureAuthUser(admin, account) {
  const existingId = await findAuthUserIdByEmail(admin, account.email);
  if (existingId) {
    console.log(`  auth exists   ${account.email} -> id ${existingId.slice(0, 8)}…`);
    return existingId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${account.email}): ${error.message}`);
  console.log(`  auth created  ${account.email} -> id ${data.user.id.slice(0, 8)}…`);
  return data.user.id;
}

/** Create/select the PG organization + department used by tenant accounts. */
async function ensureOrgDept() {
  // organization
  let { data: orgRows, error: orgErr } = await supabase.profilesClient()
    .from('organizations')
    .select('id, code')
    .eq('code', 'MIT')
    .limit(1);
  if (orgErr) throw orgErr;
  let orgId = orgRows?.[0]?.id || null;
  if (!orgId) {
    const { data, error } = await supabase.profilesClient()
      .from('organizations')
      .insert({ name: 'Metro Institute of Technology', code: 'MIT', address: '100 University Ave, Metro City' })
      .select();
    if (error) throw new Error(`createOrganization(MIT): ${error.message}`);
    orgId = data[0].id;
    console.log(`  org created   MIT -> ${orgId.slice(0, 8)}…`);
  }

  // department CSE under MIT
  let deptId = null;
  if (true) {
    let { data: deptRows } = await supabase.profilesClient()
      .from('departments')
      .select('id, code, organization_id')
      .eq('organization_id', orgId)
      .eq('code', 'CSE')
      .limit(1);
    if (!deptRows?.length) {
      const { data, error } = await supabase.profilesClient()
        .from('departments')
        .insert({ organization_id: orgId, name: 'Computer Science & Engineering', code: 'CSE' })
        .select();
      if (error) throw new Error(`createDepartment(CSE): ${error.message}`);
      deptId = data[0].id;
      console.log(`  dept created  CSE -> ${deptId.slice(0, 8)}…`);
    } else {
      deptId = deptRows[0].id;
    }
  }
  return { orgId, deptId };
}

/** Upsert a public.profiles row keyed by auth_user_id (and unique user_id). */
async function upsertProfile(account, authUserId, orgId, deptId) {
  const row = {
    auth_user_id: authUserId,
    user_id: account.userId,
    name: account.name,
    email: account.email,
    role: account.role,
    organization_id: account.orgCode ? orgId : null,
    department_id: account.deptCode ? deptId : null,
    semester: account.semester,
    section: account.section,
    first_login: account.firstLogin,
    status: account.status,
    profile: {},
    gamification: {},
  };

  const existing = await supabase.profilesClient()
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .limit(1);

  if (existing.data?.length) {
    const { error } = await supabase.profilesClient()
      .from('profiles')
      .update(row)
      .eq('auth_user_id', authUserId);
    if (error) throw new Error(`updateProfile(${account.email}): ${error.message}`);
    console.log(`  profile upsrt ${account.email} (${account.role})`);
  } else {
    const { error } = await supabase.profilesClient()
      .from('profiles')
      .insert(row);
    if (error) throw new Error(`insertProfile(${account.email}): ${error.message}`);
    console.log(`  profile create ${account.email} (${account.role})`);
  }
}

async function main() {
  ensureConfigured();
  const admin = supabase.adminClient();
  const { orgId, deptId } = await ensureOrgDept();
  console.log(`Provisioning ${ACCOUNTS.length} controlled test accounts…`);

  for (const account of ACCOUNTS) {
    const authUserId = await ensureAuthUser(admin, account);
    await upsertProfile(account, authUserId, orgId, deptId);
  }
  console.log('\nDone. Verify with `node scripts/verifySupabaseAuth.js` (see tests).');
}

main().catch((err) => {
  console.error('Provisioning failed:', err.message);
  process.exit(1);
});
