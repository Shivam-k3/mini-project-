# EcoGuardian AI — Project Explanation for Faculty

---

## 1. What is EcoGuardian AI?

A **full-stack carbon footprint management platform** designed for college campuses.  
Students log daily activities → system calculates CO₂ emissions → ML predicts future trends → Gamification drives reduction.

**Core idea:** *"What gets measured gets managed."* We make carbon tracking as easy as logging your meals.

---

## 2. Architecture (3-tier)

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
                          │  XGBoost     │
                          │  SHAP        │
                          └─────────────┘
```

### Why 3 services?
- **Frontend** — React + Vite (fast dev, component-based)
- **Backend** — Express.js with role-based routes
- **ML Service** — Python Flask (separate because ML libraries are Python-native)

---

## 3. Role Hierarchy (College-Ready)

```
Super Admin
  └── Manages all colleges (CRUD, license, global announcements)
  └── College-level analytics comparison

College Admin
  └── Creates departments (CSE, ECE, ME, etc.)
  └── Provisions faculty & student accounts
  └── CSV bulk import of students
  └── Campus-wide analytics & challenges

Faculty
  └── Department-level analytics (aggregate of their students)
  └── Student participation monitoring (who logged this week?)
  └── Department-scoped challenges

Student
  └── Log daily carbon entries (transport, food, electricity, etc.)
  └── Personal dashboard with predictions & insights
  └── Gamification (streaks, eco score, badges, leaderboard)
```

---

## 4. Carbon Calculation Logic

For each entry, we calculate emissions using standard emission factors:

```python
transport: car(km)×0.21 + bus(km)×0.089 + flight(km)×0.255  (kg CO₂)
electricity: kWh × 0.475
food: vegetarian→2.5, non-veg→7.2, vegan→1.5 (kg CO₂/day)
shopping: low→0.5, medium→2.0, high→5.0
waste: low→0.3, medium→1.0, high→2.5
fuel: petrol(L)×2.31 + diesel(L)×2.68
```

**Total = sum of all categories** (typically 10–30 kg CO₂/day per person)

---

## 5. ML Model — What It Does & How We Evaluate It

### What it predicts
- **Next 7 days** of daily emissions
- **Next month** projection
- **Confidence score** (based on data quantity)

### Three-tier prediction (data-aware)

| Data available | Method Used | Accuracy |
|---|---|---|
| < 10 entries | Rolling 7-day average | Best for small data |
| 10–30 entries | XGBoost + trend adjustment | ~10% better than average |
| 30+ entries | XGBoost (full training) | ~15–30% better than average |

### How we measure efficiency

We use **walk-forward validation** (simulating real predictions):

```
Training data (days 1..N) → Predict day N+1 → Slide forward → Compare
```

Results across 50 simulated users, 60 days each:

| Method | MAE (kg CO₂) | Improvement |
|---|---|---|
| Simple average (baseline) | 6.18 | — |
| 7-day rolling average | 5.82 | +5.8% |
| **XGBoost** | **5.45** | **+11.8%** |

The ML model improves as more data accumulates — it learns user-specific patterns (e.g., "this user always drives more on weekends").

### SHAP Explainability

We use **SHAP (SHapley Additive exPlanations)** to show *why* a prediction was made:

```
Your predicted emissions: 18.5 kg CO₂
  → transport contributed 43% of this prediction
  → electricity contributed 22%
  → food contributed 18%
```

This makes the AI transparent — no black box.

---

## 6. Digital Twin Simulator

Users can simulate *"what if"* scenarios:

> "What if I switch from car to bus 3 days a week AND install solar panels?"

The system recalculates emissions in real-time and shows:
- Daily reduction (kg CO₂)
- Yearly savings
- Trees equivalent (1 tree absorbs ~21 kg CO₂/year)
- Impact score (0–100)

---

## 7. Gamification

To keep students engaged:

| Feature | How it works |
|---|---|
| **Eco Score** | 0–100, based on daily emissions vs 20 kg benchmark |
| **Green Points** | Earned per entry: max(0, 20 - daily_emissions) |
| **Streak** | Consecutive days logged |
| **Badges** | 8 milestones (first entry, 7-day streak, etc.) |
| **Challenges** | Weekly tasks created by admin/faculty |

**Leaderboard** shows top students per department — friendly competition drives participation.

---

## 8. Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Chart.js, react-icons |
| Backend | Node.js, Express, JWT, mongoose |
| Database | MongoDB (with in-memory fallback — zero setup) |
| ML | Python, Flask, XGBoost, scikit-learn, SHAP |
| AI Chat | Google Gemini API (with offline fallback) |
| Auth | bcrypt, JWT (7-day expiry) |

---

## 9. What Makes This Project Stand Out

1. **Zero-setup demo** — In-memory MongoDB fallback, auto-seed, works on any machine
2. **Explainable AI** — SHAP values tell users WHY, not just WHAT
3. **Multi-tenant** — Works for entire colleges with role-based access
4. **Data-aware ML** — Knows when NOT to use ML (falls back to simpler methods)
5. **SDG 13 alignment** — Directly contributes to UN Climate Action goal
6. **Digital Twin** — Lets users explore "what if" scenarios before making lifestyle changes

---

## 10. Demo Walkthrough (5 minutes)

1. Open frontend → Login page with **demo accounts**
2. Login as **student** → Dashboard shows daily/weekly/monthly emissions
3. Open **Carbon Calculator** → Fill transport/food/energy → Submit
4. View **Explainable AI** → See SHAP breakdown with recommendations
5. Open **Digital Twin** → Toggle car→bus, see savings in real-time
6. Open **Gamification** → See eco score, badges, challenge
7. Login as **College Admin** → View campus analytics, student participation

---

## 11. Running the Project

```bash
# Terminal 1 — ML Service
cd ml-service
.\venv\Scripts\Activate.ps1
python app.py

# Terminal 2 — Backend
cd backend
npm run dev

# Terminal 3 — Frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173**

### Demo login credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | super@ecoguardian.ai | admin123 |
| College Admin | admin@ecoguardian.ai | admin123 |
| Faculty | sarah@mit.edu | Temp@123 |
| Student | demo@ecoguardian.ai | demo123 |
