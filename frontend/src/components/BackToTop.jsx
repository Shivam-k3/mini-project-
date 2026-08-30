import { useState, useEffect } from 'react';
import { FiArrowUp } from 'react-icons/fi';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible((window.scrollY || document.body.scrollTop) > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`
        fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center
        bg-eco-600 text-white shadow-lg shadow-eco-500/25
        hover:bg-eco-700 hover:shadow-xl hover:shadow-eco-500/30
        transition-all duration-300
        dark:bg-eco-500 dark:text-slate-950 dark:hover:bg-eco-400
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      aria-label="Scroll to top"
    >
      <FiArrowUp size={18} />
    </button>
  );
}
