import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowRight, FiArrowUp } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const ALL_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', keywords: 'home overview stats analytics' },
  { label: 'Carbon Calculator', path: '/calculator', keywords: 'log entry trip transport commute mode vehicle occupancy distance' },
  { label: 'Explainable AI', path: '/explainable-ai', keywords: 'shap prediction model interpretation' },
  { label: 'Digital Twin', path: '/simulator', keywords: 'simulation scenario what-if carbon' },
  { label: 'AI Assistant', path: '/assistant', keywords: 'chatbot help questions ai' },
  { label: 'Gamification', path: '/gamification', keywords: 'badges challenges points leaderboard eco score' },
  { label: 'Reports', path: '/reports', keywords: 'pdf export download audit' },
  { label: 'Profile', path: '/profile', keywords: 'settings account theme password' },
  { label: 'Admin Hub', path: '/admin', keywords: 'manage users departments colleges provision', roles: ['super_admin', 'college_admin'] },
];

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const filtered = ALL_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(user?.role)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q);
  });

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        navigate(filtered[selectedIndex].path);
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
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
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, filtered, selectedIndex, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-ink-950/50 animate-fade-in"
         onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search pages"
           ref={panelRef}
           className="w-full max-w-lg mx-4 bg-white dark:bg-ink-900
                       border border-ink-200 dark:border-ink-800 rounded-xl shadow-2xl overflow-hidden animate-scale-up"
           onClick={(e) => e.stopPropagation()}
           style={{ overscrollBehavior: 'contain' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-200 dark:border-ink-800">
          <FiSearch size={16} className="text-ink-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages... (↑↓ navigate, Enter select)"
            aria-label="Search pages"
            className="flex-1 bg-transparent text-sm text-ink-800 dark:text-ink-200 placeholder:text-ink-400 outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold text-ink-400 bg-ink-100 dark:bg-ink-800 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="text-xs text-ink-400 text-center py-6">No results found.</p>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose(); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                i === selectedIndex
                  ? 'bg-eco-50 dark:bg-eco-950/20 text-eco-700 dark:text-eco-300'
                  : 'hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300'
              }`}
            >
              <span className="text-sm font-semibold">{item.label}</span>
              {i === selectedIndex && <FiArrowUp size={12} className="rotate-90 text-eco-500" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-ink-200 dark:border-ink-800 text-[10px] text-ink-400">
          <span><kbd className="font-bold bg-ink-100 dark:bg-ink-800 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-bold bg-ink-100 dark:bg-ink-800 rounded px-1">Enter</kbd> select</span>
        </div>
      </div>
    </div>
  );
}
