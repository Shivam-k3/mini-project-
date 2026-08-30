import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') {
        const focusable = e.currentTarget.querySelectorAll('button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            danger
              ? 'bg-red-50 dark:bg-red-950/40 text-red-500'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-500'
          }`}>
            <FiAlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 -mt-0.5">
            <FiX size={16} />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button ref={cancelRef} onClick={onCancel}
            className="btn-secondary !text-xs !px-3.5 !py-2">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`${danger ? 'btn-danger' : 'btn-primary'} !text-xs !px-3.5 !py-2`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
