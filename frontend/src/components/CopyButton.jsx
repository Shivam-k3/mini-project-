import { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

export default function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select + copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition-all duration-200 ${
        copied
          ? 'bg-eco-500/15 text-eco-600 dark:text-eco-400'
          : 'bg-gray-100/60 text-gray-400 hover:text-eco-600 hover:bg-eco-50 dark:bg-white/5 dark:hover:bg-eco-950/20 dark:hover:text-eco-400'
      }`}
      aria-label={copied ? 'Copied to clipboard' : label}
    >
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
