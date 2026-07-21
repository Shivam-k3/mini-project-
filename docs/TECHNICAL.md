# EcoGuardian AI — Technical Documentation

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│   Express   │────▶│   MongoDB   │
│  Frontend   │     │   Backend   │     │   Database  │
│  (Port 5173)│     │  (Port 5000)│     │  (Port 27017)│
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼─────┐
              │ ML Service│ │ Gemini/  │
              │ (Port 8000)│ │ OpenAI   │
              └───────────┘ └──────────┘
```

## MongoDB Schemas

### User
- Authentication (email, password with bcrypt)
- Profile (avatar, location, bio, daily CO₂ goal)
- Gamification (ecoScore, greenPoints, streak, badges, completedChallenges)
- Role (user/admin)

### CarbonEntry
- User reference
- Transport breakdown (bike, bus, metro, car, ev, flight in km)
- Electricity (kWh), Water (liters)
- Food habit, Shopping frequency, Waste generation
- Fuel usage (petrol, diesel, lpg in liters)
- Calculated totalEmissions and category breakdown

### Challenge
- Weekly sustainability challenges with points and badge rewards

### Simulation
- Digital twin simulation history with baseline, changes, and results

## ML Pipeline

### Prediction Model
- **Algorithm:** Gradient Boosting Regressor (Scikit-learn)
- **Features:** transport_total, electricity, water, food_val, shopping_val, waste_val, fuel_total, day_of_week
- **Output:** Next 7-day forecast, weekly total, monthly projection
- **Fallback:** Simple average when insufficient data (<3 entries)

### SHAP Explainability
- Shapley value approximation for emission category attribution
- Percentage contribution per category
- Top factor identification with actionable recommendations

### Digital Twin
- Scenario-based emission recalculation
- Yearly savings projection
- Trees equivalent calculation (~21 kg CO₂/tree/year)
- Impact score (0-100)

## AI Assistant Integration

The AI assistant uses a context-aware prompt including:
- User profile and goals
- Latest emission data and breakdown
- Eco score and streak information
- Top emission source identification

Supports both Gemini 2.0 Flash and OpenAI GPT-4o-mini with intelligent fallback responses when API keys are unavailable.

## Security

- JWT-based authentication with 7-day expiry
- Password hashing with bcrypt (12 rounds)
- Protected routes with role-based access (admin)
- CORS configured for frontend origin
- Input validation with express-validator

## Gamification Logic

- **Eco Score:** 0-100 based on daily emissions vs 20kg benchmark + streak bonus
- **Green Points:** Earned per entry (max(0, 20 - daily_emissions))
- **Streak:** Consecutive daily logging
- **Badges:** 8 achievement badges for milestones
- **Challenges:** Weekly tasks with point rewards
