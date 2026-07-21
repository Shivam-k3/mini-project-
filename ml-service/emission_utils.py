"""Emission calculation utilities for ML service."""

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


def calculate_emissions(data):
    breakdown = {k: 0.0 for k in ["transport", "electricity", "water", "food", "shopping", "waste", "fuel"]}

    transport = data.get("transport", {})
    for mode, km in transport.items():
        if mode in EMISSION_FACTORS["transport"]:
            breakdown["transport"] += km * EMISSION_FACTORS["transport"][mode]

    electricity = data.get("electricity", 0)
    breakdown["electricity"] = electricity * EMISSION_FACTORS["electricity"]
    if data.get("solarPanels"):
        breakdown["electricity"] *= 0.15

    breakdown["water"] = data.get("water", 0) * EMISSION_FACTORS["water"]

    food = data.get("foodHabit", "nonVegetarian")
    breakdown["food"] = EMISSION_FACTORS["food"].get(food, 7.2)

    shop = data.get("shoppingFrequency", "medium")
    breakdown["shopping"] = EMISSION_FACTORS["shopping"].get(shop, 2.0)

    waste = data.get("wasteGeneration", "medium")
    breakdown["waste"] = EMISSION_FACTORS["waste"].get(waste, 1.0)

    fuel = data.get("fuel", {})
    for ftype, liters in fuel.items():
        if ftype in EMISSION_FACTORS["fuel"]:
            breakdown["fuel"] += liters * EMISSION_FACTORS["fuel"][ftype]

    total = round(sum(breakdown.values()), 2)
    breakdown = {k: round(v, 2) for k, v in breakdown.items()}
    return {"total": total, "breakdown": breakdown}
