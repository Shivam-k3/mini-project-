"""EcoGuardian AI - ML Service for Transportation CO2 Prediction & Explainable AI.

v3.0.0 — TRANSPORTATION-ONLY.

Provides REST endpoints for:
  - /predict       : Train on mobility history + get forecasts (user/dept/org scoped)
  - /train-entity  : Batch-train a model for a department or organization
  - /predict-entity: Get forecasts from a pre-trained entity model
  - /explain       : SHAP-based explanation of transport mode breakdown
  - /simulate      : Digital twin scenario simulation (trips-aware)
  - /health        : Service health check

Multi-tenant scope support:
  - "user"       scope_id = user's MongoDB _id
  - "department" scope_id = department's MongoDB _id
  - "college"    scope_id = college/organization's MongoDB _id

Each scope/scope_id combination gets its own model file on disk so models
never collide — enabling a distributed campus architecture.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from predictor import (
    train_and_predict,
    train_entity_model,
    predict_with_model,
    MODEL_VERSION,
)
from shap_explainer import explain_emissions
from emission_utils import calculate_trips, calculate_emissions

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "EcoGuardian Mobility ML Service",
        "modelVersion": MODEL_VERSION,
        "domain": "transportation",
        "features": ["prediction", "shap_explanation", "digital_twin"],
    })


@app.route("/predict", methods=["POST"])
def predict():
    """Train on user/entity mobility history and return forecasts.

    Request body:
    {
        "history": [ ... carbon entry docs (trips[] or legacy transport km) ... ],
        "scope": "user" | "department" | "college",   (default: "user")
        "scope_id": "...",                              (default: user_id or None)
        "user_id": "..."                                 (legacy, used as scope_id for user scope)
    }

    Response includes the honest prediction method used:
      insufficient_data | rolling_average | hybrid | xgboost
    """
    data = request.json or {}
    history = data.get("history", [])

    scope = data.get("scope", "user")
    scope_id = data.get("scope_id")

    if not scope_id:
        if scope == "user":
            scope_id = data.get("user_id", "anonymous")
        else:
            scope_id = "unknown"

    result = train_and_predict(history, scope=scope, scope_id=scope_id)
    return jsonify(result)


@app.route("/train-entity", methods=["POST"])
def train_entity():
    """Batch-train a model for a department or organization without predictions."""
    data = request.json or {}
    scope = data.get("scope")
    scope_id = data.get("scope_id")
    history = data.get("history", [])

    if scope not in ("department", "college"):
        return jsonify({"error": "scope must be 'department' or 'college'"}), 400
    if not scope_id:
        return jsonify({"error": "scope_id is required"}), 400

    result = train_entity_model(scope, scope_id, history)
    return jsonify(result)


@app.route("/predict-entity", methods=["POST"])
def predict_entity():
    """Get forecasts from a pre-trained entity model without retraining."""
    data = request.json or {}
    scope = data.get("scope")
    scope_id = data.get("scope_id")
    latest_entry = data.get("latest_entry")

    if scope not in ("department", "college", "user"):
        return jsonify({"error": "scope must be 'user', 'department', or 'college'"}), 400
    if not scope_id:
        return jsonify({"error": "scope_id is required"}), 400

    result = predict_with_model(scope, scope_id, latest_entry=latest_entry)
    return jsonify(result)


@app.route("/explain", methods=["POST"])
def explain():
    """Generate SHAP-style explanation of a transport MODE breakdown.

    Request body:
    {
        "breakdown": { "car": 2.1, "metro": 0.4, ... },   per-mode personal kg CO2
        "total": 2.5,
        "scope": "user" | "department" | "college",   (optional)
        "scope_id": "..."                               (optional)
    }

    Real TreeExplainer output is attached only when a v3 scoped XGBoost model
    exists; otherwise the composition approximation is returned with an
    honest method label.
    """
    data = request.json or {}
    breakdown = data.get("breakdown", {})
    total = data.get("total", sum(breakdown.values()) if breakdown else 0)

    scope = data.get("scope", "user")
    scope_id = data.get("scope_id", "anonymous")

    result = explain_emissions(breakdown, total, scope=scope, scope_id=scope_id)
    return jsonify(result)


@app.route("/simulate", methods=["POST"])
def simulate():
    """Digital twin: compare baseline vs. changed scenario emissions.

    Trips-aware: baseline may contain `trips` (canonical v3 shape) or legacy
    `transport` km maps. Changes support:

      - replaceMode: move km from one mode to another
        { "replaceMode": "car", "newMode": "metro", "kmPerDay": 10 }
      - occupancy change for split modes:
        { "mode": "car", "occupants": 4 }
      - vehicle replacement:
        { "vehicleSwap": { "category": "hatchback", "fuelType": "petrol" -> ev } }
      - legacy single-mode edits (transportMode/transportKm) still supported.
    """
    data = request.json or {}
    baseline = data.get("baseline", {})
    changes = data.get("changes", {})

    def _result_for(entry):
        if entry.get("trips"):
            return calculate_trips(entry["trips"])
        return calculate_emissions(entry)

    scenario_entry = {**baseline}

    # ---- trips-based scenarios --------------------------------------------
    if baseline.get("trips"):
        trips = [dict(t) for t in baseline["trips"]]

        # Mode replacement: shift km from replaceMode to newMode
        if changes.get("replaceMode") and changes.get("newMode"):
            km = float(changes.get("kmPerDay") or 0)
            remaining = []
            moved = 0.0
            for t in trips:
                if t.get("mode") == changes["replaceMode"]:
                    moved += float(t.get("distanceKm", 0))
                else:
                    remaining.append(t)
            if km <= 0:
                km = moved
            if km > 0:
                new_trip = {"mode": changes["newMode"], "distanceKm": round(km, 1),
                            "tripFrequency": 1, "purpose": "commute"}
                if changes["newMode"] == "car":
                    new_trip["occupants"] = int(changes.get("occupants", 1)) or 1
                remaining.append(new_trip)
            trips = remaining

        # Occupancy change on a specific split mode
        if changes.get("mode") and changes.get("occupants"):
            occ = max(1, min(8, int(float(changes["occupants"]))))
            for t in trips:
                if t.get("mode") == changes["mode"]:
                    t["occupants"] = occ

        # Vehicle swap to EV (or another category/fuel)
        if changes.get("vehicleSwap"):
            swap = changes["vehicleSwap"]
            for t in trips:
                if t.get("mode") in ("car", "ev", "motorcycle") and not changes.get("onlyMode") \
                        or (changes.get("onlyMode") and t.get("mode") == changes["onlyMode"]):
                    t["vehicle"] = dict(swap)
                    if swap.get("fuelType") == "electric":
                        t["mode"] = "ev"

        scenario_entry["trips"] = trips
    else:
        # ---- legacy lifestyle-shape scenarios ------------------------------
        modified = {**baseline, **changes}
        if changes.get("transportMode") and changes.get("transportKm"):
            modified["transport"] = dict(baseline.get("transport", {}))
            modified["transport"][changes["transportMode"]] = changes["transportKm"]
            if changes.get("replaceMode"):
                modified["transport"][changes["replaceMode"]] = 0
        if changes.get("carOccupants"):
            modified["transport"] = dict(baseline.get("transport", {}))
            modified["transport"]["carOccupants"] = max(1, min(8, int(float(changes["carOccupants"]))))
        scenario_entry = modified

    baseline_result = _result_for(baseline)
    scenario_result = _result_for(scenario_entry)

    b_total = baseline_result.get("transportPersonal", baseline_result.get("total", 0))
    s_total = scenario_result.get("transportPersonal", scenario_result.get("total", 0))

    reduction = round(b_total - s_total, 2)
    reduction_pct = round((reduction / b_total) * 100, 1) if b_total > 0 else 0

    yearly_savings = round(reduction * 365, 1)
    trees_equivalent = round(yearly_savings / 21, 0)

    return jsonify({
        "baseline": baseline_result,
        "scenario": scenario_result,
        "reduction": reduction,
        "reductionPercent": reduction_pct,
        "yearlySavings": yearly_savings,
        "treesEquivalent": trees_equivalent,
        "impactScore": min(100, round(reduction_pct * 1.5)),
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"EcoGuardian Mobility ML Service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
