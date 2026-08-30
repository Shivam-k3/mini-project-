import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiUser, FiLock, FiEye, FiEyeOff, FiCheck,
  FiArrowRight, FiMail
} from 'react-icons/fi';
import { FieldError } from '../components/FormFeedback';
import toast from 'react-hot-toast';

const sandboxAccounts = [
  { label: 'Super admin', id: 'super@ecoguardian.ai', pass: 'admin123' },
  { label: 'Campus admin', id: 'admin@ecoguardian.ai', pass: 'admin123' },
  { label: 'Faculty', id: 'sarah@mit.edu', pass: 'Temp@123' },
  { label: 'Student', id: 'demo@ecoguardian.ai', pass: 'demo123' },
];

function Typewriter({ text, speed = 60 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) return;
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return <>{displayed}<span className="animate-pulse" style={{ opacity: displayed.length < text.length ? 1 : 0 }}>|</span></>;
}

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ emailOrUserId: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (user) navigate(user.firstLogin ? '/change-password' : '/dashboard');
  }, [user, navigate]);

  const validate = (f) => {
    const e = {};
    if (!f.emailOrUserId.trim()) e.emailOrUserId = 'Email or User ID is required';
    else if (f.emailOrUserId.trim().length < 3) e.emailOrUserId = 'Enter a valid email or User ID';
    if (!f.password) e.password = 'Password is required';
    return e;
  };

  const handleBlur = (field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(form));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setTouched({ emailOrUserId: true, password: true });
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const data = await login(form.emailOrUserId, form.password);
      toast.success(`Welcome back, ${data.name}!`);
      navigate(data.firstLogin ? '/change-password' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (id, pass) => setForm({ emailOrUserId: id, password: pass });

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel" aria-label="EcoGuardian introduction">
        <div className="auth-brand-overlay" />
        <div className="auth-brand-content">
          <div className="auth-mark"><img src="/leaf.svg" alt="EcoGuardian" className="w-14 h-14" /></div>
          <p className="auth-brand-name"><Typewriter text="EcoGuardian" speed={65} /></p>
          <h1>Pioneering the future of sustainability through intelligent ecological stewardship.</h1>

          <div className="auth-proof-list">
            <div className="auth-proof">
              <span><FiCheck size={15} /></span>
              <p><strong>Precision analytics</strong>Monitor carbon footprints with clarity and confidence.</p>
            </div>
            <div className="auth-proof">
              <span><FiCheck size={15} /></span>
              <p><strong>Ethical forecasting</strong>Understand environmental impact through explainable AI.</p>
            </div>
          </div>
        </div>
        <p className="auth-version">Campus sustainability portal <b>•</b> SDG 13</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <img src="/leaf.svg" alt="" className="w-5 h-5 inline-block" /> <Typewriter text="EcoGuardian" speed={65} />
        </div>

        <div className="auth-form-wrap">
          <header className="auth-header">
            <p className="auth-eyebrow">Secure workspace</p>
            <h2>Welcome back</h2>
            <p>Enter your institutional credentials to access your dashboard.</p>
          </header>

          <button type="button" className="auth-google-button" aria-label="Google sign-in is not configured">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span /> <b>or</b> <span /></div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>User ID or email</span>
              <div className="auth-input-wrap">
                <FiMail aria-hidden="true" />
                <input
                  id="emailOrUserId"
                  type="text"
                  placeholder="CSE25001 or user@campus.edu"
                  value={form.emailOrUserId}
                  onChange={(e) => setForm({ ...form, emailOrUserId: e.target.value })}
                  onBlur={() => handleBlur('emailOrUserId')}
                  autoComplete="username"
                  required
                  aria-invalid={touched.emailOrUserId && !!errors.emailOrUserId}
                />
              </div>
              <FieldError message={touched.emailOrUserId ? errors.emailOrUserId : ''} />
            </label>

            <label>
              <span className="auth-password-label">Password <small>Protected account</small></span>
              <div className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onBlur={() => handleBlur('password')}
                  autoComplete="current-password"
                  required
                  aria-invalid={touched.password && !!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <FieldError message={touched.password ? errors.password : ''} />
            </label>

            <label className="auth-remember">
              <input type="checkbox" />
              <span>Keep me signed in for 30 days</span>
            </label>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? <span className="auth-spinner" /> : <>Sign in to EcoGuardian <FiArrowRight size={19} /></>}
            </button>
          </form>

          <div className="auth-sandbox" aria-label="Demo accounts">
            <p>Demo access</p>
            <div>
              {sandboxAccounts.map((account) => (
                <button key={account.id} type="button" onClick={() => quickFill(account.id, account.pass)}>
                  <b>{account.label}</b><span>{account.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="auth-legal">
          <Link to="/legal/privacy">Privacy policy</Link><span>•</span><Link to="/legal/terms">Terms of service</Link><span>•</span><Link to="/legal/security">Security architecture</Link><span>•</span><Link to="/legal/cookies">Session notice</Link>
        </footer>
      </section>
    </main>
  );
}
