"""Standalone training script for the transportation CO2 prediction model.

v3.0.0 — TRANSPORTATION-ONLY.

Synthetic data is generated from MOBILITY ARCHETYPES (car commuter, carpool,
metro user, cyclist, EV owner, etc.) producing realistic daily trip lists.
Targets are occupancy-allocated personal transport emissions computed by the
same engine used in production (emission_utils.calculate_trips).

ALL synthetic data is clearly labelled: meta.synthetic = true.

Usage:
    python train.py                          # Train with synthetic data
    python train.py --samples 1000           # Generate more samples
    python train.py --load path/to/data.csv  # Train from CSV
    python train.py --cv 5                   # 5-fold cross-validation
"""

import os
import sys
import argparse
import json
import random
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from emission_utils import calculate_trips  # noqa: E402
from predictor import FEATURE_COLS, MODEL_VERSION  # single source of truth

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Synthetic mobility archetypes (SYNTHETIC DATA - not real measurements)
# ---------------------------------------------------------------------------
def _trip(mode, lo, hi, occupants=1, purpose="commute", freq=1, vehicle=None):
    trip = {
        "mode": mode,
        "distanceKm": round(random.uniform(lo, hi), 1),
        "occupants": occupants,
        "tripFrequency": freq,
        "purpose": purpose,
    }
    if vehicle:
        trip["vehicle"] = vehicle
    return trip


ARCHETYPES = [
    # Solo petrol-car commuter
    lambda: [_trip("car", 10, 30, 1, "office", vehicle={"category": random.choice(["hatchback", "sedan", "suv"]), "fuelType": "petrol"})],
    # Carpool commuter (2-5 occupants)
    lambda: [_trip("car", 12, 35, random.randint(2, 5), "office", vehicle={"category": random.choice(["hatchback", "sedan"]), "fuelType": "petrol"})],
    # Metro + walk user
    lambda: [_trip("metro", 8, 25), _trip("walk", 0.8, 3)],
    # Bus + walk user
    lambda: [_trip("bus", 6, 20), _trip("walk", 0.5, 2)],
    # Cyclist
    lambda: [_trip("bicycle", 3, 12)] + ([_trip("metro", 5, 15)] if random.random() < 0.3 else []),
    # Motorcyclist (sometimes with pillion)
    lambda: [_trip("motorcycle", 8, 25, 1 if random.random() < 0.7 else 2, vehicle={"category": random.choice(["scooter", "standard"]), "fuelType": "petrol"})],
    # Auto-rickshaw user
    lambda: [_trip("auto_rickshaw", 4, 14, random.randint(1, 3), vehicle={"category": "standard", "fuelType": random.choice(["cng", "petrol"])})],
    # EV owner (declared consumption sometimes)
    lambda: [_trip("ev", 10, 30, 1 if random.random() < 0.7 else random.randint(2, 4), "office",
                   vehicle=({"electricityConsumptionKwhPerKm": round(random.uniform(0.12, 0.19), 3)}
                            if random.random() < 0.5 else {"category": "hatchback", "fuelType": "electric"}))],
    # Multimodal mix
    lambda: random.sample(
        [_trip("car", 5, 18, 1), _trip("metro", 6, 20), _trip("bus", 4, 12), _trip("bicycle", 2, 8), _trip("walk", 0.5, 2)],
        k=random.randint(2, 3),
    ),
    # Frequent flyer (rare long flight day)
    lambda: [_trip("flight", 500, 2000, purpose="other")] + [_trip("car", 5, 20, 1)],
]

ARCHETYPE_WEIGHTS = [0.16, 0.12, 0.16, 0.12, 0.10, 0.10, 0.06, 0.08, 0.08, 0.02]


def generate_synthetic_entry():
    """Generate one synthetic day of mobility; returns an entry dict with target set."""
    archetype = random.choices(ARCHETYPES, weights=ARCHETYPE_WEIGHTS, k=1)[0]
    trips = [t for t in archetype() if t["distanceKm"] > 0]
    result = calculate_trips(trips)

    entry = {
        "trips": trips,
        "date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=random.randint(0, 365)),
        "transportPersonal": result["transportPersonal"],
    }
    return entry


def generate_synthetic_dataset(n_samples=500):
    """Generate a full synthetic dataset (features via predictor's extractor)."""
    from predictor import _history_to_df  # exact serving-time feature extraction

    print(f"Generating {n_samples} SYNTHETIC mobility samples (archetype-based)...")
    entries = [generate_synthetic_entry() for _ in range(n_samples)]
    df = _history_to_df(entries)
    y = df["target"].values.astype(float)
    X_df = df[FEATURE_COLS]
    return X_df, y


def load_csv_data(path):
    """Load training data from a CSV file."""
    df = pd.read_csv(path)
    required = set(FEATURE_COLS + ["target"])
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    X = df[FEATURE_COLS]
    y = df["target"].values
    print(f"Loaded {len(df)} samples from {path}")
    return X, y


def train_model(X, y, cv_folds=0):
    """Train XGBoost with optional cross-validation."""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.06,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=1.0,
        reg_lambda=2.0,
        random_state=42,
        n_jobs=-1,
        eval_metric="rmse",
        early_stopping_rounds=20,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    metrics = {
        "train": {
            "r2": round(float(r2_score(y_train, train_pred)), 4),
            "mae": round(float(mean_absolute_error(y_train, train_pred)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(y_train, train_pred))), 3),
        },
        "test": {
            "r2": round(float(r2_score(y_test, test_pred)), 4),
            "mae": round(float(mean_absolute_error(y_test, test_pred)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, test_pred))), 3),
        },
    }

    if cv_folds > 1:
        cv_scores = []
        kf = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
        for train_idx, val_idx in kf.split(X_scaled):
            X_tr, X_val = X_scaled[train_idx], X_scaled[val_idx]
            y_tr, y_val = y[train_idx], y[val_idx]
            cv_model = XGBRegressor(
                n_estimators=300, max_depth=6, learning_rate=0.06,
                subsample=0.8, colsample_bytree=0.8,
                reg_alpha=1.0, reg_lambda=2.0, random_state=42, n_jobs=-1,
            )
            cv_model.fit(X_tr, y_tr)
            cv_pred = cv_model.predict(X_val)
            cv_scores.append(float(r2_score(y_val, cv_pred)))
        metrics["cv"] = {
            "folds": cv_folds,
            "mean_r2": round(float(np.mean(cv_scores)), 4),
            "std_r2": round(float(np.std(cv_scores)), 4),
            "scores": [round(s, 4) for s in cv_scores],
        }

    feature_importance = {
        FEATURE_COLS[i]: round(float(model.feature_importances_[i]), 4)
        for i in range(len(FEATURE_COLS))
    }

    return model, scaler, metrics, feature_importance


def main():
    parser = argparse.ArgumentParser(description="Train transportation CO2 prediction model")
    parser.add_argument("--samples", type=int, default=500, help="Synthetic samples to generate")
    parser.add_argument("--load", type=str, help="Load CSV file instead of synthetic data")
    parser.add_argument("--cv", type=int, default=5, help="Cross-validation folds (default: 5)")
    parser.add_argument("--scope", type=str, default="college",
                        choices=["user", "department", "college"],
                        help="Scope to save the model under (default: college)")
    parser.add_argument("--scope-id", type=str, default="global",
                        help="Scope ID (default: 'global')")
    parser.add_argument("--output", type=str, default=None,
                        help="Explicit output path (overrides scoped path)")
    args = parser.parse_args()

    if args.load:
        X, y = load_csv_data(args.load)
        synthetic = False
    else:
        X_df, y = generate_synthetic_dataset(args.samples)
        X = X_df.values
        synthetic = True

    print(f"Training on {len(y)} samples with {len(FEATURE_COLS)} features")
    print(f"Features: {FEATURE_COLS}")
    print(f"Target range: [{y.min():.2f}, {y.max():.2f}], mean: {y.mean():.2f}")
    print()

    model, scaler, metrics, importance = train_model(X, y, cv_folds=args.cv)

    print("=" * 50)
    print("TRAINING RESULTS")
    print("=" * 50)
    print(f"Train  -> R²: {metrics['train']['r2']}, MAE: {metrics['train']['mae']}, RMSE: {metrics['train']['rmse']}")
    print(f"Test   -> R²: {metrics['test']['r2']}, MAE: {metrics['test']['mae']}, RMSE: {metrics['test']['rmse']}")
    if "cv" in metrics:
        print(f"CV ({args.cv}-fold) -> R²: {metrics['cv']['mean_r2']} ± {metrics['cv']['std_r2']}")
    print()
    print("Feature Importance:")
    for feat, imp in sorted(importance.items(), key=lambda x: x[1], reverse=True):
        print(f"  {feat}: {imp:.4f}")
    print()

    if args.output:
        output_path = args.output
        meta_path = os.path.join(os.path.dirname(output_path), "model_meta.json")
    else:
        model_filename = f"carbon_model_{args.scope}_{args.scope_id}.pkl"
        meta_filename = f"model_meta_{args.scope}_{args.scope_id}.json"
        output_path = os.path.join(MODEL_DIR, model_filename)
        meta_path = os.path.join(MODEL_DIR, meta_filename)

    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "feature_schema": list(FEATURE_COLS),
        "metrics": metrics,
        "feature_importance": importance,
        "version": MODEL_VERSION,
        "scope": args.scope,
        "scope_id": args.scope_id,
        "synthetic": synthetic,
        "data_note": ("SYNTHETIC archetype-based training data - metrics describe fit to "
                      "simulated commuters, NOT real-world accuracy") if synthetic else "user-supplied CSV",
        "training_date": pd.Timestamp.now().isoformat(),
    }

    joblib.dump({"model": model, "scaler": scaler}, output_path)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Model saved to:  {output_path}")
    print(f"Metadata saved to: {meta_path}")
    print(f"Scope: {args.scope}, Scope ID: {args.scope_id}")
    print("Done.")


if __name__ == "__main__":
    main()
