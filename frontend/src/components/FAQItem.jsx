import { useState, useId } from 'react';
import { FiChevronDown } from 'react-icons/fi';

export default function FAQItem({ question, answer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  const buttonId = `${regionId}-button`;

  return (
    <div className="border border-eco-200/40 dark:border-eco-800/15 rounded-xl overflow-hidden">
      <button
        id={buttonId}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-eco-50/40 dark:hover:bg-eco-950/15 transition-colors"
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{question}</span>
        <FiChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={regionId} role="region" aria-labelledby={buttonId}
        className={`overflow-hidden transition-all duration-250 ease-out ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-eco-100/50 dark:border-eco-900/20 pt-3">
          {answer}
        </div>
      </div>
    </div>
  );
}
