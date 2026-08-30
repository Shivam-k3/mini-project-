import { useState, useEffect } from 'react';
import { carbonAPI } from '../services/api';
import { ShapBarChart } from '../components/Charts';
import { ExplainableAISkeleton } from '../components/Skeleton';
import { FiCpu, FiInfo, FiActivity, FiTrendingUp, FiClock, FiZap } from 'react-icons/fi';

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
        <p className="section-label">Explainable AI</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Explainable AI Hub</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1.5 flex flex-wrap items-center gap-2">
          Transparent Shapley value attribution and emission source analysis for your carbon footprint.
          {fetchedAt && (
            <span className="badge badge-neutral">
              <FiClock size={12} /> Updated {formatRelativeTime(fetchedAt)}
            </span>
          )}
        </p>
      </div>

      {/* Narrative & Confidence Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left: Narrative reasoning (8 cols) */}
        <div className="lg:col-span-8 card flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[11px] font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider flex items-center gap-2">
                <FiCpu size={14} className="text-eco-600 dark:text-eco-400" /> AI Attribution Analysis
              </h3>
              <span className="badge badge-blue">
                {method === 'shap_tree_explainer' ? 'SHAP TreeExplainer' : 'Composition Analysis'}
              </span>
            </div>
            <div className="p-5 rounded-xl border border-ink-200 bg-surface-2 leading-relaxed text-sm text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200">
              <p>{explanation}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
              <p className="kpi-label">Primary Driver</p>
              <p className="mt-1 text-sm font-bold text-ink-900 dark:text-white capitalize">
                {primaryDriver || '—'}
              </p>
              {primaryPct && <p className="mt-0.5 text-[11px] font-semibold text-eco-600 dark:text-eco-400">{primaryPct}% of total</p>}
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
              <p className="kpi-label">Secondary Driver</p>
              <p className="mt-1 text-sm font-bold text-ink-900 dark:text-white capitalize">
                {secondaryDriver || '—'}
              </p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
              <p className="kpi-label">Analysis Method</p>
              <p className="mt-1 text-sm font-bold text-eco-600 dark:text-eco-400">
                {method === 'shap_tree_explainer' ? 'SHAP (Model-Based)' : 'Composition (Data-Driven)'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Confidence Score Gauge (4 cols) */}
        <div className="lg:col-span-4 card flex flex-col items-center justify-center text-center min-h-[300px]">
          <h3 className="section-label mb-4">Prediction Confidence</h3>
          <div className="relative w-40 h-40">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-ink-100 dark:text-ink-800" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(confidence || 0.5) * 251} 251`}
                className="text-eco-500 dark:text-eco-400 transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="kpi-value">
                {confidence ? Math.round(confidence * 100) : '—'}
              </span>
              <span className="kpi-label mt-1">Confidence</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-500 leading-normal mt-4">
            {confidence
              ? confidence >= 0.7
                ? 'Reliable prediction based on sufficient historical data.'
                : confidence >= 0.4
                  ? 'Moderate confidence. More data will improve accuracy.'
                  : 'Low confidence. Log more entries for better predictions.'
              : 'Log entries to calculate prediction confidence.'}
          </p>
          {predictionIntervals && (
            <div className="flex gap-4 mt-3 text-[11px] text-ink-500 font-medium">
              <span>Lower: {predictionIntervals.lower} kg</span>
              <span>Upper: {predictionIntervals.upper} kg</span>
            </div>
          )}
        </div>

      </div>

      {/* SHAP Chart & Recommendations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: SHAP contributions (7 cols) */}
        <div className="lg:col-span-7 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-label mb-0">Emission Contributions by Category</h3>
            <FiInfo className="text-ink-400 cursor-help" />
          </div>
          {Object.keys(contributions).length > 0 ? (
            <div className="h-[240px]">
              <ShapBarChart contributions={contributions} />
            </div>
          ) : (
            <p className="text-ink-400 text-center py-20 text-sm">Log carbon entries to visualize contributions.</p>
          )}
        </div>

        {/* Right: Recommendations (5 cols) */}
        <div className="lg:col-span-5 card">
          <h3 className="section-label mb-5 flex items-center gap-1.5">
            <FiActivity size={14} className="text-eco-600 dark:text-eco-400" /> Recommendations
          </h3>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-eco-50 text-eco-600 dark:bg-eco-500/15 dark:text-eco-400 mt-0.5">
                    <FiZap size={15} />
                  </div>
                  <p className="text-xs text-ink-700 dark:text-ink-200 leading-relaxed mt-1">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {topFactors.slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-eco-50 text-eco-600 dark:bg-eco-500/15 dark:text-eco-400 mt-0.5">
                    <FiTrendingUp size={15} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink-900 dark:text-white capitalize mb-0.5">{f.name}</p>
                    <p className="text-[11px] text-ink-400">{f.percentage}% of total emissions</p>
                  </div>
                </div>
              ))}
              {topFactors.length === 0 && (
                <p className="text-ink-400 text-center py-8 text-sm">No recommendations yet. Log your first carbon entry.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Model Feature Importance (only when SHAP model is available) */}
      {modelImportance && (
        <div className="card">
          <h3 className="section-label mb-3">ML Model Feature Importance</h3>
          <p className="text-xs text-ink-500 dark:text-ink-400 mb-4 leading-relaxed">
            The XGBoost model considers these features most influential when predicting your future emissions.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(modelImportance)
              .sort((a, b) => b[1] - a[1])
              .map(([feature, importance]) => (
                <div key={feature} className="rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                  <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider truncate">{feature.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="progress-track flex-1">
                      <div
                        className="progress-fill"
                        style={{ width: `${(importance / Math.max(...Object.values(modelImportance))) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-ink-900 dark:text-white">{importance.toFixed(3)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  );
}