import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FiHome, FiPlusCircle, FiCpu, FiMessageCircle, FiAward,
  FiFileText, FiSettings, FiLogOut, FiSun, FiMoon, FiShield,
  FiBell, FiSearch, FiChevronDown, FiUser, FiChevronLeft, FiMenu
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileRef = useRef(null);
  const notifyRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notifyRef.current && !notifyRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const notifications = [
    { id: 1, text: "Streak Alert! You've logged 5 days in a row 🔥", time: "2 hrs ago" },
    { id: 2, text: "New Challenge: Meat-free Friday is now active 🌱", time: "4 hrs ago" },
    { id: 3, text: "Badge Earned: You are now a Green Commuter 🚲", time: "1 day ago" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 bg-mesh transition-colors duration-300">
      
      {/* Sidebar - Desktop */}
      <aside className={`fixed left-0 top-0 h-full glass border-r border-gray-200/50 dark:border-white/5 z-40 hidden lg:flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200/50 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 min-w-9 rounded-xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-lg">
              🌿
            </div>
            {!sidebarCollapsed && (
              <div className="animate-fade-in">
                <h1 className="font-bold text-base text-gray-800 dark:text-white leading-tight">EcoGuardian</h1>
                <p className="text-[10px] text-eco-600 dark:text-eco-400 font-semibold tracking-wider uppercase">SDG 13 Hub</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-600 hidden lg:block"
          >
            <FiChevronLeft size={16} className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''} ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              }`}
              title={sidebarCollapsed ? label : ''}
            >
              <Icon size={18} />
              {!sidebarCollapsed && <span className="text-sm font-medium">{label}</span>}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''} ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              }`}
              title={sidebarCollapsed ? 'Admin Panel' : ''}
            >
              <FiShield size={18} />
              {!sidebarCollapsed && <span className="text-sm font-medium">Admin Panel</span>}
            </NavLink>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200/50 dark:border-white/5 space-y-1.5">
          <button onClick={toggle} className={`nav-link w-full ${sidebarCollapsed ? 'justify-center px-0' : ''}`} title="Toggle Theme">
            {dark ? <FiSun size={18} /> : <FiMoon size={18} />}
            {!sidebarCollapsed && <span className="text-sm font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button onClick={handleLogout} className={`nav-link w-full text-red-500 hover:text-red-600 hover:bg-red-500/5 dark:hover:bg-red-500/10 ${
            sidebarCollapsed ? 'justify-center px-0' : ''
          }`} title="Logout">
            <FiLogOut size={18} />
            {!sidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className={`transition-all duration-300 lg:pl-64 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 glass border-b border-gray-200/50 dark:border-white/5 px-6 py-4 flex items-center justify-between">
          
          {/* Left: Mobile Menu Toggle / Welcome Header */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
            >
              <FiMenu size={20} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                Welcome back, {user?.name || 'Guardian'} 👋
              </h2>
              <p className="text-xs text-gray-400 font-medium">Every green choice counts towards SDG 13.</p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative hidden md:block">
              <FiSearch className="absolute left-3.5 top-3.5 text-gray-400" size={15} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-48 xl:w-60 pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-gray-900/50 focus:ring-2 focus:ring-eco-500/20 focus:border-eco-500 outline-none transition-all"
              />
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifyRef}>
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2.5 rounded-xl border border-gray-200/50 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-gray-900/50 text-gray-500 dark:text-gray-400 transition-all relative"
              >
                <FiBell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-eco-500"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 glass rounded-2xl p-4 shadow-2xl border border-gray-200/50 dark:border-white/5 animate-slide-up">
                  <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-3">Notifications</h4>
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div key={n.id} className="text-xs pb-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                        <p className="text-gray-600 dark:text-gray-300 font-medium leading-normal">{n.text}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-gray-200/50 dark:border-white/5 hover:bg-gray-100/50 dark:hover:bg-gray-900/50 text-gray-500 dark:text-gray-400 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-xs font-bold capitalize select-none">
                  {user?.name?.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 hidden md:block">{user?.name}</span>
                <FiChevronDown size={14} className={`transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-48 glass rounded-2xl p-2 shadow-2xl border border-gray-200/50 dark:border-white/5 animate-slide-up">
                  <button onClick={() => { setProfileOpen(false); navigate('/profile'); }} className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all font-medium">
                    <FiUser size={15} /> My Profile
                  </button>
                  {user?.role === 'admin' && (
                    <button onClick={() => { setProfileOpen(false); navigate('/admin'); }} className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all font-medium">
                      <FiShield size={15} /> Admin Panel
                    </button>
                  )}
                  <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
                  <button onClick={handleLogout} className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-500/5 dark:hover:bg-red-500/10 transition-all font-semibold">
                    <FiLogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Navigation overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-64 glass h-full p-6 flex flex-col z-10 border-r border-white/10 animate-slide-right">
            <div className="flex items-center justify-between pb-6 border-b border-gray-200/50 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌿</span>
                <span className="font-bold text-gray-800 dark:text-white">EcoGuardian</span>
              </div>
            </div>

            <nav className="flex-1 py-6 space-y-2 overflow-y-auto">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink 
                  key={to} 
                  to={to} 
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{label}</span>
                </NavLink>
              ))}
              {user?.role === 'admin' && (
                <NavLink 
                  to="/admin" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <FiShield size={18} />
                  <span className="text-sm font-medium">Admin Panel</span>
                </NavLink>
              )}
            </nav>

            <div className="pt-6 border-t border-gray-200/50 dark:border-white/5 space-y-2">
              <button onClick={() => { toggle(); setMobileMenuOpen(false); }} className="nav-link w-full">
                {dark ? <FiSun size={18} /> : <FiMoon size={18} />}
                <span className="text-sm font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={handleLogout} className="nav-link w-full text-red-500 hover:text-red-600">
                <FiLogOut size={18} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
