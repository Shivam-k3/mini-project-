import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { carbonAPI, gamificationAPI, collegeAdminAPI, facultyAPI, superAdminAPI } from '../services/api';
import StatCard from '../components/StatCard';
import CopyButton from '../components/CopyButton';
import { DashboardSkeleton } from '../components/Skeleton';
import { EmissionPieChart, TrendLineChart, ShapBarChart } from '../components/Charts';
import { formatMode } from '../utils/modeLabels';
import {
  FiPlusCircle, FiCpu, FiMessageCircle, FiArrowRight,
  FiSun, FiCalendar, FiTrendingUp, FiGlobe, FiZap, FiClock, FiCheck, FiUsers,
} from 'react-icons/fi';

function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Page title block ───────────────────────────────────── */
function PageHeader({ title, eyebrow, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{subtitle}</p>}
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
        setData((prev) => ({ ...prev, fetchedAt: new Date().toISOString() }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const shap        = data?.shapExplanation;
  const predictions = data?.predictions;
  const modeBreakdown = data?.modeBreakdown && Object.keys(data.modeBreakdown).length > 0
    ? data.modeBreakdown
    : (shap?.contributions && Object.keys(shap.contributions).length > 0 ? shap.contributions : null);
  const primaryMode = modeBreakdown
    ? Object.entries(modeBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        eyebrow="Personal Mobility Intelligence"
        title="My Mobility Dashboard"
        subtitle={
          <span className="flex items-center gap-1.5">
            Track your transport emissions, run simulations, and monitor AI predictions.
            {data?.fetchedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-ink-400 ml-2">
                <FiClock size={10} /> Updated {formatRelativeTime(data.fetchedAt)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Link to="/calculator" className="btn-primary text-xs py-2 px-4">
              <FiPlusCircle size={13} /> Log Trips
            </Link>
            <Link to="/twin" className="btn-secondary text-xs py-2 px-4">
              <FiCpu size={13} /> Mobility Twin
            </Link>
            <Link to="/assistant" className="btn-secondary text-xs py-2 px-4">
              <FiMessageCircle size={13} /> Ask AI
            </Link>
          </>
        }
      />

      {/* ── KPI row (transportation-only, real data) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiSun} label="Today"     value={data?.transport?.dailyPersonal   ?? data?.daily   ?? 0} unit="kg CO₂" color="eco" />
        <StatCard icon={FiCalendar} label="This Week" value={data?.transport?.weeklyPersonal  ?? data?.weekly  ?? 0} unit="kg CO₂" color="ink" />
        <StatCard icon={FiTrendingUp} label="This Month" value={data?.transport?.monthlyPersonal ?? data?.monthly ?? 0} unit="kg CO₂" color="ink" />
        <StatCard icon={FiGlobe} label="All Time" value={data?.total || 0} unit="kg CO₂" color="amber" />
      </div>

      {/* ── Eco score + ML predictions ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Eco score */}
        <div className="card flex flex-col items-center justify-between text-center gap-4">
          <p className="section-label">Eco Score</p>
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor"
                className="text-ink-100 dark:text-ink-800" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke="#2e9458"
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
          <div className="flex gap-8 text-xs w-full justify-center">
            <div className="text-center">
              <p className="font-bold text-eco-600 dark:text-eco-400 text-base">{stats?.greenPoints || 0}</p>
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-wider">Green Points</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-ink-800 dark:text-white text-base">{stats?.streak || 0}</p>
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-wider">Day Streak</p>
            </div>
          </div>
        </div>

        {/* ML predictions */}
        <div className="card lg:col-span-2 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FiZap size={15} className="text-warn-500" />
              <p className="section-label !mb-0">Transport Forecast (ML)</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {predictions?.method && (
                <span className="badge-neutral font-mono text-[9px]">{predictions.method}</span>
              )}
              {predictions?.nextWeek && (
                <CopyButton text={`Next Week: ${predictions.nextWeek} kg CO₂ | Next Month: ${predictions.nextMonth} kg CO₂`} label="Copy" />
              )}
              {predictions?.confidence && (
                <span className="badge-eco">{(predictions.confidence * 100).toFixed(0)}% Confidence</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-surface-2 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
              <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-widest">Next Week</p>
              <p className="kpi-value text-eco-600 dark:text-eco-400 mt-1 text-2xl">
                {predictions?.nextWeek || 0}
                <span className="text-xs text-ink-400 font-normal ml-1">kg CO₂</span>
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-2 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
              <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-widest">Next Month</p>
              <p className="kpi-value text-ocean-600 dark:text-ocean-400 mt-1 text-2xl">
                {predictions?.nextMonth || 0}
                <span className="text-xs text-ink-400 font-normal ml-1">kg CO₂</span>
              </p>
            </div>
          </div>

          <div className="divider !my-0" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
            <span>
              Trend:{' '}
              <span className={`font-bold uppercase ${
                predictions?.trend === 'decreasing' ? 'text-eco-600 dark:text-eco-400' :
                predictions?.trend === 'increasing' ? 'text-high-600 dark:text-high-400'  : 'text-ink-500'
              }`}>{predictions?.trend || 'Stable'}</span>
            </span>
            {primaryMode && (
              <span className="flex items-center gap-1.5">
                <FiCheck size={12} className="text-eco-600 dark:text-eco-400" />
                Primary mode: <span className="font-semibold text-ink-700 dark:text-ink-200">{formatMode(primaryMode)}</span>
              </span>
            )}
            <span className="font-mono text-[10px]">
              {predictions?.method === 'xgboost' ? 'XGBoost (v3)' :
               predictions?.method === 'hybrid' ? 'Hybrid baseline+ML' :
               predictions?.method === 'rolling_average' ? 'Rolling average' : 'Adaptive model'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Charts row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card min-w-0">
          <p className="section-label">Transport Mode Mix</p>
          {modeBreakdown ? (
            <div className="max-w-[260px] mx-auto mt-2">
              <EmissionPieChart breakdown={modeBreakdown} />
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-16">Log trips to see your mode mix.</p>
          )}
        </div>

        <div className="card min-w-0">
          <p className="section-label">Emission Trend</p>
          {data?.trend?.length > 0 ? (
            <div className="h-56 mt-2 min-w-0">
              <TrendLineChart trend={data.trend} />
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-16">No historical data yet.</p>
          )}
        </div>
      </div>

      {/* ── SHAP ───────────────────────────────────────── */}
      {shap && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-ink-100 dark:border-ink-800">
            <div>
              <p className="section-label !mb-0">Explainable AI — Attribution</p>
              <p className="text-xs text-ink-400 mt-1">Transparent SHAP value attribution for your mobility footprint.</p>
            </div>
            <span className="badge-neutral">SHAP</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-3 lg:col-span-1 min-w-0">
              <div className="p-4 rounded-lg bg-surface-2 dark:bg-ink-800 text-xs text-ink-600 dark:text-ink-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: shap.explanation }} />
              {shap.recommendations?.length > 0 && (
                <div className="p-4 rounded-lg border border-ink-200 dark:border-ink-700 bg-eco-50/50 dark:bg-eco-500/5">
                  <p className="text-[10px] font-semibold text-eco-700 dark:text-eco-400 uppercase tracking-widest mb-2">Recommendations</p>
                  <ul className="text-xs text-ink-600 dark:text-ink-300 space-y-1">
                    {shap.recommendations.map((r, i) => <li key={i} className="list-disc ml-4">{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="lg:col-span-2 min-w-0">
              {shap.contributions && Object.keys(shap.contributions).length > 0 && (
                <div className="h-52">
                  <ShapBarChart contributions={shap.contributions} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent activity ─────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label !mb-0">Recent Activity</p>
          <Link to="/calculator" className="text-xs text-eco-700 dark:text-eco-400 font-semibold hover:underline flex items-center gap-1">
            Log Entry <FiArrowRight size={13} />
          </Link>
        </div>
        {recentEntries.length > 0 ? (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {recentEntries.map((e) => (
              <div key={e._id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 shrink-0">
                    <FiTrendingUp size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-800 dark:text-white truncate">
                      {e.trips?.length ? `Trip log — ${e.trips.length} trip${e.trips.length > 1 ? 's' : ''}` : 'Carbon entry logged'}
                    </p>
                    <p className="text-[10px] text-ink-400 mt-0.5 truncate">
                      {new Date(e.date).toLocaleDateString()} · {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {e.trips?.length ? ` · ${e.trips.map((t) => formatMode(t.mode)).slice(0, 3).join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ink-800 dark:text-white">
                    {(e.transportPersonal ?? e.totalEmissions)?.toFixed(2)} kg
                  </p>
                  <p className="text-[9px] text-ink-400 uppercase tracking-wide">personal CO₂</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-400 text-sm text-center py-8">No activity logged yet.</p>
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

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        eyebrow="Faculty"
        title={`Department Dashboard — ${deptStats?.departmentName || ''}`}
        subtitle="Monitor mobility metrics, student participation, and set department challenges."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={FiUsers} label="Total Students" value={deptStats?.studentCount || 0} unit="Enrolled" color="ink" />
        <StatCard icon={FiGlobe} label="Dept Emissions" value={deptStats?.totalEmissions || 0} unit="kg CO₂" color="amber" />
        <StatCard icon={FiTrendingUp} label="Avg Eco Score" value={deptStats?.avgEcoScore || 0} unit="Index" color="eco" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card min-w-0">
          <p className="section-label">Department Sources</p>
          {deptStats?.categoryTotals && Object.keys(deptStats.categoryTotals).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={deptStats.categoryTotals} />
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-16">No student data yet.</p>
          )}
        </div>

        <div className="card lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label !mb-0">Student Participation</p>
            <span className="badge-eco">Live</span>
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
                  <td className="font-bold text-ink-900 dark:text-white">{s.userId}</td>
                  <td>{s.name}</td>
                  <td><span className="font-bold text-eco-600 dark:text-eco-400">{s.ecoScore}</span></td>
                  <td className="font-semibold">{s.greenPoints}</td>
                  <td>{s.streak} days</td>
                  <td>
                    <span className={s.loggedThisWeek ? 'badge-eco' : 'badge-amber'}>
                      {s.loggedThisWeek ? 'Active' : 'Inactive 7d+'}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-ink-400">No students in your department.</td></tr>
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

  if (loading) return <DashboardSkeleton />;

  const deptEmissions = {};
  stats?.deptComparison?.forEach(d => { deptEmissions[d.department] = d.emissions; });

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        eyebrow="Organization"
        title="Campus Administration Dashboard"
        subtitle="Campus carbon footprint, student participation, and department rankings."
        actions={
          <Link to="/admin" className="btn-primary text-xs py-2 px-4">
            <FiArrowRight size={13} /> Admin Workspace
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiTrendingUp} label="Eco Score" value={stats?.campusEcoScore || 0} unit="Campus Avg" color="eco" />
        <StatCard icon={FiGlobe} label="Campus Emissions" value={stats?.campusEmissions?.toFixed(1) || 0} unit="kg CO₂" color="amber" />
        <StatCard icon={FiTrendingUp} label="Reduction Rate" value={stats?.monthlyReduction ?? '—'} unit={stats?.monthlyReduction != null ? '% Month' : 'No data'} color="ocean" />
        <StatCard icon={FiUsers} label="Total Users" value={(stats?.totalStudents || 0) + (stats?.totalFaculty || 0)} unit="Provisioned" color="ink" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card min-w-0">
          <p className="section-label">Dept Carbon Distribution</p>
          {Object.keys(deptEmissions).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={deptEmissions} />
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-16">No departments logged yet.</p>
          )}
        </div>

        <div className="card lg:col-span-2 space-y-5">
          <div>
            <p className="section-label">Department Sustainability Stats</p>
            <div className="space-y-2">
              {stats?.deptComparison?.map((d, i) => (
                <div key={d.department} className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-2 dark:bg-ink-800 hover:border-ink-300 border border-transparent">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-800 dark:text-white truncate">{d.name}</p>
                      <p className="text-[10px] text-ink-400">{d.userCount} Students</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-ink-800 dark:text-white">{d.emissions?.toFixed(1)} kg</p>
                    <p className="text-[10px] text-ink-400">CO₂</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          <div>
            <p className="section-label">Top Sustainable Students</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stats?.topContributors?.map((c, i) => (
                <div key={c.userId} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-ink-200 dark:border-ink-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-eco-600 dark:text-eco-400">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-800 dark:text-white leading-none truncate">{c.name}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5">{c.userId}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-eco-600 dark:text-eco-400">{c.points} pts</p>
                    <p className="text-[10px] text-ink-400">Score: {c.ecoScore}</p>
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

  if (loading) return <DashboardSkeleton />;

  const collegeEmissions = {};
  collegeRankings?.comparisons?.forEach(c => { collegeEmissions[c.code] = c.emissions; });

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        eyebrow="Platform"
        title="Platform Super Administration"
        subtitle="Global carbon statistics, college comparison ranking, and licensing overview."
        actions={
          <Link to="/admin" className="btn-primary text-xs py-2 px-4">
            <FiArrowRight size={13} /> College Manager
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiGlobe} label="Total Colleges" value={globalStats?.totalColleges || 0} unit="Registered" color="eco" />
        <StatCard icon={FiUsers} label="Total Students" value={globalStats?.totalStudents || 0} unit="Active" color="ink" />
        <StatCard icon={FiUsers} label="Total Faculty" value={globalStats?.totalFaculty || 0} unit="Active" color="ocean" />
        <StatCard icon={FiTrendingUp} label="Platform Emissions" value={globalStats?.totalCarbonEmissions?.toFixed(1) || 0} unit="kg CO₂" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card min-w-0">
          <p className="section-label">Emissions per College</p>
          {Object.keys(collegeEmissions).length > 0 ? (
            <div className="max-w-[240px] mx-auto mt-2">
              <EmissionPieChart breakdown={collegeEmissions} />
            </div>
          ) : (
            <p className="text-ink-400 text-sm text-center py-16">No colleges or logging activity yet.</p>
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
                  <td className="font-bold text-ink-900 dark:text-white">#{i + 1}</td>
                  <td><span className="font-semibold text-eco-600 dark:text-eco-400">{c.code}</span></td>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.userCount}</td>
                  <td>{c.emissions?.toFixed(1)}</td>
                  <td><span className="badge-eco">{c.ecoScore}</span></td>
                </tr>
              ))}
              {collegeRankings?.topColleges?.length === 0 && (
                <tr><td colSpan="6" className="text-center py-8 text-ink-400">No colleges provisioned yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
