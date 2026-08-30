"""SHAP-based explainable AI for transportation emissions with multi-tenant model support.

Two levels of explanation:
  1. Composition analysis: what % of transport emissions comes from each MODE.
  2. Model-level SHAP: loads the scoped v3 XGBoost transportation model and uses
     TreeExplainer to show which mobility features drive predictions.

Research integrity:
  * FEATURE_COLS is imported from predictor.py (single source of truth) — this
    fixes the historical drift where this module declared its own stale list.
  * Real TreeExplainer output is only attached for v3 XGBoost models; legacy
    v2 lifestyle models are rejected by the schema guard.
"""

import os
import numpy as np
import shap
from xgboost import XGBRegressor
import joblib

from predictor import FEATURE_COLS, MODEL_VERSION  # single source of truth

# ---------------------------------------------------------------------------
# Scoped model loading (mirrors predictor.py's path logic)
# ---------------------------------------------------------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def _model_path(scope, scope_id):
    return os.path.join(MODEL_DIR, f"carbon_model_{scope}_{scope_id}.pkl")


def _load_model(scope, scope_id):
    """Load a previously-saved model and scaler for the given scope.

    Returns (model, scaler) or (None, None). Rejects any model whose saved
    feature schema does not match the current transportation FEATURE_COLS.
    """
    import json

    path = _model_path(scope, scope_id)
    meta_path = os.path.join(MODEL_DIR, f"model_meta_{scope}_{scope_id}.json")
    if not os.path.exists(path):
        return None, None
    try:
        artifacts = joblib.load(path)
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            if meta.get("feature_schema") != list(FEATURE_COLS):
                return None, None
        else:
            return None, None
        return artifacts["model"], artifacts["scaler"]
    except Exception:
        return None, None


# Human-readable names for mobility features (used in explanations)
FEATURE_LABELS = {
    "car_km": "Car distance",
    "ev_km": "EV distance",
    "motorcycle_km": "Motorcycle distance",
    "auto_rickshaw_km": "Auto-rickshaw distance",
    "bus_km": "Bus distance",
    "metro_km": "Metro distance",
    "flight_km": "Flight distance",
    "active_km": "Walking/cycling distance",
    "occupants": "Vehicle occupancy",
    "day_of_week": "Day of week",
}

# ---------------------------------------------------------------------------
# Main explainer
# ---------------------------------------------------------------------------
def explain_emissions(mode_breakdown, total, scope="user", scope_id="anonymous"):
    """Generate a SHAP-style explanation of transportation emission composition.

    Parameters
    ----------
    mode_breakdown : dict
        Per-mode personal emission values, e.g. {"car": 2.1, "metro": 0.4}.
    total : float
        Total personal transport emissions.
    scope : str
        One of "user", "department", "college".
    scope_id : str
        The MongoDB _id for the scope.

    Returns
    -------
    dict with contributions, topFactors, explanation, shapValues,
    recommendations, method, and optionally modelFeatureImportance.
    """
    if not mode_breakdown or total <= 0:
        return {
            "contributions": {},
            "topFactors": [],
            "explanation": "Insufficient mobility data for analysis.",
            "shapValues": {},
            "recommendations": [],
            "method": "shap_approximation",
        }

    categories = list(mode_breakdown.keys())
    values = np.array([mode_breakdown.get(c, 0) for c in categories])
    total_val = float(values.sum())

    if total_val == 0:
        return {
            "contributions": {c: 0 for c in categories},
            "topFactors": [],
            "explanation": "No transport emissions recorded.",
            "shapValues": {c: 0 for c in categories},
            "recommendations": [],
            "method": "shap_approximation",
        }

    # ---- Part 1: composition analysis -------------------------------------
    contributions = {}
    shap_values = {}
    for i, cat in enumerate(categories):
        pct = round(float(values[i] / total_val) * 100, 1)
        contributions[cat] = pct
        without = total_val - float(values[i])
        avg_without = without / max(len(categories) - 1, 1)
        shap_values[cat] = round(float(values[i]) - avg_without, 2)

    sorted_factors = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
    top_factors = [{"name": k, "percentage": v} for k, v in sorted_factors[:4]]

    top = sorted_factors[0]
    second = sorted_factors[1] if len(sorted_factors) > 1 else None

    explanation_parts = [
        f"Your transportation footprint is {total:.1f} kg CO\u2082.",
        f"The dominant mode is **{top[0].replace('_', ' ')}** at {top[1]}% of transport emissions.",
    ]
    if second and second[1] > 10:
        explanation_parts.append(f"**{second[0].replace('_', ' ')}** contributes {second[1]}%.")

    recommendations = _get_recommendations(sorted_factors)
    explanation_parts.extend(recommendations)

    result = {
        "contributions": contributions,
        "topFactors": top_factors,
        "explanation": " ".join(explanation_parts),
        "shapValues": shap_values,
        "recommendations": recommendations,
        "method": "shap_approximation",
    }

    # ---- Part 2: real TreeExplainer on the scoped v3 XGBoost model --------
    model, scaler = _load_model(scope, scope_id)
    if model is not None and isinstance(model, XGBRegressor):
        try:
            explainer = shap.TreeExplainer(model)
            rng = np.random.default_rng(42)
            background = rng.random((50, len(FEATURE_COLS))) * 5.0
            background_scaled = scaler.transform(background) if scaler else background
            shap_vals = explainer.shap_values(background_scaled)
            mean_abs_shap = np.abs(shap_vals).mean(axis=0)

            model_shap = {
                FEATURE_COLS[i]: round(float(mean_abs_shap[i]), 4)
                for i in range(len(FEATURE_COLS))
            }
            result["modelFeatureImportance"] = model_shap
            result["modelVersion"] = MODEL_VERSION
            result["method"] = "shap_tree_explainer"
        except Exception:
            pass  # keep composition approximation

    return result


# ---------------------------------------------------------------------------
# Transportation-only recommendations
# ---------------------------------------------------------------------------
def _get_recommendations(sorted_factors):
    """Actionable MOBILITY tips based on the dominant emission mode."""
    recs = []
    top_mode = sorted_factors[0][0]

    rec_map = {
        "car": "Your car dominates your transport emissions — try carpooling, or shifting routine trips to metro/bus.",
        "ev": "EV charging emissions follow the grid — charging overnight on cleaner grid hours can help.",
        "motorcycle": "Consider a metro+walk combo for solo motorcycle commutes.",
        "auto_rickshaw": "For regular auto routes, a bus alternative could cut emissions significantly.",
        "bus": "Buses are already efficient per passenger — cycling first/last-mile can further reduce totals.",
        "metro": "Metro is low-carbon — extending it to more trips keeps your footprint low.",
        "flight": "Flights are emission-intensive — consider rail for shorter intercity journeys.",
        "bicycle": "Cycling trips are zero-emission — great choice.",
        "walk": "Walking trips are zero-emission — great choice.",
    }

    if top_mode in rec_map:
        recs.append(rec_map[top_mode])

    return recs
