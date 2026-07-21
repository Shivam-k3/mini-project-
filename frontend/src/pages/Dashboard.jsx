import { useState, useEffect } from 'react';
import { carbonAPI, gamificationAPI } from '../services/api';
import StatCard from '../components/StatCard';
import { EmissionPieChart, TrendLineChart, ShapBarChart } from '../components/Charts';
import { FiSun, FiCalendar, FiTrendingUp, FiGlobe, FiZap } from 'react-icons/fi';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([carbonAPI.getDashboard(), gamificationAPI.getStats()])
      .then(([dash, gam]) => {
        setData(dash.data);
        setStats(gam.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  const shap = data?.shapExplanation;
  const predictions = data?.predictions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Your carbon footprint overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="☀️" label="Today" value={data?.daily || 0} unit="kg CO₂" color="eco" />
        <StatCard icon="📅" label="This Week" value={data?.weekly || 0} unit="kg CO₂" color="ocean" />
        <StatCard icon="📊" label="This Month" value={data?.monthly || 0} unit="kg CO₂" color="purple" />
        <StatCard icon="🌍" label="All Time" value={data?.total || 0} unit="kg CO₂" color="amber" />
      </div>

      {/* Eco Score & Predictions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-card text-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Eco Score</h3>
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#ecoGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(stats?.ecoScore || 0) * 2.64} 264`}
              />
              <defs>
                <linearGradient id="ecoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.ecoScore || 0}</span>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div><span className="text-eco-500 font-bold">{stats?.greenPoints || 0}</span> points</div>
            <div><span className="text-ocean-500 font-bold">{stats?.streak || 0}</span> day streak</div>
          </div>
        </div>

        <div className="glass-card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FiZap className="text-amber-500" /> ML Predictions
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-eco-50 dark:bg-eco-900/20">
              <p className="text-sm text-gray-500 dark:text-gray-400">Next Week</p>
              <p className="text-2xl font-bold text-eco-600 dark:text-eco-400">{predictions?.nextWeek || 0} kg</p>
            </div>
            <div className="p-4 rounded-xl bg-ocean-50 dark:bg-ocean-900/20">
              <p className="text-sm text-gray-500 dark:text-gray-400">Next Month</p>
              <p className="text-2xl font-bold text-ocean-600 dark:text-ocean-400">{predictions?.nextMonth || 0} kg</p>
            </div>
          </div>
          {predictions?.trend && (
            <p className="mt-3 text-sm text-gray-500">
              Trend: <span className={`font-medium ${predictions.trend === 'decreasing' ? 'text-eco-500' : predictions.trend === 'increasing' ? 'text-red-500' : 'text-gray-500'}`}>
                {predictions.trend}
              </span>
              {predictions.confidence && ` · ${(predictions.confidence * 100).toFixed(0)}% confidence`}
            </p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Emission Sources</h3>
          {data?.categoryBreakdown && Object.keys(data.categoryBreakdown).length > 0 ? (
            <EmissionPieChart breakdown={data.categoryBreakdown} />
          ) : (
            <p className="text-gray-500 text-center py-12">Log your first entry to see breakdown</p>
          )}
        </div>

        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Historical Trend</h3>
          {data?.trend?.length > 0 ? (
            <TrendLineChart trend={data.trend} />
          ) : (
            <p className="text-gray-500 text-center py-12">No trend data yet</p>
          )}
        </div>
      </div>

      {/* SHAP Explainable AI */}
      {shap && (
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Explainable AI — Why Are Emissions High?
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{shap.explanation}</p>
          {shap.contributions && Object.keys(shap.contributions).length > 0 && (
            <ShapBarChart contributions={shap.contributions} />
          )}
          {shap.topFactors?.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {shap.topFactors.map((f) => (
                <div key={f.name} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                  <p className="text-sm text-gray-500 capitalize">{f.name}</p>
                  <p className="text-xl font-bold text-eco-600">{f.percentage}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
