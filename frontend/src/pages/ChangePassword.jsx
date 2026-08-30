import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FieldError, FormSuccess } from '../components/FormFeedback';
import toast from 'react-hot-toast';

export default function ChangePassword() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const e = {};
    if (touched.newPassword) {
      if (!form.newPassword) e.newPassword = 'Password is required';
      else if (form.newPassword.length < 6) e.newPassword = 'Must be at least 6 characters';
    }
    if (touched.confirmPassword) {
      if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
      else if (form.newPassword !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    return e;
  }, [form, touched]);

  const passwordsMatch = form.confirmPassword && form.newPassword === form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = { newPassword: true, confirmPassword: true };
    setTouched(allTouched);
    if (errors.newPassword || errors.confirmPassword || !form.newPassword || !form.confirmPassword) return;
    setLoading(true);
    try {
      await authAPI.changePassword({ newPassword: form.newPassword });
      toast.success('Password updated! Welcome to the dashboard.');
      updateUser({ firstLogin: false });
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm animate-scale-up">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/leaf.svg" alt="EcoGuardian" className="w-9 h-9" />
          </div>
          <div>
            <p className="font-display font-black text-lg text-gray-900 dark:text-white leading-none">EcoGuardian</p>
            <p className="text-[10px] text-eco-600 dark:text-eco-400 font-bold uppercase tracking-wider">First Login Setup</p>
          </div>
        </div>

        {/* Card */}
        <div className="card border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="mb-6">
            <h1 className="font-display font-black text-2xl text-gray-900 dark:text-white mb-1">
              Create new password
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Hi <span className="font-bold text-gray-600 dark:text-gray-300">{user?.name || 'User'}</span>,
              your account uses a temporary password. Please set a new one to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                New Password
              </label>
              <div className="relative">
                <FiLock size={14} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pl-9 pr-10 ${touched.newPassword && errors.newPassword ? '!border-red-400 !focus:ring-red-400/15' : ''}`}
                  placeholder="Minimum 6 characters"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, newPassword: true }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-gray-400 hover:text-eco-600 transition-colors p-0.5"
                >
                  {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              <FieldError message={errors.newPassword} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <FiLock size={14} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pl-9 ${touched.confirmPassword && errors.confirmPassword ? '!border-red-400 !focus:ring-red-400/15' : ''} ${passwordsMatch ? '!border-eco-400' : ''}`}
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                  required
                />
              </div>
              <FieldError message={errors.confirmPassword} />
              {passwordsMatch && <FormSuccess message="Passwords match" />}
            </div>

            {/* Strength hint */}
            {form.newPassword.length > 0 && (
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min((form.newPassword.length / 12) * 100, 100)}%`,
                    backgroundColor:
                      form.newPassword.length < 6 ? '#ef4444'
                      : form.newPassword.length < 10 ? '#f59e0b'
                      : '#22c55e',
                  }}
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Save & Continue →'}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-5 block text-center text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors w-full"
        >
          Cancel &amp; Sign Out
        </button>
      </div>
    </div>
  );
}
