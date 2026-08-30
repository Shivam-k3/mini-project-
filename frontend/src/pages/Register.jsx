import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiNavigation, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Welcome to EcoGuardian');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-1 dark:bg-ink-950 flex items-center justify-center p-4">
      <section className="card w-full max-w-md">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-eco-600 text-white">
            <FiNavigation size={24} aria-hidden="true" />
          </div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">
            Personal Mobility Intelligence
          </p>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Create your account</h1>
          <p className="mt-1 text-xs font-medium text-ink-400 dark:text-ink-500">
            An individual account for tracking your personal mobility &amp; emissions
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-3.5 text-ink-400 dark:text-ink-500" />
              <input
                type="text"
                className="input-field pl-10"
                placeholder="John Doe"
                aria-label="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="input-label">Email address</label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-3.5 text-ink-400 dark:text-ink-500" />
              <input
                type="email"
                className="input-field pl-10"
                placeholder="you@example.com"
                aria-label="Email address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="input-label">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3.5 text-ink-400 dark:text-ink-500" />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pl-10 pr-11"
                placeholder="Min 6 characters"
                aria-label="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-3 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="input-label">Confirm Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-3.5 text-ink-400 dark:text-ink-500" />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pl-10"
                placeholder="Confirm password"
                aria-label="Confirm Password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            {loading ? 'Creating account...' : <>Create Account <FiArrowRight size={16} /></>}
          </button>
        </form>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs font-medium text-ink-400 dark:text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-eco-600 hover:text-eco-500 dark:text-eco-400 dark:hover:text-eco-300 transition-colors">
            Sign In
          </Link>
        </p>
      </section>
    </main>
  );
}
