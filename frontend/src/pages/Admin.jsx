import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { superAdminAPI, collegeAdminAPI } from '../services/api';
import toast from 'react-hot-toast';
import { AdminSkeleton } from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  FiPlus, FiUsers, FiSliders, FiShield, FiFileText, FiLayers, FiAlertCircle, 
  FiRefreshCw, FiTrash2, FiUserCheck, FiUserX, FiUpload, FiDownload, FiX, FiCheckCircle,
  FiGlobe, FiBriefcase, FiUserPlus, FiLock, FiAward, FiCalendar, FiServer, FiBookOpen
} from 'react-icons/fi';

export default function Admin() {
  const { user } = useAuth();

  if (user?.role === 'super_admin') {
    return <SuperAdminWorkspace />;
  } else if (user?.role === 'college_admin') {
    return <CollegeAdminWorkspace />;
  } else {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <FiShield size={40} className="text-ink-300 dark:text-ink-600 mb-3" />
        <h2 className="text-xl font-bold text-ink-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-ink-400 mt-2">Only administrators can access this page.</p>
      </div>
    );
  }
}

// =================================================================
// 1. SUPER ADMIN WORKSPACE
// =================================================================
function SuperAdminWorkspace() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('colleges');

  // Form states
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState(null);

  const [collegeForm, setCollegeForm] = useState({ name: '', code: '', address: '', plan: 'Standard', expiresAt: '' });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  // Global Announcement
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({ open: false, type: '', targetId: null });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'colleges') {
        const { data } = await superAdminAPI.getColleges();
        setColleges(data);
      } else if (activeTab === 'announcements') {
        const { data } = await superAdminAPI.getAnnouncements();
        setAnnouncements(data);
      }
    } catch (err) {
      toast.error('Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollege = async (e) => {
    e.preventDefault();
    try {
      await superAdminAPI.createCollege(collegeForm);
      toast.success('College created successfully!');
      setShowCollegeModal(false);
      setCollegeForm({ name: '', code: '', address: '', plan: 'Standard', expiresAt: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create college.');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await superAdminAPI.provisionAdmin(selectedCollege._id, adminForm);
      toast.success('College Admin provisioned! ID auto-generated.');
      setShowAdminModal(false);
      setAdminForm({ name: '', email: '', password: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to provision admin.');
    }
  };

  const handleToggleCollegeStatus = async (college) => {
    const nextStatus = college.status === 'active' ? 'suspended' : 'active';
    try {
      await superAdminAPI.updateCollege(college._id, { status: nextStatus });
      toast.success(`College status set to ${nextStatus}`);
      fetchData();
    } catch {
      toast.error('Failed to update college status.');
    }
  };

  const handleDeleteCollege = async (id) => {
    setConfirmState({ open: true, type: 'deleteCollege', targetId: id });
  };

  const executeConfirm = async () => {
    const { type, targetId } = confirmState;
    setConfirmState({ open: false, type: '', targetId: null });
    try {
      if (type === 'deleteCollege') {
        await superAdminAPI.deleteCollege(targetId);
        toast.success('College deleted successfully');
        fetchData();
      } else if (type === 'resetPassword') {
        await collegeAdminAPI.resetPassword(targetId);
        toast.success('Password reset to Temp@123');
      } else if (type === 'deleteUser') {
        await collegeAdminAPI.deleteUser(targetId);
        toast.success('Account deleted successfully');
        fetchData();
      }
    } catch {
      toast.error('Operation failed');
    }
  };

  const CONFIRM_CONFIG = {
    deleteCollege: { title: 'Delete College?', message: 'Are you absolutely sure? This will delete all departments, users, and carbon entries for this college!', confirmLabel: 'Delete College', danger: true },
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await superAdminAPI.createAnnouncement(newAnnouncement);
      toast.success('Global announcement posted!');
      setNewAnnouncement({ title: '', content: '' });
      fetchData();
    } catch {
      toast.error('Failed to post announcement.');
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <ConfirmDialog
        open={confirmState.open}
        title={CONFIRM_CONFIG[confirmState.type]?.title || ''}
        message={CONFIRM_CONFIG[confirmState.type]?.message || ''}
        confirmLabel={CONFIRM_CONFIG[confirmState.type]?.confirmLabel || 'Confirm'}
        danger={CONFIRM_CONFIG[confirmState.type]?.danger || false}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState({ open: false, type: '', targetId: null })}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">
            <FiGlobe size={12} /> Platform · Tenant Governance
          </p>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white mt-1">Super Admin Console</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Configure tenant licenses, colleges, and global settings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'colleges' && (
            <button onClick={() => setShowCollegeModal(true)} className="btn-primary py-2 px-4 text-xs font-bold">
              <FiPlus size={14} /> Register College
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <div className="tab-strip w-max">
          <button
            onClick={() => setActiveTab('colleges')}
            className={`flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'colleges' ? 'tab-item-active' : 'tab-item'}`}
          >
            <FiServer size={13} /> Tenants (Colleges)
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'announcements' ? 'tab-item-active' : 'tab-item'}`}
          >
            <FiFileText size={13} /> Announcements
          </button>
        </div>
      </div>

      {loading ? <AdminSkeleton /> : activeTab === 'colleges' ? (
        <div className="card overflow-x-auto !p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>College Name</th>
                <th>Admin Name</th>
                <th>Users (Stud / Fac)</th>
                <th>License / Plan</th>
                <th>Status</th>
                <th className="!text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c._id}>
                  <td className="font-bold text-eco-600 dark:text-eco-400">{c.code}</td>
                  <td className="font-semibold text-ink-900 dark:text-white">{c.name}</td>
                  <td>
                    {c.admin ? (
                      <div>
                        <span className="font-semibold block">{c.admin.name}</span>
                        <span className="text-[10px] text-ink-400 font-mono">{c.admin.userId}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSelectedCollege(c); setShowAdminModal(true); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-eco-700 dark:text-eco-400 hover:underline"
                      >
                        <FiUserPlus size={12} /> Assign Admin
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5">
                        <FiUsers size={12} className="text-ink-400" /> {c.studentCount} Students
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FiBriefcase size={12} className="text-ink-400" /> {c.facultyCount} Faculty
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge-neutral">{c.license?.plan}</span>
                    <span className="text-[9px] block text-ink-400 mt-1">Expires: {new Date(c.license?.expiresAt).toLocaleDateString()}</span>
                  </td>
                  <td>
                    <span className={c.status === 'active' ? 'badge-eco' : 'badge-amber'}>
                      {c.status}
                    </span>
                  </td>
                  <td className="!text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleCollegeStatus(c)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                          c.status === 'active'
                            ? 'border-warn-300 text-warn-600 hover:bg-warn-50 dark:border-warn-700/60 dark:text-warn-400 dark:hover:bg-warn-500/10'
                            : 'border-eco-200 text-eco-600 hover:bg-eco-50 dark:border-eco-800 dark:text-eco-400 dark:hover:bg-eco-500/10'
                        }`}
                        title={c.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                      >
                        {c.status === 'active' ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteCollege(c._id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-high-200 text-high-600 hover:bg-high-50 dark:border-ink-700 dark:text-high-400 dark:hover:bg-high-500/10 transition-colors"
                        title="Delete College"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {colleges.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-ink-400">No colleges registered. Click "Register College" to start.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Announcement Form */}
          <div className="card h-fit">
            <div className="flex items-center gap-2 mb-5">
              <FiBookOpen size={14} className="text-eco-600 dark:text-eco-400" />
              <p className="section-label !mb-0">Post Global Announcement</p>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="input-label">Title</label>
                <input
                  type="text"
                  className="input-field"
                  aria-label="Announcement Title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Message Content</label>
                <textarea
                  rows="4"
                  className="input-field"
                  aria-label="Announcement Message Content"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2 text-xs font-bold">
                Publish Announcement
              </button>
            </form>
          </div>

          {/* Announcements List */}
          <div className="card lg:col-span-2 space-y-4">
            <p className="section-label">Active Global Announcements</p>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a._id} className="p-4 rounded-lg border border-ink-100 dark:border-ink-800 bg-surface-2 dark:bg-ink-900">
                    <div className="flex items-center gap-2">
                      <FiFileText size={13} className="text-eco-600 dark:text-eco-400 shrink-0" />
                      <h4 className="text-sm font-bold text-ink-900 dark:text-white">{a.title}</h4>
                    </div>
                    <p className="text-xs text-ink-600 dark:text-ink-300 mt-2 leading-relaxed">{a.content}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-ink-400">
                      <span>By: {a.createdBy?.name || 'System'}</span>
                      <span>{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-ink-400 py-10 text-xs">No global announcements posted.</p>
            )}
          </div>
        </div>
      )}

      {/* College Modal */}
      {showCollegeModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-ink-900 dark:text-white">Register New College</h3>
              <button onClick={() => setShowCollegeModal(false)} aria-label="Close dialog" className="text-ink-400 hover:text-ink-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCollege} className="space-y-4">
              <div>
                <label className="input-label">College Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Greenwood University"
                  aria-label="College Name"
                  value={collegeForm.name}
                  onChange={(e) => setCollegeForm({ ...collegeForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Short Code</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. GWU"
                    aria-label="Short Code"
                    value={collegeForm.code}
                    onChange={(e) => setCollegeForm({ ...collegeForm, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Subscription Plan</label>
                  <select
                    className="input-field py-2"
                    aria-label="Subscription Plan"
                    value={collegeForm.plan}
                    onChange={(e) => setCollegeForm({ ...collegeForm, plan: e.target.value })}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Address</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="City, Country"
                  aria-label="College Address"
                  value={collegeForm.address}
                  onChange={(e) => setCollegeForm({ ...collegeForm, address: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                Submit Registry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-ink-900 dark:text-white">Provision College Admin</h3>
              <button onClick={() => setShowAdminModal(false)} aria-label="Close dialog" className="text-ink-400 hover:text-ink-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-eco-700 dark:text-eco-400 mb-4">
              <FiServer size={12} /> College: {selectedCollege?.name}
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="input-label">Administrator Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Prof. David"
                  aria-label="Administrator Name"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Institutional Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="admin@gwuniversity.edu"
                  aria-label="Institutional Email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Temporary Password</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Leave empty for Temp@123"
                  aria-label="Temporary Password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <FiLock size={10} /> Password defaults to <code className="font-mono font-semibold">Temp@123</code> if left empty.
              </p>
              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                Provision Admin Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// 2. COLLEGE ADMIN WORKSPACE
// =================================================================
function CollegeAdminWorkspace() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals / Forms
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'student', departmentId: '', semester: '', section: '' });

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvResult, setCsvResult] = useState(null);

  // Challenges
  const [challenges, setChallenges] = useState([]);
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', category: 'general', points: 50 });

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({ open: false, type: '', targetId: null });

  useEffect(() => {
    fetchDepartments();
    fetchData();
  }, [activeTab, search, roleFilter, deptFilter]);

  const fetchDepartments = async () => {
    try {
      const { data } = await collegeAdminAPI.getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const params = {
          role: roleFilter,
          search: search || undefined,
          departmentId: deptFilter || undefined
        };
        const { data } = await collegeAdminAPI.getUsers(params);
        setUsers(data);
      } else if (activeTab === 'challenges') {
        const { data } = await collegeAdminAPI.getChallenges();
        setChallenges(data);
      }
    } catch (err) {
      toast.error('Failed to load accounts list.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await collegeAdminAPI.createDepartment(deptForm);
      toast.success('Department created successfully!');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await collegeAdminAPI.createUser(userForm);
      toast.success('Account provisioned successfully! ID auto-generated.');
      setShowUserModal(false);
      setUserForm({ name: '', email: '', role: 'student', departmentId: '', semester: '', section: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to provision user.');
    }
  };

  const handleResetPassword = async (id) => {
    setConfirmState({ open: true, type: 'resetPassword', targetId: id });
  };

  const handleToggleUserStatus = async (userAcc) => {
    const nextStatus = userAcc.status === 'active' ? 'suspended' : 'active';
    try {
      await collegeAdminAPI.updateUser(userAcc._id, { status: nextStatus });
      toast.success(`Account set to ${nextStatus}`);
      fetchData();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDeleteUser = async (id) => {
    setConfirmState({ open: true, type: 'deleteUser', targetId: id });
  };

  const executeConfirm = async () => {
    const { type, targetId } = confirmState;
    setConfirmState({ open: false, type: '', targetId: null });
    try {
      if (type === 'resetPassword') {
        await collegeAdminAPI.resetPassword(targetId);
        toast.success('Password reset to Temp@123');
      } else if (type === 'deleteUser') {
        await collegeAdminAPI.deleteUser(targetId);
        toast.success('Account deleted successfully');
        fetchData();
      }
    } catch {
      toast.error('Operation failed');
    }
  };

  const CONFIRM_CONFIG = {
    resetPassword: { title: 'Reset Password?', message: 'Reset password to default "Temp@123"? User will be forced to change it on next login.', confirmLabel: 'Reset Password', danger: false },
    deleteUser: { title: 'Delete User?', message: 'Are you sure? This will delete this user and all their logged carbon activities!', confirmLabel: 'Delete User', danger: true },
  };

  const handleCSVImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return toast.error('Please enter CSV data.');
    try {
      const { data } = await collegeAdminAPI.importStudents(csvText);
      setCsvResult(data);
      if (data.success) {
        toast.success(`Successfully imported ${data.importedCount} students!`);
        setCsvText('');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed.');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      await collegeAdminAPI.createChallenge(newChallenge);
      toast.success('Sustainability challenge created!');
      setNewChallenge({ title: '', description: '', category: 'general', points: 50 });
      fetchData();
    } catch {
      toast.error('Failed to create challenge.');
    }
  };

  // CSV Template download helper
  const downloadCSVTemplate = () => {
    const template = 'Name,Email,DepartmentCode,Semester,Section\nJane Doe,jane@mit.edu,CSE,3,A\nJohn Smith,john@mit.edu,ECE,5,B';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <ConfirmDialog
        open={confirmState.open}
        title={CONFIRM_CONFIG[confirmState.type]?.title || ''}
        message={CONFIRM_CONFIG[confirmState.type]?.message || ''}
        confirmLabel={CONFIRM_CONFIG[confirmState.type]?.confirmLabel || 'Confirm'}
        danger={CONFIRM_CONFIG[confirmState.type]?.danger || false}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState({ open: false, type: '', targetId: null })}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">
            <FiUsers size={12} /> Organization · Access Governance
          </p>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white mt-1">Campus Administration</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Manage institutional departments, staff, students, and events.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'users' && (
            <>
              <button onClick={() => setShowDeptModal(true)} className="btn-secondary py-2 px-4 text-xs font-bold">
                <FiLayers size={13} /> New Department
              </button>
              <button onClick={() => setShowUserModal(true)} className="btn-primary py-2 px-4 text-xs font-bold">
                <FiPlus size={14} /> Provision User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <div className="tab-strip w-max">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'users' ? 'tab-item-active' : 'tab-item'}`}
          >
            <FiUserCheck size={13} /> Institutional Accounts
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'import' ? 'tab-item-active' : 'tab-item'}`}
          >
            <FiUpload size={13} /> CSV Batch Import
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'challenges' ? 'tab-item-active' : 'tab-item'}`}
          >
            <FiAward size={13} /> Campus Challenges
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="surface-soft p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <FiSliders size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by ID, name, or email..."
                aria-label="Search users by ID, name, or email"
                className="input-field py-2 text-xs pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input-field py-2 text-xs md:w-40"
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="faculty">Faculty Only</option>
              <option value="student">Students Only</option>
            </select>
            <select
              className="input-field py-2 text-xs md:w-48"
              aria-label="Filter by department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          {loading ? <AdminSkeleton /> : (
            <div className="card overflow-x-auto !p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td className="font-bold text-ink-900 dark:text-white font-mono">{u.userId}</td>
                      <td className="font-semibold text-ink-900 dark:text-white">{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.departmentId ? `${u.departmentId.name} (${u.departmentId.code})` : 'N/A'}</td>
                      <td>
                        <span className={`capitalize ${u.role === 'faculty' ? 'badge-blue' : 'badge-eco'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={u.status === 'active' ? 'badge-eco' : 'badge-amber'}>
                          {u.status}
                        </span>
                      </td>
                      <td className="!text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(u._id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 transition-colors"
                            title="Reset Password to Temp@123"
                          >
                            <FiRefreshCw size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                              u.status === 'active'
                                ? 'border-warn-300 text-warn-600 hover:bg-warn-50 dark:border-warn-700/60 dark:text-warn-400 dark:hover:bg-warn-500/10'
                                : 'border-eco-200 text-eco-600 hover:bg-eco-50 dark:border-eco-800 dark:text-eco-400 dark:hover:bg-eco-500/10'
                            }`}
                            title={u.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                          >
                            {u.status === 'active' ? <FiUserX size={13} /> : <FiUserCheck size={13} />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-high-200 text-high-600 hover:bg-high-50 dark:border-ink-700 dark:text-high-400 dark:hover:bg-high-500/10 transition-colors"
                            title="Delete User"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-ink-400">No users found. Click "Provision User" to create one.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-label !mb-0">CSV Batch Provision</h3>
              <button
                onClick={downloadCSVTemplate}
                className="inline-flex items-center gap-1 text-[10px] text-eco-700 dark:text-eco-400 hover:underline font-semibold"
              >
                <FiDownload size={12} /> Template
              </button>
            </div>

            <form onSubmit={handleCSVImport} className="space-y-4">
              <p className="text-[10px] text-ink-500 leading-relaxed font-medium">
                Copy and paste student details in CSV format below. Columns:{' '}
                <code className="font-mono">Name,Email,DepartmentCode,Semester,Section</code>
              </p>

              <textarea
                className="input-field font-mono text-[10px]"
                rows="10"
                aria-label="Paste student records in CSV format: Name,Email,DepartmentCode,Semester,Section"
                placeholder="Jane Doe,jane@mit.edu,CSE,3,A&#10;John Smith,john@mit.edu,ECE,5,B"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                required
              />

              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                <FiUpload size={14} /> Import & Provision Accounts
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2">
            <h3 className="section-label">Import Log / Results</h3>
            {csvResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 rounded-lg border border-eco-200 dark:border-eco-900 bg-eco-50 dark:bg-eco-500/10 p-4">
                  <FiCheckCircle size={18} className="text-eco-600 dark:text-eco-400 shrink-0" />
                  <span className="text-xs font-bold text-eco-700 dark:text-eco-400">
                    Successfully imported {csvResult.importedCount} student accounts!
                  </span>
                </div>

                {csvResult.errors?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-high-600 dark:text-high-400">
                      <FiAlertCircle size={13} /> Warnings / Failures ({csvResult.errors.length})
                    </h4>
                    <div className="p-3 rounded-lg bg-high-50 dark:bg-high-500/5 border border-high-200 dark:border-high-800/40 max-h-48 overflow-y-auto space-y-1 text-[10px] font-mono text-high-700 dark:text-high-300">
                      {csvResult.errors.map((e, idx) => (
                        <div key={idx}>• {e}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-ink-400 py-24 text-xs font-medium">No batch imports executed yet. Paste details on the left to start.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card h-fit">
            <h3 className="section-label">Create Campus Challenge</h3>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div>
                <label className="input-label">Challenge Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Zero-Waste Wednesday"
                  aria-label="Challenge Title"
                  value={newChallenge.title}
                  onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Description</label>
                <textarea
                  rows="3"
                  className="input-field"
                  placeholder="e.g. Limit daily waste to zero by avoiding single use plastics."
                  aria-label="Challenge Description"
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Green Points</label>
                  <input
                    type="number"
                    className="input-field"
                    aria-label="Green Points"
                    value={newChallenge.points}
                    onChange={(e) => setNewChallenge({ ...newChallenge, points: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Category</label>
                  <select
                    className="input-field py-2"
                    aria-label="Challenge Category"
                    value={newChallenge.category}
                    onChange={(e) => setNewChallenge({ ...newChallenge, category: e.target.value })}
                  >
                    <option value="general">General</option>
                    <option value="transport">Transport</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                Deploy Challenge
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2 space-y-4">
            <h3 className="section-label">Campus Scoped Challenges</h3>
            {challenges.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {challenges.map((c) => (
                  <div key={c._id} className="p-4 rounded-lg border border-ink-100 dark:border-ink-800 bg-surface-2 dark:bg-ink-900 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-eco-700 dark:text-eco-400 capitalize tracking-wider">
                        <FiAward size={12} /> {c.category}
                      </span>
                      <h4 className="text-sm font-bold text-ink-900 dark:text-white mt-1">{c.title}</h4>
                      <p className="text-[11px] text-ink-600 dark:text-ink-300 mt-2 font-medium leading-relaxed">{c.description}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-surface-2 dark:bg-ink-900 p-3 text-xs">
                      <span className="flex items-center gap-1.5 font-bold text-eco-700 dark:text-eco-400">
                        <FiAward size={14} /> {c.points} Points
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-ink-400">
                        <FiCalendar size={12} /> {c.duration} Days
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-ink-400 py-10 text-xs">No campus-wide challenges deployed.</p>
            )}
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-ink-900 dark:text-white">Create Department</h3>
              <button onClick={() => setShowDeptModal(false)} aria-label="Close dialog" className="text-ink-400 hover:text-ink-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-4">
              <div>
                <label className="input-label">Department Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Computer Science"
                  aria-label="Department Name"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Short Code</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. CSE"
                  aria-label="Department Short Code"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                Deploy Department
              </button>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-ink-900 dark:text-white">Provision User Account</h3>
              <button onClick={() => setShowUserModal(false)} aria-label="Close dialog" className="text-ink-400 hover:text-ink-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Role Type</label>
                  <select
                    className="input-field py-2"
                    aria-label="Role Type"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Department</label>
                  <select
                    className="input-field py-2"
                    aria-label="Department"
                    value={userForm.departmentId}
                    onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                    required={userForm.role === 'student'}
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  aria-label="User Full Name"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="input-label">Institutional Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="e.g. john@mit.edu"
                  aria-label="User Institutional Email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>

              {userForm.role === 'student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                  <div>
                    <label className="input-label">Semester</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 3"
                      aria-label="Semester"
                      value={userForm.semester}
                      onChange={(e) => setUserForm({ ...userForm, semester: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Section</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. A"
                      aria-label="Section"
                      value={userForm.section}
                      onChange={(e) => setUserForm({ ...userForm, section: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <p className="flex items-start gap-1.5 text-[10px] text-ink-400">
                <FiLock size={10} className="mt-0.5 shrink-0" />
                <span>Password defaults to <code className="font-mono font-semibold">Temp@123</code> and the user will be forced to change it on their first login.</span>
              </p>

              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold">
                Provision User
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}