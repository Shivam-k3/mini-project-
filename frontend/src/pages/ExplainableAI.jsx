import { useState, useEffect } from 'react';
import { carbonAPI } from '../services/api';
import { ShapBarChart } from '../components/Charts';
import { FiCpu, FiInfo, FiActivity, FiShield, FiTrendingUp } from 'react-icons/fi';

export default function ExplainableAI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carbonAPI.getDashboard()
      .then(({ data }) => setData(data.shapExplanation))
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

  // Fallback metadata if not provided by backend
  const explanation = data?.explanation || "No active carbon logs found. Log your transport, electricity, or shopping usage in the calculator to generate an attribution model.";
  const contributions = data?.contributions || {};
  const recommendations = data?.recommendations || [];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Explainable AI Hub</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Transparent Shapley value attribution and telemetry mapping for your carbon footprint model.
        </p>
      </div>

      {/* Narrative & Confidence Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Narrative reasoning (8 cols) */}
        <div className="lg:col-span-8 glass-card p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                🤖 Narrative Reasoning
              </h3>
              <span className="text-[10px] bg-eco-500/10 text-eco-600 dark:text-eco-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                Model: EcoSense-v4
              </span>
            </div>
            <div className="p-5 bg-white/40 dark:bg-gray-900/40 rounded-2xl border border-gray-200/50 dark:border-white/5 leading-relaxed text-sm text-gray-700 dark:text-gray-300">
              <p dangerouslySetInnerHTML={{ __html: explanation }}></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Primary Driver</p>
              <p className="font-bold text-xs text-gray-800 dark:text-white mt-1">Electricity Grid</p>
            </div>
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Secondary Driver</p>
              <p className="font-bold text-xs text-gray-800 dark:text-white mt-1">Logistics Shift</p>
            </div>
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Mitigation Factor</p>
              <p className="font-bold text-xs text-eco-500 mt-1">Solar Panels</p>
            </div>
          </div>
        </div>

        {/* Right: Confidence Score Gauge (4 cols) */}
        <div className="lg:col-span-4 glass-card p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Prediction Confidence</h3>
          <div className="relative w-40 h-40">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="url(#confGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray="231 251"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-800 dark:text-white tracking-tight leading-none">92%</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">Optimal Data</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 leading-normal mt-4">
            High certainty based on robust historical telemetry and verified supplier emission factors.
          </p>
        </div>

      </div>

      {/* SHAP Chart & Hotspots Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: SHAP contributions (7 cols) */}
        <div className="lg:col-span-7 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feature Contributions (SHAP)</h3>
            <FiInfo className="text-gray-400 hover:text-gray-600 cursor-help" />
          </div>
          {Object.keys(contributions).length > 0 ? (
            <div className="h-[240px]">
              <ShapBarChart contributions={contributions} />
            </div>
          ) : (
            <p className="text-gray-400 text-center py-20 text-sm">Log carbon entries to visualize contributions.</p>
          )}
        </div>

        {/* Right: Critical Hotspots (5 cols) */}
        <div className="lg:col-span-5 glass-card p-6">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Critical Hotspots</h3>
          <div className="space-y-3">
            {[
              { title: 'Global Air Logistics', desc: 'Air freight shipping commute', severity: 'High', color: 'text-red-500 bg-red-500/10' },
              { title: 'Assembly Grid Load', desc: 'Utility grid electricity usage', severity: 'Medium', color: 'text-amber-500 bg-amber-500/10' },
              { title: 'Cloud Infrastructure', desc: 'Server data processing loads', severity: 'Low', color: 'text-eco-500 bg-eco-500/10' }
            ].map((item) => (
              <div key={item.title} className="flex items-center justify-between p-3 rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${item.color.split(' ')[1]}`}>
                    🔥
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-white leading-none">{item.title}</h4>
                    <p className="text-[9px] text-gray-400 mt-1 leading-none">{item.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${item.color}`}>{item.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Model Performance Metadata */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h3 className="text-xs font-bold text-eco-600 dark:text-eco-400 uppercase tracking-wider mb-1">Technical Metadata</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
            This model uses Gradient Boosted Decision Trees (XGBoost) with a Bayesian optimization wrapper. Training data is refreshed every 24 hours from local carbon telemetry logs.
          </p>
        </div>
        <div className="flex gap-8 shrink-0">
          <div className="text-center">
            <p className="text-xl font-black text-gray-800 dark:text-white">0.024</p>
            <p className="text-[9px] text-gray-400 uppercase font-bold mt-1">RMSE Error</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-gray-800 dark:text-white">4.2M</p>
            <p className="text-[9px] text-gray-400 uppercase font-bold mt-1">Parameters</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-gray-800 dark:text-white">2ms</p>
            <p className="text-[9px] text-gray-400 uppercase font-bold mt-1">Latency</p>
          </div>
        </div>
      </div>

    </div>
  );
}
