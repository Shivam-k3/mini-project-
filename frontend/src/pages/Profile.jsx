import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiSettings, FiSliders, FiBell, FiSun, FiMoon, FiCheck, FiMail } from 'react-icons/fi';
import { FieldError } from '../components/FormFeedback';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { dark, toggle } = useTheme();
  const [form, setForm] = useState({
    name: user?.name || '',
    location: user?.profile?.location || '',
    bio: user?.profile?.bio || '',
    goal: user?.profile?.goal || 15,
  });
  const [notifications, setNotifications] = useState({
    weeklyDigest: true,
    streakAlerts: true,
    challengeReminders: false
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('Name is required'); return; }
    setNameError('');
    setLoading(true);
    try {
      const { data } = await authAPI.updateProfile({
        name: form.name,
        profile: { location: form.location, bio: form.bio, goal: Number(form.goal) },
      });
      updateUser(data);
      setSaved(true);
      toast.success('Settings and goals updated!');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Notification preferences updated!');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <p className="section-label">Account</p>
        <h1 className="text-3xl font-bold text-ink-900 dark:text-white">Profile & Preferences</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Manage user meta, notifications, theme layouts, and SDG carbon budgets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Forms (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* User Settings Form */}
          <div className="card p-5">
            <h3 className="section-label flex items-center gap-1.5">
              <FiUser className="text-eco-600 dark:text-eco-400" /> Account Information
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="input-label">Full Name</label>
                  <input aria-label="Full Name" className={`input-field py-2 text-xs ${nameError ? '!border-high-400' : ''}`} value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameError(''); }} required />
                  <FieldError message={nameError} />
                </div>
                <div className="space-y-1.5">
                  <label className="input-label">Location</label>
                  <input aria-label="Location" className="input-field py-2 text-xs" placeholder="City, Country" value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="input-label">Bio Journey</label>
                <textarea aria-label="Bio Journey" className="input-field py-2 text-xs" rows={3} placeholder="Tell us about your Decarbonization pathway"
                  value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>

              {/* Goal Slider */}
              <div className="space-y-3 p-4 rounded-lg border border-ink-200 bg-surface-2 dark:border-ink-800 dark:bg-ink-900">
                <div className="flex justify-between items-center text-xs font-semibold text-ink-700 dark:text-ink-200">
                  <span id="goal-label" className="flex items-center gap-1"><FiSliders size={13} /> Daily CO₂ Budget Target</span>
                  <span className="text-eco-600 dark:text-eco-400 font-bold">{form.goal} kg CO₂</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  value={form.goal}
                  aria-labelledby="goal-label"
                  onChange={(e) => setForm({ ...form, goal: Number(e.target.value) })}
                  className="w-full accent-eco-500 bg-ink-200 dark:bg-ink-800 rounded-full h-1.5"
                />
                <p className="text-[10px] text-ink-400 leading-normal">
                  Decarbonization Standard: A personal budget under 15 kg CO₂ is recommended to support direct climate action (SDG 13).
                </p>
              </div>

              <button type="submit" disabled={loading} className={`btn-accent py-2.5 px-6 text-xs select-none transition-all ${saved ? '!bg-eco-600 !text-white' : ''}`}>
                {loading ? 'Saving...' : saved ? <><FiCheck size={14} /> Saved!</> : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Theme & Display card */}
          <div className="card p-5">
            <h3 className="section-label flex items-center gap-1.5">
              <FiSettings className="text-ink-400 dark:text-ink-400" /> Interface Theme Mode
            </h3>
            <div className="flex gap-4">
              <button 
                onClick={() => { if (dark) toggle(); }}
                className={`flex-1 flex flex-col items-center justify-center p-6 border rounded-xl transition-colors duration-150 ${
                  !dark 
                    ? 'border-eco-500 bg-eco-50 text-eco-700 dark:bg-eco-500/10 dark:text-eco-300 font-bold'
                    : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-ink-400'
                }`}
              >
                <FiSun size={24} className="mb-2" />
                <span className="text-xs font-semibold">Light Mode</span>
              </button>
              <button 
                onClick={() => { if (!dark) toggle(); }}
                className={`flex-1 flex flex-col items-center justify-center p-6 border rounded-xl transition-colors duration-150 ${
                  dark 
                    ? 'border-eco-500 bg-eco-50 text-eco-700 dark:bg-eco-500/10 dark:text-eco-300 font-bold'
                    : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 text-ink-400'
                }`}
              >
                <FiMoon size={24} className="mb-2" />
                <span className="text-xs font-semibold">Dark Mode</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Side: Preferences & statistics (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Notification settings */}
          <div className="card p-5">
            <h3 className="section-label flex items-center gap-1.5">
              <FiBell className="text-ocean-600 dark:text-ocean-400" /> Notifications
            </h3>
            
            <div className="space-y-4">
              {[
                { key: 'weeklyDigest', label: 'Weekly Audits', desc: 'Compile and mail weekly carbon summaries.' },
                { key: 'streakAlerts', label: 'Streak Reminders', desc: 'Alert when logging streak is in danger.' },
                { key: 'challengeReminders', label: 'New Challenges', desc: 'Alert when new weekly challenges release.' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 pb-4 border-b border-ink-100 dark:border-ink-800 last:border-0 last:pb-0">
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-ink-900 dark:text-white leading-tight">{item.label}</h4>
                    <p className="text-[10px] text-ink-400 mt-1 leading-normal">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" checked={notifications[item.key]}
                      onChange={() => handleNotifyToggle(item.key)}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-ink-200 dark:bg-ink-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-eco-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-eco-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* User Scorecard */}
          <div className="card p-5">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-eco-600 flex items-center justify-center text-white text-lg font-black uppercase select-none">
                {user?.name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink-900 dark:text-white leading-tight truncate">{user?.name}</h2>
                <p className="text-[10px] text-ink-400 mt-0.5 flex items-center gap-1 truncate"><FiMail size={11} /> {user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-ink-100 dark:border-ink-800 pt-4">
              <div>
                <p className="text-base font-black text-eco-600 dark:text-eco-400 leading-none">{user?.gamification?.ecoScore || 0}</p>
                <p className="section-label mt-1.5 mb-0">Eco Score</p>
              </div>
              <div>
                <p className="text-base font-black text-ocean-600 dark:text-ocean-400 leading-none">{user?.gamification?.greenPoints || 0}</p>
                <p className="section-label mt-1.5 mb-0">Points</p>
              </div>
              <div>
                <p className="text-base font-black text-warn-600 dark:text-warn-400 leading-none">{user?.gamification?.streak || 0}</p>
                <p className="section-label mt-1.5 mb-0">Streak</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
