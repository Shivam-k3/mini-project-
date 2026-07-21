import { useState, useEffect } from 'react';
import { simulatorAPI } from '../services/api';
import { ComparisonBarChart } from '../components/Charts';
import toast from 'react-hot-toast';

export default function Simulator() {
  const [scenarios, setScenarios] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customChanges, setCustomChanges] = useState({
    electricityReduction: 0,
    foodHabit: '',
    solarPanels: false,
  });

  useEffect(() => {
    simulatorAPI.getScenarios().then(({ data }) => setScenarios(data)).catch(console.error);
  }, []);

  const runSimulation = async (changes, name) => {
    setLoading(true);
    try {
      const { data } = await simulatorAPI.simulate({ changes, name });
      setResult(data);
      toast.success(`Simulation complete: ${data.reduction} kg CO₂ saved`);
    } catch (err) {
      toast.error('Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const runCustom = () => {
    const changes = {};
    if (customChanges.electricityReduction > 0) {
      changes.electricityReduction = customChanges.electricityReduction;
    }
    if (customChanges.foodHabit) changes.foodHabit = customChanges.foodHabit;
    if (customChanges.solarPanels) changes.solarPanels = true;
    runSimulation(changes, 'Custom Scenario');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Digital Twin Simulator</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Test lifestyle changes and see instant carbon impact predictions
        </p>
      </div>

      {/* Preset Scenarios */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Preset Scenarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => runSimulation(s.changes, s.name)}
              disabled={loading}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-eco-500
                         hover:bg-eco-50 dark:hover:bg-eco-900/20 transition-all text-left group"
            >
              <h4 className="font-semibold text-gray-800 dark:text-white group-hover:text-eco-600">{s.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Scenario */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Custom Scenario</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Reduce Electricity (%)
            </label>
            <input type="range" min="0" max="50" value={customChanges.electricityReduction}
              onChange={(e) => setCustomChanges({ ...customChanges, electricityReduction: Number(e.target.value) })}
              className="w-full accent-eco-500" />
            <p className="text-sm text-eco-600 font-medium">{customChanges.electricityReduction}%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Change Diet</label>
            <select className="input-field" value={customChanges.foodHabit}
              onChange={(e) => setCustomChanges({ ...customChanges, foodHabit: e.target.value })}>
              <option value="">No change</option>
              <option value="vegan">Vegan</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="nonVegetarian">Non-Vegetarian</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={customChanges.solarPanels}
                onChange={(e) => setCustomChanges({ ...customChanges, solarPanels: e.target.checked })}
                className="w-5 h-5 rounded text-eco-500" />
              <span className="text-sm font-medium">Install Solar Panels</span>
            </label>
          </div>
        </div>
        <button onClick={runCustom} disabled={loading} className="btn-primary">
          {loading ? 'Simulating...' : 'Run Custom Simulation'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card text-center">
              <p className="text-sm text-gray-500">Baseline</p>
              <p className="text-2xl font-bold text-red-500">{result.baseline?.total} kg</p>
            </div>
            <div className="glass-card text-center">
              <p className="text-sm text-gray-500">Scenario</p>
              <p className="text-2xl font-bold text-eco-500">{result.scenario?.total} kg</p>
            </div>
            <div className="glass-card text-center">
              <p className="text-sm text-gray-500">Reduction</p>
              <p className="text-2xl font-bold text-ocean-500">{result.reduction} kg</p>
            </div>
            <div className="glass-card text-center">
              <p className="text-sm text-gray-500">Saved</p>
              <p className="text-2xl font-bold text-eco-600">{result.reductionPercent}%</p>
            </div>
          </div>

          {result.comparison && (
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Category Comparison</h3>
              <ComparisonBarChart comparison={result.comparison} />
            </div>
          )}

          {result.mlPrediction && (
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">ML Impact Analysis</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Yearly Savings</p>
                  <p className="text-xl font-bold text-eco-600">{result.mlPrediction.yearlySavings} kg</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trees Equivalent</p>
                  <p className="text-xl font-bold text-eco-600">{result.mlPrediction.treesEquivalent} 🌳</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Impact Score</p>
                  <p className="text-xl font-bold text-ocean-600">{result.mlPrediction.impactScore}/100</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
