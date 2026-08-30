import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FiHome, FiPlusCircle, FiCpu, FiMessageCircle, FiAward,
  FiFileText, FiSettings, FiLogOut, FiSun, FiMoon, FiShield,
  FiBell, FiChevronDown, FiUser, FiChevronLeft, FiMenu, FiActivity,
  FiSearch
} from 'react-icons/fi';
import SkipToContent from './SkipToContent';
import ScrollProgress from './ScrollProgress';
import BackToTop from './BackToTop';
import HelpButton from './HelpButton';
import SearchModal from './SearchModal';
import AnnouncementBanner from './AnnouncementBanner';

const getNavItems = (role) => {
  switch (role) {
    case 'super_admin':
      return [
        { to: '/dashboard', icon: FiHome,        label: 'Platform Dashboard' },
        { to: '/admin',     icon: FiShield,      label: 'Organization Manager' },
        { to: '/profile',   icon: FiSettings,    label: 'Profile' },
      ];
    case 'college_admin':
      return [
        { to: '/dashboard', icon: FiHome,        label: 'Campus Dashboard' },
        { to: '/admin',     icon: FiShield,      label: 'Admin Hub' },
        { to: '/reports',   icon: FiFileText,    label: 'Campus Reports' },
        { to: '/profile',   icon: FiSettings,    label: 'Profile' },
      ];
    case 'faculty':
      return [
        { to: '/dashboard',     icon: FiHome,         label: 'Faculty Dashboard' },
        { to: '/simulator',     icon: FiCpu,          label: 'Digital Twin' },
        { to: '/assistant',     icon: FiMessageCircle,label: 'AI Assistant' },
        { to: '/reports',       icon: FiFileText,     label: 'Reports' },
        { to: '/profile',       icon: FiSettings,     label: 'Profile' },
      ];
    case 'student':
    default:
      return [
        { to: '/dashboard',      icon: FiHome,          label: 'My Dashboard' },
        { to: '/calculator',     icon: FiPlusCircle,    label: 'Carbon Calculator' },
        { to: '/explainable-ai', icon: FiActivity,      label: 'Explainable AI' },
        { to: '/simulator',      icon: FiCpu,           label: 'Digital Twin' },
        { to: '/assistant',      icon: FiMessageCircle, label: 'AI Assistant' },
        { to: '/gamification',   icon: FiAward,         label: 'Gamification' },
        { to: '/reports',        icon: FiFileText,      label: 'Reports' },
        { to: '/profile',        icon: FiSettings,      label: 'Profile' },
      ];
  }
};

const ROLE_LABELS = {
  super_admin:   'Super Admin',
  college_admin: 'College Admin',
  faculty:       'Faculty',
  student:       'Student',
  individual:    'Personal Account',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen,      setProfileOpen]      = useState(false);
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [searchOpen,       setSearchOpen]       = useState(false);

  const profileRef = useRef(null);
  const notifyRef  = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifyRef.current  && !notifyRef.current.contains(e.target))  setNotificationsOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen, closeMobile]);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const navItems     = getNavItems(user?.role);
  const roleLabel    = ROLE_LABELS[user?.role] ?? 'User';

  const notifications = [
    { id: 1, text: 'Welcome to EcoGuardian Campus Sustainability Portal!', time: 'Just now' },
    { id: 2, text: 'New announcements published by administration.',          time: '1 hr ago' },
  ];

  return (
    <div className="min-h-screen flex bg-transparent transition-colors duration-200">
      <SkipToContent />
      <ScrollProgress />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Sidebar — Desktop ─────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col
        bg-gradient-to-b from-white/60 via-white/55 to-eco-50/30
        dark:from-slate-950/60 dark:via-slate-950/55 dark:to-eco-950/20
        backdrop-blur-2xl
        border-r border-eco-200/30 dark:border-eco-800/15
        transition-[width] duration-200
        ${sidebarCollapsed ? 'w-[68px]' : 'w-60'}
      `}>
        {/* Decorative green top accent */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-eco-400 via-eco-600 to-eco-500" />

        {/* Logo */}
        <div className={`
          flex items-center h-16 border-b border-eco-200/20 dark:border-eco-800/15 px-4 gap-3
          ${sidebarCollapsed ? 'justify-center' : ''}
        `}>
          <img src="/leaf.svg" alt="EcoGuardian" className="w-8 h-8 min-w-[32px]" />
          {!sidebarCollapsed && (
            <div className="animate-fade-in overflow-hidden">
              <p className="font-display font-black text-sm text-gray-900 dark:text-white leading-none">EcoGuardian</p>
              <p className="text-[10px] text-eco-600 dark:text-eco-400 font-bold uppercase tracking-wider mt-0.5">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white/90 dark:bg-slate-900/90
                     border border-eco-200/60 dark:border-eco-800/30 flex items-center justify-center
                     text-gray-400 hover:text-eco-600 hover:border-eco-400 transition-colors duration-150"
          aria-label="Toggle sidebar"
        >
          <FiChevronLeft size={12} className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''} ${sidebarCollapsed ? 'justify-center !px-2' : ''}`
              }
            >
              <Icon size={17} />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`px-3 py-4 border-t border-eco-200/20 dark:border-eco-800/15 space-y-0.5`}>
          <button
            onClick={toggle}
            title={sidebarCollapsed ? (dark ? 'Light Mode' : 'Dark Mode') : undefined}
            className={`nav-link w-full ${sidebarCollapsed ? 'justify-center !px-2' : ''}`}
          >
            {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
            {!sidebarCollapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* User mini-card */}
          {!sidebarCollapsed && (
            <div className="mt-2 flex items-center gap-2 px-2 py-2 rounded-xl bg-eco-50/40 dark:bg-eco-950/15 border border-eco-200/30 dark:border-eco-800/15 animate-fade-in">
              <div className="w-7 h-7 min-w-[28px] rounded-lg bg-gradient-to-br from-eco-500 to-eco-700 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
                {user?.name?.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate leading-none">{user?.name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{user?.email || user?.userId}</p>
              </div>
              <button onClick={handleLogout} title="Logout" className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                <FiLogOut size={14} />
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button onClick={handleLogout} title="Logout" className="nav-link w-full justify-center !px-2 !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/30">
              <FiLogOut size={17} />
            </button>
          )}
        </div>

        {/* Bottom green accent glow */}
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-eco-500/20 to-transparent" />
      </aside>

      {/* ── Main column ───────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin-left] duration-200 ${
        sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-60'
      }`}>

        {/* ── Header ─────────────────────────────────────── */}
        <header className="
          sticky top-0 z-30 h-16 flex items-center px-4 sm:px-6
          bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl
          border-b border-eco-200/20 dark:border-eco-800/15
        ">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-eco-50 dark:hover:bg-eco-950/30 mr-3"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <FiMenu size={20} />
          </button>

          {/* Page context */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate leading-none">
              Welcome back, <span className="text-eco-600 dark:text-eco-400">{user?.name || 'Guardian'}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {roleLabel}
              {user?.collegeId?.name     ? ` · ${user.collegeId.name}`     : ''}
              {user?.departmentId?.name  ? ` · ${user.departmentId.name}`  : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-eco-600 hover:bg-eco-50 dark:hover:bg-eco-950/30 transition-colors"
              aria-label="Open search (Ctrl+K)"
            >
              <FiSearch size={18} />
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifyRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl text-gray-400 hover:text-eco-600 hover:bg-eco-50 dark:hover:bg-eco-950/30 transition-colors"
              >
                <FiBell size={18} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-eco-500 ring-2 ring-white dark:ring-gray-900" />
              </button>

              {notificationsOpen && (
                <div className="
                  absolute right-0 top-full mt-2 w-76 z-50
                  bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl
                  border border-eco-200/30 dark:border-eco-800/15
                  rounded-2xl
                  p-4 animate-slide-up
                ">
                  <p className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-widest mb-3">Notifications</p>
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div key={n.id} className="text-xs border-b border-eco-100/50 dark:border-eco-900/20 last:border-0 pb-3 last:pb-0">
                        <p className="text-gray-700 dark:text-gray-300 font-medium leading-snug">{n.text}</p>
                        <span className="text-[10px] text-gray-400 mt-1 block">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-eco-50 dark:hover:bg-eco-950/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-eco-500 to-eco-700 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
                  {user?.name?.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">{user?.name}</span>
                <FiChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="
                  absolute right-0 top-full mt-2 w-44 z-50
                  bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl
                  border border-eco-200/30 dark:border-eco-800/15
                  rounded-2xl
                  p-1.5 animate-slide-up
                ">
                  <button onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-gray-700 dark:text-gray-300 hover:bg-eco-50 dark:hover:bg-eco-950/30 font-medium transition-colors">
                    <FiUser size={13} /> My Profile
                  </button>
                  {['super_admin', 'college_admin'].includes(user?.role) && (
                    <button onClick={() => { setProfileOpen(false); navigate('/admin'); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-gray-700 dark:text-gray-300 hover:bg-eco-50 dark:hover:bg-eco-950/30 font-medium transition-colors">
                      <FiShield size={13} /> Admin Panel
                    </button>
                  )}
                  <div className="divider !my-1" />
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold transition-colors">
                    <FiLogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page decoration — subtle green accent bar under header ── */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-eco-500/15 to-transparent" />

        {/* ── Page Content ───────────────────────────────── */}
        <main id="main-content" className="flex-1 p-5 sm:p-7 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="text-center py-3 px-5 border-t border-eco-200/20 dark:border-eco-800/15">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            &copy; {new Date().getFullYear()} <span className="font-semibold text-gray-500 dark:text-gray-400">Shivam Kumar</span>. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Mobile Drawer ────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeMobile} />
          <aside className="
            absolute inset-y-0 left-0 w-60 flex flex-col
            bg-gradient-to-b from-white/95 via-white/90 to-eco-50/80
            dark:from-slate-950/95 dark:via-slate-950/90 dark:to-eco-950/40
            backdrop-blur-2xl
            border-r border-eco-200/30 dark:border-eco-800/15
            animate-slide-right
          ">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-eco-400 via-eco-600 to-eco-500" />

            <div className="flex items-center h-16 px-4 border-b border-eco-200/20 dark:border-eco-800/15 gap-3">
              <img src="/leaf.svg" alt="EcoGuardian" className="w-8 h-8" />
              <div>
                <p className="font-display font-black text-sm text-gray-900 dark:text-white">EcoGuardian</p>
                <p className="text-[10px] text-eco-600 dark:text-eco-400 font-bold uppercase tracking-wider">{roleLabel}</p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-eco-200/20 dark:border-eco-800/15 space-y-0.5">
              <button onClick={() => { toggle(); closeMobile(); }} className="nav-link w-full">
                {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
                <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={handleLogout} className="nav-link w-full !text-red-500 hover:!bg-red-50 dark:hover:!bg-eco-950/20">
                <FiLogOut size={17} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <BackToTop />
      <HelpButton />
    </div>
  );
}
