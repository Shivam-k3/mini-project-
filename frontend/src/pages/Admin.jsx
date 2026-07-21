import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiUsers, FiBarChart2, FiDownload, FiTrash2 } from 'react-icons/fi';

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.getAnalytics(), adminAPI.getUsers()])
      .then(([a, u]) => { setAnalytics(a.data); setUsers(u.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deleteUser = async (id) => {
    if (!confirm('Delete this user and all their data?')) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers(users.filter((u) => u._id !== id));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const exportData = async () => {
    try {
      const { data } = await adminAPI.exportData();
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecoguardian-export-${Date.now()}.csv`;
      link.click();
      toast.success('Data exported!');
    } catch {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Admin Panel</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage users and monitor community emissions</p>
        </div>
        <button onClick={exportData} className="btn-secondary inline-flex items-center gap-2">
          <FiDownload size={18} /> Export CSV
        </button>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card text-center">
          <FiUsers className="mx-auto text-eco-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{analytics?.userCount || 0}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </div>
        <div className="glass-card text-center">
          <FiBarChart2 className="mx-auto text-ocean-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{analytics?.entryCount || 0}</p>
          <p className="text-sm text-gray-500">Total Entries</p>
        </div>
        <div className="glass-card text-center col-span-2">
          <p className="text-2xl font-bold text-eco-600">{analytics?.communityEmissions?.toFixed(1) || 0} kg</p>
          <p className="text-sm text-gray-500">Community Total CO₂</p>
        </div>
      </div>

      {/* Category Totals */}
      {analytics?.categoryTotals && (
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Community Emission Breakdown</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(analytics.categoryTotals).filter(([k]) => k !== '_id').map(([cat, val]) => (
              <div key={cat} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                <p className="text-sm text-gray-500 capitalize">{cat}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{val?.toFixed(1) || 0} kg</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card overflow-x-auto">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Users</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-2 text-gray-500">Name</th>
              <th className="text-left py-3 px-2 text-gray-500">Email</th>
              <th className="text-left py-3 px-2 text-gray-500">Role</th>
              <th className="text-left py-3 px-2 text-gray-500">Eco Score</th>
              <th className="text-left py-3 px-2 text-gray-500">Points</th>
              <th className="text-right py-3 px-2 text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-3 px-2 font-medium text-gray-800 dark:text-white">{u.name}</td>
                <td className="py-3 px-2 text-gray-500">{u.email}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-eco-100 text-eco-600'
                  }`}>{u.role}</span>
                </td>
                <td className="py-3 px-2">{u.gamification?.ecoScore || 0}</td>
                <td className="py-3 px-2">{u.gamification?.greenPoints || 0}</td>
                <td className="py-3 px-2 text-right">
                  {u.role !== 'admin' && (
                    <button onClick={() => deleteUser(u._id)} className="text-red-500 hover:text-red-600 p-1">
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
