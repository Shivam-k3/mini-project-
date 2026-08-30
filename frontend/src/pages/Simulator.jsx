import { useState, useEffect } from 'react';
import { simulatorAPI, carbonAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiPlay, FiSliders, FiCpu, FiTrendingUp, FiPlusCircle, FiNavigation, FiUsers } from 'react-icons/fi';
import { formatMode } from '../utils/modeLabels';

const MODES = [
  { value: 'car', label: 'Car' },
  { value: 'ev', label: 'EV' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'auto_rickshaw', label: 'Auto-rickshaw' },
  { value: 'bus', label: 'Bus' },
  { value: 'metro', label: 'Metro' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'walk', label: 'Walk' },
];

export default function Simulator() {
  const [scenarios, setScenarios] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  // null = still checking. The API simulates against the most recent entry's
  // trips (backend/routes/simulator.js), so with none it can only 400.
  const [hasTrips, setHasTrips] = useState(null);
  const [customChanges, setCustomChanges] = useState({
    replaceMode: 'car',
    newMode: 'metro',
    occupants: 1,
    evSwap: false,
  });

  useEffect(() => {
    simulatorAPI.getScenarios()
      .then(({ data }) => setScenarios(data))
      .catch(console.error)
      .finally(() => setScenariosLoading(false));

    // Mirrors the backend's baseline lookup: newest entry first, must have trips.
    carbonAPI.getAll({ limit: 1 })
      .then(({ data }) => setHasTrips((data?.entries?.[0]?.trips?.length ?? 0) > 0))
      .catch(() => setHasTrips(null));
  }, []);

  const noTrips = hasTrips === false;

  const runSimulation = async (changes, name) => {
    if (noTrips) return;
    setLoading(true);
    try {
      const { data } = await simulatorAPI.simulate({ changes, name });
      setResult(data);
      toast.success('Mobility simulation complete!');
    } catch (err) {
      // A 400 here means the baseline entry has no trips after all (e.g. it was
      // deleted in another tab) — surface the empty state instead of a toast only.
      if (err.response?.status === 400) setHasTrips(false);
      toast.error(err.response?.data?.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const runCustom = () => {
    const changes = {};
    if (customChanges.evSwap) {
      changes.vehicleSwap = { category: 'hatchback', fuelType: 'electric' };
      changes.onlyMode = customChanges.replaceMode;
    } else if (customChanges.replaceMode && customChanges.newMode && customChanges.replaceMode !== customChanges.newMode) {
      changes.replaceMode = customChanges.replaceMode;
      changes.newMode = customChanges.newMode;
    }
    if (customChanges.occupants > 1) {
      changes.mode = customChanges.replaceMode || 'car';
      changes.occupants = customChanges.occupants;
    }
    if (!Object.keys(changes).length) {
      toast.error('Pick a change to simulate');
      return;
    }
    runSimulation(changes, 'Custom Mobility Scenario');
  };

  // The API is transportation-only: baseline/scenario always carry
  // transportPersonal and a per-mode breakdown.
  const baselineTotal = result?.baseline?.transportPersonal;
  const scenarioTotal = result?.scenario?.transportPersonal;

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Page Header */}
      <div>
        <p className="section-label">Mobility Twin</p>
        <h1 className="text-2xl sm:text-3xl font-bold">Mobility Twin Simulator</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
          Test commute changes against your last logged trip — see the impact before you make them.
        </p>
      </div>

      {/* No baseline to simulate against — the API needs at least one logged trip */}
      {noTrips && (
        <div className="card flex flex-col sm:flex-row sm:items-center gap-4 border-warn-200 bg-warn-50/40 dark:bg-warn-500/10">
          <div className="w-11 h-11 shrink-0 rounded-lg bg-warn-100 dark:bg-warn-500/15 text-warn-600 dark:text-warn-400 flex items-center justify-center border border-warn-200 dark:border-warn-500/20">
            <FiNavigation size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">No trips to simulate yet</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 leading-relaxed">
              The simulator compares scenarios against your most recently logged trips. Log a commute
              first and every preset below unlocks.
            </p>
          </div>
          <Link to="/calculator" className="btn-primary py-2.5 px-4 text-xs shrink-0">
            <FiPlusCircle size={14} /> Log a trip
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column */}
        <div className="lg:col-span-5 space-y-6">

          {/* Presets */}
          <div className="card p-5">
            <h3 className="section-label flex items-center gap-1.5">
              <FiCpu className="text-eco-600 dark:text-eco-400" /> Mobility Presets
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {scenariosLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-16" />
                ))
              ) : scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => runSimulation(s.changes, s.name)}
                  disabled={loading || noTrips}
                  className="card-hover p-3.5 text-left font-medium group flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="overflow-hidden pr-3">
                    <h4 className="text-xs font-bold group-hover:text-eco-600 dark:group-hover:text-eco-400 leading-tight">{s.name}</h4>
                    <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1 truncate">{s.description}</p>
                  </div>
                  <FiPlay className="text-ink-400 group-hover:text-eco-500 group-hover:translate-x-0.5 transition-all shrink-0" size={13} />
                </button>
              ))}
            </div>
            {!scenariosLoading && scenarios.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-6">No presets available.</p>
            )}
          </div>

          {/* Custom Controls */}
          <div className="card p-5 space-y-5">
            <h3 className="section-label flex items-center gap-1.5">
              <FiSliders className="text-ocean-600 dark:text-ocean-400" /> Scenario Adjustments
            </h3>

            {/* Mode swap */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="input-label text-[10px] uppercase tracking-wider">Shift mode</label>
                <select aria-label="Shift mode" className="input-field py-2 text-xs" value={customChanges.replaceMode}
                  onChange={(e) => setCustomChanges({ ...customChanges, replaceMode: e.target.value })}>
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="input-label text-[10px] uppercase tracking-wider">To</label>
                <select aria-label="New mode" className="input-field py-2 text-xs" value={customChanges.newMode}
                  onChange={(e) => setCustomChanges({ ...customChanges, newMode: e.target.value })}>
                  {MODES.filter((m) => m.value !== customChanges.replaceMode).map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Occupants */}
            <div className="space-y-1.5">
              <label className="input-label text-[10px] uppercase tracking-wider">
                Occupants on &quot;{customChanges.replaceMode}&quot; trips
              </label>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setCustomChanges({ ...customChanges, occupants: Math.max(1, customChanges.occupants - 1) })}
                  className="btn-secondary w-9 h-9 p-0 font-black"
                >−</button>
                <span className="flex-1 text-center text-lg font-black">
                  {customChanges.occupants === 1 ? 'Solo (1)' : `${customChanges.occupants} people`}
                </span>
                <button type="button"
                  onClick={() => setCustomChanges({ ...customChanges, occupants: Math.min(8, customChanges.occupants + 1) })}
                  className="btn-secondary w-9 h-9 p-0 font-black"
                >+</button>
              </div>
              <p className="text-[9px] text-ink-400 dark:text-ink-500 flex items-center gap-1"><FiUsers size={11} /> Shared rides split vehicle emissions equally among occupants</p>
            </div>

            {/* EV swap */}
            <div className="flex items-center justify-between p-3 rounded-lg surface-soft border border-ink-200 dark:border-ink-800">
              <div>
                <h4 className="text-xs font-bold">Swap vehicle for an EV</h4>
                <p className="text-[9px] text-ink-400 dark:text-ink-500">Applies to your car/motorcycle trips</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" checked={customChanges.evSwap}
                  onChange={(e) => setCustomChanges({ ...customChanges, evSwap: e.target.checked })}
                  className="sr-only peer" />
                <div className="w-9 h-5 bg-ink-200 dark:bg-ink-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-eco-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-eco-500"></div>
              </label>
            </div>

            <button onClick={runCustom} disabled={loading || noTrips} className="btn-accent w-full py-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Running...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="space-y-6 animate-fade-in">

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card text-center p-4">
                  <p className="kpi-label">Baseline</p>
                  <p className="text-xl font-black text-high-600 dark:text-high-400 mt-1">{(baselineTotal ?? 0)?.toFixed?.(1) ?? baselineTotal} kg</p>
                </div>
                <div className="card text-center p-4">
                  <p className="kpi-label">Scenario</p>
                  <p className="text-xl font-black text-eco-600 dark:text-eco-400 mt-1">{(scenarioTotal ?? 0)?.toFixed?.(1) ?? scenarioTotal} kg</p>
                </div>
                <div className="card text-center p-4">
                  <p className="kpi-label">CO₂ Saved</p>
                  <p className="text-xl font-black text-ocean-600 dark:text-ocean-400 mt-1">{result.reduction?.toFixed?.(1) ?? result.reduction} kg</p>
                </div>
                <div className="card text-center p-4">
                  <p className="kpi-label">Reduction</p>
                  <p className="text-xl font-black text-eco-600 dark:text-eco-400 mt-1">{result.reductionPercent ?? 0}%</p>
                </div>
              </div>

              {/* Yearly projections */}
              <div className="card p-5">
                <h3 className="section-label mb-4 flex items-center gap-1.5">
                  <FiTrendingUp className="text-eco-600 dark:text-eco-400" /> Yearly Projections
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-lg surface-soft">
                    <p className="kpi-label">Yearly Savings</p>
                    <p className="text-lg font-black text-eco-600 dark:text-eco-400 mt-1">{result.yearlySavings ?? 0} <span className="text-[10px] font-normal text-ink-400 dark:text-ink-500">kg</span></p>
                  </div>
                  <div className="p-4 rounded-lg surface-soft">
                    <p className="kpi-label">Trees Equivalent</p>
                    <p className="text-lg font-black text-eco-600 dark:text-eco-400 mt-1">{result.treesEquivalent ?? 0}</p>
                  </div>
                  <div className="p-4 rounded-lg surface-soft">
                    <p className="kpi-label">Impact Score</p>
                    <p className="text-lg font-black text-ocean-600 dark:text-ocean-400 mt-1">{result.impactScore ?? 0} <span className="text-[10px] font-normal text-ink-400 dark:text-ink-500">/100</span></p>
                  </div>
                </div>
              </div>

              {/* Trip-level comparison */}
              {result.baseline?.tripDetails && (
                <div className="card p-5">
                  <h3 className="section-label mb-4">Trip-level Detail</h3>
                  <div className="space-y-2">
                    {[...result.baseline.tripDetails, ...result.scenario.tripDetails].length === 0 && (
                      <p className="text-xs text-ink-400 dark:text-ink-500">No trips.</p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="section-label text-high-600 dark:text-high-400">Baseline trips</p>
                        {(result.baseline.tripDetails || []).map((t, i) => (
                          <div key={`b${i}`} className="flex justify-between text-xs py-1.5 border-b border-ink-100 dark:border-ink-800">
                            <span>{formatMode(t.mode)} · {t.distanceKm} km · {t.occupants || 1} pax</span>
                            <span className="font-bold">{Number(t.personalAllocatedEmission ?? 0).toFixed(2)} kg</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="section-label text-eco-600 dark:text-eco-400">Scenario trips</p>
                        {(result.scenario.tripDetails || []).map((t, i) => (
                          <div key={`s${i}`} className="flex justify-between text-xs py-1.5 border-b border-ink-100 dark:border-ink-800">
                            <span>{formatMode(t.mode)} · {t.distanceKm} km · {t.occupants || 1} pax</span>
                            <span className="font-bold">{Number(t.personalAllocatedEmission ?? 0).toFixed(2)} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center text-center py-24 min-h-[400px]">
              <div className="w-16 h-16 rounded-lg bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500 flex items-center justify-center mb-4 border border-ink-200 dark:border-ink-700">
                {noTrips ? <FiNavigation size={26} /> : <FiSliders size={26} />}
              </div>
              <h3 className="text-base font-bold">
                {noTrips ? 'No Baseline Yet' : 'Awaiting Simulation'}
              </h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 max-w-xs mx-auto mt-2 leading-relaxed">
                {noTrips
                  ? 'Log your first trip to give the simulator a real commute to compare against.'
                  : 'Run a preset or custom scenario to compare it against your real commute.'}
              </p>
              {noTrips && (
                <Link to="/calculator" className="btn-primary mt-5 py-2.5 px-4 text-xs">
                  <FiPlusCircle size={14} /> Log a trip
                </Link>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
