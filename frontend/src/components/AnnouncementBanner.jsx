import { useState, useEffect } from 'react';
import { FiX, FiInfo } from 'react-icons/fi';

const ANNOUNCEMENT_KEY = 'ecoguardian_announcement_dismissed';

const DEFAULT_ANNOUNCEMENT = {
  id: 'welcome-1',
  text: 'Welcome to EcoGuardian! Start tracking your carbon footprint today.',
};

export default function AnnouncementBanner({ announcement = DEFAULT_ANNOUNCEMENT }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!announcement?.id) return;
    const dismissed = sessionStorage.getItem(ANNOUNCEMENT_KEY);
    if (dismissed !== announcement.id) setVisible(true);
  }, [announcement?.id]);

  if (!visible || !announcement) return null;

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(ANNOUNCEMENT_KEY, announcement.id);
  };

  return (
    <div className="sticky top-0 z-40 bg-eco-600 text-white dark:bg-eco-700 px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
         role="alert">
      <div className="flex items-center gap-2 min-w-0">
        <FiInfo size={14} className="flex-shrink-0" />
        <span className="font-medium truncate">{announcement.text}</span>
      </div>
      <button onClick={dismiss} className="flex-shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors" aria-label="Dismiss announcement">
        <FiX size={14} />
      </button>
    </div>
  );
}
