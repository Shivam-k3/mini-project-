"""Carbon emission prediction using XGBoost with multi-tenant support.

Supports three scopes for model training and prediction:
  - "user"       : Per-user model (trained on individual history)
  - "department" : Department-level model (trained on aggregated student data)
  - "college"    : College-level model (trained on all users in a college)

Each scope saves model files to models/carbon_model_<scope>_<scope_id>.pkl
so they never overwrite each other. This enables a distributed campus setup
where superadmin → college_admin → faculty → student each see relevant predictions.
"""

import os
import json
from collections import OrderedDict
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib

# ---------------------------------------------------------------------------
# Directory and constants
# ---------------------------------------------------------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# The 8 feature columns the model expects, in exact order
FEATURE_COLS = [
    "transport_total", "electricity", "water", "food_val",
    "shopping_val", "waste_val", "fuel_total", "day_of_week",
]

# Mapping from categorical user inputs to numeric feature values
FOOD_MAP = {"vegetarian": 2.5, "nonVegetarian": 7.2, "vegan": 1.5}
SHOP_MAP = {"low": 0.5, "medium": 2.0, "high": 5.0}
WASTE_MAP = {"low": 0.3, "medium": 1.0, "high": 2.5}

# ---------------------------------------------------------------------------
# Scoped model paths  (avoids collisions between user/dept/college models)
# ---------------------------------------------------------------------------
def _model_path(scope, scope_id):
    """Return the .pkl path for a given scope and scope_id."""
    filename = f"carbon_model_{scope}_{scope_id}.pkl"
    return os.path.join(MODEL_DIR, filename)


def _meta_path(scope, scope_id):
    """Return the metadata JSON path for a given scope and scope_id."""
    filename = f"model_meta_{scope}_{scope_id}.json"
    return os.path.join(MODEL_DIR, filename)


def _get_model_paths(scope, scope_id):
    """Convenience: return (model_path, meta_path) for the scope."""
    return _model_path(scope, scope_id), _meta_path(scope, scope_id)


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------
def _extract_features(entry):
    """Convert a raw carbon entry dict into an OrderedDict of 8 numeric features.

    The order matches FEATURE_COLS exactly so array indexing is always correct.
    """
    transport = entry.get("transport", {})
    fuel = entry.get("fuel", {})
    return OrderedDict([
        ("transport_total", sum(transport.values()) if isinstance(transport, dict) else 0),
        ("electricity", entry.get("electricity", 0)),
        ("water", entry.get("water", 0)),
        ("food_val", FOOD_MAP.get(entry.get("foodHabit", "nonVegetarian"), 7.2)),
        ("shopping_val", SHOP_MAP.get(entry.get("shoppingFrequency", "medium"), 2.0)),
        ("waste_val", WASTE_MAP.get(entry.get("wasteGeneration", "medium"), 1.0)),
        ("fuel_total", sum(fuel.values()) if isinstance(fuel, dict) else 0),
        ("day_of_week", pd.Timestamp(entry.get("date", "2024-01-01")).dayofweek),
    ])


def _history_to_df(history):
    """Convert a list of carbon entry dicts into a DataFrame with features + target."""
    rows = []
    for entry in history:
        features = _extract_features(entry)
        # Accept both 'totalEmissions' (MongoDB) and 'total_emissions' (alternate naming)
        features["target"] = entry.get("totalEmissions", entry.get("total_emissions", 0))
        rows.append(features)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Model persistence (scoped)
# ---------------------------------------------------------------------------
def _load_model(scope, scope_id):
    """Load a previously-saved model and scaler for the given scope.

    Returns (model, scaler, meta_dict) or (None, None, {}) if not found.
    """
    model_path, meta_path = _get_model_paths(scope, scope_id)
    if not os.path.exists(model_path):
        return None, None, {}
    try:
        artifacts = joblib.load(model_path)
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
        return artifacts["model"], artifacts["scaler"], meta
    except Exception:
        return None, None, {}


def _save_model(model, scaler, meta, scope, scope_id):
    """Save model + scaler as a .pkl and metadata as JSON, both scoped."""
    model_path, meta_path = _get_model_paths(scope, scope_id)
    joblib.dump({"model": model, "scaler": scaler}, model_path)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def _train_xgboost(X, y):
    """Internal: train an XGBoost regressor on pre-scaled features."""
    model = XGBRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)
    return model


def _compute_metrics(y_true, y_pred):
    """Internal: compute R², MAE, RMSE between true and predicted values."""
    return {
        "r2": round(float(r2_score(y_true, y_pred)), 3),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 2),
    }


def _safe_val(x):
    """Safely convert a numpy numeric to float, returning 0.0 for inf/nan."""
    if isinstance(x, (int, float, np.integer, np.floating)) and np.isfinite(x):
        return float(x)
    return 0.0


# =============================== PUBLIC API =================================

def train_entity_model(scope, scope_id, history):
    """Train and save an XGBoost model for a given scope (user/department/college).

    Parameters
    ----------
    scope : str
        One of "user", "department", "college".
    scope_id : str
        The MongoDB _id string for the user, department, or college.
    history : list[dict]
        Carbon entry documents to train on.

    Returns
    -------
    dict
        Training metrics (R², MAE, RMSE) and feature importance.
        Returns fallback info if fewer than 3 entries.
    """
    # Not enough data to train — report fallback
    if not history or len(history) < 3:
        return {
            "trained": False,
            "n_samples": len(history) if history else 0,
            "method": "insufficient_data",
            "metrics": {},
            "featureImportance": {},
        }

    # Convert history to feature matrix and target vector
    df = _history_to_df(history)
    X = df[FEATURE_COLS].values
    y = df["target"].values.astype(float)

    # Standardise features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train XGBoost
    model = _train_xgboost(X_scaled, y)
    train_preds = model.predict(X_scaled)
    metrics = _compute_metrics(y, train_preds)

    # Build metadata
    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "metrics": metrics,
        "version": "2.0.0",
        "scope": scope,
        "scope_id": scope_id,
    }

    # Extract feature importance from the trained model
    importance = {}
    if hasattr(model, "feature_importances_") and model.feature_importances_ is not None:
        importance = {
            FEATURE_COLS[i]: round(float(model.feature_importances_[i]), 4)
            for i in range(len(FEATURE_COLS))
        }
    meta["feature_importance"] = importance

    # Persist to disk (scoped path so user/dept/college models never collide)
    _save_model(model, scaler, meta, scope, scope_id)

    return {
        "trained": True,
        "n_samples": len(y),
        "metrics": metrics,
        "featureImportance": importance,
        "method": "xgboost",
    }


def predict_with_model(scope, scope_id, latest_entry=None, n_days=7):
    """Generate forecasts using a previously-trained model for the scope.

    Parameters
    ----------
    scope : str
    scope_id : str
    latest_entry : dict or None
        The most recent carbon entry (used as a base for the forecast).
        If None, a default entry is used.
    n_days : int
        Number of days to forecast (default 7).

    Returns
    -------
    dict with daily_forecast, next_week, next_month, confidence, prediction_intervals.
    Returns a fallback if no trained model is found.
    """
    # Try to load a previously saved model for this scope
    model, scaler, meta = _load_model(scope, scope_id)

    # No model exists yet — return zeros / minimal confidence
    if model is None:
        avg = 15.0
        if latest_entry:
            avg = latest_entry.get("totalEmissions", latest_entry.get("total_emissions", 15.0))
        return {
            "nextWeek": round(avg * 7, 2),
            "nextMonth": round(avg * 30, 2),
            "dailyForecast": [round(avg, 2)] * n_days,
            "confidence": 0.3,
            "method": "no_trained_model",
            "predictionIntervals": {"lower": 0, "upper": round(avg * 7, 2)},
        }

    # Use the latest entry (or default) as the starting point for the forecast
    if latest_entry is None:
        latest_entry = {"totalEmissions": 15.0}

    latest_features = _extract_features(latest_entry)

    # Calculate trend from the model's training data metrics (if available)
    # A simple approach: use the latest data point and n_samples as a proxy
    n_samples = meta.get("n_samples", 7) if meta else 7
    # Trend uses the mean of training targets vs current prediction
    train_mean = meta.get("metrics", {}).get("mean_target", None)

    daily_forecast = []
    for i in range(n_days):
        # Build feature vector for day i, shifting day_of_week forward
        feat = [latest_features[k] for k in FEATURE_COLS]
        feat[-1] = (feat[-1] + i) % 7
        X_pred = scaler.transform([feat])

        # Predict and ensure non-negative
        pred = max(0, _safe_val(model.predict(X_pred)[0]))
        daily_forecast.append(round(pred, 2))

    next_week = round(sum(daily_forecast), 2)
    next_month = round(next_week * 4.3, 2)

    # Confidence based on training residuals and sample count
    confidence = max(0.3, min(0.95, 0.5 + (n_samples / 100) * 0.4))

    margin = next_week * (1 - confidence)
    return {
        "nextWeek": next_week,
        "nextMonth": next_month,
        "dailyForecast": daily_forecast,
        "confidence": round(confidence, 2),
        "method": "xgboost_entity_model",
        "modelVersion": meta.get("version", "unknown"),
        "nSamples": n_samples,
        "predictionIntervals": {
            "lower": round(max(0, next_week - margin), 2),
            "upper": round(next_week + margin, 2),
        },
    }


def train_and_predict(history, scope="user", scope_id=None):
    """Train on the given history and return predictions.

    This is the primary entry point used by the /predict endpoint.
    For user scope, it trains on the user's history and saves a per-user model.
    For department/college scopes, it trains on aggregated data and saves
    an entity-level model.

    Parameters
    ----------
    history : list[dict]
    scope : str
    scope_id : str

    Returns
    -------
    dict with predictions, metrics, feature importance, etc.
    """
    # --- Train the model (or use fallback) ---
    if not history or len(history) < 3:
        avg = float(np.mean([e.get("totalEmissions", 0) for e in history])) if history else 15.0
        return {
            "nextWeek": round(avg * 7, 2),
            "nextMonth": round(avg * 30, 2),
            "dailyForecast": [round(avg, 2)] * 7,
            "confidence": 0.5,
            "method": "average_fallback",
        }

    df = _history_to_df(history)
    X = df[FEATURE_COLS].values
    y = df["target"].values.astype(float)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = _train_xgboost(X_scaled, y)
    train_preds = model.predict(X_scaled)
    metrics = _compute_metrics(y, train_preds)

    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "metrics": metrics,
        "version": "2.0.0",
        "scope": scope,
        "scope_id": scope_id,
    }

    # Persist model with scope (critical for multi-tenant: user models never collide)
    _save_model(model, scaler, meta, scope, scope_id)

    # --- Predict next 7 days using latest features with a simple trend ---
    latest = _extract_features(history[0])
    recent_avg = _safe_val(np.mean(y[-7:]) if len(y) >= 7 else np.mean(y))
    trend_val = _safe_val((y[-1] - y[0]) / max(len(y), 1)) if len(y) > 1 else 0.0

    daily_forecast = []
    for i in range(7):
        feat = [latest[k] for k in FEATURE_COLS]
        feat[-1] = (feat[-1] + i) % 7
        X_pred = scaler.transform([feat])
        pred = max(0, _safe_val(model.predict(X_pred)[0]) - trend_val * i * 0.1)
        daily_forecast.append(round(pred, 2))

    next_week = round(sum(daily_forecast), 2)
    next_month = round(next_week * 4.3, 2)

    # Confidence based on normalised prediction error
    residuals = np.abs(y - train_preds)
    std_residual = _safe_val(np.std(residuals)) if len(residuals) > 1 else 1.0
    mean_val = _safe_val(np.mean(y)) if len(y) > 0 else 1.0
    confidence = max(0.5, min(0.95, 1 - std_residual / (mean_val + 1e-6)))

    # Feature importance
    importance = {}
    if hasattr(model, "feature_importances_") and model.feature_importances_ is not None:
        importance = {
            FEATURE_COLS[i]: round(float(model.feature_importances_[i]), 4)
            for i in range(len(FEATURE_COLS))
        }

    margin = next_week * (1 - confidence)
    return {
        "nextWeek": next_week,
        "nextMonth": next_month,
        "dailyForecast": daily_forecast,
        "confidence": round(confidence, 2),
        "method": "xgboost",
        "scope": scope,
        "scopeId": scope_id,
        "modelVersion": meta["version"],
        "metrics": metrics,
        "featureImportance": importance,
        "recentAverage": round(recent_avg, 2),
        "trend": "decreasing" if trend_val < -0.1 else "increasing" if trend_val > 0.1 else "stable",
        "predictionIntervals": {
            "lower": round(max(0, next_week - margin), 2),
            "upper": round(next_week + margin, 2),
        },
    }
