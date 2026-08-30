"""Emission calculation utilities for ML service.

v3: transportation-focused. Trip-level factors resolve from the shared
dataset at ../config/emission-factors.json (same file the backend seeds
into Mongo and resolves from) so JS and Python stay in parity.
Legacy 7-category calculate_emissions() is retained for archival entries.
"""

import json
import math
import os

EMISSION_FACTORS = {
    "transport": {
        "bike": 0, "bus": 0.089, "metro": 0.041,
        "car": 0.21, "ev": 0.05, "flight": 0.255,
    },
    "electricity": 0.475,
    "water": 0.0003,
    "food": {"vegetarian": 2.5, "nonVegetarian": 7.2, "vegan": 1.5},
    "shopping": {"low": 0.5, "medium": 2.0, "high": 5.0},
    "waste": {"low": 0.3, "medium": 1.0, "high": 2.5},
    "fuel": {"petrol": 2.31, "diesel": 2.68, "lpg": 1.51},
}

_FACTORS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "emission-factors.json")


def _load_factor_dataset():
    try:
        with open(_FACTORS_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


FACTOR_DATASET = _load_factor_dataset()

if FACTOR_DATASET:
    GRID_KG_PER_KWH = FACTOR_DATASET["grid_electricity"]["factor_kg_per_kwh"]
    FUEL_KG_PER_LITER = {k: v for k, v in FACTOR_DATASET["fuel_combustion_kg_per_liter"].items() if not k.startswith("_")}
    EV_DEFAULT_KWH_PER_KM = FACTOR_DATASET["ev_default_consumption_kwh_per_km"]
else:  # pragma: no cover - dataset missing only if repo is broken
    GRID_KG_PER_KWH, FUEL_KG_PER_LITER, EV_DEFAULT_KWH_PER_KM = 0.716, {}, 0.15

ZERO_EMISSION_MODES = {"bicycle", "walk"}
OCCUPANCY_SPLIT_MODES = {"car", "motorcycle", "auto_rickshaw", "ev"}


def _norm(v):
    return str(v or "").lower().strip()


def _round2(x):
    """Round to 2 decimals, half-away-from-zero — mirrors JS Math.round(x*100)/100."""
    return math.floor(x * 100 + 0.5) / 100


def _get_vehicle_occupants(transport):
    """Read carOccupants from a transport dict, clamped to [1, 8]."""
    try:
        raw = int(float(transport.get("carOccupants", 1)))
    except (TypeError, ValueError):
        raw = 1
    return max(1, min(8, raw))


def calculate_emissions(data):
    breakdown = {k: 0.0 for k in ["transport", "electricity", "water", "food", "shopping", "waste", "fuel"]}
    household_breakdown = dict(breakdown)

    # Occupancy-aware allocation: car/EV emissions split equally among
    # occupants (personal share); raw trip total kept for household accounting.
    # Bus/metro/flight factors are already per-passenger (DEFRA).
    transport = data.get("transport", {})
    occupants = _get_vehicle_occupants(transport) if isinstance(transport, dict) else 1
    for mode, km in transport.items():
        if mode not in EMISSION_FACTORS["transport"]:
            continue  # skips carOccupants metadata key
        factor = EMISSION_FACTORS["transport"][mode]
        trip_total = km * factor
        household_breakdown["transport"] += trip_total
        if mode in ("car", "ev"):
            trip_total /= occupants
        breakdown["transport"] += trip_total

    electricity = data.get("electricity", 0)
    breakdown["electricity"] = electricity * EMISSION_FACTORS["electricity"]
    household_breakdown["electricity"] = breakdown["electricity"]
    if data.get("solarPanels"):
        breakdown["electricity"] *= 0.15
        household_breakdown["electricity"] = breakdown["electricity"]

    breakdown["water"] = data.get("water", 0) * EMISSION_FACTORS["water"]
    household_breakdown["water"] = breakdown["water"]

    food = data.get("foodHabit", "nonVegetarian")
    breakdown["food"] = EMISSION_FACTORS["food"].get(food, 7.2)
    household_breakdown["food"] = breakdown["food"]

    shop = data.get("shoppingFrequency", "medium")
    breakdown["shopping"] = EMISSION_FACTORS["shopping"].get(shop, 2.0)
    household_breakdown["shopping"] = breakdown["shopping"]

    waste = data.get("wasteGeneration", "medium")
    breakdown["waste"] = EMISSION_FACTORS["waste"].get(waste, 1.0)
    household_breakdown["waste"] = breakdown["waste"]

    fuel = data.get("fuel", {})
    for ftype, liters in fuel.items():
        if ftype in EMISSION_FACTORS["fuel"]:
            breakdown["fuel"] += liters * EMISSION_FACTORS["fuel"][ftype]
            household_breakdown["fuel"] = breakdown["fuel"]

    # Round breakdown first (like JS), then derive totals from rounded values
    breakdown = {k: _round2(v) for k, v in breakdown.items()}
    household_breakdown = {k: _round2(v) for k, v in household_breakdown.items()}
    total = _round2(sum(breakdown.values()))
    household_total = _round2(sum(household_breakdown.values()))
    return {
        "total": total,
        "breakdown": breakdown,
        "householdTotal": household_total,
        "householdBreakdown": household_breakdown,
    }


# ---------------------------------------------------------------------------
# v3 trip-level engine — mirrors backend/utils/tripEngine.js + factorResolver.js
# ---------------------------------------------------------------------------

def _clamp_occupants(v):
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return 1
    return max(1, min(8, n))


def resolve_trip_factor(trip):
    """Hierarchical resolution: declared CO2 -> EV branch -> category -> efficiency -> generic.

    Mirrors factorResolver.resolveTripFactor for the static dataset tier
    (DB catalog hits are a superset handled only on the JS side).
    """
    mode = _norm(trip.get("mode"))
    vehicle = trip.get("vehicle") or {}

    if mode in ZERO_EMISSION_MODES:
        row = (FACTOR_DATASET or {}).get("modes", {}).get(mode, {})
        return {"factorKgPerKm": 0.0, "level": "generic-mode", "sourceName": row.get("source", "")}

    declared = vehicle.get("declaredCo2GPerKm")
    try:
        declared = float(declared)
    except (TypeError, ValueError):
        declared = None
    if declared is not None and declared > 0:
        return {
            "factorKgPerKm": round(declared / 1000.0, 4),
            "level": "vehicle-specific",
            "sourceName": "User-declared vehicle CO2",
        }

    if mode == "ev" or _norm(vehicle.get("fuelType")) == "electric":
        consumption = vehicle.get("electricityConsumptionKwhPerKm")
        try:
            consumption = float(consumption)
        except (TypeError, ValueError):
            consumption = None
        if consumption is not None and consumption > 0:
            return {
                "factorKgPerKm": round(consumption * GRID_KG_PER_KWH, 4),
                "level": "vehicle-specific",
                "sourceName": f"User-declared {consumption} kWh/km x grid {GRID_KG_PER_KWH}",
            }
        category_row = next(
            (
                c for c in (FACTOR_DATASET or {}).get("vehicle_categories", [])
                if c["mode"] == "car" and c["vehicle_category"] == _norm(vehicle.get("category"))
                and c["fuel_type"] == "electric"
            ),
            None,
        ) if vehicle.get("category") else None
        if category_row:
            return {
                "factorKgPerKm": round(category_row["kwh_per_km"] * GRID_KG_PER_KWH, 4),
                "level": "category",
                "sourceName": FACTOR_DATASET["modes"]["ev"]["source"],
            }
        generic = (FACTOR_DATASET or {}).get("modes", {}).get("ev", {})
        return {
            "factorKgPerKm": round(EV_DEFAULT_KWH_PER_KM * GRID_KG_PER_KWH, 4),
            "level": "generic-mode",
            "sourceName": generic.get("source", ""),
        }

    if vehicle.get("category") and vehicle.get("fuelType"):
        cat_row = next(
            (
                c for c in (FACTOR_DATASET or {}).get("vehicle_categories", [])
                if c["mode"] == mode and c["vehicle_category"] == _norm(vehicle.get("category"))
                and c["fuel_type"] == _norm(vehicle.get("fuelType"))
            ),
            None,
        )
        if cat_row:
            factor = (
                cat_row["kwh_per_km"] * GRID_KG_PER_KWH
                if cat_row.get("kwh_per_km") is not None
                else cat_row["co2_kg_per_km"]
            )
            return {"factorKgPerKm": round(factor, 4), "level": "category", "sourceName": "Category default"}

    efficiency = vehicle.get("fuelEfficiencyKmpl")
    fuel_type = _norm(vehicle.get("fuelType"))
    try:
        efficiency = float(efficiency)
    except (TypeError, ValueError):
        efficiency = None
    if efficiency is not None and efficiency > 0 and FUEL_KG_PER_LITER.get(fuel_type):
        return {
            "factorKgPerKm": round(FUEL_KG_PER_LITER[fuel_type] / efficiency, 4),
            "level": "efficiency-derived",
            "sourceName": f"{FUEL_KG_PER_LITER[fuel_type]} kg/L / {efficiency} km/L",
        }

    generic = (FACTOR_DATASET or {}).get("modes", {}).get(mode)
    if generic:
        return {
            "factorKgPerKm": generic["co2_kg_per_km"],
            "level": "generic-mode",
            "sourceName": generic.get("source", ""),
        }
    # Unknown mode — fall back to the canonical car default from the shared
    # dataset (mirrors factorResolver.resolveTripFactor), never a hardcoded literal.
    car_default = (FACTOR_DATASET or {}).get("modes", {}).get("car", {}).get("co2_kg_per_km", 0.21)
    return {"factorKgPerKm": car_default, "level": "generic-mode", "sourceName": ""}


def calculate_trips(trips):
    """Occupancy-aware trip aggregation. Returns rounded aggregates mirroring tripEngine.js."""
    result = {
        "transportPersonal": 0.0,
        "transportHousehold": 0.0,
        "modeBreakdown": {},
        "householdModeBreakdown": {},
        "tripDetails": [],
    }
    for trip in trips or []:
        try:
            distance = float(trip.get("distanceKm", 0))
        except (TypeError, ValueError):
            continue
        if distance <= 0:
            continue
        mode = _norm(trip.get("mode"))
        try:
            frequency = max(1, int(round(float(trip.get("tripFrequency") or 1))))
        except (TypeError, ValueError):
            frequency = 1
        occupants = _clamp_occupants(trip.get("occupants"))

        resolved = resolve_trip_factor({**trip, "mode": mode})
        trip_total = distance * resolved["factorKgPerKm"] * frequency
        split = mode in OCCUPANCY_SPLIT_MODES and occupants > 1
        personal = trip_total / occupants if split else trip_total

        result["transportPersonal"] += personal
        result["transportHousehold"] += trip_total
        result["modeBreakdown"][mode] = result["modeBreakdown"].get(mode, 0.0) + personal
        result["householdModeBreakdown"][mode] = result["householdModeBreakdown"].get(mode, 0.0) + trip_total
        result["tripDetails"].append({
            "mode": mode,
            "distanceKm": distance,
            "occupants": occupants,
            "tripFrequency": frequency,
            "purpose": trip.get("purpose") or "other",
            "factorKgPerKm": resolved["factorKgPerKm"],
            "factorLevel": resolved["level"],
            "factorSource": resolved["sourceName"],
            "tripTotalEmission": trip_total,
            "personalAllocatedEmission": personal,
        })

    result["transportPersonal"] = _round2(result["transportPersonal"])
    result["transportHousehold"] = _round2(result["transportHousehold"])
    result["modeBreakdown"] = {k: _round2(v) for k, v in result["modeBreakdown"].items()}
    result["householdModeBreakdown"] = {k: _round2(v) for k, v in result["householdModeBreakdown"].items()}
    return result
