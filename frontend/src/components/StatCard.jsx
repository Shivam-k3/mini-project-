export default function StatCard({ icon: Icon, label, value, unit, color = 'ink', hint }) {
  const iconTone = {
    ink:    'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    eco:    'bg-eco-50 text-eco-600 dark:bg-eco-500/15 dark:text-eco-400',
    ocean:  'bg-ocean-50 text-ocean-600 dark:bg-ocean-500/15 dark:text-ocean-400',
    amber:  'bg-warn-50 text-warn-600 dark:bg-warn-500/15 dark:text-warn-400',
    high:   'bg-high-50 text-high-600 dark:bg-high-500/15 dark:text-high-400',
  };

  const valueTone = {
    ink:    'text-ink-900 dark:text-white',
    eco:    'text-eco-600 dark:text-eco-400',
    ocean:  'text-ocean-600 dark:text-ocean-400',
    amber:  'text-warn-600 dark:text-warn-400',
    high:   'text-high-600 dark:text-high-400',
  };

  return (
    <div className="card p-5 flex flex-col gap-3">
      {Icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconTone[color] || iconTone.ink}`}>
          <Icon size={17} />
        </div>
      )}
      <div>
        <p className="kpi-label">{label}</p>
        <p className={`font-display font-bold text-2xl leading-tight tracking-tight mt-1 ${valueTone[color] || valueTone.ink}`}>
          {value}
          {unit && <span className="text-xs text-ink-400 font-normal ml-1">{unit}</span>}
        </p>
        {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}
