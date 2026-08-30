/**
 * Canonical transportation CO2 calculation engine (spec §12).
 *
 *   total_trip_emission      = distance_km x emission_factor_kg_per_km x trip_frequency
 *   personal_allocated       = total_trip_emission / occupants   (shared private vehicles)
 *
 * Bus/metro/flight factors are already per-passenger, so no occupancy division
 * applies there. Private/para-transit modes (car, motorcycle, auto_rickshaw, ev)
 * are split equally among occupants including the driver.
 *
 * Values are rounded to 2 dp only at the aggregate boundary; internal math
 * stays unrounded to avoid cumulative rounding drift.
 */
const { resolveTripFactor, isOccupancySplitMode } = require('./factorResolver');

const clampOccupants = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(8, n);
};

/**
 * @param {Array} trips - [{ mode, distanceKm, occupants?, tripFrequency?, purpose?, vehicle? }]
 * @returns {Promise<Object>} aggregates + per-trip resolution details
 */
async function calculateTrips(trips) {
  const list = Array.isArray(trips) ? trips.filter((t) => t && Number(t.distanceKm) > 0) : [];

  let transportPersonal = 0;
  let transportHousehold = 0;
  const modeBreakdown = {};
  const householdModeBreakdown = {};
  const tripDetails = [];

  for (const trip of list) {
    const mode = String(trip.mode || '').toLowerCase().trim();
    const distanceKm = Number(trip.distanceKm);
    if (!distanceKm || distanceKm < 0) continue;

    const frequency = Math.max(1, Math.round(Number(trip.tripFrequency) || 1));
    const occupants = clampOccupants(trip.occupants);

    const { factorKgPerKm, level, source, methodology } = await resolveTripFactor({ ...trip, mode });

    const tripTotal = distanceKm * factorKgPerKm * frequency;
    const split = isOccupancySplitMode(mode) && occupants > 1;
    const personal = split ? tripTotal / occupants : tripTotal;

    transportPersonal += personal;
    transportHousehold += tripTotal;
    modeBreakdown[mode] = (modeBreakdown[mode] || 0) + personal;
    householdModeBreakdown[mode] = (householdModeBreakdown[mode] || 0) + tripTotal;

    tripDetails.push({
      mode,
      distanceKm,
      occupants,
      tripFrequency: frequency,
      purpose: trip.purpose || 'other',
      // Carried through so callers can persist the trip without re-indexing
      // against the input array — zero-distance trips are filtered out above,
      // so input and tripDetails indices do not align.
      vehicle: trip.vehicle || {},
      factorKgPerKm,
      factorLevel: level,
      factorSource: source.name || '',
      // Provenance (spec §11): kept alongside the number so a stored entry can
      // always be traced back to the dataset row and formula that produced it.
      factorSourceUrl: source.url || '',
      factorSourceYear: source.year ?? null,
      factorMethodology: methodology || '',
      tripTotalEmission: tripTotal,
      personalAllocatedEmission: personal,
    });
  }

  const r2 = (x) => Math.round(x * 100) / 100;
  return {
    transportPersonal: r2(transportPersonal),
    transportHousehold: r2(transportHousehold),
    modeBreakdown: Object.fromEntries(Object.entries(modeBreakdown).map(([k, v]) => [k, r2(v)])),
    householdModeBreakdown: Object.fromEntries(
      Object.entries(householdModeBreakdown).map(([k, v]) => [k, r2(v)])
    ),
    tripDetails,
  };
}

module.exports = { calculateTrips, clampOccupants };
