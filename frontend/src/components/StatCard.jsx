export default function StatCard({ icon, label, value, unit, color = 'eco', trend }) {
  const iconBg = {
    eco:    'bg-gradient-to-br from-eco-100 to-eco-200 dark:from-eco-950 dark:to-eco-900 text-eco-600 dark:text-eco-400',
    ocean:  'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900 text-blue-600 dark:text-blue-400',
    purple: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950 dark:to-purple-900 text-purple-600 dark:text-purple-400',
    amber:  'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-950 dark:to-amber-900 text-amber-600 dark:text-amber-400',
  };

  const valueColor = {
    eco:    'text-eco-600 dark:text-eco-400',
    ocean:  'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber:  'text-amber-600 dark:text-amber-400',
  };

  const glow = {
    eco:    'shadow-eco-500/10',
    ocean:  'shadow-blue-500/10',
    purple: 'shadow-purple-500/10',
    amber:  'shadow-amber-500/10',
  };

  return (
    <div className={`card flex flex-col gap-3 animate-slide-up hover:shadow-md ${glow[color]} transition-shadow`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${iconBg[color]}`}>
        {icon}
      </div>
      <div>
        <p className="kpi-label">{label}</p>
        <p className={`font-display font-black text-2xl leading-tight tracking-tight mt-1 ${valueColor[color]}`}>
          {value}
          {unit && <span className="text-xs text-gray-400 font-normal ml-1">{unit}</span>}
        </p>
      </div>
      {trend !== undefined && (
        <p className={`text-xs font-semibold ${trend > 0 ? 'text-red-500' : 'text-eco-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </p>
      )}
    </div>
  );
}
