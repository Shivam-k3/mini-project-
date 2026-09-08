import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowRight, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { FieldError } from '../components/FormFeedback';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import AuthBrandPanel from '../components/AuthBrandPanel';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required';
    if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    if (!isSupabaseConfigured()) {
      toast.error('Password recovery is not configured');
      return;
    }

    setLoading(true);
    try {
      const { error: supaError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Always surface a friendly result without revealing whether the email
      // exists in the system (anti-enumeration).
      if (supaError) {
        toast.error('Could not send the reset link. Please try again.');
        return;
      }
      setSent(true);
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
          <header className="auth-header">
            <p className="auth-eyebrow">Account recovery</p>
            <h2>{sent ? 'Check your inbox' : 'Reset your password'}</h2>
            <p>
              {sent
                ? 'If an account exists for the email you entered, a secure reset link is on its way. The link expires shortly.'
                : 'Enter your account email and we will send you a secure link to create a new password.'}
            </p>
          </header>

          {sent ? (
            <div className="auth-success" role="status" aria-live="polite">
              <span className="auth-success-icon"><FiCheck size={18} /></span>
              <p><strong>Reset link sent</strong></p>
              <p className="auth-success-note">
                Please check your inbox (and spam folder) for an email from EcoGuardian, then follow the link to reset your password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                <span>Email address</span>
                <div className="auth-input-wrap">
                  <FiMail aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => { setTouched(true); setError(validate()); }}
                    autoComplete="email"
                    required
                    aria-invalid={touched && !!error}
                  />
                </div>
                <FieldError message={touched ? error : ''} />
              </label>

              <button type="submit" disabled={loading} className="auth-submit">
                {loading ? <span className="auth-spinner" /> : <>Send reset link <FiArrowRight size={19} /></>}
              </button>
            </form>
          )}

          <div className="auth-alt-actions">
            <Link to="/login" className="auth-alt-link"><FiArrowLeft size={14} /> Back to login</Link>
          </div>
        </div>

        <footer className="auth-legal">
          <Link to="/legal/privacy">Privacy policy</Link><span>•</span><Link to="/legal/terms">Terms of service</Link><span>•</span><Link to="/legal/security">Security architecture</Link>
        </footer>
      </section>
    </main>
  );
}