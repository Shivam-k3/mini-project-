# EcoGuardian AI — Technical Verification Report

> Applies to **v3.0.0** — the transportation-only, explainable-AI sustainable
> mobility platform. This report documents the verified architecture, the factor
> API, provenance model, ML/SHAP pipeline, and the test results that back the
> listed readiness claims. All figures below were produced by the repository's
> own test suites (not assumed).

---

## 1. System Architecture

```
┌─────────────┐       ┌─────────────┐      ┌─────────────┐      ┌───────────┐
│   React     │   JWT │   Express   │ Mongoose│  MongoDB    │      │           │
│  (5173)     │──────▶│  Backend    │──────▶│  (27017)    │      │           │
└─────────────┘       │  (5000)     │      └─────────────┘      │           │
        │             └──────┬──────┘                           │  ML svc   │
        │  /api/factors/*    │  /routes/factors.js              │  (8000)   │
        │  (client requests) │  /api/carbon, /api/twin,         │ predictor │
        │  which factor      │  /api/simulator, /api/ai,        │ SHAP      │
        │  applies           │  /api/reports, /api/gamification │           │
        └───────────────────┴───────────────────────────────────┴───────────┘
```

- **Frontend** (Vite/React 18, port 5173): thin client. It holds *no* emission
  factor table; it asks `/api/factors/resolve` which factor applies and renders
  only what the server returns.
- **Backend** (Express, port 5000): single source of truth for factors and trip
  calculation; ownership/tenant isolation; RBAC; trips persistence.
- **ML service** (Python/Flask, port 8000): adaptive 3-tier prediction + SHAP,
  scoped model files; consumes trip records (never re-derived from a client).

Verified: backend unit suite 33/33; frontend production build succeeds; all
routes mount cleanly (`server.js` `app.use` table below).

| Mount | Router | Guard |
|---|---|---|
| `/api/auth` | routes/auth.js | loginLimiter |
| `/api/carbon` | routes/carbon.js | protect + submissionLimiter |
| `/api/twin` | routes/twin.js | — |
| `/api/factors` | routes/factors.js | protect |
| `/api/simulator` | routes/simulator.js | protect + simulationLimiter |
| `/api/ai` | routes/ai.js | protect + aiLimiter |
| `/api/gamification` | routes/gamification.js | — |
| `/api/reports` | routes/reports.js | protect + reportLimiter |
| `/api/superadmin`, `/api/collegeadmin`, `/api/faculty` | admin routers | — |

---

## 2. Emission-Factor Model (source of truth)

The canonical dataset is **`config/emission-factors.json` v3.0.0**. Both
`backend/utils/factorResolver.js` (JS) and `ml-service/emission_utils.py`
(Python) load this same file, keeping JS and Python in parity.

Hierarchical resolution priority (spec §7):

1. **vehicle-specific** — user-declared certified `CO₂ g/km` (highest integrity).
2. **EV branch** (spec §10) — `kWh/km × grid kgCO₂/kWh`, never fuel efficiency.
3. **category** — `vehicle_category + fuel_type` catalog row.
4. **efficiency-derived** — `fuel combustion kg/L ÷ declared km/L`.
5. **generic-mode** — mode-level default factor.

Every resolved factor carries provenance: `factorKgPerKm`, `level`,
`source { name, url, year, region, confidence }`, and a human `methodology`
string.

### 2.1 Constants exposed by the resolver

Exported and used consistently across JS and Python (from dataset):

| Constant | Value | Source |
|---|---|---|
| `GRID_KG_PER_KWH` | 0.716 (CEA v19 / 2023) | config grid_electricity |
| `FUEL_KG_PER_LITER.petrol` | 2.31 | DEFRA 2024 |
| `FUEL_KG_PER_LITER.diesel` | 2.68 | DEFRA 2024 |
| `FUEL_KG_PER_LITER.lpg` | 1.51 | DEFRA 2024 |
| `EV_DEFAULT_KWH_PER_KM` | 0.15 | config ev_default |

---

## 3. Factor API

Router: `backend/routes/factors.js`, mounted at `/api/factors`, `protect`-guarded.
Read-only by design — clients can *request* a resolution but never *define* a
factor; curation stays with the seeder / super-admin.

### 3.1 `GET /api/factors/resolve`

Query params: `mode` (required), `manufacturer`, `model`, `variant`,
`vehicleCategory`/`category`, `fuelType`, `fuelEfficiencyKmPerL`,
`energyConsumptionKwhPerKm`, `declaredCo2GPerKm`.

Response envelope (verified via `factorApi.test.js`):

```json
{
  "mode": "car",
  "factorKgPerKm": 0.145,
  "factorLevel": "category",
  "factorLevelLabel": "Category-level",
  "factorSource": "",
  "sourceUrl": "",
  "sourceYear": null,
  "methodology": "0.145 kgCO²/km taken directly from the hatchback/petrol category factor",
  "region": "IN",
  "confidence": "low",
  "occupancySplit": true,
  "perPassenger": false,
  "datasetVersion": "3.0.0"
}
```

Error contract: unknown/missing mode or non-positive numeric input →
`FactorRequestError` → HTTP 400 with a message (via `FactorRequestError.status`).

### 3.2 `GET /api/factors/modes`

Returns `datasetVersion`, and for each of `KNOWN_MODES` the labels
`occupancySplit` and `perPassenger` — lets the UI build selectors from the
dataset rather than a hardcoded list.

**Factor API status: complete and tested.** `backend/tests/factorApi.test.js`
adds 15 cases covering: envelope shape, provenance passthrough for generic
mode-level factors, category resolution, declared-CO₂ priority + confidence,
efficiency derivation, EV grid maths, zero-emission modes, validation errors
(missing mode, unknown mode, non-positive numbers), known-modes coverage,
occupancy-split set, per-passenger flag, `describeLevel`, and dataset-coherence.

---

## 4. Provenance Model

- **Calculator**: `FactorBadge` renders server-returned provenance (value, level
  label, method, source, year) per trip and per the live preview.
- **Carbon persistence**: each stored trip sub-document keeps
  `factorLevel`, `factorSource`, `factorSourceUrl`, `factorSourceYear`,
  `factorKgPerKm`, plus `personalAllocatedEmission` / `householdAllocatedEmission`.
- **Simulator**: `/api/simulator/simulate` returns `tripDetails` for both
  baseline and scenario; each trip row carries the same provenance fields.
- **AI assistant**: recommendations are written from the user's own
  mode-breakdown, and the assistant is hard-gated to the mobility domain.

### 4.1 Known provenance gap

For **category-level** resolutions (`staticCategory`) the `vehicle_categories`
rows in the dataset do not yet carry `source`/`source_url`/`source_year`, so the
factor API returns `factorSource` empty for those. The factor level,
`methodology`, and `confidence` are still provided. This is a data-completeness
item, **not** a calculation defect; no external citation is attached to the
category rows to avoid fabricating references. Flagged for the data curators.

---

## 5. Trip Engine & Occupancy Allocation

`backend/utils/tripEngine.js` → `calculateTrips(trips)` is the active path; its
Python mirror is `ml-service/emission_utils.py` → `calculate_trips`.

Shape returned (flat, no `.breakdown`/`.total` wrapper):

```js
{
  transportPersonal,      // occupancy-allocated personal share
  transportHousehold,     // raw total
  modeBreakdown,          // per-mode personal kg
  householdModeBreakdown,
  tripDetails: [{ mode, distanceKm, occupants, tripFrequency, purpose,
                  factorKgPerKm, factorLevel, factorSource,
                  factorSourceUrl, factorSourceYear,
                  tripTotalEmission, personalAllocatedEmission, vehicle }]
}
```

Occupancy split applies only to `car`, `motorcycle`, `auto_rickshaw`, `ev`;
`bus`/`metro`/`flight` factors are already per-passenger; `walk`/`bicycle` are 0.

---

## 6. ML Prediction (adaptive 3-tier)

`ml-service/predictor.py` v3.0.0 — transport-only features:

```
[car_km, ev_km, motorcycle_km, auto_rickshaw_km, bus_km, metro_km,
 flight_km, active_km, occupants, day_of_week]
```

Tiering (data-aware, honest method label on every response):

| Tier | Condition | Method |
|---|---|---|
| 1 | < 10 samples | `rolling_average` |
| 2 | 10–29 | `hybrid` (blend weight 0 → 0.5) |
| 3 | ≥ 30 | `xgboost` |

- Scoped persistence: user / department / college model files with a
  `feature_schema` guard that rejects stale/legacy lifestyle models (never
  silently reused).
- Training (`train.py`) uses commuter archetypes whose targets come from
  `calculate_trips`, meta marked `synthetic: true`.
- Evaluation (`evaluate.py`) is walk-forward vs naive baselines, with an honest
  synthetic-data disclaimer.

---

## 7. SHAP Explainability

`ml-service/shap_explainer.py`:

- `TreeExplainer` runs **only** on real v3 XGBoost models (gated by
  `feature_schema` in model meta); otherwise falls back to `shap_approximation`.
- Returns per-mode contributions, `topFactors`, and transport-only
  recommendations. Single `FEATURE_COLS`/`MODEL_VERSION` source imported from
  `predictor.py`.

---

## 8. Verified Test Results

| Suite | Command | Result |
|---|---|---|
| Backend unit tests incl. factor API | `npm test` (backend/) | **33 pass / 0 fail** |
| JS/Python trip parity | `node scripts/trip_parity_test.js` + `scripts/trip_parity_check.py` | **86 pass / 0 fail** |
| ML compile | `python -m py_compile predictor.py shap_explainer.py train.py evaluate.py app.py emission_utils.py` | OK |
| Frontend production build | `npm run build` (frontend/) | success |

Backend test files:

- `backend/tests/emission.test.js` — 18 cases (factorResolver priority,
  engine aggregation, occupancy split, provenance passthrough).
- `backend/tests/factorApi.test.js` — 15 cases (factor API contract).

---

## 9. CI Status

GitHub Actions `.github/workflows/ci.yml` (3 jobs):

| Job | Steps | Node/Python |
|---|---|---|
| `backend` | checkout → setup-node → `npm ci` → `npm test` | Node 20 |
| `ml-service` | checkout → setup-python → `pip install -r requirements.txt` → `py_compile` → install backend deps → `node ../scripts/trip_parity_test.js` (PYTHON=python) | Python 3.11, Node 20 |
| `frontend` | checkout → setup-node → `npm ci` → `npm run build` | Node 20 |

Compatibility notes (verified):

- `backend/package-lock.json` is `lockfileVersion: 3` — readable by the npm 10
  bundled with Node 20.
- `ml-service` has no Python-version pin; CI uses 3.11 and requirements install
  cleanly there. Locally it runs on 3.13.2.
- The trip-parity test spawns Python via `process.env.PYTHON` (`PYTHON: python`
  on CI). `setup-python` puts `python` on PATH in GitHub-hosted runners, so this
  resolves there; locally `emission_utils.py` runs under the project venv.
- Node 20's `node:test` fully supports the async `test()` style used in both
  backend test files.

---

## 10. Remaining Issues / Readiness

Readiness: **fit for release / verification complete.**

Minor, non-blocking items:

1. **Category-factor provenance** — `vehicle_categories` rows lack
   `source`/`source_url`/`source_year`; category-level factor API responses show
   empty `factorSource` (see §4.1). No fabricated citation added.
2. **Legacy mirrored constants** — `ml-service/emission_utils.py` retains the
   legacy `EMISSION_FACTORS` dict and `calculate_emissions()` purely for the
   archival 7-category parity script. Not on the active transport path; retained
   deliberately. The one active-path hardcoded fallback (`0.21`) was removed and
   now reads from the shared dataset (parity unchanged: 86/86).
3. **Prose factors in AI prompt** — `backend/utils/aiService.js` uses
   approximate figures (`~0.041`, `~0.21 kg/km`) in the human-facing mobility
   advice string. These are illustrative text, not calculation logic.

These do not affect the transportation-only active pipeline, the factor API, or
test correctness.
