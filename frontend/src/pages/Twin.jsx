import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiRefreshCw, FiCpu, FiNavigation, FiUsers, FiTrendingUp, FiInfo, FiActivity, FiArrowRight } from 'react-icons/fi';
import { twinAPI } from '../services/api';
import { formatMode } from '../utils/modeLabels';

const MODE_BAR_COLOR = {
  car: 'bg-graph-primary', motorcycle: 'bg-graph-info', auto_rickshaw: 'bg-graph-amber',
  bus: 'bg-graph-slate', metro: 'bg-graph-violet', ev: 'bg-graph-teal', bicycle: 'bg-graph-info',
  walk: 'bg-graph-slate', flight: 'bg-graph-amber',
};

function StatTile({ label, value, unit, accent }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-[-0.02em] ${accent ? 'text-eco-600 dark:text-eco-400' : 'text-ink-900 dark:text-white'}`}>
        {value}
      </p>
      {unit && <p className="mt-0.5 text-xs text-ink-400">{unit}</p>}
    </div>
  );
}

function ModeRow({ mode, km, kg, share }) {
  const bar = MODE_BAR_COLOR[mode] || 'bg-graph-slate';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 dark:border-ink-800 last:border-0">
      <span className={`w-2.5 h-2.5 rounded-sm ${bar}`} />
      <span className="w-28 truncate text-sm font-medium text-ink-700 dark:text-ink-200">{formatMode(mode)}</span>
      <div className="flex-1 h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
      <span className="w-20 text-right text-xs text-ink-400">{km?.toFixed?.(1) ?? 0} km</span>
      <span className="w-20 text-right text-xs font-semibold text-ink-700 dark:text-ink-200">{kg?.toFixed?.(2) ?? 0} kg</span>
    </div>
  );
}

function QualityBadge({ quality }) {
  if (quality === 'good')   return <span className="badge-eco">Good sample</span>;
  if (quality === 'moderate') return <span className="badge-amber">Moderate sample</span>;
  if (quality === 'sparse')  return <span className="badge-neutral">Sparse data</span>;
  return <span className="badge-neutral">No data yet</span>;
}

function TwinPage() {
  const [twin, setTwin] = useState(null);
  const [replacements, setReplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const { data } = refresh ? await twinAPI.refresh() : await twinAPI.get();
      setTwin(data.twin);
      setReplacements(data.replacements || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load your Mobility Twin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => { setRefreshing(true); await load(true); };

  const baseline = twin?.baseline;
  const vp = twin?.vehicleProfile || {};
  const noData = !baseline || baseline.entryCount === 0;
  const modeBreakdown = baseline?.modeBreakdown || {};
  const totalKg = Object.values(modeBreakdown).reduce((a, b) => a + b, 0);
  const primaryMode = Object.entries(modeBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0];

  const inner = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">Personal Mobility Intelligence</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">Your Mobility Twin</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            A data profile of your travel behaviour, derived from your logged trips. Nothing fabricated — every figure comes from your entries.
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary self-start shrink-0">
          <FiRefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Re-derive twin
        </button>
      </div>

      {error && (
        <div className="card border-high-200 dark:border-high-800 bg-high-50 dark:bg-high-900/30 text-high-700 dark:text-high-300 flex items-start gap-3">
          <FiInfo className="mt-0.5 shrink-0" size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 skeleton" />)}
        </div>
      )}

      {!loading && noData && (
        <div className="card flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="w-12 h-12 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400">
            <FiCpu size={22} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-ink-900 dark:text-white">No trips logged yet</h2>
          <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">
            Your Twin is built from your actual trips. Log at least one commute and it will appear here — estimates, habits and recommendations are all derived from your own data.
          </p>
          <Link to="/calculator" className="btn-primary mt-5">
            <FiNavigation size={15} /> Log your first trip <FiArrowRight size={15} />
          </Link>
        </div>
      )}

      {!loading && !noData && twin && (
        <>
          {/* Data quality + baseline KPIs */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink-900 dark:text-white">Baseline snapshot</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">{baseline.entryCount} sample day{(baseline.entryCount !== 1) && 's'}</span>
                <QualityBadge quality={baseline.dataQuality} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatTile label="Average daily" value={baseline.dailyPersonalKg?.toFixed(2) ?? '0.00'} unit="kg CO₂ / day" />
              <StatTile label="Weekly" value={baseline.weeklyPersonalKg?.toFixed(1) ?? '0.0'} unit="kg CO₂ / week" />
              <StatTile label="Monthly" value={baseline.monthlyPersonalKg?.toFixed(1) ?? '0.0'} unit="kg CO₂ / month" />
              <StatTile label="Your primary mode" value={formatMode(primaryMode) || '—'} unit={primaryMode ? 'most used' : 'not yet identified'} />
            </div>
          </div>

          {/* Vehicle profile */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-ink-900 dark:text-white mb-4">Vehicle profile</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Mode</span>
                <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{formatMode(vp.mode) || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Model</span>
                <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{vp.manufacturer ? `${vp.manufacturer} ${vp.model || ''}`.trim() : (vp.model || '—')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Category</span>
                <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{vp.category || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Fuel</span>
                <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{vp.fuelType || '—'}</span>
              </div>
            </div>
          </div>

          {/* Mode breakdown */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-ink-900 dark:text-white mb-2">Mode mix</h2>
            <p className="text-xs text-ink-400 mb-4">Weekly kilometres and average CO₂ contributed by each mode.</p>
            {Object.keys(baseline.modeBreakdown || {}).length === 0 ? (
              <p className="text-sm text-ink-400 py-6 text-center">No mode breakdown available.</p>
            ) : (
              <div>
                {Object.entries(baseline.modeBreakdown).map(([mode, kg]) => (
                  <ModeRow
                    key={mode}
                    mode={mode}
                    kg={kg}
                    km={baseline.weeklyKmByMode?.[mode]}
                    share={totalKg > 0 ? (kg / totalKg) * 100 : 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Occupancy profile */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-ink-900 dark:text-white mb-4 flex items-center gap-2"><FiUsers size={16} className="text-ink-400" /> Average occupancy</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.keys(baseline.occupancyProfile || {}).length === 0 ? (
                <p className="text-sm text-ink-400">No shared-mode trips recorded yet.</p>
              ) : (
                Object.entries(baseline.occupancyProfile).map(([mode, occ]) => (
                  <div key={mode} className="rounded-lg bg-surface-2 dark:bg-ink-800 p-3 text-center">
                    <p className="text-lg font-bold text-ink-900 dark:text-white">{occ}</p>
                    <p className="text-[11px] text-ink-400">{formatMode(mode)} occupants</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Personalized replacements */}
          {replacements.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 dark:text-white mb-1 flex items-center gap-2"><FiActivity size={16} className="text-ink-400" /> Lower-impact options</h2>
              <p className="text-xs text-ink-400 mb-4">Alternatives computed against your own travel patterns.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {replacements.map((r, i) => (
                  <div key={i} className="rounded-lg border border-ink-200 dark:border-ink-700 p-4 space-y-1.5">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{r.title}</p>
                    {r.dailyKg != null && (
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        <span className="font-semibold text-eco-600 dark:text-eco-400">−{(r.dailyKg*7)?.toFixed?.(1) ?? r.dailyKg} kg</span> per week
                        <span className="text-ink-300 dark:text-ink-600"> · </span>daily −{r.dailyKg?.toFixed?.(2)} kg
                      </p>
                    )}
                    {r.basis && <p className="text-[11px] text-ink-400">{r.basis}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved scenarios */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-ink-900 dark:text-white flex items-center gap-2"><FiTrendingUp size={16} className="text-ink-400" /> Saved scenarios</h2>
              <Link to="/simulator" className="inline-flex items-center gap-1 text-xs font-semibold text-eco-700 dark:text-eco-400 hover:underline">
                Open Simulator <FiArrowRight size={13} />
              </Link>
            </div>
            <p className="text-xs text-ink-400 mb-4">What-ifs you evaluated against your baseline. Historical trips are never modified.</p>
            {(twin.scenarios || []).length === 0 ? (
              <p className="text-sm text-ink-400 py-4 text-center">No scenarios saved yet. Run one in the Simulator.</p>
            ) : (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {twin.scenarios.map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{s.name}</p>
                      <p className="text-[11px] text-ink-400">Projected {s.result?.projectedPercent != null ? `−${s.result.projectedPercent}%` : s.result?.reductionPercent != null ? `−${s.result.reductionPercent}%` : ''} · −{s.result?.reductionKg ?? 0} kg/day</p>
                    </div>
                    <span className="text-xs font-semibold text-eco-600 dark:text-eco-400">{s.result?.yearlySavingsKg ? `≈${s.result.yearlySavingsKg} kg/yr` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to explainable AI */}
          <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-base font-bold text-ink-900 dark:text-white">Understand what drives your emissions</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">See which modes and habits contribute most, with model explanations.</p>
            </div>
            <Link to="/explainable-ai" className="btn-primary shrink-0">
              <FiActivity size={15} /> Explainable AI <FiArrowRight size={15} />
            </Link>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {inner}
    </div>
  );
}

export default TwinPage;
