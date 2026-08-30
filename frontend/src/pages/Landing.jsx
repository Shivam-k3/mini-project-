import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FiArrowRight, FiCpu, FiMessageCircle, FiTrendingUp,
  FiAward, FiFileText, FiSun, FiMoon, FiNavigation, FiSliders,
  FiLayers,   FiUsers, FiShield, FiMapPin, FiActivity, FiBarChart2,
  FiUser, FiCheck
} from 'react-icons/fi';
import FAQItem from '../components/FAQItem';

const fade = (reduceMotion) => reduceMotion
  ? { initial: false }
  : {
      initial: { opacity: 0, y: 20 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true },
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    };

const features = [
  {
    icon: FiNavigation,
    title: 'Trip Logger',
    desc: 'Log every journey by mode, distance, vehicle and occupancy. Track a daily, weekly and monthly personal footprint from the modes you actually use.',
  },
  {
    icon: FiLayers,
    title: 'Personal Mobility Twin',
    desc: 'A continuously refreshed profile of your travel behaviour: baseline footprint, mode mix, vehicle profile and occupancy pattern across your logged window.',
  },
  {
    icon: FiCpu,
    title: 'Explainable AI (SHAP)',
    desc: 'See exactly which modes and trip patterns drive your emissions. Shapley values reveal each mode\'s contribution percentage and the model\'s feature importance.',
  },
  {
    icon: FiTrendingUp,
    title: 'ML Forecasts',
    desc: 'A personalized XGBoost model predicts your next-week and next-month emissions. With less history it falls back to a rolling-average hybrid so predictions stay meaningful.',
  },
  {
    icon: FiSliders,
    title: 'Scenario Simulator',
    desc: 'Model what-if changes before making them. Shift car km to metro or bus, share rides, or swap to an EV, and see the projected daily reduction and yearly savings.',
  },
  {
    icon: FiMessageCircle,
    title: 'AI Mobility Assistant',
    desc: 'A mobility-domain assistant that answers questions about trip emissions, travel modes, carpooling and EV swaps, grounded in your logged activity.',
  },
  {
    icon: FiAward,
    title: 'Challenges & Progress',
    desc: 'Earn points, build streaks and unlock badges for mobility choices, with your progress tracked against your own footprint over time.',
  },
  {
    icon: FiFileText,
    title: 'Reports',
    desc: 'Generate a downloadable PDF breakdown of your mobility emissions, mode mix and trends for personal review or organization reporting.',
  },
];

const steps = [
  {
    icon: FiMapPin,
    title: 'Log your journeys',
    desc: 'Enter trips by mode, distance, vehicle and occupancy. Emission factors resolve from the most specific data available: your vehicle, category or mode average.',
  },
  {
    icon: FiLayers,
    title: 'Build your Twin',
    desc: 'Your travel behaviour becomes a Mobility Twin: a baseline profile of your footprint, mode mix and occupancy across your logged window.',
  },
  {
    icon: FiCpu,
    title: 'Understand with AI',
    desc: 'A personalized model predicts what comes next and SHAP explains which modes matter most, so reductions are targeted, not guesswork.',
  },
  {
    icon: FiSliders,
    title: 'Simulate and act',
    desc: 'Compare realistic commute changes and see projected savings before you commit, then make mobility decisions you can measure.',
  },
];

const individualTools = [
  'Personal footprint by mode and trip',
  'Mobility Twin with baseline & scenarios',
  'Personalized predictions and SHAP explanations',
  'Mobility domain AI assistant',
  'Downloadable emission reports',
];

const orgTools = [
  'Multi-tier roles: faculty, admins, members',
  'Department and campus-wide aggregated analytics',
  'Role-based access with tenant isolation',
  'Fleet and mode distribution reporting',
];

export default function Landing() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const reduceMotion = useReducedMotion();

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

  return (
    <div className="min-h-screen bg-surface-1 dark:bg-ink-950 text-ink-800 dark:text-ink-200 transition-colors duration-300">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-ink-950/90 backdrop-blur border-b border-ink-200/70 dark:border-ink-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-ink-900 dark:bg-ink-800 flex items-center justify-center text-eco-500">
            <FiNavigation size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-ink-900 dark:text-white leading-tight truncate">EcoGuardian</h1>
            <p className="hidden sm:block text-[10px] text-eco-700 dark:text-eco-400 font-semibold uppercase tracking-wider">Personal Mobility Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="p-2 sm:p-2.5 rounded-lg border border-ink-200 dark:border-ink-800 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors text-ink-500 dark:text-ink-400"
          >
            {dark ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap">Dashboard <FiArrowRight size={15} className="hidden sm:inline" /></Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex btn-secondary px-4 py-2 text-sm whitespace-nowrap">Sign In</Link>
              <Link to="/register" className="btn-primary px-3.5 sm:px-4 py-2 text-sm flex items-center gap-1.5 whitespace-nowrap">Get Started <FiArrowRight size={15} className="hidden sm:inline" /></Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fade(reduceMotion)} className="space-y-6">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink-900 dark:text-white tracking-tight leading-[1.05]">
                Understand your travel emissions and what to do about them.
              </h2>
              <p className="text-lg text-ink-500 dark:text-ink-400 leading-relaxed max-w-xl">
                Log trips, build a personal Mobility Twin, see which modes drive your footprint, and simulate changes before you make them.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                {user ? (
                  <>
                    <Link to="/dashboard" className="btn-primary px-7 py-3.5 text-base inline-flex items-center gap-2">Open Dashboard <FiArrowRight size={17} /></Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="btn-primary px-7 py-3.5 text-base inline-flex items-center gap-2">Start tracking your mobility <FiArrowRight size={17} /></Link>
                    <Link to="/login" className="btn-secondary px-7 py-3.5 text-base">Sign In</Link>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs font-semibold text-ink-400 dark:text-ink-500">
                <span className="inline-flex items-center gap-1.5"><FiLayers size={13} className="text-eco-600 dark:text-eco-400" /> Mobility Twin</span>
                <span className="inline-flex items-center gap-1.5"><FiCpu size={13} className="text-eco-600 dark:text-eco-400" /> Explainable AI</span>
                <span className="inline-flex items-center gap-1.5"><FiSliders size={13} className="text-eco-600 dark:text-eco-400" /> What-if scenarios</span>
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink-900 dark:text-white text-sm">Your Mobility Intelligence</h3>
                  <span className="badge-eco text-[10px]">Trip &amp; Twin driven</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3">
                    <div className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-300"><FiMapPin size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 dark:text-white">Trip Logger</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">Daily, weekly &amp; monthly footprint by mode</p>
                    </div>
                    <FiActivity className="text-eco-600 dark:text-eco-400 shrink-0" size={15} />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3">
                    <div className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-300"><FiLayers size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 dark:text-white">Mobility Twin</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">Baseline, mode mix, scenarios</p>
                    </div>
                    <FiBarChart2 className="text-eco-600 dark:text-eco-400 shrink-0" size={15} />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3">
                    <div className="w-9 h-9 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-300"><FiCpu size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 dark:text-white">AI Predictions</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">Next week &amp; next month, SHAP-explained</p>
                    </div>
                    <FiTrendingUp className="text-eco-600 dark:text-eco-400 shrink-0" size={15} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-ink-200/70 dark:border-ink-800">
        <motion.div {...fade(reduceMotion)} className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-eco-700 dark:text-eco-400">Capabilities</p>
          <h3 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">A single workspace for travel emissions</h3>
          <p className="text-ink-500 dark:text-ink-400 font-medium">Everything is built around transportation: logging, understanding, predicting and improving how you move.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="card p-5 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 text-eco-700 dark:text-eco-400 flex items-center justify-center">
                <f.icon size={19} />
              </div>
              <h4 className="text-sm font-bold text-ink-900 dark:text-white">{f.title}</h4>
              <p className="text-xs text-ink-500 dark:text-ink-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-ink-200/70 dark:border-ink-800">
        <motion.div {...fade(reduceMotion)} className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-eco-700 dark:text-eco-400">Who it's for</p>
          <h3 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Built for individuals and organizations</h3>
          <p className="text-ink-500 dark:text-ink-400 font-medium">One platform, two clear tracks, so personal insights and team analytics never get mixed up.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 text-eco-700 dark:text-eco-400 flex items-center justify-center"><FiUser className="text-eco-600 dark:text-eco-400" /></div>
              <div>
                <h4 className="font-bold text-ink-900 dark:text-white text-base">For individuals</h4>
                <p className="text-xs text-ink-500 dark:text-ink-400">Understand your own commute footprint</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {individualTools.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-ink-700 dark:text-ink-300">
                  <FiCheck className="text-eco-600 dark:text-eco-400 mt-0.5 shrink-0" size={15} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-400 dark:text-ink-500 bg-ink-50 dark:bg-ink-800/40 border border-ink-200/70 dark:border-ink-800 rounded-lg p-3">
              Track all mobility modes: car, motorcycle, auto rickshaw, bus, metro, EV, bicycle, walk and flight.
            </p>
            <Link to="/register" className="btn-secondary text-sm self-start">Start tracking</Link>
          </div>

          <div className="card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 text-eco-700 dark:text-eco-400 flex items-center justify-center"><FiUsers className="text-eco-600 dark:text-eco-400" /></div>
              <div>
                <h4 className="font-bold text-ink-900 dark:text-white text-base">For organizations</h4>
                <p className="text-xs text-ink-500 dark:text-ink-400">Campus and company-wide mobility analytics</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {orgTools.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-ink-700 dark:text-ink-300">
                  <FiCheck className="text-eco-600 dark:text-eco-400 mt-0.5 shrink-0" size={15} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-400 dark:text-ink-500 bg-ink-50 dark:bg-ink-800/40 border border-ink-200/70 dark:border-ink-800 rounded-lg p-3 inline-flex items-center gap-2">
              <FiShield className="text-eco-600 dark:text-eco-400 shrink-0" size={14} />
              Role-based access and tenant-isolated data keep every organization's analytics private.
            </p>
            <Link to="/login" className="btn-secondary text-sm self-start">Sign in with your organization account</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-ink-200/70 dark:border-ink-800">
        <motion.div {...fade(reduceMotion)} className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-eco-700 dark:text-eco-400">How it works</p>
          <h3 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">From first trip to informed decision</h3>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 text-eco-700 dark:text-eco-400 flex items-center justify-center"><s.icon size={19} /></div>
                <span className="text-xs font-bold text-ink-300 dark:text-ink-600">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h4 className="text-sm font-bold text-ink-900 dark:text-white">{s.title}</h4>
              <p className="text-xs text-ink-500 dark:text-ink-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16 border-t border-ink-200/70 dark:border-ink-800">
        <div className="text-center mb-10 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-eco-700 dark:text-eco-400">FAQ</p>
          <h3 className="text-3xl font-bold text-ink-900 dark:text-white tracking-tight">Frequently asked questions</h3>
        </div>
        <div className="space-y-3">
          <FAQItem question="How is my carbon footprint calculated?" answer="EcoGuardian uses a bottom-up, activity-based approach. For each trip we multiply distance by a mode- and vehicle-specific emission factor, then divide shared private trips by the number of occupants, so a four-person carpool counts as a quarter of the journey each. Factors resolve from the most specific data available: your declared CO₂ per km, then vehicle category, then fuel efficiency, then a generic mode average." />
          <FAQItem question="What is the Mobility Twin?" answer="Your Mobility Twin is a continually refreshed profile of your travel behaviour built from your logged trips. It captures your baseline daily, weekly and monthly footprint, your breakdown by mode, your vehicle profile, and your occupancy pattern. From that baseline it can model what-if scenarios such as shifting car kilometres to the metro or bus, sharing rides, or swapping to an EV, and show the projected daily reduction and yearly savings." />
          <FAQItem question="How does the AI predict my future emissions?" answer="EcoGuardian trains a personalized XGBoost machine learning model on your historical trip entries. With 30+ entries it uses full ML predictions; with 10–30 entries it uses a hybrid approach; and with fewer than 10 it falls back to a rolling average. Every prediction is explained with SHAP values." />
          <FAQItem question="What is Explainable AI (SHAP)?" answer="SHAP (SHapley Additive exPlanations) reveals which travel modes and trip patterns contribute most to your carbon footprint. It shows both the percentage contribution of each mode and the model's feature importance, so you know exactly which commutes to focus your reduction efforts on." />
          <FAQItem question="What can the AI assistant help with?" answer="The assistant is scoped to transportation and mobility. It can explain your trip emissions, compare travel modes, and suggest carpooling or EV-swap strategies, grounded in the activity you've logged. It does not claim to track electricity, water, food or household utilities." />
          <FAQItem question="Is my data secure?" answer="Yes. Each user, department and organization has isolated data with scoped ML models, JWT authentication, bcrypt password hashing, rate limiting and role-based access control." />
          <FAQItem question="Can this be used across an entire campus or company?" answer="Yes. EcoGuardian supports a multi-tier role hierarchy: Super Admin manages organizations, Organization Admin manages departments and users, Faculty monitors department analytics, and members log their daily trips. Each role has its own dashboard and permissions, and people never see org-only tools unless their role grants them." />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-ink-200/70 dark:border-ink-800">
        <div className="card p-8 sm:p-12 text-center max-w-4xl mx-auto">
          <h3 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">
            Start with your next trip.
          </h3>
          <p className="text-ink-500 dark:text-ink-400 max-w-lg mx-auto mt-3 font-medium leading-relaxed">
            Create an individual account to log your journeys and build your Mobility Twin, or sign in with an organization account for team-wide analytics.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {user ? (
              <Link to="/dashboard" className="btn-primary px-7 py-3.5 text-base inline-flex items-center gap-2">Open Dashboard <FiArrowRight size={17} /></Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-7 py-3.5 text-base inline-flex items-center gap-2">Create your account <FiArrowRight size={17} /></Link>
                <Link to="/login" className="btn-secondary px-7 py-3.5 text-base">Sign In</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200/70 dark:border-ink-800 px-6 py-10 bg-white dark:bg-ink-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink-900 dark:bg-ink-800 flex items-center justify-center text-eco-500"><FiNavigation size={15} /></div>
            <div>
              <p className="font-bold text-sm text-ink-900 dark:text-white leading-tight">EcoGuardian</p>
              <p className="text-[10px] text-ink-400">Personal Mobility Intelligence</p>
            </div>
          </div>
          <div className="flex gap-6 text-xs font-semibold text-ink-500 dark:text-ink-400">
            <Link to="/login" className="hover:text-eco-600 dark:hover:text-eco-400 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-eco-600 dark:hover:text-eco-400 transition-colors">Register</Link>
            <Link to="/legal/privacy" className="hover:text-eco-600 dark:hover:text-eco-400 transition-colors">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-eco-600 dark:hover:text-eco-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
