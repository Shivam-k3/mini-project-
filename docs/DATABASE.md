# EcoGuardian AI — MongoDB Schema Reference

## Collections

### users

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  role: "user" | "admin",
  profile: {
    avatar: String,
    location: String,
    bio: String,
    goal: Number  // daily CO2 goal in kg, default 15
  },
  gamification: {
    ecoScore: Number,      // 0-100
    greenPoints: Number,
    streak: Number,
    lastActiveDate: Date,
    badges: [String],
    completedChallenges: [ObjectId]
  },
  createdAt: Date
}
```

### carbonentries

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: users),
  date: Date,
  transport: {
    bike: Number,    // km
    bus: Number,
    metro: Number,
    car: Number,
    ev: Number,
    flight: Number
  },
  electricity: Number,  // kWh
  water: Number,        // liters
  foodHabit: "vegetarian" | "nonVegetarian" | "vegan",
  shoppingFrequency: "low" | "medium" | "high",
  wasteGeneration: "low" | "medium" | "high",
  fuel: {
    petrol: Number,  // liters
    diesel: Number,
    lpg: Number
  },
  solarPanels: Boolean,
  totalEmissions: Number,  // kg CO2
  breakdown: {
    transport: Number,
    electricity: Number,
    water: Number,
    food: Number,
    shopping: Number,
    waste: Number,
    fuel: Number
  },
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### challenges

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: "transport" | "energy" | "food" | "waste" | "general",
  points: Number,
  targetReduction: Number,  // percentage
  duration: Number,         // days
  badge: String,
  isActive: Boolean,
  weekNumber: Number,
  createdAt: Date
}
```

### simulations

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: users),
  name: String,
  baseline: Object,
  changes: Object,
  results: {
    baselineTotal: Number,
    scenarioTotal: Number,
    reduction: Number,
    reductionPercent: Number
  },
  createdAt: Date
}
```

## Indexes

- `carbonentries`: `{ user: 1, date: -1 }` — for efficient user history queries
- `users`: `{ email: 1 }` — unique index (via schema)
