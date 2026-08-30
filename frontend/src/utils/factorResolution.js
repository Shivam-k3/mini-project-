/**
 * Client side of the emission-factor resolution API.
 *
 * The backend resolver (backend/utils/factorResolver.js) is the single source of
 * truth for scientific constants — there is deliberately no factor table in the
 * frontend. This module turns a Calculator trip row into a resolution request,
 * caches the answer, and hands the *server-returned* factor back for UI-only
 * arithmetic (live preview). The authoritative figure is always recomputed
 * server-side on submit.
 *
 * Two properties make the live preview cheap (spec §4, §13):
 *   - resolution depends only on (mode, vehicle) — never on distance, frequency
 *     or occupants — so typing a distance triggers no network activity at all;
 *   - resolutions are deterministic, so an identical request is answered from a
 *     module-level cache for the rest of the session.
 */
import { factorsAPI } from '../services/api';

/** requestKey -> Promise<factor>. Deterministic, so cached for the session. */
const cache = new Map();

/**
 * Query params that actually influence resolution, in a fixed order.
 * Anything not listed here (distance, occupants, frequency, purpose) is a
 * downstream multiplier and must not invalidate a cached factor.
 */
const RESOLUTION_FIELDS = [
  'mode',
  'manufacturer',
  'model',
  'variant',
  'vehicleCategory',
  'fuelType',
  'fuelEfficiencyKmPerL',
  'energyConsumptionKwhPerKm',
  'declaredCo2GPerKm',
];

const clean = (v) => {
  const s = String(v ?? '').trim();
  return s || undefined;
};

/**
 * Build the resolution request for one trip row, or null when the row does not
 * yet name a mode (nothing to resolve).
 *
 * Vehicle attributes are only sent when they are meaningful for the mode, so a
 * leftover mileage value from a previously-selected mode cannot skew the answer:
 * fuel efficiency applies to liquid-fuel vehicles, kWh/km to electric ones.
 */
export function factorRequestFor(trip) {
  const mode = clean(trip?.mode);
  if (!mode) return null;

  const v = trip.vehicle || {};
  const fuelType = clean(v.fuelType);
  const isElectric = mode === 'ev' || fuelType === 'electric';

  const request = {
    mode,
    manufacturer: clean(v.manufacturer),
    model: clean(v.model),
    variant: clean(v.variant),
    vehicleCategory: clean(v.category),
    fuelType,
    declaredCo2GPerKm: clean(v.declaredCo2GPerKm),
  };

  if (isElectric) {
    request.energyConsumptionKwhPerKm = clean(v.electricityConsumptionKwhPerKm);
  } else {
    request.fuelEfficiencyKmPerL = clean(v.fuelEfficiencyKmpl);
  }

  // Drop empties so equivalent rows share one cache key and one request.
  return Object.fromEntries(
    RESOLUTION_FIELDS.filter((k) => request[k] !== undefined).map((k) => [k, request[k]])
  );
}

/** Stable cache/dedupe key for a request built by factorRequestFor(). */
export function factorKey(request) {
  if (!request) return '';
  return RESOLUTION_FIELDS.map((k) => request[k] ?? '').join('|');
}

/**
 * Resolve a factor through the backend, reusing the cached answer (or an
 * in-flight request) for an identical query.
 *
 * @returns {Promise<Object>} { factorKgPerKm, factorLevel, factorLevelLabel,
 *   factorSource, sourceUrl, sourceYear, methodology, occupancySplit, ... }
 */
export function resolveFactor(request) {
  const key = factorKey(request);
  if (!key) return Promise.reject(new Error('mode is required'));
  if (cache.has(key)) return cache.get(key);

  const pending = factorsAPI
    .resolve(request)
    .then((res) => res.data)
    .catch((err) => {
      // Never cache a failure — a transient network error would otherwise
      // freeze that trip's preview for the rest of the session.
      cache.delete(key);
      throw err;
    });

  cache.set(key, pending);
  return pending;
}

/** Test/debug helper — forget every cached resolution. */
export function clearFactorCache() {
  cache.clear();
}
