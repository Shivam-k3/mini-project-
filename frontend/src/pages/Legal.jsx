import { Link, useLocation } from 'react-router-dom';
import { FiFeather, FiArrowLeft, FiMail, FiShield } from 'react-icons/fi';

const updated = '23 July 2026';

const documents = {
  privacy: {
    eyebrow: 'Privacy notice',
    title: 'Your data, handled with care.',
    intro: 'This notice explains what EcoGuardian AI collects, why it is used, and the choices available to people using a campus sustainability workspace.',
    sections: [
      ['Information we process', [
        'Account information such as your name, user ID, institutional email address, college, department, and role.',
        'Profile and sustainability information you choose to provide, including your daily carbon goal and carbon-calculator entries.',
        'Activity information needed to provide platform features, including challenge progress, green points, reports, simulations, and AI-assistant requests.',
        'Basic session information required to keep you signed in securely. We do not ask for payment-card information.'
      ]],
      ['How we use it', [
        'To authenticate your account, deliver the requested dashboard and calculate your carbon-footprint insights.',
        'To provide aggregate campus, department, and platform analytics to the administrators authorised for your institution.',
        'To maintain security, investigate misuse, improve reliability, and respond to support requests.'
      ]],
      ['Who can see information', [
        'You can see your own profile and individual activity. Authorised faculty and college administrators may see the aggregated or student-level information their role permits.',
        'EcoGuardian AI does not sell personal information. Information is only shared with service providers needed to run the platform, or when required by applicable law.'
      ]],
      ['Retention and your choices', [
        'Your institution controls account lifecycle and retention settings. Contact your campus administrator to correct, export, or request deletion of your account data.',
        'Deleting an account may remove associated carbon entries, simulations, and participation history where permitted by your institution’s policy.'
      ]]
    ]
  },
  terms: {
    eyebrow: 'Terms of use',
    title: 'Clear rules for a trusted workspace.',
    intro: 'These terms govern access to EcoGuardian AI by students, faculty, administrators, and other authorised institutional users.',
    sections: [
      ['Using the platform', [
        'Use EcoGuardian AI only with an authorised account and for lawful sustainability, educational, or institutional purposes.',
        'Keep your credentials private. You are responsible for activity performed through your account until you report suspected unauthorised access.',
        'Do not attempt to access another person’s account, bypass role controls, disrupt the service, or upload harmful content.'
      ]],
      ['Accuracy and decision-making', [
        'Carbon estimates, forecasts, simulations, and AI responses are informational estimates. They should not be treated as regulatory, financial, medical, or professional advice.',
        'You are responsible for checking the accuracy of activity data you submit and for decisions made using reports or recommendations.'
      ]],
      ['Institutional administration', [
        'Your institution may provision, suspend, reset, or remove accounts and may set its own participation, retention, and acceptable-use requirements.',
        'Administrators must use access to student and staff data only for authorised institutional purposes.'
      ]],
      ['Service availability', [
        'We aim to keep the service available and secure, but features may change, be maintained, or be unavailable from time to time.',
        'Where permitted by law, EcoGuardian AI is provided without warranties beyond those that cannot legally be excluded.'
      ]]
    ]
  },
  security: {
    eyebrow: 'Security & data handling',
    title: 'Security designed into the workflow.',
    intro: 'EcoGuardian AI uses role-aware access controls and protective account practices to reduce unnecessary exposure of campus sustainability data.',
    sections: [
      ['How accounts are protected', [
        'Passwords are stored as one-way hashes; the application never stores a readable copy of a password.',
        'Authenticated requests use time-limited signed tokens, and protected areas require both a valid session and an authorised role.',
        'First-login password changes, account status controls, and administrator-managed resets help institutions manage access.'
      ]],
      ['Data boundaries', [
        'Student, faculty, college administrator, and super administrator roles have distinct access boundaries.',
        'Campus and department analytics are scoped to the institution or department assigned to the authorised user.'
      ]],
      ['Your part', [
        'Use a unique password, sign out from shared devices, and report a suspected compromise to your campus administrator promptly.',
        'Do not include sensitive personal, health, financial, or confidential institutional information in carbon-entry notes or AI-assistant messages.'
      ]],
      ['Report a concern', [
        'If you believe data has been exposed, an account is compromised, or a feature behaves unexpectedly, contact your institution’s EcoGuardian administrator with the relevant account and time details.',
        'Security reports should include enough detail to reproduce the issue, but never include passwords or access tokens.'
      ]]
    ]
  },
  cookies: {
    eyebrow: 'Cookie & session notice',
    title: 'A minimal approach to session storage.',
    intro: 'EcoGuardian AI uses essential browser storage to remember an authenticated session and your chosen interface theme.',
    sections: [
      ['What is stored', [
        'An authentication token is stored in your browser after a successful sign-in so protected pages can recognise your session.',
        'Your selected light or dark theme may be stored locally so the interface opens in your preferred appearance.'
      ]],
      ['What we do not use', [
        'The application does not rely on advertising, behavioural profiling, or third-party marketing cookies for the core service.',
        'You can clear local browser storage at any time. Doing so signs you out and resets local interface preferences.'
      ]]
    ]
  }
};

export default function Legal() {
  const location = useLocation();
  const key = location.pathname.split('/').pop();
  const document = documents[key] || documents.privacy;

  return (
    <main className="legal-page">
      <header className="legal-nav">
        <Link to="/login" className="legal-brand"><FiFeather size={18} /> EcoGuardian AI</Link>
        <Link to="/login" className="legal-back"><FiArrowLeft size={15} /> Back to sign in</Link>
      </header>

      <article className="legal-document">
        <div className="legal-icon"><FiShield size={22} /></div>
        <p className="legal-eyebrow">{document.eyebrow}</p>
        <h1>{document.title}</h1>
        <p className="legal-intro">{document.intro}</p>
        <p className="legal-updated">Last updated: {updated}</p>

        <div className="legal-content">
          {document.sections.map(([heading, paragraphs]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <ul>{paragraphs.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}</ul>
            </section>
          ))}
        </div>

        <aside className="legal-contact">
          <FiMail size={18} />
          <div><strong>Questions about this notice?</strong><p>Contact your campus EcoGuardian administrator for account, privacy, or access requests.</p></div>
        </aside>
      </article>

      <footer className="legal-footer">
        <Link to="/legal/privacy">Privacy</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/security">Security</Link><Link to="/legal/cookies">Session notice</Link>
      </footer>
    </main>
  );
}
