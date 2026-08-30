import { useState, useEffect } from 'react';
import { carbonAPI } from '../services/api';
import { ShapBarChart } from '../components/Charts';
import { ExplainableAISkeleton } from '../components/Skeleton';
import { FiCpu, FiInfo, FiActivity, FiTrendingUp, FiClock } from 'react-icons/fi';

function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ExplainableAI() {
  const [data, setData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);

  useEffect(() => {
    carbonAPI.getDashboard()
      .then(({ data }) => {
        setDashboard(data);
        setData(data.shapExplanation);
        setFetchedAt(new Date().toISOString());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ExplainableAISkeleton />;

  const explanation = data?.explanation || "No carbon data yet. Log your activities in the Calculator to generate an AI-powered analysis.";
  const contributions = data?.contributions || {};
  const topFactors = data?.topFactors || [];
  const recommendations = data?.recommendations || [];
  const modelImportance = data?.modelFeatureImportance || null;
  const confidence = dashboard?.predictions?.confidence || null;
  const method = data?.method || 'composition_analysis';
  const predictionIntervals = dashboard?.predictions?.predictionIntervals || null;

  const primaryDriver = topFactors[0]?.name || null;
  const secondaryDriver = topFactors[1]?.name || null;
  const primaryPct = topFactors[0]?.percentage || null;

  return (
    <div className="space-y-6 animate-slide-up">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Explainable AI Hub</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
          Transparent Shapley value attribution and emission source analysis for your carbon footprint.
          {fetchedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 ml-2">
              <FiClock size={10} /> Updated {formatRelativeTime(fetchedAt)}
            </span>
          )}
        </p>
      </div>

      {/* Narrative & Confidence Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Narrative reasoning (8 cols) */}
        <div className="lg:col-span-8 glass-card p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                🤖 AI Attribution Analysis
              </h3>
              <span className="text-[10px] bg-eco-500/10 text-eco-600 dark:text-eco-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                {method === 'shap_tree_explainer' ? 'SHAP TreeExplainer' : 'Composition Analysis'}
              </span>
            </div>
            <div className="p-5 bg-white/40 dark:bg-gray-900/40 rounded-2xl border border-gray-200/50 dark:border-white/5 leading-relaxed text-sm text-gray-700 dark:text-gray-300">
              <p>{explanation}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Primary Driver</p>
              <p className="font-bold text-xs text-gray-800 dark:text-white mt-1 capitalize">
                {primaryDriver || '—'}
              </p>
              {primaryPct && <p className="text-[10px] text-eco-600 dark:text-eco-400 mt-0.5 font-semibold">{primaryPct}% of total</p>}
            </div>
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Secondary Driver</p>
              <p className="font-bold text-xs text-gray-800 dark:text-white mt-1 capitalize">
                {secondaryDriver || '—'}
              </p>
            </div>
            <div className="p-3.5 bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5 rounded-xl">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Analysis Method</p>
              <p className="font-bold text-xs text-eco-500 mt-1">
                {method === 'shap_tree_explainer' ? 'SHAP (Model-Based)' : 'Composition (Data-Driven)'}
              </p>
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
                strokeDasharray={`${(confidence || 0.5) * 251} 251`}
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
              <span className="text-3xl font-black text-gray-800 dark:text-white tracking-tight leading-none">
                {confidence ? Math.round(confidence * 100) : '—'}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">Confidence</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 leading-normal mt-4">
            {confidence
              ? confidence >= 0.7
                ? 'Reliable prediction based on sufficient historical data.'
                : confidence >= 0.4
                  ? 'Moderate confidence. More data will improve accuracy.'
                  : 'Low confidence. Log more entries for better predictions.'
              : 'Log entries to calculate prediction confidence.'}
          </p>
          {predictionIntervals && (
            <div className="flex gap-4 mt-3 text-[10px] text-gray-400 font-medium">
              <span>Lower: {predictionIntervals.lower} kg</span>
              <span>Upper: {predictionIntervals.upper} kg</span>
            </div>
          )}
        </div>

      </div>

      {/* SHAP Chart & Recommendations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: SHAP contributions (7 cols) */}
        <div className="lg:col-span-7 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emission Contributions by Category</h3>
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

        {/* Right: Recommendations (5 cols) */}
        <div className="lg:col-span-5 glass-card p-6">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
            <FiActivity className="inline text-eco-500 mr-1.5" /> Recommendations
          </h3>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40">
                  <div className="w-8 h-8 rounded-xl bg-eco-500/10 text-eco-500 flex items-center justify-center text-sm shrink-0 mt-0.5">
                    💡
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {topFactors.slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40">
                  <div className="w-8 h-8 rounded-xl bg-eco-500/10 text-eco-500 flex items-center justify-center text-sm shrink-0 mt-0.5">
                    💡
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-white capitalize mb-0.5">{f.name}</p>
                    <p className="text-[11px] text-gray-400">{f.percentage}% of total emissions</p>
                  </div>
                </div>
              ))}
              {topFactors.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No recommendations yet. Log your first carbon entry.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Model Feature Importance (only when SHAP model is available) */}
      {modelImportance && (
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold text-eco-600 dark:text-eco-400 uppercase tracking-wider mb-3">ML Model Feature Importance</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            The XGBoost model considers these features most influential when predicting your future emissions.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(modelImportance)
              .sort((a, b) => b[1] - a[1])
              .map(([feature, importance]) => (
                <div key={feature} className="p-3 rounded-xl bg-gray-100/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-white/5">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{feature.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-eco-500 to-ocean-500"
                        style={{ width: `${(importance / Math.max(...Object.values(modelImportance))) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-gray-800 dark:text-white">{importance.toFixed(3)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  );
}
