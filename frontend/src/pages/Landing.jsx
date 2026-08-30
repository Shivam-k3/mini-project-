import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import {
  FiArrowRight, FiCpu, FiMessageCircle, FiTrendingUp,
  FiAward, FiSettings, FiFileText, FiSun, FiMoon
} from 'react-icons/fi';
import GlowButton from '../components/GlowButton';
import AnimatedCard from '../components/AnimatedCard';
import ErrorBoundary from '../components/ErrorBoundary';
import FAQItem from '../components/FAQItem';

const EarthCanvas = lazy(() => import('../components/EarthCanvas'));
const ParticlesBackground = lazy(() => import('../components/ParticlesBackground'));
const ScrollStory = lazy(() => import('../components/ScrollStory'));

export default function Landing() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let hasUTM = false;
    utmKeys.forEach((key) => {
      const val = params.get(key);
      if (val) { sessionStorage.setItem(key, val); hasUTM = true; }
    });
    if (hasUTM) sessionStorage.setItem('ecoguardian_landing_ref', window.location.pathname + window.location.search);
  }, []);

  const features = [
    { icon: FiFileText, title: 'Multi-Step Trip Calculator', desc: 'Log every trip with mode, distance, vehicle and occupancy. Visualize real-time totals with an itemized logging wizard.', tags: ['Trips', 'Vehicles', 'Occupancy', 'Purpose'], color: 'text-eco-600', bg: 'bg-eco-500/10' },
    { icon: FiCpu, title: 'Explainable AI (SHAP)', desc: 'Understand the exact root causes of high emissions with Shapley values and feature contribution percentages.', color: 'text-purple-500', bg: 'bg-purple-500/10', tag: 'Transparent Attribution Model' },
    { icon: FiTrendingUp, title: 'Forecast Predictions', desc: 'Train ML algorithms on your carbon history to forecast emissions for next week and next month.', color: 'text-ocean-500', bg: 'bg-ocean-500/10', tag: '95% Confidence Bounds' },
    { icon: FiSettings, title: 'Mobility Twin Simulator', desc: 'Simulate commute changes before making them — shift modes, share rides, swap to an EV, and see the carbon offset.', tagsSim: ['🚗 → 🚇', '👥 Carpool', '⚡ EV Swap'], color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { icon: FiMessageCircle, title: 'AI Mobility Assistant', desc: 'Chatbot trained to guide your commute strategy, compare travel modes, and explain your trip emissions.', color: 'text-teal-600', bg: 'bg-teal-500/10', tag: 'Gemini & OpenAI Powered' },
    { icon: FiAward, title: 'Gamification & Rewards', desc: 'Earn Green Points, build streaks, unlock milestone badges, and compete on the global leaderboard.', tagsSim: ['🏆 Leaderboard', '🔥 Streaks', '🏅 Badges'], color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 bg-mesh text-gray-800 dark:text-gray-200 transition-colors duration-300">
      <Suspense fallback={null}>
        <ErrorBoundary>
          <ParticlesBackground />
        </ErrorBoundary>
      </Suspense>

      {/* Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-eco-400 to-ocean-500 flex items-center justify-center text-white text-lg">🌿</div>
          <div>
            <h1 className="font-bold text-base text-gray-800 dark:text-white leading-tight">EcoGuardian</h1>
            <p className="text-[10px] text-eco-600 dark:text-eco-400 font-semibold uppercase tracking-wider">SDG 13 Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggle} className="p-2.5 rounded-xl border border-gray-200/50 dark:border-white/5 hover:bg-gray-150 dark:hover:bg-gray-900/50 transition-all text-gray-500 dark:text-gray-400">
            {dark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary flex items-center gap-2 px-5 py-2 text-sm">Dashboard <FiArrowRight /></Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary px-5 py-2 text-sm">Sign In</Link>
              <Link to="/register" className="btn-primary px-5 py-2 text-sm flex items-center gap-2">Get Started <FiArrowRight /></Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-eco-200/50 dark:border-eco-800/30 bg-eco-500/5 text-eco-600 dark:text-eco-400 text-xs font-semibold tracking-wide uppercase">🌍 Supporting UN SDG 13</span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                Empowering Your Climate Action with <span className="bg-clip-text text-transparent bg-gradient-to-r from-eco-500 to-ocean-500">Explainable AI</span>
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-xl">
                EcoGuardian is a premium SaaS carbon footprint management platform. Calculate, monitor, forecast, and simulate your commute impact using advanced ML and SHAP Explanations.
              </p>
              <div className="flex justify-start gap-4 pt-2">
                {user ? (
                  <GlowButton onClick={() => window.location.href = '/dashboard'}>Open Dashboard</GlowButton>
                ) : (
                  <>
                    <Link to="/register" className="btn-primary px-8 py-3.5 text-base inline-flex items-center gap-2">Get Started for Free <FiArrowRight /></Link>
                    <Link to="/login" className="btn-secondary px-8 py-3.5 text-base">Sign In</Link>
                  </>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-[400px] lg:h-[500px] w-full relative"
            >
              <Suspense fallback={<div className="w-full h-full skeleton animate-pulse rounded-2xl" />}>
                <ErrorBoundary>
                  <EarthCanvas />
                </ErrorBoundary>
              </Suspense>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-200/50 dark:border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Intelligent Climate Actions</h3>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Discover a comprehensive ecosystem designed for emission reduction and behavioral modeling.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <AnimatedCard key={f.title} index={i} className={`bento-card ${i === 0 || i === 3 || i === 5 ? 'md:col-span-2' : ''} flex flex-col justify-between min-h-[220px]`}>
              <div>
                <div className={`w-10 h-10 rounded-xl ${f.bg} ${f.color} flex items-center justify-center mb-4`}><f.icon size={20} /></div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{f.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xl">{f.desc}</p>
              </div>
              {f.tags && <div className="mt-4 flex gap-1 flex-wrap">{f.tags.map(t => <span key={t} className="text-[10px] font-semibold bg-gray-150 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-500">{t}</span>)}</div>}
              {f.tagsSim && <div className="mt-4 flex gap-4 text-xs font-semibold" style={{ color: f.color.replace('text-', '') }}>{f.tagsSim.map(t => <span key={t}>{t}</span>)}</div>}
              {f.tag && !f.tags && !f.tagsSim && <div className={`text-xs font-semibold ${f.color} mt-4`}>{f.tag}</div>}
            </AnimatedCard>
          ))}
        </div>
      </section>

      {/* Scroll Story */}
      <Suspense fallback={null}>
        <ErrorBoundary>
          <ScrollStory />
        </ErrorBoundary>
      </Suspense>

      {/* SDG 13 Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-200/50 dark:border-white/5 bg-eco-500/[0.01] rounded-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">Directly Supporting UN SDG 13</h3>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">United Nations Sustainable Development Goal 13 demands urgent action to combat climate change. EcoGuardian contributes by providing data, metrics, and tools to motivate personal decarbonization.</p>
            <div className="space-y-4">
              {[
                { title: '13.1 Strengthen resilience and adaptive capacity', desc: 'Personalized calculations and predictive alerts raise immediate awareness of climate risks.' },
                { title: '13.3 Improve education, awareness-raising, and human capacity', desc: 'Explainable AI and interactive digital twins serve as powerful educational simulators.' },
              ].map(item => (
                <div key={item.title} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-eco-500/10 flex items-center justify-center text-eco-600 text-xs shrink-0 font-bold">✓</div>
                  <div>
                    <h5 className="font-bold text-gray-800 dark:text-white text-sm">{item.title}</h5>
                    <p className="text-xs text-gray-500 mt-1 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="glass rounded-3xl p-6 border border-gray-200/50 dark:border-white/5 flex flex-col justify-center text-center py-12 relative overflow-hidden bg-gradient-to-br from-eco-500/10 to-ocean-500/10">
            <div className="text-6xl mb-4">🌱</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">Join the Global Decarbonization Wave</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2 leading-relaxed">Every log entry, challenge completed, and tree saved helps create a measurable impact.</p>
            <div className="mt-6"><Link to="/register" className="btn-primary inline-flex items-center gap-2">Join the Platform Now <FiArrowRight /></Link></div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-20 border-t border-gray-200/50 dark:border-white/5">
        <div className="text-center mb-12 space-y-2">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Frequently Asked Questions</h3>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Everything you need to know about EcoGuardian.</p>
        </div>
        <div className="space-y-3">
          <FAQItem question="How is my carbon footprint calculated?" answer="EcoGuardian uses a bottom-up, activity-based approach consistent with IPCC Guidelines. For each trip we multiply distance by a mode- and vehicle-specific emission factor, then divide shared private trips by the number of occupants — so a four-person carpool counts as a quarter of the journey each. Factors resolve from the most specific data available: your declared CO₂ per km, then vehicle category, then fuel efficiency, then a generic mode average." />
          <FAQItem question="What is the Mobility Twin simulator?" answer="The Mobility Twin lets you model 'what-if' commute changes before making them. You can simulate shifting car km to the metro or bus, sharing a ride with more occupants, or swapping to an EV — and see the projected daily CO₂ reduction, yearly savings, and equivalent trees needed. It runs against your most recently logged trips, so log at least one trip first." />
          <FAQItem question="How does the AI predict my future emissions?" answer="EcoGuardian trains a personalized XGBoost machine learning model on your historical carbon entries. With 30+ entries, it uses full ML predictions; with 10-30 entries, a hybrid approach; and with fewer than 10, a rolling average fallback. All predictions are explained via SHAP values." />
          <FAQItem question="What is Explainable AI (SHAP)?" answer="SHAP (SHapley Additive exPlanations) reveals which travel modes and trip patterns contribute most to your carbon footprint. It shows both the percentage contribution of each mode and the model's feature importance — so you know exactly which commutes to focus your reduction efforts on." />
          <FAQItem question="Is my data secure?" answer="Yes. Each user, department, and organization has isolated data with scoped ML models. We use JWT authentication, bcrypt password hashing, rate limiting, and role-based access control. In development, data uses an in-memory MongoDB server that resets on restart." />
          <FAQItem question="Can this be used across an entire campus or company?" answer="Absolutely. EcoGuardian supports a 4-tier role hierarchy: Super Admin manages organizations, Organization Admin manages departments and users, Faculty monitors department analytics, and members log their daily trips. Each role has its own dashboard and permissions." />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="glass rounded-3xl p-8 sm:p-16 border border-gray-200/50 dark:border-white/5 max-w-4xl mx-auto relative overflow-hidden bg-gradient-to-r from-eco-500/5 to-ocean-500/5">
          <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Ready to Monitor and Reduce Your Footprint?</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mt-4 font-medium leading-relaxed">Create a profile, access the dashboard, and begin optimizing your daily routines under SDG 13 guidelines.</p>
          <div className="mt-8">
            <GlowButton onClick={() => window.location.href = user ? '/dashboard' : '/register'}>Launch EcoGuardian</GlowButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/50 dark:border-white/5 px-6 py-12 bg-white/30 dark:bg-gray-950/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌿</span>
            <div>
              <p className="font-bold text-sm text-gray-800 dark:text-white leading-tight">EcoGuardian</p>
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
