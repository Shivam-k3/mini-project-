import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowRight } from 'react-icons/fi';
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
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, filtered, selectedIndex, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-slate-950/40 backdrop-blur-sm animate-fade-in"
         onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl
                      border border-eco-200/40 dark:border-eco-800/15 rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-eco-100/50 dark:border-eco-800/15">
          <FiSearch size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages... (↑↓ navigate, Enter select)"
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold text-gray-400 bg-gray-100/60 dark:bg-white/5 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No results found.</p>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose(); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${
                i === selectedIndex
                  ? 'bg-eco-50 dark:bg-eco-950/20 text-eco-700 dark:text-eco-300'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-sm font-semibold">{item.label}</span>
              {i === selectedIndex && <FiArrowUp size={12} className="rotate-90 text-eco-500" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-eco-100/50 dark:border-eco-800/15 text-[10px] text-gray-400">
          <span><kbd className="font-bold bg-gray-100/60 dark:bg-white/5 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-bold bg-gray-100/60 dark:bg-white/5 rounded px-1">Enter</kbd> select</span>
        </div>
      </div>
    </div>
  );
}
