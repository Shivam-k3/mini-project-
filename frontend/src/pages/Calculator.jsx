import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carbonAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiArrowRight, FiCheckCircle } from 'react-icons/fi';

const defaultForm = {
  transport: { bike: 0, bus: 0, metro: 0, car: 0, ev: 0, flight: 0, carOccupants: 1 },
  electricity: 10,
  water: 150,
  foodHabit: 'nonVegetarian',
  shoppingFrequency: 'medium',
  wasteGeneration: 'medium',
  fuel: { petrol: 0, diesel: 0, lpg: 0 },
  solarPanels: false,
  notes: '',
};

// Local factors for live preview (kg CO2 per unit)
const FACTORS = {
  transport: { bike: 0, bus: 0.089, metro: 0.041, car: 0.21, ev: 0.05, flight: 0.255 },
  electricity: 0.475,
  water: 0.0003,
  food: { vegetarian: 2.5, nonVegetarian: 7.2, vegan: 1.5 },
  shopping: { low: 0.5, medium: 2.0, high: 5.0 },
  waste: { low: 0.3, medium: 1.0, high: 2.5 },
  fuel: { petrol: 2.31, diesel: 2.68, lpg: 1.51 }
};

export default function Calculator() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const updateTransport = (mode, value) => {
    if (mode === 'carOccupants') {
      const raw = Math.round(Number(value));
      const occupants = Math.max(1, Math.min(8, Number.isFinite(raw) ? raw : 1));
      setForm({ ...form, transport: { ...form.transport, carOccupants: occupants } });
      return;
    }
    setForm({ ...form, transport: { ...form.transport, [mode]: Math.max(0, Number(value)) } });
  };

  const updateFuel = (type, value) => {
    setForm({ ...form, fuel: { ...form.fuel, [type]: Math.max(0, Number(value)) } });
  };

  // Live footprint calculation for preview panel
  const calculateLiveEmissions = () => {
    const occupants = form.transport.carOccupants || 1;
    let transportVal = 0;
    let householdTransport = 0;
    Object.entries(form.transport).forEach(([m, v]) => {
      const factor = FACTORS.transport[m] || 0;
      if (!factor) return; // skips carOccupants metadata key
      householdTransport += v * factor;
      transportVal += (m === 'car' || m === 'ev') ? (v * factor) / occupants : v * factor;
    });

    let elecVal = form.electricity * FACTORS.electricity;
    if (form.solarPanels) elecVal *= 0.15; // 85% solar offset

    const waterVal = form.water * FACTORS.water;
    const foodVal = FACTORS.food[form.foodHabit] || 7.2;
    const shopVal = FACTORS.shopping[form.shoppingFrequency] || 2.0;
    const wasteVal = FACTORS.waste[form.wasteGeneration] || 1.0;

    let fuelVal = 0;
    Object.entries(form.fuel).forEach(([t, v]) => {
      fuelVal += v * (FACTORS.fuel[t] || 0);
    });

    const total = transportVal + elecVal + waterVal + foodVal + shopVal + wasteVal + fuelVal;
    return {
      total: Math.round(total * 100) / 100,
      breakdown: {
        transport: Math.round(transportVal * 100) / 100,
        electricity: Math.round(elecVal * 100) / 100,
        water: Math.round(waterVal * 100) / 100,
        food: Math.round(foodVal * 100) / 100,
        shopping: Math.round(shopVal * 100) / 100,
        waste: Math.round(wasteVal * 100) / 100,
        fuel: Math.round(fuelVal * 100) / 100,
      },
      householdTransport: Math.round(householdTransport * 100) / 100,
      occupants,
    };
  };

  const liveStats = calculateLiveEmissions();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const { data } = await carbonAPI.create(form);
      setResult(data);
      toast.success(`Successfully Logged ${data.totalEmissions} kg CO₂!`);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log entry');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Transportation' },
    { num: 2, label: 'Energy & Water' },
    { num: 3, label: 'Lifestyle & Fuel' },
    { num: 4, label: 'Preview & Save' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Carbon Calculator</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Log your daily activities to track and budget emissions</p>
      </div>

      {/* Progress Tracker */}
      <div className="glass p-4 rounded-2xl flex items-center justify-between border border-gray-200/50 dark:border-white/5">
        {stepsList.map((s, index) => (
          <div key={s.num} className="flex items-center gap-2 flex-1 last:flex-initial">
            <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
              step === s.num ? 'bg-eco-500 text-white ring-4 ring-eco-500/20' :
              step > s.num ? 'bg-eco-500/10 text-eco-600 dark:text-eco-400' : 'bg-gray-150 dark:bg-gray-800/40 text-gray-400'
            }`}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span className={`text-xs font-bold hidden sm:inline ${step === s.num ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {index < stepsList.length - 1 && (
              <div className={`flex-1 h-[2px] mx-4 rounded-full ${step > s.num ? 'bg-eco-500/50' : 'bg-gray-150 dark:bg-gray-800/30'}`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Main Layout: Split Form vs live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Container (Left 2 cols) */}
        <div className="lg:col-span-2 glass-card p-6 min-h-[350px] flex flex-col justify-between">
          
          {/* Step 1: Transport */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">🚗 Transportation Commute</h3>
                <p className="text-xs text-gray-400 mt-0.5">Input your typical daily distance logged in kilometers.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'bike', label: 'Bicycle / Walk', icon: '🚲' },
                  { key: 'bus', label: 'Bus transit', icon: '🚌' },
                  { key: 'metro', label: 'Metro / Rail', icon: '🚇' },
                  { key: 'car', label: 'Gasoline Car', icon: '🚗' },
                  { key: 'ev', label: 'Electric Vehicle (EV)', icon: '⚡' },
                  { key: 'flight', label: 'Air Flight', icon: '✈️' },
                ].map(({ key, label, icon }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {icon} {label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input-field"
                      placeholder="0.0 km"
                      value={form.transport[key] || ''}
                      onChange={(e) => updateTransport(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Occupancy-aware carpool input (only relevant when car/EV km > 0) */}
              {(form.transport.car > 0 || form.transport.ev > 0) && (
                <div className="p-4 rounded-2xl bg-eco-500/5 border border-eco-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-white">🚗 Vehicle Occupants (incl. driver)</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Your personal share = vehicle emissions ÷ occupants. Shared trips are split fairly.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateTransport('carOccupants', Math.max(1, form.transport.carOccupants - 1))}
                        className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black hover:bg-eco-500 hover:text-white transition-all"
                      >−</button>
                      <span className="w-10 text-center text-lg font-black text-gray-800 dark:text-white">{form.transport.carOccupants}</span>
                      <button
                        type="button"
                        onClick={() => updateTransport('carOccupants', Math.min(8, form.transport.carOccupants + 1))}
                        className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black hover:bg-eco-500 hover:text-white transition-all"
                      >+</button>
                    </div>
                  </div>
                  {form.transport.carOccupants > 1 && (
                    <p className="text-[10px] font-bold text-eco-600 dark:text-eco-400">
                      💡 Splitting {liveStats.householdTransport} kg among {form.transport.carOccupants} occupants → your share is {liveStats.breakdown.transport} kg (household trip = {liveStats.householdTransport} kg)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Energy & Water */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">⚡ Household Utility Power</h3>
                <p className="text-xs text-gray-400 mt-0.5">Log electricity and water consumed today.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Electricity (kWh)</label>
                    <input type="number" min="0" className="input-field" value={form.electricity || ''}
                      onChange={(e) => setForm({ ...form, electricity: Math.max(0, Number(e.target.value)) })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Water consumption (Liters)</label>
                    <input type="number" min="0" className="input-field" value={form.water || ''}
                      onChange={(e) => setForm({ ...form, water: Math.max(0, Number(e.target.value)) })} />
                  </div>
                </div>
                
                {/* Solar Toggle */}
                <div className="p-4 rounded-2xl bg-eco-500/5 border border-eco-500/10 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-white">Solar Panels Activated</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Cuts grid electricity carbon footprint by 85%</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input type="checkbox" checked={form.solarPanels}
                      onChange={(e) => setForm({ ...form, solarPanels: e.target.checked })}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-eco-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-eco-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Diet, Shop, Fuel */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">🍽️ Lifestyle & Fuel Variables</h3>
                <p className="text-xs text-gray-400 mt-0.5">Nutrition, shopping, waste, and direct fuel additions.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Food Habit</label>
                  <select className="input-field cursor-pointer" value={form.foodHabit}
                    onChange={(e) => setForm({ ...form, foodHabit: e.target.value })}>
                    <option value="vegan">Vegan 🌱</option>
                    <option value="vegetarian">Vegetarian 🥗</option>
                    <option value="nonVegetarian">Non-Vegetarian 🥩</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Shopping Level</label>
                  <select className="input-field cursor-pointer" value={form.shoppingFrequency}
                    onChange={(e) => setForm({ ...form, shoppingFrequency: e.target.value })}>
                    <option value="low">Low (Sustainable) 🛍️</option>
                    <option value="medium">Medium 🛒</option>
                    <option value="high">High (Excessive) 💸</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Waste Generation</label>
                  <select className="input-field cursor-pointer" value={form.wasteGeneration}
                    onChange={(e) => setForm({ ...form, wasteGeneration: e.target.value })}>
                    <option value="low">Low (Compost) ♻️</option>
                    <option value="medium">Medium 🗑️</option>
                    <option value="high">High 🗑️</option>
                  </select>
                </div>
              </div>

              {/* Fuel Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">⛽ Generator / Cooking Fuel (Liters)</h4>
                <div className="grid grid-cols-3 gap-4">
                  {['petrol', 'diesel', 'lpg'].map((type) => (
                    <div key={type} className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{type}</label>
                      <input type="number" min="0" step="any" className="input-field" placeholder="0.0 L" value={form.fuel[type] || ''}
                        onChange={(e) => updateFuel(type, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview & Save */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">📊 Preview and Submit Log</h3>
                <p className="text-xs text-gray-400 mt-0.5">Finalize notes before committing data points.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Journal/Commute Notes (Optional)</label>
                  <textarea 
                    className="input-field" 
                    rows={4} 
                    placeholder="E.g., Took public transit to office today. Avoided single-use plastics."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                {result && (
                  <div className="p-4 rounded-2xl bg-eco-500/10 text-eco-700 dark:text-eco-400 text-xs font-bold flex items-center gap-2 border border-eco-500/20">
                    <FiCheckCircle size={16} /> Saved! Navigating to Dashboard...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-6 mt-8 flex justify-between">
            <button 
              type="button"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || loading}
              className="btn-secondary px-5 py-2 text-xs flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed select-none"
            >
              <FiArrowLeft /> Back
            </button>

            {step < 4 ? (
              <button 
                type="button"
                onClick={() => setStep(s => Math.min(4, s + 1))}
                className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5 select-none"
              >
                Next <FiArrowRight />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary px-6 py-2 text-xs flex items-center gap-1.5 select-none"
              >
                {loading ? 'Submitting...' : 'Confirm & Log Entry'}
              </button>
            )}
          </div>

        </div>

        {/* Live Footprint Accumulator Panel (Right 1 col) */}
        <div className="glass-card p-6 flex flex-col justify-between border-2 border-eco-500/20">
          <div>
            <h3 className="text-xs font-bold text-eco-600 dark:text-eco-400 uppercase tracking-wider mb-4">Live Carbon budget</h3>
            <div className="text-center py-6">
              <span className="text-5xl font-black text-gray-800 dark:text-white tracking-tight">{liveStats.total}</span>
              <span className="text-xs font-semibold text-gray-400 block mt-2">kg CO₂ Equivalent</span>
            </div>

            {/* Breakdown progress bars */}
            <div className="space-y-3.5 mt-4">
              {[
                { key: 'transport', label: 'Transport', color: 'bg-eco-500' },
                { key: 'electricity', label: 'Electricity', color: 'bg-ocean-500' },
                { key: 'food', label: 'Food Diet', color: 'bg-purple-500' },
                { key: 'shopping', label: 'Shopping', color: 'bg-amber-500' },
                { key: 'waste', label: 'Waste', color: 'bg-rose-500' },
                { key: 'fuel', label: 'Fuel', color: 'bg-teal-500' },
              ].map(({ key, label, color }) => {
                const val = liveStats.breakdown[key] || 0;
                const pct = liveStats.total > 0 ? Math.round((val / liveStats.total) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>{label}</span>
                      <span>{val} kg ({pct}%)</span>
                    </div>
                    <div className="w-full h-1 bg-gray-150 dark:bg-gray-800/40 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-6 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Budgets are verified in real-time
          </div>
        </div>

      </div>

    </div>
  );
}
