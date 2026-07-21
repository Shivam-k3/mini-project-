import { useState, useEffect } from 'react';
import { simulatorAPI } from '../services/api';
import { ComparisonBarChart } from '../components/Charts';
import toast from 'react-hot-toast';
import { FiPlay, FiSettings, FiSliders, FiCpu, FiTrendingDown, FiShield } from 'react-icons/fi';

export default function Simulator() {
  const [scenarios, setScenarios] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customChanges, setCustomChanges] = useState({
    electricityReduction: 0,
    foodHabit: '',
    solarPanels: false,
    workFromHome: false,
  });

  useEffect(() => {
    simulatorAPI.getScenarios()
      .then(({ data }) => setScenarios(data))
      .catch(console.error);
  }, []);

  const runSimulation = async (changes, name) => {
    setLoading(true);
    try {
      const { data } = await simulatorAPI.simulate({ changes, name });
      setResult(data);
      toast.success(`Decarbonization Simulation complete!`);
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
    if (customChanges.foodHabit) {
      changes.foodHabit = customChanges.foodHabit;
    }
    if (customChanges.solarPanels) {
      changes.solarPanels = true;
    }
    if (customChanges.workFromHome) {
      // Simulate WFH by replacing 15km car commute with zero-emission bike commute
      changes.transportMode = 'bike';
      changes.transportKm = 15;
      changes.replaceMode = 'car';
    }
    runSimulation(changes, 'Custom Scenario');
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Digital Twin Lifestyle Simulator</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Model lifestyle offsets and predict carbon savings on your digital twin clone.
        </p>
      </div>

      {/* Split Layout: Controls (Left) vs Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Preset & Custom Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Preset Buttons */}
          <div className="glass-card p-5">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FiCpu className="text-eco-500" /> Decarbonization Presets
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => runSimulation(s.changes, s.name)}
                  disabled={loading}
                  className="p-3.5 rounded-2xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 hover:bg-eco-500/5 hover:border-eco-500/30 text-left font-medium transition-all group flex items-center justify-between"
                >
                  <div className="overflow-hidden pr-3">
                    <h4 className="text-xs font-bold text-gray-800 dark:text-white group-hover:text-eco-600 dark:group-hover:text-eco-400 leading-tight">{s.name}</h4>
                    <p className="text-[10px] text-gray-400 mt-1 truncate">{s.description}</p>
                  </div>
                  <FiPlay className="text-gray-400 group-hover:text-eco-500 group-hover:translate-x-0.5 transition-all shrink-0" size={13} />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Lifestyle Sliders */}
          <div className="glass-card p-5 space-y-5">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <FiSliders className="text-ocean-500" /> Scenario Adjustments
            </h3>
            
            {/* Electricity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                <span>Reduce Grid Electricity</span>
                <span className="text-eco-500 font-bold">{customChanges.electricityReduction}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={customChanges.electricityReduction}
                onChange={(e) => setCustomChanges({ ...customChanges, electricityReduction: Number(e.target.value) })}
                className="w-full accent-eco-500 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5"
              />
            </div>

            {/* Diet Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Change Nutritional Diet</label>
              <select className="input-field py-2 text-xs" value={customChanges.foodHabit}
                onChange={(e) => setCustomChanges({ ...customChanges, foodHabit: e.target.value })}>
                <option value="">No change</option>
                <option value="vegan">Vegan Diet 🌱</option>
                <option value="vegetarian">Vegetarian Diet 🥗</option>
                <option value="nonVegetarian">Non-Vegetarian Diet 🥩</option>
              </select>
            </div>

            {/* Solar Panel Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-white/5">
              <div>
                <h4 className="text-xs font-bold text-gray-800 dark:text-white">Install Solar Panels</h4>
                <p className="text-[9px] text-gray-400">85% carbon offset</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" checked={customChanges.solarPanels}
                  onChange={(e) => setCustomChanges({ ...customChanges, solarPanels: e.target.checked })}
                  className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-eco-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-eco-500"></div>
              </label>
            </div>

            {/* WFH Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-white/5">
              <div>
                <h4 className="text-xs font-bold text-gray-800 dark:text-white">Work From Home</h4>
                <p className="text-[9px] text-gray-400">Avoid daily office commute</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" checked={customChanges.workFromHome}
                  onChange={(e) => setCustomChanges({ ...customChanges, workFromHome: e.target.checked })}
                  className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-eco-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-eco-500"></div>
              </label>
            </div>

            <button onClick={runCustom} disabled={loading} className="btn-primary w-full py-2.5 text-xs">
              {loading ? 'Running...' : 'Execute Custom Model'}
            </button>
          </div>

        </div>

        {/* Right Column: Comparative Metrics & Charts (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* Comparative Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass-card text-center p-4">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Baseline</p>
                  <p className="text-xl font-black text-red-500 mt-1">{result.baseline?.total?.toFixed(1)} kg</p>
                </div>
                <div className="glass-card text-center p-4">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Scenario</p>
                  <p className="text-xl font-black text-eco-500 mt-1">{result.scenario?.total?.toFixed(1)} kg</p>
                </div>
                <div className="glass-card text-center p-4">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">CO₂ Saved</p>
                  <p className="text-xl font-black text-ocean-500 mt-1">{result.reduction?.toFixed(1)} kg</p>
                </div>
                <div className="glass-card text-center p-4">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Reduction</p>
                  <p className="text-xl font-black text-eco-600 mt-1">{result.reductionPercent?.toFixed(1)}%</p>
                </div>
              </div>

              {/* ML Impact Projections */}
              {result.mlPrediction && (
                <div className="glass-card p-5">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <FiTrendingUp className="text-eco-500" /> ML Yearly Twin Projections
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-xl bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5">
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Yearly Savings</p>
                      <p className="text-lg font-black text-eco-600 dark:text-eco-400 mt-1">{result.mlPrediction.yearlySavings} <span className="text-[10px] font-normal text-gray-400">kg</span></p>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5">
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Trees Equivalent</p>
                      <p className="text-lg font-black text-eco-600 dark:text-eco-400 mt-1">{result.mlPrediction.treesEquivalent} 🌳</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-100/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-white/5">
                      <p className="text-[9px] text-gray-400 uppercase font-bold">Impact Score</p>
                      <p className="text-lg font-black text-ocean-600 dark:text-ocean-400 mt-1">{result.mlPrediction.impactScore} <span className="text-[10px] font-normal text-gray-400">/100</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison Chart */}
              {result.comparison && (
                <div className="glass-card p-5">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Emissions Category comparison</h3>
                  <div className="h-[220px]">
                    <ComparisonBarChart comparison={result.comparison} />
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="glass-card flex flex-col items-center justify-center text-center py-24 min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-eco-500/10 to-ocean-500/10 text-eco-500 flex items-center justify-center text-2xl mb-4 border border-eco-500/20">
                🔮
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white">Awaiting Model Execution</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mt-2 leading-relaxed">
                Configure your lifestyle modifications on the left and execute the model to inspect predicted offsets.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
