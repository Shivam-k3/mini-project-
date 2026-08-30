export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999]
                 focus:rounded-xl focus:bg-eco-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white
                 focus:shadow-lg focus:shadow-eco-500/25 focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
