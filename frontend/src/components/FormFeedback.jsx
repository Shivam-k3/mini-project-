export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 mt-1 ml-1" role="alert" aria-live="polite">
      {message}
    </p>
  );
}

export function FormSuccess({ message }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-semibold text-eco-600 dark:text-eco-400 mt-1 ml-1" role="status" aria-live="polite">
      {message}
    </p>
  );
}
