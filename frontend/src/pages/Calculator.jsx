import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { carbonAPI, factorsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiCheckCircle, FiCheck, FiMapPin, FiUsers, FiSettings, FiClipboard, FiTruck, FiZap, FiMove, FiNavigation, FiSend, FiActivity } from 'react-icons/fi';
import { formatMode } from '../utils/modeLabels';
import { factorRequestFor, factorKey, resolveFactor } from '../utils/factorResolution';

// Presentation only — labels and Feather icons for the mode selector. Emission
// factors, occupancy rules and fuel/grid constants all come from the backend
// resolver (GET /api/factors/resolve); this page deliberately holds no factor
// table. Icons render inline where a mode is shown; the <select> options use
// plain text labels only.
const MODE_OPTIONS = [
  { value: 'car', label: 'Car', icon: FiTruck },
  { value: 'ev', label: 'Electric Vehicle', icon: FiZap },
  { value: 'motorcycle', label: 'Motorcycle / Scooter', icon: FiMove },
  { value: 'auto_rickshaw', label: 'Auto-rickshaw', icon: FiTruck },
  { value: 'bus', label: 'Bus', icon: FiTruck },
  { value: 'metro', label: 'Metro / Rail', icon: FiNavigation },
  { value: 'flight', label: 'Flight', icon: FiSend },
  { value: 'bicycle', label: 'Bicycle', icon: FiActivity },
  { value: 'walk', label: 'Walk', icon: FiMapPin },
];

const PURPOSES = ['commute', 'college', 'office', 'school', 'personal', 'other'];

// Typing a mileage or kWh/km figure changes the resolution request on every
// keystroke, so requests are debounced (spec §4). Mode and dropdown changes go
// through the same path — the wait is imperceptible and identical requests are
// answered from the session cache without touching the network.
const RESOLVE_DEBOUNCE_MS = 350;

const emptyTrip = () => ({
  mode: 'car',
  distanceKm: '',
  occupants: 1,
  purpose: 'commute',
  vehicle: { category: '', fuelType: '', fuelEfficiencyKmpl: '', electricityConsumptionKwhPerKm: '' },
});

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Provenance for one server-resolved factor (spec §3, §11): the number, where it
 * sits in the resolution hierarchy, and the formula behind it. Kept to a few
 * short lines so a normal user is not made to read dataset internals.
 */
function FactorBadge({ factor, pending, compact = false }) {
  if (!factor) {
    return pending
      ? <p className="text-[10px] italic text-ink-400 dark:text-ink-500">Resolving emission factor…</p>
      : null;
  }

  const value = `${Number(factor.factorKgPerKm).toFixed(3)} kg CO₂/km`;

  if (compact) {
    return (
      <p className="text-[10px] text-ink-400 dark:text-ink-500" title={factor.methodology}>
        <span className="font-bold text-ink-600 dark:text-ink-300">{value}</span>
        {' · '}{factor.factorLevelLabel}
      </p>
    );
  }

  return (
    <div className="p-2.5 rounded-lg border border-ink-200 dark:border-ink-800 bg-surface-2 dark:bg-ink-900 space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-ink-400 dark:text-ink-500">Emission factor</span>
        <span className="font-bold text-eco-600 dark:text-eco-400">{value}</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-ink-400 dark:text-ink-500">Source</span>
        <span className="font-bold text-ink-600 dark:text-ink-300">{factor.factorLevelLabel}</span>
      </div>
      {factor.methodology && (
        <p className="text-[10px] text-ink-400 dark:text-ink-500 leading-snug">
          <span className="font-bold">Method:</span> {factor.methodology}
        </p>
      )}
      {factor.factorSource && (
        <p className="text-[9px] text-ink-400 dark:text-ink-500 leading-snug">
          {factor.sourceUrl ? (
            <a href={factor.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-eco-600 dark:hover:text-eco-400">
              {factor.factorSource}
            </a>
          ) : factor.factorSource}
          {factor.sourceYear ? ` (${factor.sourceYear})` : ''}
        </p>
      )}
    </div>
  );
}

export default function Calculator() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([emptyTrip()]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // factorKey -> server resolution. Grows as the form is edited; a key is only
  // ever written from a backend response, never from a local constant.
  const [factors, setFactors] = useState({});
  const [modeMeta, setModeMeta] = useState(null);

  // Which modes split their emissions across occupants is a backend rule too —
  // fetched once so the occupants stepper does not need a local copy of it.
  useEffect(() => {
    let live = true;
    factorsAPI.getModes()
      .then(({ data }) => {
        if (live) setModeMeta(Object.fromEntries((data.modes || []).map((m) => [m.mode, m])));
      })
      .catch(() => { /* per-trip resolutions still carry occupancySplit */ });
    return () => { live = false; };
  }, []);

  // One request per distinct (mode, vehicle) combination on the form. Distance,
  // occupants, frequency and purpose are absent from the key by construction, so
  // editing them costs nothing (spec §4, §13).
  const requests = useMemo(() => trips.map(factorRequestFor), [trips]);
  const requestSignature = requests.map(factorKey).join('~');

  useEffect(() => {
    const distinct = new Map();
    for (const req of requests) {
      if (req) distinct.set(factorKey(req), req);
    }
    const missing = [...distinct.entries()].filter(([key]) => !factors[key]);
    if (!missing.length) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const settled = await Promise.all(missing.map(async ([key, req]) => {
        try {
          return [key, await resolveFactor(req)];
        } catch {
          return [key, null];
        }
      }));
      if (cancelled) return;
      const resolved = settled.filter(([, value]) => value);
      if (resolved.length) setFactors((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
      if (resolved.length < settled.length) toast.error('Could not reach the emission-factor service');
    }, RESOLVE_DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
    // factors is intentionally omitted: a resolution arriving must not re-trigger
    // the effect, and the request set is fully described by requestSignature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSignature]);

  const factorFor = (trip) => {
    const req = factorRequestFor(trip);
    return req ? factors[factorKey(req)] : undefined;
  };

  const splitsByOccupants = (trip) => {
    const resolved = factorFor(trip);
    if (resolved) return resolved.occupancySplit;
    return modeMeta?.[trip.mode]?.occupancySplit ?? false;
  };

  const updateTrip = (idx, patch) => {
    setTrips(trips.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const updateVehicle = (idx, key, value) => {
    setTrips(trips.map((t, i) => (
      i === idx ? { ...t, vehicle: { ...t.vehicle, [key]: value } } : t
    )));
  };

  const addTrip = () => setTrips([...trips, emptyTrip()]);
  const removeTrip = (idx) => {
    const next = trips.filter((_, i) => i !== idx);
    setTrips(next.length ? next : [emptyTrip()]);
  };

  // UI-only preview. It multiplies out the *server-returned* factor and mirrors
  // the server's occupancy allocation, so it agrees with the stored figure — but
  // it is never the scientific calculation: the backend recomputes everything
  // from the resolver on submit (spec §4, §5). Trips whose factor has not been
  // resolved yet are counted as pending rather than assumed.
  const liveStats = useMemo(() => {
    let personal = 0;
    let household = 0;
    let pending = 0;

    for (const t of trips) {
      const km = Number(t.distanceKm) || 0;
      if (km <= 0) continue;
      const resolved = factorFor(t);
      if (!resolved) { pending += 1; continue; }

      const totalKg = km * Number(resolved.factorKgPerKm);
      const occupants = Math.max(1, Math.min(8, Number(t.occupants) || 1));
      const share = resolved.occupancySplit ? totalKg / occupants : totalKg;
      household += totalKg;
      personal += share;
    }

    return { personal: r2(personal), household: r2(household), pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, factors]);

  const validTrips = trips.filter((t) => Number(t.distanceKm) > 0);
  const previewPersonal = liveStats.pending && !liveStats.personal ? '—' : liveStats.personal;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validTrips.length) {
      toast.error('Add at least one trip with a distance');
      return;
    }
    setLoading(true);
    try {
      // Only trip inputs are sent. No factor and no CO₂ figure travels with the
      // request — the server resolves both from the canonical dataset (spec §5).
      const payload = {
        date: new Date().toISOString(),
        trips: validTrips.map((t) => ({
          mode: t.mode,
          distanceKm: Number(t.distanceKm),
          occupants: Math.max(1, Math.min(8, Number(t.occupants) || 1)),
          tripFrequency: 1,
          purpose: t.purpose,
          vehicle: {
            ...(t.vehicle.category ? { category: t.vehicle.category } : {}),
            ...(t.vehicle.fuelType ? { fuelType: t.vehicle.fuelType } : {}),
            ...(t.vehicle.fuelEfficiencyKmpl ? { fuelEfficiencyKmpl: Number(t.vehicle.fuelEfficiencyKmpl) } : {}),
            ...(t.vehicle.electricityConsumptionKwhPerKm ? { electricityConsumptionKwhPerKm: Number(t.vehicle.electricityConsumptionKwhPerKm) } : {}),
          },
        })),
      };
      const { data } = await carbonAPI.create(payload);
      setResult(data);
      toast.success(`Logged ${data.transportPersonal ?? data.totalEmissions} kg CO₂ personal transport!`);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log trips');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Your Trips' },
    { num: 2, label: 'Vehicle Details' },
    { num: 3, label: 'Preview & Save' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">Personal Mobility Intelligence</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">Trip Logger</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Log today&apos;s travel — emissions are allocated per person for shared rides
        </p>
      </div>

      {/* Progress Tracker */}
      <div className="card flex items-center justify-between p-4">
        {stepsList.map((s, index) => (
          <div key={s.num} className="flex items-center gap-2 flex-1 last:flex-initial">
            <div className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
              step === s.num ? 'bg-eco-600 text-white' :
              step > s.num ? 'bg-eco-50 text-eco-700 dark:bg-eco-500/15 dark:text-eco-300' : 'bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
            }`}>
              {step > s.num ? <FiCheck size={14} /> : s.num}
            </div>
            <span className={`text-xs font-semibold hidden sm:inline ${step === s.num ? 'text-ink-900 dark:text-white' : 'text-ink-400 dark:text-ink-500'}`}>
              {s.label}
            </span>
            {index < stepsList.length - 1 && (
              <div className={`flex-1 h-[2px] mx-4 rounded-full ${step > s.num ? 'bg-eco-500' : 'bg-ink-200 dark:bg-ink-800'}`}></div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Form */}
        <div className="lg:col-span-2 card min-h-[350px] flex flex-col justify-between">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-ink-900 dark:text-white flex items-center gap-2"><FiMapPin size={16} className="text-ink-400" /> Today&apos;s Trips</h3>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Add each journey you made today.</p>
              </div>

              {trips.map((trip, idx) => (
                <div key={idx} className="surface-soft p-4 border border-ink-200 dark:border-ink-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Trip {idx + 1}</span>
                    {trips.length > 1 && (
                      <button type="button" onClick={() => removeTrip(idx)}
                        className="text-high-500 hover:text-high-600 dark:text-high-400 transition-colors" aria-label="Remove trip">
                        <FiTrash2 />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="input-label">Mode</label>
                      <select aria-label="Mode" className="input-field cursor-pointer" value={trip.mode}
                        onChange={(e) => updateTrip(idx, { mode: e.target.value })}>
                        {MODE_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <FactorBadge factor={factorFor(trip)} pending compact />
                    </div>
                    <div className="space-y-1.5">
                      <label className="input-label">Distance (km)</label>
                      <input aria-label="Distance (km)" type="number" min="0" step="any" className="input-field" placeholder="0.0"
                        value={trip.distanceKm}
                        onChange={(e) => updateTrip(idx, { distanceKm: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="input-label">Purpose</label>
                      <select aria-label="Purpose" className="input-field cursor-pointer" value={trip.purpose}
                        onChange={(e) => updateTrip(idx, { purpose: e.target.value })}>
                        {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  {splitsByOccupants(trip) && (
                    <div className="p-3 rounded-lg bg-eco-50 dark:bg-eco-500/10 border border-eco-200 dark:border-eco-500/20 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-ink-900 dark:text-white">Occupants (incl. driver)</h4>
                        <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Your share = vehicle emissions ÷ occupants</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => updateTrip(idx, { occupants: Math.max(1, (Number(trip.occupants) || 1) - 1) })}
                          className="w-8 h-8 rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 font-bold hover:bg-eco-600 hover:border-eco-600 hover:text-white transition-colors">−</button>
                        <span className="w-10 text-center text-lg font-bold text-ink-900 dark:text-white">{trip.occupants || 1}</span>
                        <button type="button"
                          onClick={() => updateTrip(idx, { occupants: Math.min(8, (Number(trip.occupants) || 1) + 1) })}
                          className="w-8 h-8 rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 font-bold hover:bg-eco-600 hover:border-eco-600 hover:text-white transition-colors">+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addTrip}
                className="w-full py-3 rounded-lg border-2 border-dashed border-ink-300 dark:border-ink-700 text-ink-500 dark:text-ink-400 font-semibold text-sm hover:border-ink-400 dark:hover:border-ink-600 hover:text-ink-700 dark:hover:text-ink-200 transition-colors flex items-center justify-center gap-2">
                <FiPlus /> Add Another Trip
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-ink-900 dark:text-white flex items-center gap-2"><FiSettings size={16} className="text-ink-400" /> Vehicle Details (optional)</h3>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                  Add specifics for car/EV/motorcycle trips so exact emission factors can be used instead of generic ones.
                </p>
              </div>

              {trips.filter((t) => ['car', 'ev', 'motorcycle'].includes(t.mode)).length === 0 && (
                <p className="text-sm text-ink-400 dark:text-ink-500 py-8 text-center">No vehicle trips added — nothing to configure.</p>
              )}

              {trips.map((trip, idx) => (
                !['car', 'ev', 'motorcycle'].includes(trip.mode) ? null : (
                  <div key={idx} className="surface-soft p-4 border border-ink-200 dark:border-ink-800 space-y-3">
                    <div className="flex items-center gap-2">
                      {(() => { const Icon = MODE_OPTIONS.find((m) => m.value === trip.mode)?.icon; return Icon ? <Icon size={14} className="text-ink-400" /> : null; })()}
                      <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">
                        Trip {idx + 1}: {MODE_OPTIONS.find((m) => m.value === trip.mode)?.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {trip.mode !== 'motorcycle' && (
                        <div className="space-y-1.5">
                          <label className="input-label">Category</label>
                          <select aria-label="Category" className="input-field cursor-pointer" value={trip.vehicle.category}
                            onChange={(e) => updateVehicle(idx, 'category', e.target.value)}>
                            <option value="">Generic</option>
                            {(trip.mode === 'motorcycle'
                              ? [['scooter', 'Scooter'], ['standard', 'Standard'], ['performance', 'Performance']]
                              : [['hatchback', 'Hatchback'], ['sedan', 'Sedan'], ['suv', 'SUV']]
                            ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      )}
                      {trip.mode !== 'ev' && (
                        <div className="space-y-1.5">
                          <label className="input-label">Fuel</label>
                          <select aria-label="Fuel" className="input-field cursor-pointer" value={trip.vehicle.fuelType}
                            onChange={(e) => updateVehicle(idx, 'fuelType', e.target.value)}>
                            <option value="">Generic</option>
                            {(trip.mode === 'auto_rickshaw'
                              ? [['cng', 'CNG'], ['petrol', 'Petrol']]
                              : [['petrol', 'Petrol'], ['diesel', 'Diesel'], ['cng', 'CNG']]
                            ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      )}
                      {['car', 'motorcycle'].includes(trip.mode) && (
                        <div className="space-y-1.5">
                          <label className="input-label">Mileage (km/L)</label>
                          <input aria-label="Mileage (km/L)" type="number" min="0" step="any" className="input-field" placeholder="e.g. 18"
                            value={trip.vehicle.fuelEfficiencyKmpl}
                            onChange={(e) => updateVehicle(idx, 'fuelEfficiencyKmpl', e.target.value)} />
                        </div>
                      )}
                      {trip.mode === 'ev' && (
                        <div className="space-y-1.5">
                          <label className="input-label">Consumption (kWh/km)</label>
                          <input aria-label="Consumption (kWh/km)" type="number" min="0" step="any" className="input-field" placeholder="e.g. 0.15"
                            value={trip.vehicle.electricityConsumptionKwhPerKm}
                            onChange={(e) => updateVehicle(idx, 'electricityConsumptionKwhPerKm', e.target.value)} />
                        </div>
                      )}
                    </div>
                    <FactorBadge factor={factorFor(trip)} pending />
                  </div>
                )
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-ink-900 dark:text-white flex items-center gap-2"><FiClipboard size={16} className="text-ink-400" /> Preview</h3>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                  Factors below are the ones the server resolved — it recalculates the final figure on save.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-eco-50 dark:bg-eco-500/10 border border-eco-200 dark:border-eco-500/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-600 dark:text-ink-300">Your personal transport emissions</span>
                  <span className="font-bold text-eco-700 dark:text-eco-400">{previewPersonal} kg CO₂</span>
                </div>
                {liveStats.household !== liveStats.personal && (
                  <div className="flex justify-between text-xs text-ink-400 dark:text-ink-500">
                    <span>Full vehicle emissions (whole household)</span>
                    <span>{liveStats.household} kg CO₂</span>
                  </div>
                )}
                {liveStats.pending > 0 && (
                  <p className="text-[10px] italic text-ink-400 dark:text-ink-500">
                    Resolving emission factors for {liveStats.pending} trip{liveStats.pending > 1 ? 's' : ''}…
                  </p>
                )}
                <div className="pt-2 border-t border-eco-100 dark:border-eco-500/20 space-y-2">
                  {trips.map((trip, idx) => {
                    const km = Number(trip.distanceKm) || 0;
                    if (km <= 0) return null;
                    const resolved = factorFor(trip);
                    const occupants = Math.max(1, Math.min(8, Number(trip.occupants) || 1));
                    const share = resolved
                      ? (km * Number(resolved.factorKgPerKm)) / (resolved.occupancySplit ? occupants : 1)
                      : null;
                    const ModeIcon = MODE_OPTIONS.find((m) => m.value === trip.mode)?.icon;
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-xs text-ink-500 dark:text-ink-400 items-center">
                          <span className="inline-flex items-center gap-1.5">
                            {ModeIcon && <ModeIcon size={13} className="text-ink-400" />}
                            {formatMode(trip.mode)} · {km} km
                          </span>
                          <span className="font-bold">{share === null ? '—' : `${r2(share)} kg`}</span>
                        </div>
                        <FactorBadge factor={resolved} pending compact />
                      </div>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleSubmit} disabled={loading || !validTrips.length}
                className="btn-accent w-full disabled:opacity-50">
                {loading ? 'Saving...' : <><FiCheckCircle /> Save Trip Log</>}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-ink-200 dark:border-ink-800">
            <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}
              className="btn-secondary disabled:opacity-40">
              Back
            </button>
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)}
                className="btn-primary">
                Continue
              </button>
            ) : <span />}
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="card min-h-[350px] p-6 flex flex-col items-center justify-center text-center space-y-4">
          <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Personal Transport Today</p>
          <p className="text-5xl font-bold text-eco-600 dark:text-eco-400">{previewPersonal}</p>
          <p className="text-xs text-ink-400 dark:text-ink-500 -mt-3">kg CO₂</p>
          <div className="w-full pt-4 border-t border-ink-200 dark:border-ink-800 space-y-2 text-left">
            <div className="flex justify-between text-xs">
              <span className="text-ink-400 dark:text-ink-500">Trips logged</span>
              <span className="font-bold text-ink-700 dark:text-ink-200">{validTrips.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-400 dark:text-ink-500">Total distance</span>
              <span className="font-bold text-ink-700 dark:text-ink-200">
                {Math.round(validTrips.reduce((s, t) => s + (Number(t.distanceKm) || 0), 0) * 10) / 10} km
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-400 dark:text-ink-500">Shared-ride savings</span>
              <span className="font-bold text-eco-700 dark:text-eco-400">
                {r2(liveStats.household - liveStats.personal)} kg
              </span>
            </div>
          </div>
          {liveStats.pending > 0 && (
            <p className="text-[10px] italic text-ink-400 dark:text-ink-500">Waiting on the emission-factor service…</p>
          )}
          {result && (
            <div className="w-full p-3 rounded-lg bg-eco-50 dark:bg-eco-500/10 border border-eco-200 dark:border-eco-500/20 text-eco-700 dark:text-eco-400 text-xs font-bold flex items-center justify-center gap-1.5">
              <FiCheck size={14} /> Saved! Redirecting to dashboard...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
