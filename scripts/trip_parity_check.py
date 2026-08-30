"""Trip-engine parity check: runs calculate_trips on fixed cases, prints JSON."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml-service"))

from emission_utils import calculate_trips  # noqa: E402

CASES = [
    # 1. solo generic car
    [{"mode": "car", "distanceKm": 10}],
    # 2. carpool 3 occupants
    [{"mode": "car", "distanceKm": 10, "occupants": 3}],
    # 3. user-declared CO2 g/km
    [{"mode": "car", "distanceKm": 10, "vehicle": {"declaredCo2GPerKm": 120}}],
    # 4. category-level petrol SUV
    [{"mode": "car", "distanceKm": 10, "vehicle": {"category": "suv", "fuelType": "petrol"}}],
    # 5. efficiency-derived petrol 16 km/L
    [{"mode": "car", "distanceKm": 10, "vehicle": {"fuelType": "petrol", "fuelEfficiencyKmpl": 16}}],
    # 6. EV generic (default consumption x grid)
    [{"mode": "ev", "distanceKm": 10}],
    # 7. EV declared consumption
    [{"mode": "ev", "distanceKm": 10, "vehicle": {"electricityConsumptionKwhPerKm": 0.18}}],
    # 8. metro is per-passenger: occupants must NOT split
    [{"mode": "metro", "distanceKm": 12, "occupants": 3}],
    # 9. mixed modes with frequency + motorcycle pillion split
    [
        {"mode": "bus", "distanceKm": 8, "tripFrequency": 2},
        {"mode": "motorcycle", "distanceKm": 15, "occupants": 2},
    ],
    # 10. active modes are free
    [{"mode": "walk", "distanceKm": 3}, {"mode": "bicycle", "distanceKm": 7}],
    # 11. school run: driver + 2 children
    [{"mode": "car", "distanceKm": 6, "occupants": 3, "purpose": "school"}],
    # 12. occupant clamp 99 -> 8
    [{"mode": "car", "distanceKm": 16, "occupants": 99}],
]

print(json.dumps([calculate_trips(c) for c in CASES]))
