import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { superAdminAPI, collegeAdminAPI } from '../services/api';
import toast from 'react-hot-toast';
import { AdminSkeleton } from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  FiPlus, FiUsers, FiSliders, FiShield, FiFileText, FiLayers, FiAlertCircle, 
  FiRefreshCw, FiTrash2, FiUserCheck, FiUserX, FiUpload, FiDownload, FiCheck, FiX, FiCheckCircle
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
        <FiAlertCircle size={48} className="text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-400 mt-2">Only administrators can access this page.</p>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white font-Outfit">Super Admin Console</h1>
          <p className="text-xs text-gray-400 mt-1">Configure tenant licenses, colleges, and global settings.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'colleges' && (
            <button onClick={() => setShowCollegeModal(true)} className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1">
              <FiPlus size={16} /> Register College
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-gray-200 dark:border-gray-800 pb-px">
        <button 
          onClick={() => setActiveTab('colleges')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
            activeTab === 'colleges' ? 'border-eco-500 text-eco-500' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Tenants (Colleges)
        </button>
        <button 
          onClick={() => setActiveTab('announcements')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
            activeTab === 'announcements' ? 'border-eco-500 text-eco-500' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Announcements
        </button>
      </div>

      {loading ? <AdminSkeleton /> : activeTab === 'colleges' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-semibold">
                <th className="py-3">Code</th>
                <th>College Name</th>
                <th>Admin Name</th>
                <th>Users (Stud / Fac)</th>
                <th>License / Plan</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c._id} className="border-b border-gray-150 dark:border-gray-900 text-gray-600 dark:text-gray-300">
                  <td className="py-4 font-bold text-eco-500">{c.code}</td>
                  <td className="font-semibold text-gray-800 dark:text-white">{c.name}</td>
                  <td>
                    {c.admin ? (
                      <div>
                        <span className="font-semibold block">{c.admin.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{c.admin.userId}</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setSelectedCollege(c); setShowAdminModal(true); }}
                        className="text-eco-500 hover:underline font-bold text-[10px]"
                      >
                        + Assign Admin
                      </button>
                    )}
                  </td>
                  <td>👨‍🎓 {c.studentCount} / 🎓 {c.facultyCount}</td>
                  <td>
                    <span className="font-semibold">{c.license?.plan}</span>
                    <span className="text-[9px] block text-gray-400">Expires: {new Date(c.license?.expiresAt).toLocaleDateString()}</span>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                      c.status === 'active' ? 'bg-eco-100 text-eco-600 dark:bg-eco-500/10 dark:text-eco-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleToggleCollegeStatus(c)} 
                        className={`p-1.5 rounded-lg border ${
                          c.status === 'active' 
                            ? 'border-amber-200 text-amber-500 hover:bg-amber-50 dark:border-amber-900/30' 
                            : 'border-eco-200 text-eco-500 hover:bg-eco-50 dark:border-eco-900/30'
                        }`}
                        title={c.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                      >
                        {c.status === 'active' ? <FiUserX size={14} /> : <FiUserCheck size={14} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteCollege(c._id)} 
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30"
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
                  <td colSpan="7" className="text-center py-8 text-gray-400">No colleges registered. Click "Register College" to start.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Announcement Form */}
          <div className="card h-fit">
            <p className="section-label">Post Global Announcement</p>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Message Content</label>
                <textarea 
                  rows="4" 
                  className="input-field"
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
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a._id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-white font-Outfit">{a.title}</h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{a.content}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[9px] text-gray-400">
                    <span>By: {a.createdBy?.name || 'System'}</span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <p className="text-center text-gray-400 py-10 text-xs">No global announcements posted.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* College Modal */}
      {showCollegeModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800 dark:text-white font-Outfit">Register New College</h3>
              <button onClick={() => setShowCollegeModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCollege} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">College Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Greenwood University"
                  value={collegeForm.name}
                  onChange={(e) => setCollegeForm({ ...collegeForm, name: e.target.value })}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Short Code</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. GWU"
                    value={collegeForm.code}
                    onChange={(e) => setCollegeForm({ ...collegeForm, code: e.target.value })}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Subscription Plan</label>
                  <select 
                    className="input-field py-2"
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Address</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="City, Country"
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
              <h3 className="font-bold text-base text-gray-800 dark:text-white">Provision College Admin</h3>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            <p className="text-[11px] text-eco-600 dark:text-eco-400 font-semibold mb-3">College: {selectedCollege?.name}</p>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Administrator Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Prof. David"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Institutional Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="admin@gwuniversity.edu"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Temporary Password</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Leave empty for Temp@123"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                />
              </div>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white font-Outfit">Campus Administration</h1>
          <p className="text-xs text-gray-400 mt-1">Manage institutional departments, staff, students, and events.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'users' && (
            <>
              <button onClick={() => setShowDeptModal(true)} className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                <FiLayers size={14} /> New Department
              </button>
              <button onClick={() => setShowUserModal(true)} className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1">
                <FiPlus size={16} /> Provision User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-gray-200 dark:border-gray-800 pb-px">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
            activeTab === 'users' ? 'border-eco-500 text-eco-500' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Institutional Accounts
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
            activeTab === 'import' ? 'border-eco-500 text-eco-500' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          CSV Batch Import
        </button>
        <button 
          onClick={() => setActiveTab('challenges')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 px-1 ${
            activeTab === 'challenges' ? 'border-eco-500 text-eco-500' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Campus Challenges
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <input 
              type="text" 
              placeholder="Search by ID, name, or email..." 
              className="input-field py-2 text-xs flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select 
              className="input-field py-2 text-xs md:w-40"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="faculty">Faculty Only</option>
              <option value="student">Students Only</option>
            </select>
            <select 
              className="input-field py-2 text-xs md:w-48"
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
            <div className="card overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-semibold">
                    <th className="py-2.5">User ID</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-b border-gray-150 dark:border-gray-900 text-gray-600 dark:text-gray-300">
                      <td className="py-3.5 font-bold text-gray-850 dark:text-white font-mono">{u.userId}</td>
                      <td className="font-semibold text-gray-800 dark:text-white">{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.departmentId ? `${u.departmentId.name} (${u.departmentId.code})` : 'N/A'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] capitalize ${
                          u.role === 'faculty' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400' : 'bg-eco-100 text-eco-600 dark:bg-eco-500/10 dark:text-eco-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                          u.status === 'active' ? 'bg-eco-100 text-eco-600 dark:bg-eco-500/10 dark:text-eco-400' : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleResetPassword(u._id)}
                            className="p-1 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Reset Password to Temp@123"
                          >
                            <FiRefreshCw size={13} />
                          </button>
                          <button 
                            onClick={() => handleToggleUserStatus(u)} 
                            className={`p-1 rounded-lg border ${
                              u.status === 'active' 
                                ? 'border-amber-200 text-amber-500 hover:bg-amber-50 dark:border-amber-900/30' 
                                : 'border-eco-200 text-eco-500 hover:bg-eco-50 dark:border-eco-900/30'
                            }`}
                            title={u.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                          >
                            {u.status === 'active' ? <FiUserX size={13} /> : <FiUserCheck size={13} />}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u._id)}
                            className="p-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30"
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
                      <td colSpan="7" className="text-center py-8 text-gray-400">No users found. Click "Provision User" to create one.</td>
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
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CSV Batch Provision</h3>
              <button 
                onClick={downloadCSVTemplate}
                className="text-[10px] text-eco-500 hover:underline font-bold flex items-center gap-1"
              >
                <FiDownload /> Template
              </button>
            </div>
            
            <form onSubmit={handleCSVImport} className="space-y-4">
              <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                Copy and paste student details in CSV format below. 
                Columns: **`Name,Email,DepartmentCode,Semester,Section`**
              </p>
              
              <textarea 
                className="input-field font-mono text-[10px]" 
                rows="10" 
                placeholder="Jane Doe,jane@mit.edu,CSE,3,A&#10;John Smith,john@mit.edu,ECE,5,B"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                required
              />

              <button type="submit" className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5">
                <FiUpload size={14} /> Import & Provision Accounts
              </button>
            </form>
          </div>

          <div className="card lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Import Log / Results</h3>
            {csvResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-eco-600 bg-eco-50 dark:bg-eco-950/40 p-4 rounded-xl border border-eco-100 dark:border-eco-900">
                  <FiCheckCircle size={20} />
                  <span className="text-xs font-bold">Successfully imported {csvResult.importedCount} student accounts!</span>
                </div>

                {csvResult.errors?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-red-500 flex items-center gap-1">
                      <FiAlertCircle /> Warnings / Failures ({csvResult.errors.length})
                    </h4>
                    <div className="p-3 rounded-2xl bg-red-500/5 border border-red-500/10 max-h-48 overflow-y-auto space-y-1 text-[10px] font-mono text-red-600">
                      {csvResult.errors.map((e, idx) => (
                        <div key={idx}>• {e}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-24 text-xs font-medium">No batch imports executed yet. Paste details on the left to start.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card h-fit">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Create Campus Challenge</h3>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-455 uppercase tracking-wider mb-1">Challenge Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Zero-Waste Wednesday"
                  value={newChallenge.title}
                  onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-455 uppercase tracking-wider mb-1">Description</label>
                <textarea 
                  rows="3" 
                  className="input-field" 
                  placeholder="e.g. Limit daily waste to zero by avoiding single use plastics."
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-455 uppercase tracking-wider mb-1">Green Points</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newChallenge.points}
                    onChange={(e) => setNewChallenge({ ...newChallenge, points: Number(e.target.value) })}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-455 uppercase tracking-wider mb-1">Category</label>
                  <select 
                    className="input-field py-2"
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
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Campus Scoped Challenges</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((c) => (
                <div key={c._id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-eco-500 capitalize tracking-wider">{c.category}</span>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-white mt-1 font-Outfit">{c.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-2 font-medium leading-relaxed">{c.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-eco-600 bg-eco-50 dark:bg-eco-950/40 p-2 rounded-xl border border-eco-100 dark:border-eco-900">
                    <span>Reward: {c.points} Points</span>
                    <span className="text-[10px] text-gray-400">{c.duration} Days</span>
                  </div>
                </div>
              ))}
              {challenges.length === 0 && (
                <p className="text-center text-gray-400 py-10 text-xs col-span-2">No campus-wide challenges deployed.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800 dark:text-white">Create Department</h3>
              <button onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Department Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Computer Science"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Short Code</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. CSE"
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
              <h3 className="font-bold text-base text-gray-800 dark:text-white">Provision User Account</h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Role Type</label>
                  <select 
                    className="input-field py-2"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Department</label>
                  <select 
                    className="input-field py-2"
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. John Doe"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Institutional Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="e.g. john@mit.edu"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required 
                />
              </div>
              
              {userForm.role === 'student' && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Semester</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. 3"
                      value={userForm.semester}
                      onChange={(e) => setUserForm({ ...userForm, semester: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Section</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. A"
                      value={userForm.section}
                      onChange={(e) => setUserForm({ ...userForm, section: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-400 italic">
                * Password will default to **`Temp@123`** and the user will be forced to change it on their first login.
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
