import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { carbonAPI, gamificationAPI } from '../services/api';
import StatCard from '../components/StatCard';
import { EmissionPieChart, TrendLineChart, ShapBarChart } from '../components/Charts';
import { 
  FiSun, FiCalendar, FiTrendingUp, FiGlobe, FiZap, 
  FiArrowRight, FiPlusCircle, FiCpu, FiMessageCircle, FiFileText 
} from 'react-icons/fi';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      carbonAPI.getDashboard(), 
      gamificationAPI.getStats(),
      carbonAPI.getAll({ limit: 4 })
    ])
      .then(([dash, gam, entries]) => {
        setData(dash.data);
        setStats(gam.data);
        setRecentEntries(entries.data?.entries || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  const shap = data?.shapExplanation;
  const predictions = data?.predictions;

  return (
    <div className="space-y-6">
      
      {/* Welcome & Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/40 dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-200/50 dark:border-white/5 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Climate Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Analyze your carbon budget, run digital twin simulations, and monitor predictions.
          </p>
        </div>
        
        {/* Quick Actions Grid */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Link to="/calculator" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-md">
            <FiPlusCircle size={14} /> Log Footprint
          </Link>
          <Link to="/simulator" className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 bg-white/60 dark:bg-gray-800/40 hover:bg-white/90 active:scale-95">
            <FiCpu size={14} /> Run Twin Simulation
          </Link>
          <Link to="/assistant" className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 bg-white/60 dark:bg-gray-800/40 hover:bg-white/90 active:scale-95">
            <FiMessageCircle size={14} /> Ask AI
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="☀️" label="Today" value={data?.daily || 0} unit="kg CO₂" color="eco" />
        <StatCard icon="📅" label="This Week" value={data?.weekly || 0} unit="kg CO₂" color="ocean" />
        <StatCard icon="📊" label="This Month" value={data?.monthly || 0} unit="kg CO₂" color="purple" />
        <StatCard icon="🌍" label="All Time" value={data?.total || 0} unit="kg CO₂" color="amber" />
      </div>

      {/* Eco Score & Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Eco Score Radials */}
        <div className="glass-card flex flex-col justify-between items-center text-center p-6 min-h-[260px]">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Eco Score Indicator</h3>
          <div className="relative w-36 h-36 my-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="url(#ecoScoreGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(stats?.ecoScore || 0) * 2.51} 251`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="ecoScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-800 dark:text-white tracking-tight leading-none">{stats?.ecoScore || 0}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">Budget Index</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-semibold text-gray-500">
            <div>Points: <span className="text-eco-500 font-bold">{stats?.greenPoints || 0}</span></div>
            <div className="text-gray-300">|</div>
            <div>Streak: <span className="text-ocean-500 font-bold">{stats?.streak || 0} days</span></div>
          </div>
        </div>

        {/* Machine Learning Predictions */}
        <div className="glass-card lg:col-span-2 flex flex-col justify-between p-6 min-h-[260px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <FiZap className="text-amber-500 fill-amber-500/10" /> ML Emission Forecasts
              </h3>
              {predictions?.confidence && (
                <span className="text-[10px] bg-eco-500/10 text-eco-600 dark:text-eco-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  {(predictions.confidence * 100).toFixed(0)}% Confidence
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-eco-500/5 border border-eco-500/10">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Predicted Next Week</p>
                <p className="text-2xl font-black text-eco-600 dark:text-eco-400 mt-1">
                  {predictions?.nextWeek || 0} <span className="text-xs font-normal text-gray-400">kg CO₂</span>
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-ocean-500/5 border border-ocean-500/10">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Predicted Next Month</p>
                <p className="text-2xl font-black text-ocean-600 dark:text-ocean-400 mt-1">
                  {predictions?.nextMonth || 0} <span className="text-xs font-normal text-gray-400">kg CO₂</span>
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex items-center justify-between text-xs text-gray-400">
            <span className="font-medium">
              Trend Status: <span className={`font-bold uppercase ${
                predictions?.trend === 'decreasing' ? 'text-eco-500' :
                predictions?.trend === 'increasing' ? 'text-red-500' : 'text-gray-500'
              }`}>{predictions?.trend || 'Stable'}</span>
            </span>
            <span className="text-[10px] font-mono">Gradient Boosting Model</span>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Emission Source Breakdown</h3>
          {data?.categoryBreakdown && Object.keys(data.categoryBreakdown).length > 0 ? (
            <div className="max-w-[280px] mx-auto">
              <EmissionPieChart breakdown={data.categoryBreakdown} />
            </div>
          ) : (
            <p className="text-gray-400 text-center py-20 text-sm">Log carbon entries to visualize sources.</p>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Historical Emission Trend</h3>
          {data?.trend?.length > 0 ? (
            <div className="h-[240px]">
              <TrendLineChart trend={data.trend} />
            </div>
          ) : (
            <p className="text-gray-400 text-center py-20 text-sm">No historical log entries recorded.</p>
          )}
        </div>
      </div>

      {/* SHAP Explainable AI Panel */}
      {shap && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                🤖 Explainable AI — Attribution Insights
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Transparent Shapley value attribution for recorded carbon footprints.</p>
            </div>
            <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
              SHAP Analysis
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Written Explanation */}
            <div className="lg:col-span-1 space-y-4">
              <div className="p-5 rounded-2xl bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: shap.explanation }}></p>
              </div>
              {shap.recommendations?.length > 0 && (
                <div className="p-4 rounded-2xl bg-eco-500/5 border border-eco-500/10">
                  <h4 className="text-xs font-bold text-eco-700 dark:text-eco-400 uppercase tracking-wider mb-1.5">Eco Advice</h4>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {shap.recommendations.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Contributions Chart */}
            <div className="lg:col-span-2">
              {shap.contributions && Object.keys(shap.contributions).length > 0 && (
                <div className="h-[220px]">
                  <ShapBarChart contributions={shap.contributions} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activities Timeline */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent Activity Timeline</h3>
          <Link to="/calculator" className="text-xs text-eco-500 hover:text-eco-600 font-bold flex items-center gap-1">
            Log Entry <FiArrowRight />
          </Link>
        </div>

        {recentEntries.length > 0 ? (
          <div className="space-y-4">
            {recentEntries.map((e) => (
              <div key={e._id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-eco-500/10 text-eco-500 flex items-center justify-center font-bold">
                    🌿
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-white">Logged carbon entry</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(e.date).toLocaleDateString()} at {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-800 dark:text-white">{e.totalEmissions?.toFixed(2)} kg</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">CO₂ Equivalent</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8 text-sm">No activity logs recorded yet.</p>
        )}
      </div>

    </div>
  );
}
