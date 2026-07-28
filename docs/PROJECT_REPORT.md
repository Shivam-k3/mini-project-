# EcoGuardian AI

## AI-Powered Carbon Footprint Management Platform for Campus Sustainability

### Submitted in partial fulfillment of the requirements for the academic project

---

## 1. Abstract

EcoGuardian AI is a full-stack, multi-tenant carbon footprint management platform designed for college campuses. It enables students to log daily activities (transport, energy, food, waste), calculates CO₂ emissions using standard emission factors, predicts future trends using XGBoost, and motivates behavior change through gamification. The system features explainable AI (SHAP), a digital twin simulator, and role-based access supporting super admin, college admin, faculty, and student roles. The ML model uses a data-aware approach — falling back to simpler statistical methods when insufficient data is available — and achieves 11.8% better accuracy than naive baselines when trained on 30+ days of data.

---

## 2. Introduction

Climate change is the defining challenge of our generation. UN Sustainable Development Goal 13 calls for urgent action to combat climate change and its impacts. However, individual carbon footprints are often invisible — people don't know how their daily choices translate to CO₂ emissions.

EcoGuardian AI bridges this gap by providing:
- **Measurement** — Easy daily logging of lifestyle activities
- **Calculation** — Real-time CO₂ conversion using standard emission factors
- **Prediction** — ML-based forecasting of future emissions
- **Explanation** — SHAP-based transparency showing WHY emissions are high
- **Simulation** — Digital twin for testing "what if" scenarios
- **Motivation** — Gamification to drive sustained behavior change

The platform is built for college campuses, where it can be deployed with a super admin overseeing multiple colleges, each with departments, faculty, and students.

---

## 3. Problem Statement

Individuals lack awareness of their carbon footprint and the impact of their daily choices. Existing carbon calculators are either too simplistic (no predictions), too complex (require expert knowledge), or lack engagement features. There is no integrated platform that combines measurement, ML prediction, explainability, simulation, and gamification in a single system deployable at campus scale.

---

## 4. Objectives

1. Build a multi-tenant web application for college campus carbon tracking
2. Implement accurate CO₂ calculation using standard emission factors
3. Develop an ML model that predicts future emissions and adapts to data availability
4. Provide explainable AI (SHAP) to make predictions transparent
5. Create a digital twin simulator for scenario analysis
6. Implement gamification to drive sustained user engagement
7. Support role-based access (super admin → college admin → faculty → student)
8. Ensure zero-setup deployment with in-memory database fallback

---

## 5. System Architecture

### 5.1 Three-Tier Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React Frontend │────▶│  Express Backend │────▶│    MongoDB       │
│   (Port 5173)    │     │  (Port 5000)     │     │  (Database)      │
│   Tailwind CSS   │     │  JWT Auth        │     │  + In-Memory     │
│   Chart.js       │     │  Role-based ACL  │     │  Fallback        │
└──────────────────┘     └───────┬──────────┘     └──────────────────┘
                                 │
                          ┌──────┴──────┐
                          │  ML Service  │
                          │  (Port 8000) │
                          │  Python/Flask│
                          │  XGBoost     │
                          │  SHAP        │
                          └─────────────┘
```

### 5.2 Role Hierarchy

```
Super Admin
  └── Manages all colleges, global analytics, license control
College Admin
  └── Creates departments, provisions users, campus challenges
Faculty
  └── Department analytics, student participation monitoring
Student
  └── Log emissions, view dashboard, compete on leaderboard
```

### 5.3 Data Flow

```
User Input (transport, food, energy, waste)
  → Backend calculateEmissions()
    → Returns total + breakdown per category
      → Stored in MongoDB (CarbonEntry)
        → Dashboard fetches history
          → Calls ML Service /predict
            → XGBoost trains on history → returns forecast
          → Calls ML Service /explain
            → SHAP analysis → returns feature importance
```

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, Vite, Tailwind CSS | UI framework & styling |
| Visualization | Chart.js, react-chartjs-2 | Emission charts & trends |
| Icons | react-icons (Feather) | UI iconography |
| Backend | Node.js, Express.js | REST API server |
| Authentication | JWT, bcrypt | Secure login & role management |
| Database | MongoDB + Mongoose | Data persistence |
| Database Fallback | mongodb-memory-server | Zero-setup development |
| ML Service | Python, Flask | ML model serving |
| ML Model | XGBoost, scikit-learn | Emission prediction |
| Explainability | SHAP (TreeExplainer) | Model interpretability |
| AI Chat | Google Gemini API | Sustainability assistant |
| PDF Generation | PDFKit | Carbon report download |

---

## 7. Features

### 7.1 Carbon Calculator

Users log daily activities across 7 categories:

| Category | Input Type | Unit | Example Values |
|---|---|---|---|
| Transport | Per-mode distance | km/day | Car: 10 km, Bus: 5 km |
| Electricity | Daily consumption | kWh | 8 kWh/day |
| Water | Daily consumption | liters | 100 L/day |
| Food | Diet type | — | Vegetarian / Non-Veg / Vegan |
| Shopping | Frequency | — | Low / Medium / High |
| Waste | Generation level | — | Low / Medium / High |
| Fuel | Per-type consumption | liters | Petrol: 2 L |

### 7.2 CO₂ Calculation (Emission Factors)

CO₂ = activity × emission factor:

```
Car:       10 km  × 0.21 kg/km  = 2.10 kg CO₂
Bus:        5 km  × 0.089 kg/km = 0.45 kg CO₂
Electricity: 8 kWh × 0.475 kg/kWh = 3.80 kg CO₂
Food: Non-veg = 7.20 kg CO₂/day
Total: 2.10 + 0.45 + 3.80 + 7.20 = 13.55 kg CO₂
```

### 7.3 Dashboard

Role-based dashboard showing:
- Daily / Weekly / Monthly total emissions
- Category-wise breakdown (pie chart)
- Historical trend (line chart, last 30 days)
- ML prediction (next 7 days + next month)
- SHAP explanation (top emission factors)
- Eco Score, Green Points, Streak

### 7.4 ML Prediction Model

**Features (8 dimensions):**
`transport_total, electricity, water, food_val, shopping_val, waste_val, fuel_total, day_of_week`

**Data-Aware Approach:**

| Data Available | Method | Rationale |
|---|---|---|
| < 10 entries | Rolling 7-day average | Avoids overfitting |
| 10–30 entries | XGBoost + trend | ML starts learning patterns |
| 30+ entries | XGBoost (full) | Reliable predictions |

**Model Persistence:** Each user/department/college gets its own model file (`carbon_model_<scope>_<id>.pkl`), preventing collisions in multi-tenant deployment.

### 7.5 SHAP Explainable AI

Uses SHAP TreeExplainer on the trained XGBoost model to show:
- **Feature importance**: Which input features most influence predictions
- **Contribution analysis**: What % of total emissions comes from each category
- **Recommendations**: Actionable tips for the top contributor

### 7.6 Digital Twin Simulator

Users can simulate lifestyle changes and see instant impact:

```
Baseline: Car 20 km/day, 10 kWh electricity, Non-veg diet = 19.15 kg CO₂
Scenario: Car 5 km/day, -30% electricity, Vegetarian diet = 9.88 kg CO₂
───────────────────────────────────────────────────────────────
Reduction: 9.27 kg/day (48.4%)
Yearly Savings: 3,383 kg CO₂
Trees Equivalent: 161 trees/year
Impact Score: 73/100
```

6 preset scenarios + fully customizable sliders.

### 7.7 Gamification

| Feature | Formula | Example |
|---|---|---|
| Eco Score | max(0, min(100, (1 - emissions/20) × 100 + streak_bonus)) | 15 kg/day → 78/100 |
| Green Points | max(0, 20 - daily_emissions) per entry | 15 kg → +5 points |
| Streak | Consecutive days logged | 7 days → +14 bonus |
| Badges | 8 milestones | "First Entry", "Eco Warrior" |
| Challenges | Weekly admin-created tasks | "Reduce 10% this week" |
| Leaderboard | Rank by Green Points | Per-department ranking |

### 7.8 AI Assistant

Context-aware sustainability chatbot powered by Google Gemini API:
- Knows the user's latest emissions, eco score, streak
- Provides personalized reduction tips
- Explains SHAP insights in natural language
- Falls back to local responses when API key is unavailable

### 7.9 PDF Reports

Generates downloadable carbon audit reports with:
- Emission summary (daily/weekly/monthly)
- Category breakdown charts
- ML predictions
- SHAP insights
- Personalized recommendations

---

## 8. ML Model Evaluation

### 8.1 Methodology: Walk-Forward Validation

Instead of standard train/test split (which leaks future information for time series), we use walk-forward validation:

```
Day 1-5 → predict Day 6 → compare
Day 1-6 → predict Day 7 → compare
Day 1-7 → predict Day 8 → compare
... (slide forward)
```

This simulates real-world usage where the model predicts the *next* day.

### 8.2 Results (50 synthetic users × 60 days)

| Method | MAE (kg CO₂) | vs Naive Mean |
|---|---|---|
| Naive (last value) | 7.63 | +23.5% (worst) |
| **Naive (mean)** | **6.18** | **baseline** |
| Naive (7-day avg) | 5.82 | -5.8% (better) |
| **XGBoost** | **5.45** | **-11.8% (best)** |

### 8.3 XGBoost Performance by Training Size

| Training Days | vs Naive Mean | Verdict |
|---|---|---|
| 5–9 | +5% to +45% | WORSE (overfits) |
| 10–14 | -0% to -8% | NEUTRAL (same as naive) |
| 15–29 | -8% to -25% | BETTER (starts learning) |
| 30+ | -10% to -31% | BEST (consistently wins) |

**Key Insight:** XGBoost only becomes beneficial once 15+ days of data are available. Below that, simple averages are more reliable. The system automatically selects the best method based on data quantity.

---

## 9. Database Schema

### User
```
{
  _id, name, email, password (bcrypt), role, collegeId, departmentId,
  userId (auto-generated), semester, section, firstLogin, status,
  gamification: { ecoScore, greenPoints, streak, badges, completedChallenges },
  profile: { avatar, goal, location, bio }
}
```

### CarbonEntry
```
{
  _id, user (ref), date,
  transport: { bike, bus, metro, car, ev, flight },
  electricity, water, foodHabit, shoppingFrequency, wasteGeneration,
  fuel: { petrol, diesel, lpg },
  solarPanels, totalEmissions, breakdown: { transport, electricity, ... }
}
```

### College / Department
```
College: { _id, name, code, address, license: { plan, expiry, status } }
Department: { _id, collegeId, name, code }
```

---

## 10. Project Structure

```
├── backend/                  # Node.js Express API
│   ├── config/db.js          # MongoDB + in-memory fallback
│   ├── models/               # Mongoose schemas (7 models)
│   ├── routes/               # API routes (10 route files)
│   ├── middleware/auth.js    # JWT protection
│   ├── utils/                # Emission factors, AI, ML client
│   └── scripts/              # Database seeding
├── frontend/                 # React + Tailwind CSS
│   └── src/
│       ├── components/       # Layout, Charts, StatCard, ProtectedRoute
│       ├── context/          # AuthContext, ThemeContext
│       ├── pages/            # 13 pages (Dashboard, Calculator, etc.)
│       └── services/api.js   # Axios API client
├── ml-service/               # Python Flask ML microservice
│   ├── app.py                # Flask API (6 endpoints)
│   ├── predictor.py          # XGBoost model (scoped persistence)
│   ├── shap_explainer.py     # SHAP explainability
│   ├── emission_utils.py     # CO₂ calculation factors
│   ├── train.py              # Batch training script
│   └── evaluate.py           # Walk-forward validation
└── docs/                     # Documentation
```

---

## 11. Setup & Deployment

### Local Development (3 terminals)

```bash
# Terminal 1: ML Service
cd ml-service
venv\Scripts\activate
python app.py                    # Port 8000

# Terminal 2: Backend
cd backend
npm run dev                      # Port 5000

# Terminal 3: Frontend
cd frontend
npm run dev                      # Port 5173
```

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | super@ecoguardian.ai | admin123 |
| College Admin | admin@ecoguardian.ai | admin123 |
| Faculty | sarah@mit.edu | Temp@123 |
| Student | demo@ecoguardian.ai | demo123 |

### Pre-training (optional)

```bash
cd ml-service
python train.py --samples 1000  # Pre-train a global model
```

---

## 12. Conclusion

EcoGuardian AI successfully demonstrates an integrated platform for campus-scale carbon footprint management. The key contributions are:

1. **Multi-tenant architecture** supporting the full college hierarchy
2. **Data-aware ML** that adapts its approach based on data availability
3. **Transparent AI** via SHAP explainability
4. **Digital twin simulation** for scenario analysis
5. **Gamification** driving sustained engagement
6. **Zero-setup deployment** with in-memory database fallback

The ML model achieves 11.8% better accuracy than simple averaging methods when sufficient data is available, with walk-forward validation confirming that XGBoost consistently outperforms baselines after 15+ training days.

### 12.1 Future Work

- **Cross-college federated learning** — Train global models without sharing raw data
- **Mobile app** — React Native for native logging experience
- **IoT integration** — Smart meter and GPS auto-logging
- **Team-based challenges** — Department vs department competitions
- **Carbon offset marketplace** — Link to verified offset programs

---

## 13. References

1. UN Sustainable Development Goal 13: Climate Action — https://sdgs.un.org/goals/goal13
2. IPCC Emission Factor Database — https://www.ipcc-nggip.iges.or.jp/
3. SHAP: A Unified Approach to Interpreting Model Predictions — Lundberg & Lee, 2017
4. XGBoost: A Scalable Tree Boosting System — Chen & Guestrin, 2016
5. Mongodb-memory-server — https://github.com/nodkz/mongodb-memory-server
