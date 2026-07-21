import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    location: user?.profile?.location || '',
    bio: user?.profile?.bio || '',
    goal: user?.profile?.goal || 15,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.updateProfile({
        name: form.name,
        profile: { location: form.location, bio: form.bio, goal: Number(form.goal) },
      });
      updateUser(data);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account and sustainability goals</p>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-2xl font-bold">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{user?.name}</h2>
            <p className="text-gray-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-eco-100 dark:bg-eco-900/30 text-eco-600 capitalize">
              {user?.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
            <input className="input-field" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
            <input className="input-field" placeholder="City, Country" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Bio</label>
            <textarea className="input-field" rows={3} placeholder="Tell us about your sustainability journey"
              value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Daily CO₂ Goal (kg)
            </label>
            <input type="number" min="1" max="50" className="input-field" value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Your Stats</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-eco-600">{user?.gamification?.ecoScore || 0}</p>
            <p className="text-sm text-gray-500">Eco Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-ocean-600">{user?.gamification?.greenPoints || 0}</p>
            <p className="text-sm text-gray-500">Green Points</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{user?.gamification?.streak || 0}</p>
            <p className="text-sm text-gray-500">Day Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
}
