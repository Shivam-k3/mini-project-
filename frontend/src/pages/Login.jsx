import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    toast.loading('Redirecting to Google Sign-In...', { duration: 1500 });
    setTimeout(() => {
      // Simulate successful OAuth login as demo user
      login('demo@ecoguardian.ai', 'demo123')
        .then(() => {
          toast.success('Google Login Successful!');
          navigate('/dashboard');
        })
        .catch(() => toast.error('Google Sign-In failed'));
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 bg-mesh p-4">
      <div className="glass-card w-full max-w-md animate-slide-up border border-white/20 dark:border-white/5 rounded-3xl p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-xl mx-auto mb-4 shadow-md">
            🌿
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Welcome back</h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">Continue your climate action journey</p>
        </div>

        {/* Google Sign In */}
        <button 
          type="button" 
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white/40 dark:bg-gray-900/40 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] select-none text-gray-700 dark:text-gray-200"
        >
          <FcGoogle size={18} />
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
          <span className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">or email</span>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Email address</label>
            <div className="relative">
              <FiMail className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="email"
                className="input-field pl-11"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider font-Outfit">Password</label>
            <div className="relative">
              <FiLock className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pl-11 pr-11"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer info */}
        <p className="text-center mt-6 text-xs text-gray-400 font-medium">
          Don't have an account?{' '}
          <Link to="/register" className="text-eco-600 hover:text-eco-500 font-semibold transition-colors">Create one</Link>
        </p>

        {/* Demo Accounts Panel */}
        <div className="mt-8 p-4 rounded-2xl bg-eco-500/5 border border-eco-200/20 dark:border-eco-800/10 text-xs text-eco-700 dark:text-eco-300 space-y-1">
          <p className="font-bold text-eco-800 dark:text-eco-400 uppercase tracking-wide mb-1">Developer Sandbox Credentials:</p>
          <div className="flex justify-between">
            <span>👤 User: demo@ecoguardian.ai</span>
            <span className="font-mono">demo123</span>
          </div>
          <div className="flex justify-between">
            <span>🛡️ Admin: admin@ecoguardian.ai</span>
            <span className="font-mono">admin123</span>
          </div>
        </div>

      </div>
    </div>
  );
}
