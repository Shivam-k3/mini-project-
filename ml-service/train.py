"""Standalone training script for the carbon emission prediction model.

Generates synthetic training data from the emission factor library,
trains an XGBoost model with cross-validation, and saves it to models/.

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
from collections import OrderedDict
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from emission_utils import EMISSION_FACTORS, calculate_emissions

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    "transport_total", "electricity", "water", "food_val",
    "shopping_val", "waste_val", "fuel_total", "day_of_week",
    "car_occupants",
]

FOOD_OPTIONS = list(EMISSION_FACTORS["food"].keys())
SHOP_OPTIONS = list(EMISSION_FACTORS["shopping"].keys())
WASTE_OPTIONS = list(EMISSION_FACTORS["waste"].keys())
TRANSPORT_MODES = list(EMISSION_FACTORS["transport"].keys())
FUEL_TYPES = list(EMISSION_FACTORS["fuel"].keys())
FOOD_MAP = EMISSION_FACTORS["food"]
SHOP_MAP = EMISSION_FACTORS["shopping"]
WASTE_MAP = EMISSION_FACTORS["waste"]


def generate_synthetic_sample():
    """Generate one realistic carbon entry and return (features_dict, target)."""
    transport = {}
    for mode in TRANSPORT_MODES:
        if random.random() < 0.6:
            transport[mode] = round(random.uniform(0, 30), 1)

    # Occupancy-aware: most trips solo, some shared (carpool / family)
    occupants = 1 if random.random() < 0.55 else random.randint(2, 6)
    transport["carOccupants"] = occupants

    electricity = round(random.uniform(2, 20), 1)
    water = round(random.uniform(30, 300), 0)
    food_habit = random.choice(FOOD_OPTIONS)
    shopping = random.choice(SHOP_OPTIONS)
    waste = random.choice(WASTE_OPTIONS)

    fuel = {}
    for ftype in FUEL_TYPES:
        if random.random() < 0.3:
            fuel[ftype] = round(random.uniform(0.5, 5), 1)

    solar = random.random() < 0.15

    entry = {
        "transport": transport,
        "electricity": electricity,
        "water": water,
        "foodHabit": food_habit,
        "shoppingFrequency": shopping,
        "wasteGeneration": waste,
        "fuel": fuel,
        "solarPanels": solar,
    }

    result = calculate_emissions(entry)
    target = result["total"] + round(random.gauss(0, result["total"] * 0.05), 2)

    features = OrderedDict([
        ("transport_total", sum(v for k, v in transport.items() if k != "carOccupants")),
        ("electricity", electricity),
        ("water", water),
        ("food_val", FOOD_MAP[food_habit]),
        ("shopping_val", SHOP_MAP[shopping]),
        ("waste_val", WASTE_MAP[waste]),
        ("fuel_total", sum(fuel.values())),
        ("day_of_week", random.randint(0, 6)),
        ("car_occupants", occupants),
    ])

    return features, max(0, target)


def generate_synthetic_dataset(n_samples=500):
    """Generate a full synthetic dataset."""
    print(f"Generating {n_samples} synthetic samples...")
    rows = []
    targets = []
    for _ in range(n_samples):
        features, target = generate_synthetic_sample()
        rows.append(features)
        targets.append(target)
    return pd.DataFrame(rows), np.array(targets)


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
    parser = argparse.ArgumentParser(description="Train carbon emission prediction model")
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
    else:
        X_df, y = generate_synthetic_dataset(args.samples)
        X = X_df.values

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

    # Determine output path: explicit, or scoped path, or legacy global path
    if args.output:
        output_path = args.output
        meta_path = os.path.join(os.path.dirname(output_path), "model_meta.json")
    else:
        # Use scoped filename so the model is discoverable by predictor.py
        model_filename = f"carbon_model_{args.scope}_{args.scope_id}.pkl"
        meta_filename = f"model_meta_{args.scope}_{args.scope_id}.json"
        output_path = os.path.join(MODEL_DIR, model_filename)
        meta_path = os.path.join(MODEL_DIR, meta_filename)

    meta = {
        "n_samples": len(y),
        "n_features": len(FEATURE_COLS),
        "metrics": metrics,
        "feature_importance": importance,
        "version": "2.1.0",
        "scope": args.scope,
        "scope_id": args.scope_id,
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
