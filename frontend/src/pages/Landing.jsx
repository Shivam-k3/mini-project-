import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  FiArrowRight, FiCpu, FiMessageCircle, FiTrendingUp, 
  FiAward, FiSettings, FiFileText, FiSun, FiMoon 
} from 'react-icons/fi';

export default function Landing() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 bg-mesh text-gray-800 dark:text-gray-200 transition-colors duration-300">
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-lg">
            🌿
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-800 dark:text-white leading-tight">EcoGuardian AI</h1>
            <p className="text-[10px] text-eco-600 dark:text-eco-400 font-semibold uppercase tracking-wider">SDG 13 Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggle} className="p-2.5 rounded-xl border border-gray-200/50 dark:border-white/5 hover:bg-gray-150 dark:hover:bg-gray-900/50 transition-all text-gray-500 dark:text-gray-400">
            {dark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary flex items-center gap-2 px-5 py-2 text-sm">
              Dashboard <FiArrowRight />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary px-5 py-2 text-sm">Sign In</Link>
              <Link to="/register" className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                Get Started <FiArrowRight />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-eco-200/50 dark:border-eco-800/30 bg-eco-500/5 text-eco-600 dark:text-eco-400 text-xs font-semibold tracking-wide uppercase">
            🌍 Supporting UN Sustainable Development Goal 13
          </span>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
            Empowering Your Climate Action with <span className="bg-clip-text text-transparent bg-gradient-to-r from-eco-500 to-ocean-500">Explainable AI</span>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">
            EcoGuardian AI is a premium SaaS carbon footprint management platform. Calculate, monitor, forecast, and simulate lifestyle impacts using advanced Machine Learning and SHAP Explanations.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            {user ? (
              <Link to="/dashboard" className="btn-primary px-8 py-3.5 text-base flex items-center gap-2">
                Open Dashboard <FiArrowRight />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-8 py-3.5 text-base flex items-center gap-2">
                  Get Started for Free <FiArrowRight />
                </Link>
                <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">Sign In</Link>
              </>
            )}
          </div>
        </div>

        {/* Floating Mockup Layout preview */}
        <div className="mt-16 glass rounded-3xl p-4 border border-gray-200/50 dark:border-white/5 shadow-2xl relative max-w-5xl mx-auto">
          <div className="w-full h-[350px] sm:h-[450px] rounded-2xl bg-gray-900/10 dark:bg-gray-900/80 border border-gray-200/50 dark:border-white/5 flex flex-col p-6 overflow-hidden relative select-none">
            {/* Mock Dashboard Topbar */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-white/10 text-left">
              <div>
                <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded-md"></div>
                <div className="h-2 w-20 bg-gray-200 dark:bg-gray-800 rounded-md mt-1.5"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
              </div>
            </div>
            {/* Mock Dashboard Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-left flex-1">
              <div className="glass bg-white/20 dark:bg-gray-800/20 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xl">🌿</span>
                  <p className="text-xs text-gray-400 mt-2 font-medium">Daily Footprint</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">10.71 kg</p>
                </div>
                <div className="h-1.5 w-full bg-eco-500/20 rounded-full mt-2 overflow-hidden">
                  <div className="bg-eco-500 h-full w-[54%]"></div>
                </div>
              </div>
              <div className="glass bg-white/20 dark:bg-gray-800/20 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xl">🔥</span>
                  <p className="text-xs text-gray-400 mt-2 font-medium">Eco Score</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">65 / 100</p>
                </div>
                <div className="h-1.5 w-full bg-ocean-500/20 rounded-full mt-2 overflow-hidden">
                  <div className="bg-ocean-500 h-full w-[65%]"></div>
                </div>
              </div>
              <div className="glass bg-white/20 dark:bg-gray-800/20 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-xl">🤖</span>
                  <p className="text-xs text-gray-400 mt-2 font-medium">AI Recommendation</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-normal">
                    "Switching commute to metro will save 4.3 kg CO₂ daily."
                  </p>
                </div>
                <div className="h-6 w-16 bg-eco-500/10 text-eco-600 text-[10px] font-bold rounded-lg flex items-center justify-center">
                  Highly Active
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-200/50 dark:border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Intelligent Climate Actions</h3>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Discover a comprehensive ecosystem designed for emission reduction and behavioral modeling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Carbon Calculator */}
          <div className="bento-card md:col-span-2 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-eco-500/10 text-eco-600 flex items-center justify-center mb-4">
                <FiFileText size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Multi-Step Carbon Calculator</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xl">
                Log transportation, electric power consumption, household water usage, and nutritional choices. Visualize real-time totals and complete itemized logging wizards.
              </p>
            </div>
            <div className="mt-4 flex gap-1">
              {['Transport', 'Energy', 'Water', 'Nutrition', 'Fuel'].map((c) => (
                <span key={c} className="text-[10px] font-semibold bg-gray-150 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-500">{c}</span>
              ))}
            </div>
          </div>

          {/* Card 2: SHAP Explainable AI */}
          <div className="bento-card flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <FiCpu size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Explainable AI (SHAP)</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Understand the exact root causes of high emissions with Shapley values and feature contribution percentages.
              </p>
            </div>
            <div className="text-xs font-semibold text-purple-500 mt-4 flex items-center gap-1">
              Transparent attribution Model
            </div>
          </div>

          {/* Card 3: Machine Learning Predictions */}
          <div className="bento-card flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-ocean-500/10 text-ocean-500 flex items-center justify-center mb-4">
                <FiTrendingUp size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Forecast Predictions</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Stay ahead of the curve. Train machine learning algorithms on your carbon history to forecast emissions for next week and next month.
              </p>
            </div>
            <div className="text-xs font-semibold text-ocean-500 mt-4">
              95% Confidence Bounds
            </div>
          </div>

          {/* Card 4: Digital Twin Lifestyle Simulator */}
          <div className="bento-card md:col-span-2 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                <FiSettings size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Digital Twin Lifestyle Simulator</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xl">
                Simulate lifestyle modifications before executing them. Toggle parameters (dietary habits, transport modes, solar panel installations) and see simulated carbon offsets and trees saved.
              </p>
            </div>
            <div className="mt-4 flex gap-4 text-xs font-semibold text-amber-600">
              <span>🚗 → 🚇 Mode Shifts</span>
              <span>☀️ Solar Integrations</span>
              <span>🥗 Plant-Based Diet</span>
            </div>
          </div>

          {/* Card 5: AI Sustainability Assistant */}
          <div className="bento-card flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-4">
                <FiMessageCircle size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">AI Sustainability Assistant</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Interact with a chatbot trained to guide your environmental strategy, formulate meal plans, and summarize files.
              </p>
            </div>
            <div className="text-xs font-semibold text-teal-600 mt-4">
              Gemini & OpenAI Powered
            </div>
          </div>

          {/* Card 6: Gamification */}
          <div className="bento-card md:col-span-2 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                <FiAward size={20} />
              </div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Gamification & Social Rewards</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xl">
                Earn Green Points, build streaks, unlock milestone badges, and participate in weekly challenges to see your name rise on the global leaderboard.
              </p>
            </div>
            <div className="mt-4 flex gap-4 text-xs font-semibold text-rose-500">
              <span>🏆 Leaderboard Rank</span>
              <span>🔥 Log Streaks</span>
              <span>🏅 Custom Badges</span>
            </div>
          </div>
        </div>
      </section>

      {/* SDG 13 Hub Impact Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-200/50 dark:border-white/5 bg-eco-500/[0.01] rounded-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">Directly Supporting UN SDG 13</h3>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              United Nations Sustainable Development Goal 13 demands urgent action to combat climate change and its impacts. EcoGuardian AI contributes to this mission by providing key data points, metrics, and explanatory tools to motivate personal decarbonization.
            </p>
            <div className="space-y-4">
              {[
                { title: '13.1 Strengthen resilience and adaptive capacity', desc: 'Personalized calculations and predictive alerts raise immediate awareness of climate risks.' },
                { title: '13.3 Improve education, awareness-raising, and human capacity', desc: 'Explainable AI and interactive digital twins serve as powerful educational simulators.' }
              ].map((item) => (
                <div key={item.title} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-eco-500/10 flex items-center justify-center text-eco-600 text-xs shrink-0 font-bold">✓</div>
                  <div>
                    <h5 className="font-bold text-gray-800 dark:text-white text-sm">{item.title}</h5>
                    <p className="text-xs text-gray-500 mt-1 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-3xl p-6 border border-gray-200/50 dark:border-white/5 flex flex-col justify-center text-center py-12 relative overflow-hidden bg-gradient-to-br from-eco-500/10 to-ocean-500/10">
            <div className="text-6xl mb-4">🌱</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Join the Global Decarbonization Wave</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2 leading-relaxed">
              Every log entry, challenge completed, and tree saved helps create a measurable impact.
            </p>
            <div className="mt-6">
              <Link to="/register" className="btn-primary inline-flex items-center gap-2">
                Join the Platform Now <FiArrowRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="glass rounded-3xl p-8 sm:p-16 border border-gray-200/50 dark:border-white/5 max-w-4xl mx-auto relative overflow-hidden bg-gradient-to-r from-eco-500/5 to-ocean-500/5">
          <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Ready to Monitor and Reduce Your Footprint?</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mt-4 font-medium leading-relaxed">
            Create a profile, access the dashboard, and begin optimizing your daily routines under SDG 13 guidelines.
          </p>
          <div className="mt-8">
            <Link to="/register" className="btn-primary px-8 py-3.5 text-base inline-flex items-center gap-2">
              Start Decarbonizing <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/50 dark:border-white/5 px-6 py-12 bg-white/30 dark:bg-gray-950/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌿</span>
            <div>
              <p className="font-bold text-sm text-gray-800 dark:text-white leading-tight">EcoGuardian AI</p>
              <p className="text-[10px] text-gray-400">UN SDG 13 Climate Action Platform © 2026</p>
            </div>
          </div>
          <div className="flex gap-6 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Link to="/login" className="hover:text-eco-600 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-eco-600 transition-colors">Register</Link>
            <a href="https://sdgs.un.org/goals/goal13" target="_blank" rel="noopener noreferrer" className="hover:text-eco-600 transition-colors">Goal 13 Info</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
