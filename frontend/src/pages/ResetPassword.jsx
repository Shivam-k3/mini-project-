import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiKey, FiLock, FiEye, FiEyeOff, FiCheck, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { FieldError, FormSuccess } from '../components/FormFeedback';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import AuthBrandPanel from '../components/AuthBrandPanel';

export default function ResetPassword() {
  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  // A reset page visit is only meaningful when Supabase has established a
  // recovery session. Detect it via the recovery auth event and the
  // `type=recovery` marker in the redirect URL (before the client processes it).
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChecking(false);
      return;
    }
    let active = true;
    const hasRecoveryParams =
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      // Recovery-only: a normal (already signed-in) session is NOT sufficient.
      if (data.session && hasRecoveryParams) setRecoveryReady(true);
      setChecking(false);
    })();

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

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
    if (!recoveryReady) return;
    setTouched({ newPassword: true, confirmPassword: true });
    if (errors.newPassword || errors.confirmPassword || !form.newPassword || !form.confirmPassword) return;
    if (!isSupabaseConfigured()) {
      toast.error('Password reset is not configured');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) {
        toast.error(error.message || 'Failed to update password.');
        return;
      }
      // End the recovery session so the user signs in fresh with the new password.
      await supabase.auth.signOut().catch(() => {});
      setUpdated(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <AuthBrandPanel />

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <img src="/leaf.svg" alt="" className="w-5 h-5 inline-block" /> EcoGuardian
        </div>

        <div className="auth-form-wrap">
          {checking && (
            <div className="auth-loading">
              <span className="auth-spinner" />
              <p>Checking your reset link…</p>
            </div>
          )}

          {!checking && !recoveryReady && (
            <>
              <header className="auth-header">
                <p className="auth-eyebrow">Password recovery</p>
                <h2>Link required</h2>
                <p>This page only completes a password reset started from your recovery email.</p>
              </header>

              <div className="auth-alert" role="status" aria-live="polite">
                <p>
                  <strong>No active recovery session.</strong> Open the reset link from your email to continue, or request a new one below.
                </p>
              </div>

              <div className="auth-block-links">
                <Link to="/forgot-password" className="auth-submit-link"><FiArrowLeft size={15} /> Request a new link</Link>
                <Link to="/login" className="auth-alt-link" style={{ justifySelf: 'center' }}>Back to login</Link>
              </div>
            </>
          )}

          {!checking && recoveryReady && updated && (
            <>
              <header className="auth-header">
                <p className="auth-eyebrow">Password recovery</p>
                <h2>Password updated</h2>
                <p>Your EcoGuardian password has been changed.</p>
              </header>

              <div className="auth-success" role="status" aria-live="polite">
                <span className="auth-success-icon"><FiCheck size={18} /></span>
                <p><strong>All set</strong></p>
                <p className="auth-success-note">
                  You can now sign in with your new password. For security, you were signed out of the recovery session.
                </p>
              </div>

              <div className="auth-block-links">
                <Link to="/login" className="auth-submit-link">Go to login <FiArrowRight size={16} /></Link>
              </div>
            </>
          )}

          {!checking && recoveryReady && !updated && (
            <>
              <header className="auth-header">
                <p className="auth-eyebrow">Password recovery</p>
                <h2>Set a new password</h2>
                <p>Choose a new password for your EcoGuardian account. Use at least 6 characters.</p>
              </header>

              <form onSubmit={handleSubmit} className="auth-form">
                <label>
                  <span>New password</span>
                  <div className="auth-input-wrap">
                    <FiKey aria-hidden="true" />
                    <input
                      id="newPassword"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={form.newPassword}
                      onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, newPassword: true }))}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      aria-invalid={touched.newPassword && !!errors.newPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide new password' : 'Show new password'}
                    >
                      {showPass ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <FieldError message={touched.newPassword ? errors.newPassword : ''} />
                </label>

                <label>
                  <span>Confirm password</span>
                  <div className="auth-input-wrap">
                    <FiLock aria-hidden="true" />
                    <input
                      id="confirmPassword"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                      autoComplete="new-password"
                      required
                      aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showPass ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <FieldError message={touched.confirmPassword ? errors.confirmPassword : ''} />
                  {passwordsMatch && (
                    <FormSuccess message="Passwords match" />
                  )}
                </label>

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

                <button type="submit" disabled={loading} className="auth-submit">
                  {loading ? <span className="auth-spinner" /> : <>Update password <FiArrowRight size={19} /></>}
                </button>
              </form>

              <div className="auth-alt-actions">
                <Link to="/login" className="auth-alt-link"><FiArrowLeft size={14} /> Back to login</Link>
              </div>
            </>
          )}
        </div>

        <footer className="auth-legal">
          <Link to="/legal/privacy">Privacy policy</Link><span>•</span><Link to="/legal/terms">Terms of service</Link><span>•</span><Link to="/legal/security">Security architecture</Link>
        </footer>
      </section>
    </main>
  );
}