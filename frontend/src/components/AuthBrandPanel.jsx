import { FiActivity, FiShare2 } from 'react-icons/fi';

export default function AuthBrandPanel() {
  return (
    <section className="auth-brand-panel" aria-label="EcoGuardian introduction">
      <div className="auth-brand-overlay" />
      <div className="auth-brand-content">
        <div className="auth-mark"><img src="/leaf.svg" alt="EcoGuardian" className="w-14 h-14" /></div>
        <p className="auth-brand-name">EcoGuardian</p>
        <p className="auth-brand-kicker">Personal Mobility Intelligence</p>
        <h1>Know your transportation emissions before you move.</h1>

        <div className="auth-proof-list">
          <div className="auth-proof">
            <span><FiActivity size={15} /></span>
            <p><strong>Explainable ML</strong>Trust transparent, auditable emission forecasts — every prediction is reasoned, never a black box.</p>
          </div>
          <div className="auth-proof">
            <span><FiShare2 size={15} /></span>
            <p><strong>Mobility Twin</strong>Simulate route, mode, and schedule scenarios to see their emissions impact before you change anything.</p>
          </div>
        </div>
      </div>
      <p className="auth-version">Transport emissions analytics <b>•</b> Scenario simulation</p>
    </section>
  );
}