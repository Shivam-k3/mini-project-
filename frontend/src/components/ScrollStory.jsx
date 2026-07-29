import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiCpu, FiTrendingUp, FiAward, FiGlobe } from 'react-icons/fi';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: FiGlobe,
    title: 'Measure Your Footprint',
    desc: 'Log daily activities across transport, energy, food, and water to build your carbon profile.',
    color: 'text-eco-500',
    bg: 'bg-eco-500/5',
  },
  {
    icon: FiCpu,
    title: 'AI-Powered Analysis',
    desc: 'Our XGBoost model predicts future emissions with SHAP explanations for full transparency.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/5',
  },
  {
    icon: FiTrendingUp,
    title: 'Simulate & Optimize',
    desc: 'Run digital twin simulations to test lifestyle changes before making real-world decisions.',
    color: 'text-ocean-500',
    bg: 'bg-ocean-500/5',
  },
  {
    icon: FiAward,
    title: 'Track & Compete',
    desc: 'Earn green points, unlock badges, and climb leaderboards while reducing your carbon footprint.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/5',
  },
];

export default function ScrollStory() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const stepsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      stepsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 80%',
              end: 'top 40%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      if (trackRef.current) {
        gsap.fromTo(
          trackRef.current,
          { scaleY: 0, transformOrigin: 'top center' },
          {
            scaleY: 1,
            duration: 1.5,
            ease: 'power2.inOut',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              end: 'bottom 40%',
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="max-w-4xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">How It Works</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Four steps to climate-conscious living</p>
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="absolute left-8 top-0 w-0.5 h-full bg-gradient-to-b from-eco-500 via-purple-500 to-amber-500 origin-top"
        />

        <div className="space-y-16 relative">
          {steps.map((step, i) => (
            <div
              key={i}
              ref={(el) => (stepsRef.current[i] = el)}
              className="relative pl-20"
            >
              <div className={`absolute left-4 w-9 h-9 rounded-xl ${step.bg} ${step.color} flex items-center justify-center border border-current/20`}>
                <step.icon size={16} />
              </div>
              <div className="glass-card p-6">
                <h4 className={`text-sm font-bold ${step.color} uppercase tracking-wider mb-2`}>
                  Step {i + 1}
                </h4>
                <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{step.title}</h5>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
