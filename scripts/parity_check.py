"""Dual-calc parity check: mirrors the JS test cases and prints JSON for comparison."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ml-service"))
from emission_utils import calculate_emissions

CASES = [
    {"transport": {"car": 10}, "electricity": 10, "water": 150, "foodHabit": "nonVegetarian", "shoppingFrequency": "medium", "wasteGeneration": "medium", "fuel": {"petrol": 0, "diesel": 0, "lpg": 0}, "solarPanels": False},
    {"transport": {"car": 10, "carOccupants": 3}, "electricity": 10, "water": 150, "foodHabit": "nonVegetarian", "shoppingFrequency": "medium", "wasteGeneration": "medium", "fuel": {"petrol": 0, "diesel": 0, "lpg": 0}, "solarPanels": False},
    {"transport": {"car": 20, "ev": 12, "bus": 5, "metro": 3, "bike": 2, "flight": 0, "carOccupants": 4}, "electricity": 15, "water": 200, "foodHabit": "vegan", "shoppingFrequency": "low", "wasteGeneration": "low", "fuel": {"petrol": 1.5, "diesel": 0, "lpg": 0.5}, "solarPanels": True},
    {"transport": {"ev": 30, "carOccupants": 8}, "electricity": 0, "water": 0, "foodHabit": "vegetarian", "shoppingFrequency": "high", "wasteGeneration": "high", "fuel": {}, "solarPanels": False},
    {"transport": {"car": 5, "carOccupants": 0}, "electricity": 8, "water": 100, "foodHabit": "nonVegetarian", "shoppingFrequency": "medium", "wasteGeneration": "medium", "fuel": {}, "solarPanels": False},
]

results = []
for case in CASES:
    r = calculate_emissions(case)
    results.append({"total": r["total"], "householdTotal": r["householdTotal"], "breakdown": r["breakdown"], "householdBreakdown": r["householdBreakdown"]})
print(json.dumps(results))
