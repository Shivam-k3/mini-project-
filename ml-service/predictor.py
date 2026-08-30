"""Transportation CO2 prediction using XGBoost with adaptive tiers and multi-tenant scopes.

v3.0.0 — TRANSPORTATION-ONLY pipeline (spec §15/§17):
  * Features describe mobility behaviour exclusively (mode km, occupancy,
    day-of-week). Legacy lifestyle fields (electricity/water/food/shopping/
    waste/fuel) are NEVER used as features or targets.
  * Targets are occupancy-allocated personal transport emissions.
  * Adaptive tiers:
      Tier 1 (< 10 samples)  : rolling-average statistical baseline ("rolling_average")
      Tier 2 (10–29 samples) : hybrid = rolling baseline blended with XGBoost ("hybrid")
      Tier 3 (>= 30 samples) : full XGBoost model ("xgboost")
    SHAP explanations are only meaningful for Tier 3 XGBoost output.

Scopes (model files never collide):
  - "user"       : per-user personalized model
  - "department" : department-level model
  - "college"    : organization-level model (presented as "Organization" in UI)

Legacy v2 models (9 lifestyle features) are rejected by the stale-model guard.
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

MODEL_VERSION = "3.0.0"

# Transport-only feature columns, exact order (spec §15 candidate features that
# actually exist in the data). Distances are RAW vehicle km (behaviour), while
# the target is the occupancy-allocated personal emission.
FEATURE_COLS = [
    "car_km", "ev_km", "motorcycle_km", "auto_rickshaw_km",
    "bus_km", "metro_km", "flight_km", "active_km",
    "occupants", "day_of_week",
]

TRANSPORT_MODES = ["car", "ev", "motorcycle", "auto_rickshaw", "bus", "metro", "flight", "bicycle", "walk"]
OCCUPANCY_SPLIT_MODES = {"car", "motorcycle", "auto_rickshaw", "ev"}

# Adaptive tier thresholds (spec §17)
TIER1_MAX = 9      # < 10 samples -> rolling average
TIER2_MAX = 29     # 10..29       -> hybrid

LEGACY_MODE_MAP = {"car": "car", "ev": "ev", "bus": "bus", "metro": "metro", "flight": "flight"}


def _clamp_occupants(v):
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return 1
    return max(1, min(8, n))


def _extract_mode_kms(entry):
    """Return ({mode: raw_km}, [occupants...]) from a v3 trips entry or legacy aggregate."""
    mode_km = {m: 0.0 for m in TRANSPORT_MODES}
    occupants_seen = []

    trips = entry.get("trips")
    if isinstance(trips, list) and trips:
        for t in trips:
            if not isinstance(t, dict):
                continue
            mode = str(t.get("mode", "")).lower().strip()
            if mode not in mode_km:
                continue
            try:
                dist = float(t.get("distanceKm", 0))
            except (TypeError, ValueError):
                continue
            if dist <= 0:
                continue
            try:
                freq = max(1, int(round(float(t.get("tripFrequency") or 1))))
            except (TypeError, ValueError):
                freq = 1
            mode_km[mode] += dist * freq
            if mode in OCCUPANCY_SPLIT_MODES:
                occupants_seen.append(_clamp_occupants(t.get("occupants", 1)))
        return mode_km, occupants_seen

    # Legacy daily-aggregate shape (archival entries): still valid MOBILITY data.
    legacy = entry.get("transport", {})
    if isinstance(legacy, dict):
        for key, mode in LEGACY_MODE_MAP.items():
            try:
                mode_km[mode] += float(legacy.get(key, 0) or 0)
            except (TypeError, ValueError):
                pass
        try:
            mode_km["bicycle"] += float(legacy.get("bike", 0) or 0)
        except (TypeError, ValueError):
            pass
        occupants_seen.append(_clamp_occupants(legacy.get("carOccupants", 1)))
    return mode_km, occupants_seen


def _transport_target(entry):
    """Occupancy-allocated personal transport emissions for one entry."""
    v = entry.get("transportPersonal")
    if v is None:
        breakdown = entry.get("breakdown") or {}
        v = breakdown.get("transport", 0)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------
def _extract_features(entry):
    """Convert a carbon entry dict into an OrderedDict matching FEATURE_COLS."""
    mode_km, occupants_seen = _extract_mode_kms(entry)
    occupants = float(np.mean(occupants_seen)) if occupants_seen else 1.0
    date = entry.get("date") or entry.get("createdAt") or "2024-01-01"
    try:
        dow = pd.Timestamp(date).dayofweek
    except Exception:
        dow = 0
    return OrderedDict([
        ("car_km", mode_km["car"]),
        ("ev_km", mode_km["ev"]),
        ("motorcycle_km", mode_km["motorcycle"]),
        ("auto_rickshaw_km", mode_km["auto_rickshaw"]),
        ("bus_km", mode_km["bus"]),
        ("metro_km", mode_km["metro"]),
        ("flight_km", mode_km["flight"]),
        ("active_km", mode_km["bicycle"] + mode_km["walk"]),
        ("occupants", occupants),
        ("day_of_week", dow),
    ])


def _history_to_df(history):
    """Convert entry dicts into a DataFrame of transport features + target."""
    rows = []
    for entry in history:
        features = _extract_features(entry)
        features["target"] = _transport_target(entry)
        rows.append(features)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Scoped model paths (avoids collisions between user/dept/org models)
# ---------------------------------------------------------------------------
def _model_path(scope, scope_id):
    return os.path.join(MODEL_DIR, f"carbon_model_{scope}_{scope_id}.pkl")


def _meta_path(scope, scope_id):
    return os.path.join(MODEL_DIR, f"model_meta_{scope}_{scope_id}.json")


def _get_model_paths(scope, scope_id):
    return _model_path(scope, scope_id), _meta_path(scope, scope_id)


# ---------------------------------------------------------------------------
# Model persistence (scoped)
# ---------------------------------------------------------------------------
def _load_model(scope, scope_id):
    """Load a saved model+scaler+meta, or (None, None, {}).

    Stale-model guard: any model whose feature count/schema differs from the
    current transportation FEATURE_COLS is rejected (old v2 lifestyle models).
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
        if meta.get("n_features") != len(FEATURE_COLS):
            return None, None, {}
        if meta.get("feature_schema") != list(FEATURE_COLS):
            return None, None, {}
        return artifacts["model"], artifacts["scaler"], meta
    except Exception:
        return None, None, {}


def _save_model(model, scaler, meta, scope, scope_id):
    model_path, meta_path = _get_model_paths(scope, scope_id)
    joblib.dump({"model": model, "scaler": scaler}, model_path)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)


# ---------------------------------------------------------------------------
# Training helpers
# ---------------------------------------------------------------------------
def _train_xgboost(X, y):
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
    return {
        "r2": round(float(r2_score(y_true, y_pred)), 3),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 2),
    }


def _safe_val(x):
    if isinstance(x, (int, float, np.integer, np.floating)) and np.isfinite(x):
        return float(x)
    return 0.0


def _rolling_baseline(history, n_days=7):
    """Tier 1 statistical baseline: mean of the most recent week of targets."""
    targets = [_transport_target(e) for e in history]
    window = targets[-7:] if len(targets) >= 7 else targets
    avg = float(np.mean(window)) if window else 0.0
    return {
        "nextWeek": round(avg * n_days, 2),
        "nextMonth": round(avg * 30, 2),
        "dailyForecast": [round(avg, 2)] * n_days,
        "recentAverage": round(avg, 2),
    }


def _feature_importance(model):
    importance = {}
    if hasattr(model, "feature_importances_") and model.feature_importances_ is not None:
        importance = {
            FEATURE_COLS[i]: round(float(model.feature_importances_[i]), 4)
            for i in range(len(FEATURE_COLS))
        }
    return importance


def _fit(history):
    """Fit scaler+xgboost on history; returns (model, scaler, metrics)."""
    df = _history_to_df(history)
    X = df[FEATURE_COLS].values
    y = df["target"].values.astype(float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model = _train_xgboost(X_scaled, y)
    metrics = _compute_metrics(y, model.predict(X_scaled))
    return model, scaler, metrics, y


# =============================== PUBLIC API =================================

def train_entity_model(scope, scope_id, history):
    """Train and persist a scoped XGBoost model on transportation data."""
    if not history or len(history) < TIER1_MAX + 1:
        return {
            "trained": False,
            "n_samples": len(history) if history else 0,
            "method": "insufficient_data",
            "metrics": {},
            "featureImportance": {},
        }

    model, scaler, metrics, y = _fit(history)
    importance = _feature_importance(model)
    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "feature_schema": list(FEATURE_COLS),
        "metrics": metrics,
        "version": MODEL_VERSION,
        "scope": scope,
        "scope_id": scope_id,
        "feature_importance": importance,
    }
    _save_model(model, scaler, meta, scope, scope_id)

    return {
        "trained": True,
        "n_samples": len(y),
        "metrics": metrics,
        "featureImportance": importance,
        "method": "xgboost",
    }


def predict_with_model(scope, scope_id, latest_entry=None, n_days=7):
    """Forecast using a previously-trained scoped model (Tier 3 path)."""
    model, scaler, meta = _load_model(scope, scope_id)

    if model is None:
        avg = _transport_target(latest_entry) if latest_entry else 0.0
        return {
            "nextWeek": round(avg * 7, 2),
            "nextMonth": round(avg * 30, 2),
            "dailyForecast": [round(avg, 2)] * n_days,
            "confidence": 0.3,
            "method": "no_trained_model",
            "tier": 0,
            "predictionIntervals": {"lower": 0, "upper": round(avg * 7, 2)},
        }

    if latest_entry is None:
        latest_entry = {}

    latest_features = _extract_features(latest_entry)
    n_samples = meta.get("n_samples", 7) if meta else 7

    daily_forecast = []
    for i in range(n_days):
        feat = [latest_features[k] for k in FEATURE_COLS]
        feat[-1] = (feat[-1] + i) % 7
        X_pred = scaler.transform([feat])
        pred = max(0, _safe_val(model.predict(X_pred)[0]))
        daily_forecast.append(round(pred, 2))

    next_week = round(sum(daily_forecast), 2)
    next_month = round(next_week * 4.3, 2)
    confidence = max(0.3, min(0.95, 0.5 + (n_samples / 100) * 0.4))
    margin = next_week * (1 - confidence)

    return {
        "nextWeek": next_week,
        "nextMonth": next_month,
        "dailyForecast": daily_forecast,
        "confidence": round(confidence, 2),
        "method": "xgboost_entity_model",
        "tier": 3,
        "modelVersion": meta.get("version", MODEL_VERSION),
        "nSamples": n_samples,
        "predictionIntervals": {
            "lower": round(max(0, next_week - margin), 2),
            "upper": round(next_week + margin, 2),
        },
    }


def train_and_predict(history, scope="user", scope_id=None):
    """Adaptive prediction entry point used by /predict.

    Chooses the tier from available sample count (spec §17) and labels the
    method honestly: rolling_average | hybrid | xgboost.
    """
    n = len(history) if history else 0

    # ---- Tier 1: statistical baseline ------------------------------------
    if n == 0:
        baseline = _rolling_baseline([], 7)
        return {
            **baseline,
            "dailyForecast": [0.0] * 7,
            "nextWeek": 0,
            "nextMonth": 0,
            "confidence": 0.3,
            "method": "insufficient_data",
            "tier": 0,
            "scope": scope,
            "scopeId": scope_id,
            "trend": "unknown",
        }

    if n <= TIER1_MAX:
        baseline = _rolling_baseline(history, 7)
        return {
            **baseline,
            "confidence": 0.4,
            "method": "rolling_average",
            "tier": 1,
            "methodNote": "Statistical rolling baseline (insufficient data for ML)",
            "scope": scope,
            "scopeId": scope_id,
            "trend": "unknown",
        }

    # ---- Fit XGBoost (used by Tier 2 hybrid and Tier 3) -------------------
    model, scaler, metrics, y = _fit(history)
    importance = _feature_importance(model)
    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "feature_schema": list(FEATURE_COLS),
        "metrics": metrics,
        "version": MODEL_VERSION,
        "scope": scope,
        "scope_id": scope_id,
        "feature_importance": importance,
    }
    # Persist only when there is enough data for a standalone model (Tier 3)
    if n >= TIER2_MAX + 1:
        _save_model(model, scaler, meta, scope, scope_id)

    latest = _extract_features(history[0])
    recent_avg = _safe_val(np.mean(y[-7:]) if len(y) >= 7 else np.mean(y))
    trend_val = _safe_val((y[-1] - y[0]) / max(len(y), 1)) if len(y) > 1 else 0.0

    xgb_daily = []
    for i in range(7):
        feat = [latest[k] for k in FEATURE_COLS]
        feat[-1] = (feat[-1] + i) % 7
        X_pred = scaler.transform([feat])
        pred = max(0, _safe_val(model.predict(X_pred)[0]) - trend_val * i * 0.1)
        xgb_daily.append(pred)

    residuals = np.abs(y - model.predict(scaler.transform(
        pd.DataFrame([_extract_features(e) for e in history])[FEATURE_COLS].values)))
    std_residual = _safe_val(np.std(residuals)) if len(residuals) > 1 else 1.0
    mean_val = _safe_val(np.mean(y)) if len(y) > 0 else 1.0
    confidence = max(0.5, min(0.95, 1 - std_residual / (mean_val + 1e-6)))

    trend_label = "decreasing" if trend_val < -0.1 else "increasing" if trend_val > 0.1 else "stable"

    # ---- Tier 2: hybrid blend ---------------------------------------------
    if n <= TIER2_MAX:
        weight_ml = min(0.5, (n - TIER1_MAX) / (TIER2_MAX - TIER1_MAX) * 0.5)  # 0→0.5 as data grows
        rolling_avg = _rolling_baseline(history, 7)["recentAverage"]
        blended = [
            round((1 - weight_ml) * rolling_avg + weight_ml * x, 2)
            for x in xgb_daily
        ]
        next_week = round(sum(blended), 2)
        return {
            "nextWeek": next_week,
            "nextMonth": round(next_week * 4.3, 2),
            "dailyForecast": blended,
            "confidence": round(confidence, 2),
            "method": "hybrid",
            "tier": 2,
            "methodNote": f"Rolling baseline blended with XGBoost ({int(weight_ml * 100)}% ML weight)",
            "scope": scope,
            "scopeId": scope_id,
            "modelVersion": MODEL_VERSION,
            "metrics": metrics,
            "featureImportance": importance,
            "recentAverage": round(recent_avg, 2),
            "trend": trend_label,
            "predictionIntervals": {
                "lower": round(max(0, next_week * confidence), 2),
                "upper": round(next_week / max(confidence, 0.01), 2),
            },
        }

    # ---- Tier 3: full XGBoost ----------------------------------------------
    daily_forecast = [round(p, 2) for p in xgb_daily]
    next_week = round(sum(daily_forecast), 2)
    margin = next_week * (1 - confidence)
    return {
        "nextWeek": next_week,
        "nextMonth": round(next_week * 4.3, 2),
        "dailyForecast": daily_forecast,
        "confidence": round(confidence, 2),
        "method": "xgboost",
        "tier": 3,
        "scope": scope,
        "scopeId": scope_id,
        "modelVersion": MODEL_VERSION,
        "metrics": metrics,
        "featureImportance": importance,
        "recentAverage": round(recent_avg, 2),
        "trend": trend_label,
        "predictionIntervals": {
            "lower": round(max(0, next_week - margin), 2),
            "upper": round(next_week + margin, 2),
        },
    }
