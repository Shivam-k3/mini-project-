"""Carbon emission prediction using XGBoost."""

import os
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    "transport_total", "electricity", "water", "food_val",
    "shopping_val", "waste_val", "fuel_total", "day_of_week",
]


def _extract_features(entry):
    transport = entry.get("transport", {})
    fuel = entry.get("fuel", {})
    food_map = {"vegetarian": 2.5, "nonVegetarian": 7.2, "vegan": 1.5}
    shop_map = {"low": 0.5, "medium": 2.0, "high": 5.0}
    waste_map = {"low": 0.3, "medium": 1.0, "high": 2.5}

    return {
        "transport_total": sum(transport.values()) if isinstance(transport, dict) else 0,
        "electricity": entry.get("electricity", 0),
        "water": entry.get("water", 0),
        "food_val": food_map.get(entry.get("foodHabit", "nonVegetarian"), 7.2),
        "shopping_val": shop_map.get(entry.get("shoppingFrequency", "medium"), 2.0),
        "waste_val": waste_map.get(entry.get("wasteGeneration", "medium"), 1.0),
        "fuel_total": sum(fuel.values()) if isinstance(fuel, dict) else 0,
        "day_of_week": pd.Timestamp(entry.get("date", "2024-01-01")).dayofweek,
    }


def _history_to_df(history):
    rows = []
    for entry in history:
        features = _extract_features(entry)
        features["target"] = entry.get("totalEmissions", entry.get("total_emissions", 0))
        rows.append(features)
    return pd.DataFrame(rows)


def train_and_predict(history):
    if not history or len(history) < 3:
        avg = np.mean([e.get("totalEmissions", 0) for e in history]) if history else 15.0
        return {
            "nextWeek": round(avg * 7, 2),
            "nextMonth": round(avg * 30, 2),
            "dailyForecast": [round(avg, 2)] * 7,
            "confidence": 0.5,
            "method": "average_fallback",
        }

    df = _history_to_df(history)
    X = df[FEATURE_COLS].values
    y = df["target"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = GradientBoostingRegressor(
        n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42
    )
    model.fit(X_scaled, y)

    # Predict next 7 days using latest features with slight trend
    latest = _extract_features(history[0])
    recent_avg = np.mean(y[-7:]) if len(y) >= 7 else np.mean(y)
    trend = (y[-1] - y[0]) / len(y) if len(y) > 1 else 0

    daily_forecast = []
    for i in range(7):
        feat = latest.copy()
        feat["day_of_week"] = (feat["day_of_week"] + i) % 7
        X_pred = scaler.transform([list(feat.values())])
        pred = max(0, model.predict(X_pred)[0] - trend * i * 0.1)
        daily_forecast.append(round(pred, 2))

    next_week = round(sum(daily_forecast), 2)
    next_month = round(next_week * 4.3, 2)

    # Save model
    joblib.dump({"model": model, "scaler": scaler}, os.path.join(MODEL_DIR, "carbon_model.pkl"))

    residuals = np.abs(y - model.predict(X_scaled))
    confidence = max(0.5, min(0.95, 1 - np.mean(residuals) / (np.mean(y) + 1e-6)))

    return {
        "nextWeek": next_week,
        "nextMonth": next_month,
        "dailyForecast": daily_forecast,
        "confidence": round(confidence, 2),
        "method": "gradient_boosting",
        "recentAverage": round(recent_avg, 2),
        "trend": "decreasing" if trend < -0.1 else "increasing" if trend > 0.1 else "stable",
    }
