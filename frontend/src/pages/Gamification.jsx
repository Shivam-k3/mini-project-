import { useState, useEffect } from 'react';
import { gamificationAPI } from '../services/api';
import toast from 'react-hot-toast';
import { GamificationSkeleton } from '../components/Skeleton';
import {
  FiAward, FiZap, FiCheck, FiCheckCircle, FiActivity, FiStar, FiCalendar,
  FiUsers, FiFeather, FiTrendingDown, FiNavigation, FiShield, FiSun,
} from 'react-icons/fi';

const BADGE_ICONS = {
  'first_entry': FiFeather,
  'week_streak': FiCalendar,
  'month_streak': FiStar,
  'eco_hero': FiAward,
  'carbon_cut': FiTrendingDown,
  'green_commuter': FiNavigation,
  'eco_warrior': FiShield,
  'challenge_champ': FiAward,
  'solar_pioneer': FiSun,
};

function BadgeIcon({ id }) {
  const Icon = BADGE_ICONS[id] || FiAward;
  return <Icon size={18} />;
}

export default function Gamification() {
  const [stats, setStats] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      gamificationAPI.getStats(),
      gamificationAPI.getChallenges(),
      gamificationAPI.getLeaderboard(),
    ]).then(([s, c, l]) => {
      setStats(s.data);
      setChallenges(c.data);
      setLeaderboard(l.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const completeChallenge = async (id) => {
    try {
      const { data } = await gamificationAPI.completeChallenge(id);
      toast.success(`+${data.pointsEarned} Green Points earned!${data.badge ? ' New Badge unlocked!' : ''}`);
      const [s, c] = await Promise.all([gamificationAPI.getStats(), gamificationAPI.getChallenges()]);
      setStats(s.data);
      setChallenges(c.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete challenge');
    }
  };

  if (loading) return <GamificationSkeleton />;

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">Personal Mobility Intelligence</p>
        <h1 className="text-2xl md:text-3xl font-bold text-ink-900 dark:text-white mt-1">Eco Achievements & Challenges</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-1">Earn points, unlock milestone badges, and benchmark your progress in the community.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="kpi-label !mt-0">Eco Score</p>
            <span className="w-9 h-9 rounded-lg bg-eco-100 text-eco-700 dark:bg-eco-500/15 dark:text-eco-300 flex items-center justify-center shrink-0">
              <FiStar size={16} />
            </span>
          </div>
          <p className="kpi-value">{stats?.ecoScore || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="kpi-label !mt-0">Green Points Balance</p>
            <span className="w-9 h-9 rounded-lg bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300 flex items-center justify-center shrink-0">
              <FiZap size={16} />
            </span>
          </div>
          <p className="kpi-value">{stats?.greenPoints || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="kpi-label !mt-0">Daily Logging Streak</p>
            <span className="w-9 h-9 rounded-lg bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300 flex items-center justify-center shrink-0">
              <FiCalendar size={16} />
            </span>
          </div>
          <p className="kpi-value">
            {stats?.streak || 0}
            <span className="text-sm font-medium text-ink-400 ml-1">days</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Challenges (Left 7 cols) vs Leaderboard & Badges (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side: Weekly Challenges */}
        <div className="lg:col-span-7 space-y-6">

          <div className="card">
            <h3 className="section-label !mb-5 flex items-center gap-1.5">
              <FiActivity className="text-eco-600 dark:text-eco-400" /> Active Weekly Challenges
            </h3>

            <div className="space-y-3">
              {challenges.map((c) => (
                <div key={c._id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-ink-900 dark:text-white leading-normal">{c.title}</h4>
                      <span className="badge badge-eco">{c.category}</span>
                    </div>
                    <p className="text-[11px] text-ink-500 dark:text-ink-400 leading-normal max-w-md">{c.description}</p>
                    <span className="text-[10px] text-eco-600 dark:text-eco-400 font-semibold mt-1 block">+{c.points} Green Points</span>
                  </div>

                  {c.completed ? (
                    <span className="w-8 h-8 rounded-full bg-eco-100 text-eco-700 dark:bg-eco-500/15 dark:text-eco-300 flex items-center justify-center shrink-0 select-none">
                      <FiCheckCircle size={16} />
                    </span>
                  ) : (
                    <button
                      onClick={() => completeChallenge(c._id)}
                      className="btn-accent py-1.5 px-3 text-xs font-bold select-none whitespace-nowrap"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Badges Achievements */}
          <div className="card">
            <h3 className="section-label !mb-5 flex items-center gap-1.5">
              <FiAward className="text-eco-600 dark:text-eco-400" /> Milestone Badges
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(stats?.allBadges || []).map((badge) => {
                const earned = stats?.badges?.includes(badge.id);
                return (
                  <div key={badge.id} className={`p-4 rounded-xl text-center border flex flex-col justify-between min-h-[130px] ${
                    earned
                      ? 'border-eco-200 bg-eco-50 dark:border-eco-800 dark:bg-eco-950/40'
                      : 'border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-950/40 opacity-45'
                  }`}>
                    <div>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 select-none ${
                        earned
                          ? 'bg-eco-100 text-eco-700 dark:bg-eco-500/15 dark:text-eco-300'
                          : 'bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                      }`}>
                        <BadgeIcon id={badge.id} />
                      </span>
                      <p className={`font-bold text-[11px] leading-tight ${earned ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-ink-400'}`}>{badge.name}</p>
                    </div>
                    <p className="text-[9px] text-ink-400 leading-normal mt-1">{badge.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Leaderboard */}
        <div className="lg:col-span-5">
          <div className="card">
            <h3 className="section-label !mb-5 flex items-center gap-1.5">
              <FiUsers className="text-warn-500" /> Community Leaderboard
            </h3>

            <div className="space-y-2.5">
              {leaderboard.map((u) => {
                const isTopThree = u.rank <= 3;
                return (
                  <div key={u.rank} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black select-none ${
                        u.rank === 1 ? 'bg-warn-100 text-warn-700 dark:bg-warn-500/15 dark:text-warn-300' :
                        u.rank === 2 ? 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300' :
                        u.rank === 3 ? 'bg-ocean-100 text-ocean-700 dark:bg-ocean-500/15 dark:text-ocean-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                      }`}>
                        {u.rank}
                      </span>
                      <span className="text-xs font-bold text-ink-900 dark:text-white truncate">{u.name}</span>
                    </div>
                    <div className="text-[10px] text-ink-500 dark:text-ink-400 font-semibold whitespace-nowrap">
                      <span className="text-eco-600 dark:text-eco-400">{u.greenPoints}</span> pts · <span className="text-ocean-600 dark:text-ocean-400">Score {u.ecoScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}