import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { FiLock, FiEye, FiEyeOff, FiKey, FiShield, FiCheck, FiArrowRight } from 'react-icons/fi';
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
    <div className="flex min-h-screen items-center justify-center bg-surface-1 p-4 dark:bg-ink-950">
      <div className="w-full max-w-md animate-scale-up">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center">
            <img src="/leaf.svg" alt="EcoGuardian" className="h-9 w-9" />
          </div>
          <div>
            <p className="font-display text-lg font-black leading-none text-ink-900 dark:text-white">EcoGuardian</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-eco-600 dark:text-eco-400">First Login Setup</p>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="mb-6">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-eco-50 px-2 py-1 text-[11px] font-semibold text-eco-700 dark:bg-eco-500/15 dark:text-eco-300">
              <FiShield size={13} />
              <span>Secure workspace</span>
            </div>
            <h1 className="mb-1 font-display text-2xl font-black text-ink-900 dark:text-white">
              Create new password
            </h1>
            <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              Hi <span className="font-bold text-ink-700 dark:text-ink-200">{user?.name || 'User'}</span>,
              your account uses a temporary password. Please set a new one to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="input-label">New Password</label>
              <div className="relative">
                <FiKey size={14} className="pointer-events-none absolute left-3.5 top-3.5 text-ink-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pl-9 pr-10 ${touched.newPassword && errors.newPassword ? '!border-high-400 !focus:ring-high-400/25' : ''}`}
                  placeholder="Minimum 6 characters"
                  aria-label="New Password"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, newPassword: true }))}
                  aria-invalid={touched.newPassword && !!errors.newPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-3 p-0.5 text-ink-400 transition-colors hover:text-eco-600"
                >
                  {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              <FieldError message={errors.newPassword} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="input-label">Confirm Password</label>
              <div className="relative">
                <FiLock size={14} className="pointer-events-none absolute left-3.5 top-3.5 text-ink-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pl-9 ${touched.confirmPassword && errors.confirmPassword ? '!border-high-400 !focus:ring-high-400/25' : ''} ${passwordsMatch ? '!border-eco-500' : ''}`}
                  placeholder="Repeat your password"
                  aria-label="Confirm Password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                  aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
                  required
                />
              </div>
              <FieldError message={errors.confirmPassword} />
              {passwordsMatch && (
                <p className="mt-1 ml-1 flex items-center gap-1 text-[11px] font-semibold text-eco-600 dark:text-eco-400" role="status" aria-live="polite">
                  <FiCheck size={13} />
                  <span>Passwords match</span>
                </p>
              )}
            </div>

            {/* Strength hint */}
            {form.newPassword.length > 0 && (
              <div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min((form.newPassword.length / 12) * 100, 100)}%`,
                      backgroundColor:
                        form.newPassword.length < 6 ? '#a92f2c'
                        : form.newPassword.length < 10 ? '#f0a11a'
                        : '#2e9458',
                    }}
                  />
                </div>
                <p className="mt-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  {form.newPassword.length < 6 ? 'Weak' : form.newPassword.length < 10 ? 'Fair' : 'Strong'}
                </p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Save &amp; Continue
                  <FiArrowRight size={16} />
                </span>
              )}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-5 block w-full text-center text-xs font-semibold text-ink-400 transition-colors hover:text-high-600 dark:text-ink-500 dark:hover:text-high-400"
        >
          Cancel &amp; Sign Out
        </button>
      </div>
    </div>
  );
}
