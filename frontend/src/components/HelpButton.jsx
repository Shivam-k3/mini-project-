import { useState, useRef, useEffect } from 'react';
import { FiHelpCircle, FiX, FiMail, FiExternalLink } from 'react-icons/fi';

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-6 right-20 z-50">
      <button
        onClick={() => setOpen(!open)}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          open
            ? 'bg-gray-500 text-white shadow-gray-500/25'
            : 'bg-eco-600 text-white shadow-eco-500/25 hover:bg-eco-700 dark:bg-eco-500 dark:text-slate-950 animate-bounce-sub'
        }`}
        aria-label="Help"
        aria-expanded={open}
      >
        {open ? <FiX size={18} /> : <FiHelpCircle size={18} />}
      </button>

      {open && (
        <div className="absolute bottom-14 right-0 w-64 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl
                        border border-eco-200/30 dark:border-eco-800/15 rounded-2xl p-4 animate-slide-up shadow-xl">
          <p className="text-xs font-bold text-gray-800 dark:text-white mb-2">Need help?</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
            Here are some quick resources to get you started.
          </p>
          <div className="space-y-1.5">
            <a href="/dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-eco-700 dark:text-eco-400 hover:underline px-2 py-1.5 rounded-lg hover:bg-eco-50/50 dark:hover:bg-eco-950/15 transition-colors">
              <FiExternalLink size={12} /> Go to Dashboard
            </a>
            <a href="mailto:support@ecoguardian.ai"
              className="flex items-center gap-2 text-xs font-semibold text-eco-700 dark:text-eco-400 hover:underline px-2 py-1.5 rounded-lg hover:bg-eco-50/50 dark:hover:bg-eco-950/15 transition-colors">
              <FiMail size={12} /> Contact Support
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
