"""Emission calculation utilities for ML service."""

import math

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
