import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { carbonAPI, gamificationAPI, collegeAdminAPI, facultyAPI, superAdminAPI } from '../services/api';
import StatCard from '../components/StatCard';
import { EmissionPieChart, TrendLineChart, ShapBarChart } from '../components/Charts';
import {
  FiPlusCircle, FiCpu, FiMessageCircle, FiArrowRight,
  FiUsers, FiShield, FiZap,
} from 'react-icons/fi';

/* ── Shared loading spinner ─────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center h-80">
      <span className="w-8 h-8 rounded-full border-2 border-eco-200 border-t-eco-600 animate-spin" />
    </div>
  );
}

/* ── Page title block ───────────────────────────────────── */
function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display font-black text-2xl text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'super_admin':   return <SuperAdminDashboard />;
    case 'college_admin': return <CollegeAdminDashboard />;
    case 'faculty':       return <FacultyDashboard />;
    default:              return <StudentDashboard />;
  }
}

// ─────────────────────────────────────────────────────────
// 1. STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────
function StudentDashboard() {
  const [data, setData]               = useState(null);
  const [stats, setStats]             = useState(null);
  const [recentEntries, setRecent]    = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      carbonAPI.getDashboard(),
      gamificationAPI.getStats(),
      carbonAPI.getAll({ limit: 4 }),
    ])
      .then(([dash, gam, entries]) => {
        setData(dash.data);
        setStats(gam.data);
        setRecent(entries.data?.entries || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const shap        = data?.shapExplanation;
  const predictions = data?.predictions;

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="My Climate Dashboard"
        subtitle="Track your footprint, run simulations, and monitor AI predictions."
        actions={
          <>
            <Link to="/calculator" className="btn-primary text-xs py-2 px-4">
              <FiPlusCircle size={13} /> Log Footprint
            </Link>
            <Link to="/simulator" className="btn-secondary text-xs py-2 px-4">
              <FiCpu size={13} /> Run Simulation
            </Link>
            <Link to="/assistant" className="btn-secondary text-xs py-2 px-4">
              <FiMessageCircle size={13} /> Ask AI
            </Link>
          </>
        }
      />

      {/* ── KPI row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="☀️" label="Today"      value={data?.daily   || 0} unit="kg CO₂" color="eco"    />
        <StatCard icon="📅" label="This Week"  value={data?.weekly  || 0} unit="kg CO₂" color="ocean"  />
        <StatCard icon="📊" label="This Month" value={data?.monthly || 0} unit="kg CO₂" color="purple" />
        <StatCard icon="🌍" label="All Time"   value={data?.total   || 0} unit="kg CO₂" color="amber"  />
      </div>

      {/* ── Eco Score + ML Predictions ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Eco Score ring */}
        <div className="card flex flex-col items-center justify-between text-center gap-4">
          <p className="section-label">Eco Score Index</p>
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
                className="text-gray-100 dark:text-gray-800" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke="#22c55e"
                strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(stats?.ecoScore || 0) * 2.51} 251`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="kpi-value text-2xl">{stats?.ecoScore || 0}</span>
              <span className="kpi-label text-[9px]">/ 100</span>
            </div>
          </div>
          <div className="flex gap-6 text-xs w-full justify-center">
            <div className="text-center">
              <p className="font-black text-eco-600 dark:text-eco-400 text-base">{stats?.greenPoints || 0}</p>
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Green Points</p>
            </div>
            <div className="text-center">
              <p className="font-black text-amber-500 text-base">🔥 {stats?.streak || 0}</p>
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Day Streak</p>
            </div>
          </div>
        </div>

        {/* ML Predictions */}
        <div className="card lg:col-span-2 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiZap size={15} className="text-amber-500" />
              <p className="section-label !mb-0">ML Emission Forecasts</p>
            </div>
            {predictions?.confidence && (
              <span className="badge badge-eco">
                {(predictions.confidence * 100).toFixed(0)}% Confidence
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-eco-50 dark:bg-eco-950/40 border border-eco-100 dark:border-eco-900">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Next Week</p>
              <p className="kpi-value text-eco-600 dark:text-eco-400 mt-1 text-2xl">
                {predictions?.nextWeek || 0}
                <span className="text-xs text-gray-400 font-normal ml-1">kg CO₂</span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Next Month</p>
              <p className="kpi-value text-blue-600 dark:text-blue-400 mt-1 text-2xl">
                {predictions?.nextMonth || 0}
                <span className="text-xs text-gray-400 font-normal ml-1">kg CO₂</span>
              </p>
            </div>
          </div>

          <div className="divider !my-0" />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Trend:{' '}
              <span className={`font-bold uppercase ${
                predictions?.trend === 'decreasing' ? 'text-eco-600' :
                predictions?.trend === 'increasing' ? 'text-red-500'  : 'text-gray-500'
              }`}>{predictions?.trend || 'Stable'}</span>
            </span>
            <span className="font-mono text-[10px]">Gradient Boosting Model</span>
          </div>
        </div>
      </div>

      {/* ── Charts row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <p className="section-label">Emission Source Breakdown</p>
          {data?.categoryBreakdown && Object.keys(data.categoryBreakdown).length > 0 ? (
            <div className="max-w-[260px] mx-auto mt-2">
              <EmissionPieChart breakdown={data.categoryBreakdown} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">Log carbon entries to see sources.</p>
          )}
        </div>

        <div className="card">
          <p className="section-label">Historical Emission Trend</p>
          {data?.trend?.length > 0 ? (
            <div className="h-56 mt-2">
              <TrendLineChart trend={data.trend} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">No historical data yet.</p>
          )}
        </div>
      </div>

      {/* ── SHAP ────────────────────────────────────────── */}
      {shap && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="section-label !mb-0">Explainable AI — Attribution Insights</p>
              <p className="text-xs text-gray-400 mt-1">Transparent SHAP value attribution for your carbon footprint.</p>
            </div>
            <span className="badge badge-purple">SHAP</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-3 lg:col-span-1">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: shap.explanation }} />
              {shap.recommendations?.length > 0 && (
                <div className="p-4 rounded-xl bg-eco-50 dark:bg-eco-950/40 border border-eco-100 dark:border-eco-900">
                  <p className="text-[10px] font-bold text-eco-700 dark:text-eco-400 uppercase tracking-widest mb-2">Eco Advice</p>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {shap.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              {shap.contributions && Object.keys(shap.contributions).length > 0 && (
                <div className="h-52">
                  <ShapBarChart contributions={shap.contributions} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Activity ──────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label !mb-0">Recent Activity</p>
          <Link to="/calculator" className="text-xs text-eco-600 font-bold hover:text-eco-700 flex items-center gap-1">
            Log Entry <FiArrowRight size={13} />
          </Link>
        </div>
        {recentEntries.length > 0 ? (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {recentEntries.map((e) => (
              <div key={e._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-eco-100 dark:bg-eco-950 flex items-center justify-center text-sm">🌿</div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-white">Carbon entry logged</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(e.date).toLocaleDateString()} · {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-800 dark:text-white">{e.totalEmissions?.toFixed(2)} kg</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">CO₂ eq.</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">No activity logged yet.</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 2. FACULTY DASHBOARD
// ─────────────────────────────────────────────────────────
function FacultyDashboard() {
  const [deptStats, setDeptStats] = useState(null);
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([facultyAPI.getDeptAnalytics(), facultyAPI.getStudentsParticipation()])
      .then(([stats, studs]) => { setDeptStats(stats.data); setStudents(studs.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title={`Department Dashboard — ${deptStats?.departmentName || ''}`}
        subtitle="Monitor carbon metrics, student participation, and set department challenges."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon="🎓" label="Total Students"      value={deptStats?.studentCount    || 0} unit="Enrolled" color="eco"   />
        <StatCard icon="🌍" label="Dept Emissions"      value={deptStats?.totalEmissions  || 0} unit="kg CO₂"  color="amber" />
        <StatCard icon="📈" label="Avg Eco Score"       value={deptStats?.avgEcoScore     || 0} unit="Index"   color="ocean" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card">
          <p className="section-label">Department Sources</p>
          {deptStats?.categoryTotals && Object.keys(deptStats.categoryTotals).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={deptStats.categoryTotals} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">No student data yet.</p>
          )}
        </div>

        <div className="card lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label !mb-0">Student Participation Tracker</p>
            <span className="badge badge-eco">Live</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th><th>Name</th><th>Eco Score</th>
                <th>Points</th><th>Streak</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s._id}>
                  <td className="font-bold text-gray-900 dark:text-white">{s.userId}</td>
                  <td>{s.name}</td>
                  <td><span className="font-bold text-eco-600 dark:text-eco-400">{s.ecoScore}</span></td>
                  <td className="font-semibold">{s.greenPoints}</td>
                  <td>🔥 {s.streak} days</td>
                  <td>
                    <span className={s.loggedThisWeek ? 'badge badge-eco' : 'badge badge-amber'}>
                      {s.loggedThisWeek ? 'Active' : 'Inactive 7d+'}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No students in your department.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 3. COLLEGE ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────
function CollegeAdminDashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    collegeAdminAPI.getCampusAnalytics()
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const deptEmissions = {};
  stats?.deptComparison?.forEach(d => { deptEmissions[d.department] = d.emissions; });

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Campus Administration Dashboard"
        subtitle="Campus carbon footprint, student participation, and department rankings."
        actions={
          <Link to="/admin" className="btn-primary text-xs py-2 px-4">
            <FiShield size={13} /> Admin Workspace
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🏫" label="Eco Score"         value={stats?.campusEcoScore          || 0} unit="Campus Avg"  color="eco"    />
        <StatCard icon="🌍" label="Campus Emissions"  value={stats?.campusEmissions?.toFixed(1) || 0} unit="kg CO₂" color="amber"  />
        <StatCard icon="📉" label="Reduction Rate"    value={stats?.monthlyReduction         || 0} unit="% Month"   color="ocean"  />
        <StatCard icon="👥" label="Total Users"       value={(stats?.totalStudents || 0) + (stats?.totalFaculty || 0)} unit="Provisioned" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card">
          <p className="section-label">Dept Carbon Distribution</p>
          {Object.keys(deptEmissions).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={deptEmissions} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">No departments logged yet.</p>
          )}
        </div>

        <div className="card lg:col-span-2 space-y-5">
          {/* Dept Stats */}
          <div>
            <p className="section-label">Department Sustainability Stats</p>
            <div className="space-y-2">
              {stats?.deptComparison?.map((d, i) => (
                <div key={d.department} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-eco-50 dark:hover:bg-eco-950/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-eco-100 dark:bg-eco-950 text-eco-600 dark:text-eco-400 flex items-center justify-center text-[11px] font-black">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-white">{d.name}</p>
                      <p className="text-[10px] text-gray-400">{d.userCount} Students</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-800 dark:text-white">{d.emissions?.toFixed(1)} kg</p>
                    <p className="text-[10px] text-gray-400">CO₂</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Top Students */}
          <div>
            <p className="section-label">Top Sustainable Students</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stats?.topContributors?.map((c, i) => (
                <div key={c.userId} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-eco-50 dark:bg-eco-950/40 border border-eco-100 dark:border-eco-900">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-eco-600">#{i + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-white leading-none">{c.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.userId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-eco-600 dark:text-eco-400">{c.points} pts</p>
                    <p className="text-[10px] text-gray-400">Score: {c.ecoScore}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 4. SUPER ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────
function SuperAdminDashboard() {
  const [globalStats,    setGlobalStats]    = useState(null);
  const [collegeRankings, setCollegeRankings] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    Promise.all([superAdminAPI.getGlobalAnalytics(), superAdminAPI.getCollegesCompare()])
      .then(([stats, ranking]) => { setGlobalStats(stats.data); setCollegeRankings(ranking.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const collegeEmissions = {};
  collegeRankings?.comparisons?.forEach(c => { collegeEmissions[c.code] = c.emissions; });

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Platform Super Administration"
        subtitle="Global carbon statistics, college comparison ranking, and licensing overview."
        actions={
          <Link to="/admin" className="btn-primary text-xs py-2 px-4">
            <FiShield size={13} /> College Manager
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🏢" label="Total Colleges"       value={globalStats?.totalColleges             || 0} unit="Registered" color="eco"    />
        <StatCard icon="👥" label="Total Students"       value={globalStats?.totalStudents             || 0} unit="Active"     color="purple" />
        <StatCard icon="🎓" label="Total Faculty"        value={globalStats?.totalFaculty              || 0} unit="Active"     color="ocean"  />
        <StatCard icon="🌍" label="Platform Emissions"   value={globalStats?.totalCarbonEmissions?.toFixed(1) || 0} unit="kg CO₂" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card">
          <p className="section-label">Emissions per College</p>
          {Object.keys(collegeEmissions).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={collegeEmissions} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-16">No colleges or logging activity yet.</p>
          )}
        </div>

        <div className="card lg:col-span-2 overflow-x-auto">
          <p className="section-label mb-4">Top 10 Sustainable Colleges</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th><th>Code</th><th>Name</th>
                <th>Users</th><th>Carbon (kg)</th><th>Eco Score</th>
              </tr>
            </thead>
            <tbody>
              {collegeRankings?.topColleges?.map((c, i) => (
                <tr key={c.collegeId}>
                  <td className="font-black text-gray-900 dark:text-white">#{i + 1}</td>
                  <td><span className="font-bold text-eco-600 dark:text-eco-400">{c.code}</span></td>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.userCount}</td>
                  <td>{c.emissions?.toFixed(1)}</td>
                  <td><span className="badge badge-eco">{c.ecoScore}</span></td>
                </tr>
              ))}
              {collegeRankings?.topColleges?.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No colleges provisioned yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
