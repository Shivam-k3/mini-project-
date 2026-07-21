import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle as GoogleIcon } from 'react-icons/fc';
import toast from 'react-hot-toast';

export default function Register() {
  const { register, user, login } = useAuth();
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
      toast.success('Account created! Welcome to EcoGuardian AI');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    toast.loading('Redirecting to Google Sign-Up...', { duration: 1500 });
    setTimeout(() => {
      // Simulate OAuth auto-register/login
      login('demo@ecoguardian.ai', 'demo123')
        .then(() => {
          toast.success('Google Registration Successful!');
          navigate('/dashboard');
        })
        .catch(() => toast.error('Google Sign-Up failed'));
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 bg-mesh p-4">
      <div className="glass-card w-full max-w-md animate-slide-up border border-white/20 dark:border-white/5 rounded-3xl p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-xl mx-auto mb-4 shadow-md">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Create account</h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">Join our global community for SDG 13</p>
        </div>

        {/* Google Signup */}
        <button 
          type="button" 
          onClick={handleGoogleSignUp}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white/40 dark:bg-gray-900/40 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] select-none text-gray-700 dark:text-gray-200"
        >
          <GoogleIcon size={18} />
          Sign up with Google
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
          <span className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">or credentials</span>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-800"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                className="input-field pl-11"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <FiLock className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pl-11 pr-11"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <FiLock className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field pl-11"
                placeholder="Confirm password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Footer info */}
        <p className="text-center mt-6 text-xs text-gray-400 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-eco-600 hover:text-eco-500 font-semibold transition-colors">Sign In</Link>
        </p>

      </div>
    </div>
  );
}
