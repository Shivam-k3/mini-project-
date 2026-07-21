# EcoGuardian AI

**AI-Powered Personal Carbon Footprint Management Platform for UN SDG 13: Climate Action**

EcoGuardian AI is a full-stack intelligent platform that helps users calculate, monitor, predict, and reduce their carbon emissions through Explainable AI, personalized recommendations, Digital Twin simulation, and gamification.

![Tech Stack](https://img.shields.io/badge/React-18-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![MongoDB](https://img.shields.io/badge/MongoDB-Database-green) ![Python](https://img.shields.io/badge/Python-ML-yellow) ![SDG](https://img.shields.io/badge/SDG-13_Climate_Action-blue)

## Features

| Feature | Description |
|---------|-------------|
| **Carbon Calculator** | Track transport, electricity, water, food, shopping, waste, and fuel emissions |
| **Dashboard** | Daily/weekly/monthly stats with pie charts, line charts, and category breakdown |
| **Explainable AI (SHAP)** | Understand why emissions are high with feature contribution analysis |
| **AI Assistant** | Gemini/OpenAI-powered sustainability chatbot with personalized advice |
| **ML Predictions** | XGBoost/Gradient Boosting model predicts next week's and month's emissions |
| **Digital Twin Simulator** | Test lifestyle scenarios (metro vs car, solar panels, vegetarian diet) |
| **Gamification** | Eco Score, Green Points, badges, streaks, weekly challenges, leaderboard |
| **PDF Reports** | Downloadable carbon footprint reports with AI recommendations |
| **Admin Panel** | User management, community analytics, data export |

## Tech Stack

- **Frontend:** React.js, Tailwind CSS, Chart.js, Vite
- **Backend:** Node.js, Express.js, JWT Authentication
- **Database:** MongoDB with Mongoose
- **ML Service:** Python, Flask, Scikit-learn, XGBoost, SHAP
- **AI:** Google Gemini API / OpenAI API

## Project Structure

```
ecoguardian-ai/
├── backend/           # Node.js Express API
│   ├── config/        # Database configuration
│   ├── models/        # MongoDB schemas
│   ├── routes/        # API routes
│   ├── middleware/     # Auth middleware
│   ├── utils/         # Emission factors, AI, PDF, ML client
│   └── scripts/       # Database seed script
├── frontend/          # React + Tailwind UI
│   └── src/
│       ├── components/  # Layout, Charts, StatCard
│       ├── context/     # Auth & Theme providers
│       ├── pages/       # All application pages
│       └── services/    # API client
├── ml-service/        # Python ML microservice
│   ├── app.py           # Flask API
│   ├── predictor.py     # Emission prediction model
│   └── shap_explainer.py # Explainable AI
└── docs/              # Documentation
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** 6+ (local or Atlas)
- **Gemini API Key** or **OpenAI API Key** (optional, fallback responses available)

## Quick Start

### 1. Clone and Setup

```bash
cd "sem 3 mini"
```

### 2. Start MongoDB

Ensure MongoDB is running locally on `mongodb://localhost:27017` or update the connection string.

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed        # Creates admin & demo users + challenges
npm run dev         # Starts on http://localhost:5000
```

### 4. ML Service Setup

```bash
cd ml-service
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py       # Starts on http://localhost:8000
```

### 5. Frontend Setup

```bash
cd frontend
npm install
npm run dev         # Starts on http://localhost:5173
```

### 6. Open the App

Visit **http://localhost:5173** and login with:

| Role | Email | Password |
|------|-------|----------|
| Demo User | demo@ecoguardian.ai | demo123 |
| Admin | admin@ecoguardian.ai | admin123 |

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ecoguardian
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
ML_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
AI_PROVIDER=gemini
FRONTEND_URL=http://localhost:5173
```

### ML Service (`ml-service/.env`)

```env
PORT=8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/carbon` | Log carbon entry |
| GET | `/api/carbon/dashboard` | Dashboard data + SHAP + predictions |
| POST | `/api/simulator/simulate` | Run digital twin simulation |
| POST | `/api/ai/chat` | AI sustainability assistant |
| GET | `/api/gamification/stats` | Eco score, points, badges |
| GET | `/api/reports/pdf` | Download PDF report |
| GET | `/api/admin/analytics` | Admin community analytics |

## Emission Factors

Standard CO₂ emission factors used (kg CO₂ per unit):

| Category | Factor |
|----------|--------|
| Car | 0.21 kg/km |
| Bus | 0.089 kg/km |
| Metro | 0.041 kg/km |
| EV | 0.05 kg/km |
| Flight | 0.255 kg/km |
| Electricity | 0.475 kg/kWh |
| Non-Veg Food | 7.2 kg/day |
| Vegetarian | 2.5 kg/day |
| Vegan | 1.5 kg/day |

## Research Novelty

Unlike existing carbon footprint calculators, EcoGuardian AI combines:

1. **Carbon Footprint Calculation** with standard emission factors
2. **Explainable AI (SHAP)** for transparent emission attribution
3. **Machine Learning Prediction** for forecasting future emissions
4. **Digital Twin Simulation** for testing lifestyle changes
5. **AI Sustainability Assistant** with personalized recommendations
6. **Gamification** for behavioral change motivation

All integrated into a single intelligent platform supporting **UN SDG 13: Climate Action**.

## Deployment

### Production Build

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm start

# ML Service
cd ml-service && gunicorn app:app -b 0.0.0.0:8000
```

### Recommended Hosting

- **Frontend:** Vercel, Netlify
- **Backend:** Railway, Render, AWS EC2
- **ML Service:** Railway, Google Cloud Run
- **Database:** MongoDB Atlas

## License

MIT License — Built for SDG 13 Climate Action education and research.
