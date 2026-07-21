import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FiHome, FiPlusCircle, FiCpu, FiMessageCircle, FiAward,
  FiFileText, FiSettings, FiLogOut, FiSun, FiMoon, FiShield,
} from 'react-icons/fi';

const navItems = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/calculator', icon: FiPlusCircle, label: 'Calculator' },
  { to: '/simulator', icon: FiCpu, label: 'Digital Twin' },
  { to: '/assistant', icon: FiMessageCircle, label: 'AI Assistant' },
  { to: '/gamification', icon: FiAward, label: 'Gamification' },
  { to: '/reports', icon: FiFileText, label: 'Reports' },
  { to: '/profile', icon: FiSettings, label: 'Profile' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 bg-mesh transition-colors duration-300">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 glass border-r border-white/10 z-40 hidden lg:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-xl">
              🌿
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-800 dark:text-white">EcoGuardian</h1>
              <p className="text-xs text-eco-600 dark:text-eco-400">SDG 13 · Climate Action</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <FiShield size={20} />
              Admin Panel
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button onClick={toggle} className="nav-link w-full">
            {dark ? <FiSun size={20} /> : <FiMoon size={20} />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} className="nav-link w-full text-red-500 hover:text-red-600">
            <FiLogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-gray-800 dark:text-white">EcoGuardian AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {dark ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500">
              <FiLogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/10 px-2 py-2">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map(({ to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `p-2 rounded-xl ${isActive ? 'text-eco-500' : 'text-gray-500'}`
            }>
              <Icon size={22} />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
