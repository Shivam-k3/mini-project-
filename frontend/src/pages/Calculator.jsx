import { useState } from 'react';
import { carbonAPI } from '../services/api';
import toast from 'react-hot-toast';

const defaultForm = {
  transport: { bike: 0, bus: 0, metro: 0, car: 0, ev: 0, flight: 0 },
  electricity: 10,
  water: 150,
  foodHabit: 'nonVegetarian',
  shoppingFrequency: 'medium',
  wasteGeneration: 'medium',
  fuel: { petrol: 0, diesel: 0, lpg: 0 },
  solarPanels: false,
  notes: '',
};

export default function Calculator() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const updateTransport = (mode, value) => {
    setForm({ ...form, transport: { ...form.transport, [mode]: Number(value) } });
  };

  const updateFuel = (type, value) => {
    setForm({ ...form, fuel: { ...form.fuel, [type]: Number(value) } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await carbonAPI.create(form);
      setResult(data);
      toast.success(`Logged ${data.totalEmissions} kg CO₂`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Carbon Calculator</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Log your daily activities to track emissions</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Transport */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">🚗 Transportation (km/day)</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'bike', label: 'Bicycle', icon: '🚲' },
              { key: 'bus', label: 'Bus', icon: '🚌' },
              { key: 'metro', label: 'Metro', icon: '🚇' },
              { key: 'car', label: 'Car', icon: '🚗' },
              { key: 'ev', label: 'Electric Vehicle', icon: '⚡' },
              { key: 'flight', label: 'Flight', icon: '✈️' },
            ].map(({ key, label, icon }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {icon} {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="input-field"
                  value={form.transport[key]}
                  onChange={(e) => updateTransport(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Energy & Water */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">⚡ Energy & Water</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Electricity (kWh)</label>
              <input type="number" min="0" className="input-field" value={form.electricity}
                onChange={(e) => setForm({ ...form, electricity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Water (liters)</label>
              <input type="number" min="0" className="input-field" value={form.water}
                onChange={(e) => setForm({ ...form, water: Number(e.target.value) })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.solarPanels}
                  onChange={(e) => setForm({ ...form, solarPanels: e.target.checked })}
                  className="w-5 h-5 rounded text-eco-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">☀️ Solar Panels Installed</span>
              </label>
            </div>
          </div>
        </div>

        {/* Lifestyle */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">🍽️ Lifestyle</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Food Habit</label>
              <select className="input-field" value={form.foodHabit}
                onChange={(e) => setForm({ ...form, foodHabit: e.target.value })}>
                <option value="vegan">Vegan</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="nonVegetarian">Non-Vegetarian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Shopping Frequency</label>
              <select className="input-field" value={form.shoppingFrequency}
                onChange={(e) => setForm({ ...form, shoppingFrequency: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Waste Generation</label>
              <select className="input-field" value={form.wasteGeneration}
                onChange={(e) => setForm({ ...form, wasteGeneration: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Fuel */}
        <div className="glass-card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">⛽ Fuel Usage (liters/day)</h3>
          <div className="grid grid-cols-3 gap-4">
            {['petrol', 'diesel', 'lpg'].map((type) => (
              <div key={type}>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">{type}</label>
                <input type="number" min="0" step="0.1" className="input-field" value={form.fuel[type]}
                  onChange={(e) => updateFuel(type, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full lg:w-auto">
          {loading ? 'Calculating...' : 'Calculate & Log Emissions'}
        </button>
      </form>

      {result && (
        <div className="glass-card animate-slide-up border-2 border-eco-500/30">
          <h3 className="text-lg font-semibold text-eco-600 dark:text-eco-400 mb-4">Result</h3>
          <p className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            {result.totalEmissions} <span className="text-lg font-normal text-gray-500">kg CO₂</span>
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(result.breakdown || {}).map(([cat, val]) => (
              <div key={cat} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-500 capitalize">{cat}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{val} kg</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
