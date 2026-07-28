"""EcoGuardian AI - ML Service for Carbon Prediction & Explainable AI.

Provides REST endpoints for:
  - /predict       : Train on history + get predictions (user/dept/college scoped)
  - /train-entity  : Batch-train a model for a department or college (no prediction)
  - /predict-entity: Get forecasts from a pre-trained entity model
  - /explain       : SHAP-based explanation of emission breakdown
  - /simulate      : Digital twin scenario simulation
  - /health        : Service health check

Multi-tenant scope support:
  - "user"       scope_id = user's MongoDB _id
  - "department" scope_id = department's MongoDB _id
  - "college"    scope_id = college's MongoDB _id

Each scope/scope_id combination gets its own model file on disk so models
never collide — enabling a distributed campus architecture.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from predictor import train_and_predict, train_entity_model, predict_with_model
from shap_explainer import explain_emissions
from emission_utils import calculate_emissions

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "EcoGuardian ML Service",
        "features": ["prediction", "shap_explanation", "digital_twin"],
    })


@app.route("/predict", methods=["POST"])
def predict():
    """Train on user/entity history and return forecasts.

    Request body:
    {
        "history": [ ... carbon entry docs ... ],
        "scope": "user" | "department" | "college",   (default: "user")
        "scope_id": "...",                              (default: user_id or None)
        "user_id": "..."                                 (legacy, used as scope_id for user scope)
    }

    The model is saved to a scope-specific file so that entity-level models
    (departments, colleges) are preserved and reusable across requests.
    """
    data = request.json or {}
    history = data.get("history", [])

    # Determine scope and scope_id
    # Backward compatibility: if "user_id" is provided without scope info,
    # treat it as a user-scoped request.
    scope = data.get("scope", "user")
    scope_id = data.get("scope_id")

    if not scope_id:
        # Fall back to legacy user_id for user-scope requests
        if scope == "user":
            scope_id = data.get("user_id", "anonymous")
        else:
            scope_id = "unknown"

    result = train_and_predict(history, scope=scope, scope_id=scope_id)
    return jsonify(result)


@app.route("/train-entity", methods=["POST"])
def train_entity():
    """Batch-train a model for a department or college without returning predictions.

    This is useful for faculty/college-admin dashboards that want to pre-train
    entity-level models during off-peak hours.

    Request body:
    {
        "scope": "department" | "college",
        "scope_id": "...",
        "history": [ ... aggregated carbon entries ... ]
    }
    """
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
    """Get forecasts from a pre-trained entity model without retraining.

    Request body:
    {
        "scope": "department" | "college",
        "scope_id": "...",
        "latest_entry": { ... single carbon entry ... }  (optional)
    }
    """
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
    """Generate SHAP-style explanation of an emission breakdown.

    Request body:
    {
        "breakdown": { "transport": 5.2, "electricity": 3.8, ... },
        "total": 23.83,
        "scope": "user" | "department" | "college",   (optional)
        "scope_id": "..."                               (optional)
    }

    When scope and scope_id are provided, the explainer loads the corresponding
    trained model to produce real SHAP feature importance values.
    """
    data = request.json or {}
    breakdown = data.get("breakdown", {})
    total = data.get("total", sum(breakdown.values()) if breakdown else 0)

    # Optional scope for model-aware SHAP (loads the correct entity model)
    scope = data.get("scope", "user")
    scope_id = data.get("scope_id", "anonymous")

    result = explain_emissions(breakdown, total, scope=scope, scope_id=scope_id)
    return jsonify(result)


@app.route("/simulate", methods=["POST"])
def simulate():
    """Digital twin: compare baseline vs. changed scenario emissions.

    Request body:
    {
        "baseline": { "transport": {"car": 20}, "electricity": 10, ... },
        "changes":  { "transportMode": "car", "transportKm": 5, ... }
    }
    """
    data = request.json or {}
    baseline = data.get("baseline", {})
    changes = data.get("changes", {})

    modified = {**baseline, **changes}

    if changes.get("transportMode") and changes.get("transportKm"):
        modified["transport"] = dict(baseline.get("transport", {}))
        modified["transport"][changes["transportMode"]] = changes["transportKm"]
        if changes.get("replaceMode"):
            modified["transport"][changes["replaceMode"]] = 0

    if changes.get("electricityReduction"):
        modified["electricity"] = baseline.get("electricity", 0) * (1 - changes["electricityReduction"] / 100)

    if changes.get("foodHabit"):
        modified["foodHabit"] = changes["foodHabit"]

    if changes.get("solarPanels"):
        modified["solarPanels"] = True

    baseline_result = calculate_emissions(baseline)
    scenario_result = calculate_emissions(modified)

    reduction = round(baseline_result["total"] - scenario_result["total"], 2)
    reduction_pct = (
        round((reduction / baseline_result["total"]) * 100, 1)
        if baseline_result["total"] > 0 else 0
    )

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
    print(f"EcoGuardian ML Service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
