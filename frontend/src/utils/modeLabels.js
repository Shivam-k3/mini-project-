/**
 * Travel-mode display helpers.
 *
 * Backend mode keys are snake_case enum values (see the `trips[].mode` enum in
 * backend/models/CarbonEntry.js): car, motorcycle, auto_rickshaw, bus, metro,
 * ev, bicycle, walk, flight. They reach the UI raw via trip lists, mode
 * breakdowns and chart legends, so formatting lives in one place.
 */

const MODE_LABELS = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  auto_rickshaw: 'Auto Rickshaw',
  bus: 'Bus',
  metro: 'Metro',
  ev: 'EV',
  bicycle: 'Bicycle',
  walk: 'Walk',
  flight: 'Flight',
};

/**
 * Capitalises each word's first letter and leaves the rest of the word alone,
 * so acronyms passed through formatBreakdownKey() ("CSE", "IIT Bombay") survive.
 */
function titleCase(str) {
  return str
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Human-readable label for a travel mode key.
 * Falls back to de-underscored title case so an unrecognised mode still reads
 * correctly rather than leaking `auto_rickshaw` into the UI.
 */
export function formatMode(mode) {
  if (!mode) return '';
  const key = String(mode).toLowerCase().trim();
  if (MODE_LABELS[key]) return MODE_LABELS[key];
  return titleCase(key.replace(/_/g, ' '));
}

/**
 * Label for an arbitrary breakdown key in a chart legend.
 *
 * Charts are fed travel modes, but also department names, college names and
 * SHAP feature names — so unlike formatMode() this preserves the caller's
 * casing (keeping acronyms like "CSE" intact) and only de-underscores.
 */
export function formatBreakdownKey(key) {
  if (!key) return '';
  const lookup = MODE_LABELS[String(key).toLowerCase().trim()];
  if (lookup) return lookup;
  return titleCase(String(key).replace(/_/g, ' '));
}

export { MODE_LABELS };
