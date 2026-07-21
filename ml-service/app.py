"""EcoGuardian AI - ML Service for Carbon Prediction & Explainable AI"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from predictor import train_and_predict
from shap_explainer import explain_emissions
from emission_utils import calculate_emissions

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "EcoGuardian ML Service",
        "features": ["prediction", "shap_explanation", "digital_twin"],
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json or {}
    history = data.get("history", [])
    result = train_and_predict(history)
    return jsonify(result)


@app.route("/explain", methods=["POST"])
def explain():
    data = request.json or {}
    breakdown = data.get("breakdown", {})
    total = data.get("total", sum(breakdown.values()) if breakdown else 0)
    result = explain_emissions(breakdown, total)
    return jsonify(result)


@app.route("/simulate", methods=["POST"])
def simulate():
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

    # Yearly projection
    yearly_savings = round(reduction * 365, 1)
    trees_equivalent = round(yearly_savings / 21, 0)  # ~21kg CO2 per tree per year

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
