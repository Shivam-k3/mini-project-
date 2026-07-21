"""SHAP-based explainable AI for carbon emissions."""

import numpy as np


def explain_emissions(breakdown, total):
    """Generate SHAP-style feature contribution explanations."""
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
    total_val = values.sum()

    if total_val == 0:
        return {
            "contributions": {c: 0 for c in categories},
            "topFactors": [],
            "explanation": "No emissions recorded.",
            "shapValues": {c: 0 for c in categories},
            "method": "shap_approximation",
        }

    # SHAP-style Shapley value approximation for emission attribution
    contributions = {}
    shap_values = {}

    for i, cat in enumerate(categories):
        pct = round((values[i] / total_val) * 100, 1)
        contributions[cat] = pct

        # Marginal contribution approximation
        without = total_val - values[i]
        avg_without = without / max(len(categories) - 1, 1)
        marginal = values[i] - avg_without
        shap_values[cat] = round(marginal, 2)

    sorted_factors = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
    top_factors = [{"name": k, "percentage": v} for k, v in sorted_factors[:4]]

    # Generate human-readable explanation
    top = sorted_factors[0]
    second = sorted_factors[1] if len(sorted_factors) > 1 else None

    explanation_parts = [
        f"Your total carbon footprint is {total:.1f} kg CO₂.",
        f"The primary contributor is **{top[0]}** at {top[1]}% of total emissions.",
    ]

    if second and second[1] > 10:
        explanation_parts.append(
            f"**{second[0]}** is the second largest factor at {second[1]}%."
        )

    recommendations = _get_recommendations(sorted_factors)
    explanation_parts.extend(recommendations)

    return {
        "contributions": contributions,
        "topFactors": top_factors,
        "explanation": " ".join(explanation_parts),
        "shapValues": shap_values,
        "recommendations": recommendations,
        "method": "shap_approximation",
    }


def _get_recommendations(sorted_factors):
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
