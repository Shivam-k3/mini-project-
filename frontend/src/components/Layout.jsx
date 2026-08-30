import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FiHome, FiPlusCircle, FiCpu, FiMessageCircle, FiAward,
  FiFileText, FiSettings, FiLogOut, FiSun, FiMoon, FiShield,
  FiBell, FiChevronDown, FiUser, FiChevronLeft, FiMenu, FiActivity,
  FiSearch, FiTrendingUp, FiLayers, FiGlobe, FiGrid,
} from 'react-icons/fi';
import SkipToContent from './SkipToContent';
import ScrollProgress from './ScrollProgress';
import BackToTop from './BackToTop';
import HelpButton from './HelpButton';
import SearchModal from './SearchModal';
import AnnouncementBanner from './AnnouncementBanner';

/* Personal mobility toolset (shared by individual, student, faculty).
   Personal tool surfaces must never admit org-only functions. */
const PERSONAL_NAV = [
  { to: '/dashboard',       icon: FiHome,          label: 'My Dashboard' },
  { to: '/calculator',      icon: FiPlusCircle,    label: 'Trip Logger' },
  { to: '/twin',            icon: FiCpu,           label: 'Mobility Twin' },
  { to: '/explainable-ai',  icon: FiActivity,      label: 'Explainable AI' },
  { to: '/simulator',       icon: FiTrendingUp,    label: 'Simulator' },
  { to: '/assistant',       icon: FiMessageCircle, label: 'AI Assistant' },
  { to: '/gamification',    icon: FiAward,         label: 'Challenges' },
  { to: '/reports',         icon: FiFileText,      label: 'Reports' },
  { to: '/profile',         icon: FiSettings,      label: 'Profile' },
];

/* Nav grouped by section so personal vs organization experiences stay distinct. */
const getNavGroups = (role) => {
  const groups = [];

  if (role === 'super_admin') {
    groups.push({
      label: 'Platform',
      items: [
        { to: '/dashboard', icon: FiGlobe,  label: 'Platform Dashboard' },
        { to: '/admin',     icon: FiShield, label: 'Organizations' },
        { to: '/reports',   icon: FiFileText, label: 'Platform Reports' },
      ],
    });
  } else if (role === 'college_admin') {
    groups.push({
      label: 'Organization',
      items: [
        { to: '/dashboard', icon: FiGrid,      label: 'Campus Dashboard' },
        { to: '/admin',     icon: FiShield,    label: 'Admin Hub' },
        { to: '/reports',   icon: FiFileText,  label: 'Campus Reports' },
      ],
    });
  } else if (role === 'faculty') {
    groups.push({
      label: 'Faculty',
      items: [
        { to: '/dashboard', icon: FiHome, label: 'Faculty Dashboard' },
        { to: '/reports',   icon: FiFileText, label: 'Reports' },
      ],
    });
  }

  if (['student', 'individual', 'faculty'].includes(role)) {
    groups.push({ label: 'Your Mobility', items: PERSONAL_NAV });
  }

  // Profile always available
  const hasProfile = groups.flatMap((g) => g.items).some((i) => i.to === '/profile');
  if (!hasProfile) {
    groups.push({ label: 'Account', items: [{ to: '/profile', icon: FiSettings, label: 'Profile' }] });
  }
  return groups;
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
  const drawerRef  = useRef(null);

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
    const prevActive = document.activeElement;
    const timer = setTimeout(() => drawerRef.current?.querySelector('a, button')?.focus(), 50);
    const handleKey = (e) => {
      if (e.key === 'Escape') { if (document.activeElement) prevActive?.focus?.(); closeMobile(); return; }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
      prevActive?.focus?.();
    };
  }, [mobileOpen, closeMobile]);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const navGroups    = getNavGroups(user?.role);
  const roleLabel    = ROLE_LABELS[user?.role] ?? 'User';

  const notifications = [
    { id: 1, text: 'Welcome to your Personal Mobility Intelligence workspace.', time: 'Just now' },
    { id: 2, text: 'Review your latest predictions and tailored recommendations.', time: '1 hr ago' },
  ];

  const brand = user?.name?.charAt(0)?.toUpperCase() ?? 'G';

  return (
    <div className="min-h-screen flex bg-surface-1 dark:bg-ink-950 text-ink-700 dark:text-ink-200 transition-colors duration-200">
      <SkipToContent />
      <ScrollProgress />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Sidebar — Desktop ──────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col
        bg-white dark:bg-ink-900
        border-r border-ink-200 dark:border-ink-800
        transition-[width] duration-200
        ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}
      `}>
        {/* Logo */}
        <div className={`
          flex items-center h-16 border-b border-ink-200 dark:border-ink-800 px-4 gap-3
          ${sidebarCollapsed ? 'justify-center px-0' : ''}
        `}>
          <img src="/leaf.svg" alt="EcoGuardian" className="w-8 h-8 min-w-[32px]" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="font-display font-bold text-sm text-ink-900 dark:text-white leading-none">EcoGuardian</p>
              <p className="text-[10px] text-ink-400 dark:text-ink-500 font-semibold uppercase tracking-wider mt-1">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-ink-800
                     border border-ink-300 dark:border-ink-700 flex items-center justify-center
                     text-ink-400 hover:text-ink-700 hover:border-ink-400 dark:hover:text-white transition-colors duration-150"
          aria-label="Toggle sidebar"
        >
          <FiChevronLeft size={12} className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && <p className="nav-section-label">{group.label}</p>}
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
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
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`px-3 py-4 border-t border-ink-200 dark:border-ink-800 space-y-0.5`}>
          <button
            onClick={toggle}
            title={sidebarCollapsed ? (dark ? 'Light Mode' : 'Dark Mode') : undefined}
            className={`nav-link w-full ${sidebarCollapsed ? 'justify-center !px-2' : ''}`}
          >
            {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
            {!sidebarCollapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {!sidebarCollapsed && (
            <div className="mt-2 flex items-center gap-2 px-2 py-2 rounded-lg bg-surface-2 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
              <div className="w-7 h-7 min-w-[28px] rounded-md bg-ink-800 dark:bg-ink-200 flex items-center justify-center text-white dark:text-ink-900 text-xs font-bold uppercase">
                {brand}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate leading-none">{user?.name}</p>
                <p className="text-[10px] text-ink-400 truncate mt-0.5">{user?.email || user?.userId}</p>
              </div>
              <button onClick={handleLogout} aria-label="Logout" title="Logout" className="text-ink-400 hover:text-high-600 transition-colors p-0.5">
                <FiLogOut size={14} />
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button onClick={handleLogout} aria-label="Logout" title="Logout" className="nav-link w-full justify-center !px-2 !text-high-600 hover:!bg-high-50 dark:!text-high-400 dark:hover:!bg-ink-800">
              <FiLogOut size={17} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin-left] duration-200 ${
        sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
      }`}>

        {/* ── Header ──────────────────────────────────── */}
        <header className="
          sticky top-0 z-30 h-16 flex items-center px-4 sm:px-6
          bg-white/90 dark:bg-ink-900/90 backdrop-blur
          border-b border-ink-200 dark:border-ink-800
        ">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 mr-3"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <FiMenu size={20} />
          </button>

          {/* Page context */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-800 dark:text-white truncate leading-none">
              Welcome back, <span className="text-eco-700 dark:text-eco-400">{user?.name || 'Guardian'}</span>
            </p>
            <p className="text-[11px] text-ink-400 mt-0.5 truncate">
              {roleLabel}
              {user?.collegeId?.name     ? ` · ${user.collegeId.name}`     : ''}
              {user?.departmentId?.name  ? ` · ${user.departmentId.name}`  : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Open search (Ctrl+K)"
            >
              <FiSearch size={18} />
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifyRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <FiBell size={18} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-eco-500 ring-2 ring-white dark:ring-ink-900" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-76 z-50 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-4 shadow-pop animate-slide-up">
                  <p className="text-xs font-semibold text-ink-800 dark:text-white uppercase tracking-widest mb-3">Notifications</p>
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div key={n.id} className="text-xs border-b border-ink-100 dark:border-ink-800 last:border-0 pb-3 last:pb-0">
                        <p className="text-ink-700 dark:text-ink-200 font-medium leading-snug">{n.text}</p>
                        <span className="text-[10px] text-ink-400 mt-1 block">{n.time}</span>
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
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-ink-800 dark:bg-ink-200 flex items-center justify-center text-white dark:text-ink-900 text-xs font-bold uppercase">
                  {brand}
                </div>
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-300 hidden sm:block">{user?.name}</span>
                <FiChevronDown size={13} className={`text-ink-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 z-50 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-1.5 shadow-pop animate-slide-up">
                  <button onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 font-medium transition-colors">
                    <FiUser size={13} /> My Profile
                  </button>
                  {['super_admin', 'college_admin'].includes(user?.role) && (
                    <button onClick={() => { setProfileOpen(false); navigate('/admin'); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 font-medium transition-colors">
                      <FiShield size={13} /> Admin Panel
                    </button>
                  )}
                  <div className="divider !my-1" />
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-high-600 dark:text-high-400 hover:bg-high-50 dark:hover:bg-ink-800 font-semibold transition-colors">
                    <FiLogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ─────────────────────────────── */}
        <main id="main-content" className="flex-1 p-5 sm:p-7 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>

        {/* ── Footer ───────────────────────────────────── */}
        <footer className="text-center py-3 px-5 border-t border-ink-200 dark:border-ink-800">
          <p className="text-[11px] text-ink-400 dark:text-ink-500">
            &copy; {new Date().getFullYear()} <span className="font-semibold text-ink-500 dark:text-ink-400">EcoGuardian</span>. Personal Mobility Intelligence.
          </p>
        </footer>
      </div>

      {/* ── Mobile Drawer ─────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside ref={drawerRef} className="absolute inset-y-0 left-0 w-72 flex flex-col bg-white dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800 animate-slide-right"
                 style={{ overscrollBehavior: 'contain', touchAction: 'manipulation' }}>
            <div className="flex items-center h-16 px-4 border-b border-ink-200 dark:border-ink-800 gap-3">
              <img src="/leaf.svg" alt="EcoGuardian" className="w-8 h-8" />
              <div>
                <p className="font-display font-bold text-sm text-ink-900 dark:text-white">EcoGuardian</p>
                <p className="text-[10px] text-ink-400 dark:text-ink-500 font-semibold uppercase tracking-wider">{roleLabel}</p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Mobile navigation">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="nav-section-label">{group.label}</p>
                  <div className="space-y-0.5 mb-1">
                    {group.items.map(({ to, icon: Icon, label }) => (
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
                  </div>
                </div>
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-ink-200 dark:border-ink-800 space-y-0.5">
              <button onClick={() => { toggle(); closeMobile(); }} className="nav-link w-full">
                {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
                <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={handleLogout} className="nav-link w-full !text-high-600 hover:!bg-high-50 dark:!text-high-400 dark:hover:!bg-ink-800">
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
