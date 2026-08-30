"""Model evaluation: compare XGBoost against naive baselines using walk-forward validation.

v3.0.0 — TRANSPORTATION-ONLY.

Simulates real-world usage: each synthetic user is assigned a mobility
archetype (car commuter, metro user, cyclist...) with day-to-day variation.
For each user, train on days 1..N, predict day N+1, slide forward, accumulate
errors. Reports MAE / RMSE / MAPE per method so you can see whether the ML
model actually beats simple approaches on mobility data.

ALL data is SYNTHETIC (archetype-based) — metrics describe fit to simulated
commuters, NOT real-world accuracy.

Usage:
    python evaluate.py                          # synthetic data, 500 users
    python evaluate.py --users 1000             # more users
"""

import os
import sys
import argparse
import random
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.dirname(__file__))
from emission_utils import calculate_trips  # noqa: E402
from predictor import FEATURE_COLS, _history_to_df  # noqa: E402

# Archetypes mirror train.py but parameterised per-user so behaviour is
# consistent within a user (that is what makes prediction learnable).
ARCHETYPES = ["car_solo", "carpool", "metro", "bus", "cyclist",
              "motorcycle", "auto", "ev", "multimodal"]


def _trip(mode, lo, hi, occupants=1, purpose="commute", vehicle=None):
    trip = {
        "mode": mode,
        "distanceKm": round(max(0.0, random.gauss((lo + hi) / 2, (hi - lo) / 4)), 1),
        "occupants": occupants,
        "tripFrequency": 1,
        "purpose": purpose,
    }
    if vehicle:
        trip["vehicle"] = vehicle
    return trip


def _archetype_trips(archetype):
    """Generate one day of trips for the given archetype."""
    if archetype == "car_solo":
        trips = [_trip("car", 10, 30, 1, vehicle={"category": "hatchback", "fuelType": "petrol"})]
    elif archetype == "carpool":
        trips = [_trip("car", 12, 35, random.randint(2, 5),
                       vehicle={"category": "sedan", "fuelType": "petrol"})]
    elif archetype == "metro":
        trips = [_trip("metro", 8, 25), _trip("walk", 0.8, 3)]
    elif archetype == "bus":
        trips = [_trip("bus", 6, 20), _trip("walk", 0.5, 2)]
    elif archetype == "cyclist":
        trips = [_trip("bicycle", 3, 12)]
        if random.random() < 0.25:
            trips.append(_trip("metro", 5, 15))
    elif archetype == "motorcycle":
        trips = [_trip("motorcycle", 8, 25, 1 if random.random() < 0.75 else 2,
                       vehicle={"category": "standard", "fuelType": "petrol"})]
    elif archetype == "auto":
        trips = [_trip("auto_rickshaw", 4, 14, random.randint(1, 3),
                       vehicle={"category": "standard", "fuelType": "cng"})]
    elif archetype == "ev":
        occ = 1 if random.random() < 0.7 else random.randint(2, 4)
        trips = [_trip("ev", 10, 30, occ,
                       vehicle={"electricityConsumptionKwhPerKm": round(random.uniform(0.12, 0.19), 3)})]
    else:  # multimodal
        pool = [_trip("car", 5, 18, 1), _trip("metro", 6, 20), _trip("bus", 4, 12),
                _trip("bicycle", 2, 8), _trip("walk", 0.5, 2)]
        trips = random.sample(pool, k=random.randint(2, 3))

    # Occasional rest day (weekend effect)
    if random.random() < 0.12:
        trips = [t for t in trips if t["mode"] in ("walk", "bicycle")] or trips
    return [t for t in trips if t["distanceKm"] > 0]


def generate_user(archetype, days=30, start_day=0):
    """Generate one synthetic user's history as an entry list."""
    entries = []
    for d in range(days):
        trips = _archetype_trips(archetype)
        result = calculate_trips(trips)
        entries.append({
            "trips": trips,
            "date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=start_day + d),
            "transportPersonal": result["transportPersonal"],
        })
    return entries


# ---------------------------------------------------------------------------
# Prediction methods
# ---------------------------------------------------------------------------
def predict_naive_last(train_y):
    return float(train_y[-1]) if len(train_y) > 0 else 5.0


def predict_naive_mean(train_y):
    return float(np.mean(train_y)) if len(train_y) > 0 else 5.0


def predict_naive_weekly(train_y):
    window = train_y[-7:] if len(train_y) >= 7 else train_y
    return float(np.mean(window)) if len(window) > 0 else 5.0


def predict_xgboost(train_X, train_y, test_X):
    if len(train_y) < 3:
        return predict_naive_mean(train_y)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(train_X)
    model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1,
                         random_state=42, n_jobs=-1, verbosity=0)
    model.fit(X_scaled, train_y)
    test_scaled = scaler.transform([test_X])
    return max(0, float(model.predict(test_scaled)[0]))


# ---------------------------------------------------------------------------
# Walk-forward evaluation for one user
# ---------------------------------------------------------------------------
def walk_forward_evaluate(df, targets, min_train=5):
    """Walk-forward validation on one user's data.

    For each day i from min_train to len(data)-1:
      - Train on days 0..i-1, predict day i, compare to actual.
    """
    results = []
    X = df[FEATURE_COLS].values
    y = targets

    for i in range(min_train, len(y)):
        train_X = X[:i]
        train_y = y[:i]
        actual = y[i]

        for method_name, pred_fn in [
            ("naive_last",   lambda: predict_naive_last(train_y)),
            ("naive_mean",   lambda: predict_naive_mean(train_y)),
            ("naive_weekly", lambda: predict_naive_weekly(train_y)),
            ("xgboost",      lambda: predict_xgboost(train_X, train_y, X[i])),
        ]:
            pred = pred_fn()
            results.append({
                "method": method_name,
                "actual": actual,
                "predicted": pred,
                "error": abs(actual - pred),
                "squared_error": (actual - pred) ** 2,
                "ape": abs(actual - pred) / max(actual, 0.1) * 100,
                "train_size": i,
            })
    return results


def print_result(metrics, label=""):
    print(f"  {label:20s}  MAE: {metrics['mae']:6.2f}  RMSE: {metrics['rmse']:6.2f}  MAPE: {metrics['mape']:5.1f}%  "
          f"vs naive_mean: {metrics.get('vs_naive', 0):+5.1f}%")


def evaluate(args):
    print(f"Generating {args.users} SYNTHETIC users (mobility archetypes, ~{args.days} days each)...")
    print()

    all_results = []

    for uid in range(args.users):
        archetype = ARCHETYPES[uid % len(ARCHETYPES)]
        entries = generate_user(archetype, days=args.days, start_day=random.randint(0, 200))
        df = _history_to_df(entries)
        targets = df["target"].values.astype(float)
        results = walk_forward_evaluate(df, targets, min_train=args.min_train)
        all_results.extend(results)

        if (uid + 1) % 100 == 0:
            print(f"  Processed {uid + 1}/{args.users} users...")

    print(f"\nEvaluated {len(all_results)} prediction points across {args.users} users")
    print("=" * 75)

    methods = ["naive_last", "naive_mean", "naive_weekly", "xgboost"]
    method_labels = {
        "naive_last":   "Naive (last val)",
        "naive_mean":   "Naive (mean)",
        "naive_weekly": "Naive (7-day avg)",
        "xgboost":      "XGBoost",
    }

    metrics = {}
    for method in methods:
        errs = [r["error"] for r in all_results if r["method"] == method]
        sq_errs = [r["squared_error"] for r in all_results if r["method"] == method]
        apes = [r["ape"] for r in all_results if r["method"] == method]

        if errs:
            metrics[method] = {
                "mae": round(float(np.mean(errs)), 2),
                "rmse": round(float(np.sqrt(np.mean(sq_errs))), 2),
                "mape": round(float(np.mean(apes)), 1),
                "count": len(errs),
            }

    baseline_mae = metrics.get("naive_mean", {}).get("mae", 1)
    for method in methods:
        m = metrics.get(method, {})
        m["vs_naive"] = round((m.get("mae", 0) - baseline_mae) / max(baseline_mae, 0.01) * 100, 1)
        print_result(m, method_labels.get(method, method))

    print("=" * 75)
    print()

    print("XGBoost error vs training set size:")
    print(f"  {'Train size':>12s}  {'MAE':>8s}  {'RMSE':>8s}  {'MAPE':>8s}  {'vs naive':>10s}")
    print("  " + "-" * 52)

    xgb_results = [r for r in all_results if r["method"] == "xgboost"]
    naive_results_by_size = {}
    for r in all_results:
        if r["method"] == "naive_mean":
            naive_results_by_size.setdefault(r["train_size"], []).append(r["error"])

    for size_bucket in sorted(set(r["train_size"] for r in xgb_results)):
        bucket_errs = [r["error"] for r in xgb_results if r["train_size"] == size_bucket]
        naive_errs = naive_results_by_size.get(size_bucket, [1])
        if bucket_errs:
            mae = float(np.mean(bucket_errs))
            rmse = float(np.sqrt(np.mean([r["squared_error"] for r in xgb_results if r["train_size"] == size_bucket])))
            mape = float(np.mean([r["ape"] for r in xgb_results if r["train_size"] == size_bucket]))
            vs_naive = round((mae - float(np.mean(naive_errs))) / max(float(np.mean(naive_errs)), 0.01) * 100, 1)
            marker = " [BETTER]" if vs_naive < 0 else " [WORSE]"
            print(f"  {size_bucket:>6d} days  {mae:>8.2f}  {rmse:>8.2f}  {mape:>7.1f}%  {vs_naive:>+7.1f}%{marker}")

    print()
    print("Interpretation:")
    print("  [BETTER] = XGBoost beats the simple average for this training size")
    print("  [WORSE]  = stick with simple average for this training size")
    print("  NOTE: synthetic archetype data — treat as sanity check, not real-world accuracy")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate XGBoost vs naive baselines (transport)")
    parser.add_argument("--users", type=int, default=500, help="Number of synthetic users")
    parser.add_argument("--days", type=int, default=60, help="Days of data per user")
    parser.add_argument("--min-train", type=int, default=5, help="Minimum training days before predicting")
    args = parser.parse_args()
    evaluate(args)
