"""SHAP-based explainable AI for carbon emissions with multi-tenant model support.

Provides two levels of explanation:
  1. Composition analysis: what % of total emissions comes from each category.
  2. Model-level SHAP: loads the scoped XGBoost model and uses TreeExplainer
     to show feature importance, giving insight into what drives predictions.

Supports the same scope/scope_id system as predictor.py so the correct
entity-level model is loaded for each request (user/department/college).
"""

import os
import numpy as np
import shap
from xgboost import XGBRegressor
import joblib

# ---------------------------------------------------------------------------
# Scoped model loading (mirrors predictor.py's path logic)
# ---------------------------------------------------------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
FEATURE_COLS = [
    "transport_total", "electricity", "water", "food_val",
    "shopping_val", "waste_val", "fuel_total", "day_of_week",
]


def _model_path(scope, scope_id):
    """Return the .pkl path for a given scope and scope_id."""
    return os.path.join(MODEL_DIR, f"carbon_model_{scope}_{scope_id}.pkl")


def _load_model(scope, scope_id):
    """Load a previously-saved model and scaler for the given scope.

    Returns (model, scaler) or (None, None) if not found.
    """
    path = _model_path(scope, scope_id)
    if not os.path.exists(path):
        return None, None
    try:
        artifacts = joblib.load(path)
        return artifacts["model"], artifacts["scaler"]
    except Exception:
        return None, None


# ---------------------------------------------------------------------------
# Main explainer
# ---------------------------------------------------------------------------
def explain_emissions(breakdown, total, scope="user", scope_id="anonymous"):
    """Generate a SHAP-style explanation of emission composition.

    Parameters
    ----------
    breakdown : dict
        Per-category emission values, e.g. {"transport": 5.2, "electricity": 3.8, ...}
    total : float
        Total emissions (sum of breakdown values).
    scope : str
        One of "user", "department", "college" — determines which model to load.
    scope_id : str
        The MongoDB _id for the scope.

    Returns
    -------
    dict
        contributions, topFactors, explanation, shapValues, recommendations,
        and optionally modelFeatureImportance from the scoped XGBoost model.
    """
    # -----------------------------------------------------------------------
    # Fallback: no data to analyse
    # -----------------------------------------------------------------------
    if not breakdown or total <= 0:
        return {
            "contributions": {},
            "topFactors": [],
            "explanation": "Insufficient data for analysis.",
            "shapValues": {},
            "method": "shap_approximation",
        }

    categories = list(breakdown.keys())
    values = np.array([breakdown.get(c, 0) for c in categories])
    total_val = float(values.sum())

    if total_val == 0:
        return {
            "contributions": {c: 0 for c in categories},
            "topFactors": [],
            "explanation": "No emissions recorded.",
            "shapValues": {c: 0 for c in categories},
            "method": "shap_approximation",
        }

    # -----------------------------------------------------------------------
    # Part 1: Composition analysis — what % of total comes from each category?
    # -----------------------------------------------------------------------
    contributions = {}
    shap_values = {}
    for i, cat in enumerate(categories):
        pct = round(float(values[i] / total_val) * 100, 1)
        contributions[cat] = pct

        # Approximate marginal (Shapley-like) contribution:
        # how much does this category contribute beyond the average of others?
        without = total_val - float(values[i])
        avg_without = without / max(len(categories) - 1, 1)
        marginal = float(values[i]) - avg_without
        shap_values[cat] = round(marginal, 2)

    sorted_factors = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
    top_factors = [{"name": k, "percentage": v} for k, v in sorted_factors[:4]]

    # Human-readable summary
    top = sorted_factors[0]
    second = sorted_factors[1] if len(sorted_factors) > 1 else None

    explanation_parts = [
        f"Your total carbon footprint is {total:.1f} kg CO2.",
        f"The primary contributor is **{top[0]}** at {top[1]}% of total emissions.",
    ]
    if second and second[1] > 10:
        explanation_parts.append(f"**{second[0]}** is the second largest factor at {second[1]}%.")

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

    # -----------------------------------------------------------------------
    # Part 2: Model-level SHAP — load the scoped XGBoost model and compute
    # actual SHAP feature importance using TreeExplainer.
    #
    # This gives insight into which features (transport_total, electricity, etc.)
    # the model considers most important for predictions in this scope.
    # -----------------------------------------------------------------------
    model, scaler = _load_model(scope, scope_id)
    if model is not None and isinstance(model, XGBRegressor):
        try:
            # TreeExplainer is fast and exact for tree-based models
            explainer = shap.TreeExplainer(model)
            # Create a small background sample for SHAP value estimation
            background = np.random.randn(50, len(FEATURE_COLS)) * 0.1
            background_scaled = scaler.transform(background) if scaler else background
            shap_vals = explainer.shap_values(background_scaled)
            mean_abs_shap = np.abs(shap_vals).mean(axis=0)

            model_shap = {
                FEATURE_COLS[i]: round(float(mean_abs_shap[i]), 4)
                for i in range(len(FEATURE_COLS))
            }
            # Attach model-level insights to the response
            result["modelFeatureImportance"] = model_shap
            # Mark that we used the real SHAP explainer (not approximation)
            result["method"] = "shap_tree_explainer"
        except Exception:
            # If SHAP computation fails, keep the approximation result as-is
            pass

    return result


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------
def _get_recommendations(sorted_factors):
    """Generate actionable tips based on the top emission category."""
    recs = []
    top_cat = sorted_factors[0][0]

    rec_map = {
        "transport": "Consider switching to public transit, cycling, or an electric vehicle to reduce transport emissions.",
        "electricity": "Reduce electricity usage by 20% through LED bulbs, smart thermostats, or solar panels.",
        "food": "Switching to a plant-based diet could reduce food emissions by up to 60%.",
        "shopping": "Reduce shopping frequency and choose sustainable, locally-sourced products.",
        "waste": "Implement composting and recycling to minimize waste-related emissions.",
        "fuel": "Reduce direct fuel consumption by consolidating trips and maintaining your vehicle.",
        "water": "Fix leaks and install water-efficient fixtures to reduce water-related energy use.",
    }

    if top_cat in rec_map:
        recs.append(rec_map[top_cat])

    return recs
