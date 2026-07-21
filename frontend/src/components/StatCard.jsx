export default function StatCard({ icon, label, value, unit, color = 'eco', trend }) {
  const colors = {
    eco: 'from-eco-500 to-eco-600',
    ocean: 'from-ocean-500 to-ocean-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="stat-card animate-slide-up">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-xl mb-3 shadow-lg`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {trend && (
        <p className={`text-xs mt-1 ${trend > 0 ? 'text-red-500' : 'text-eco-500'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </p>
      )}
    </div>
  );
}
