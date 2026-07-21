import { useState, useEffect } from 'react';
import { gamificationAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiAward, FiZap, FiCheck, FiActivity } from 'react-icons/fi';

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
      toast.success(`+${data.pointsEarned} Green Points earned! ${data.badge ? '🏅 New Badge unlocked!' : ''}`);
      const [s, c] = await Promise.all([gamificationAPI.getStats(), gamificationAPI.getChallenges()]);
      setStats(s.data);
      setChallenges(c.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete challenge');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Eco Achievements & Challenges</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Earn points, unlock milestone badges, and benchmark your progress in the community.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-2xl bg-eco-500/10 text-eco-500 flex items-center justify-center text-2xl shrink-0">
            🌟
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Eco Score</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white mt-0.5">{stats?.ecoScore || 0}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-2xl bg-ocean-500/10 text-ocean-500 flex items-center justify-center text-2xl shrink-0">
            💚
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Green Points Balance</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white mt-0.5">{stats?.greenPoints || 0}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl shrink-0">
            🔥
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Daily Logging Streak</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white mt-0.5">{stats?.streak || 0} days</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Challenges (Left 7 cols) vs Leaderboard & Badges (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Weekly Challenges */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-1.5">
              <FiActivity className="text-eco-500" /> Active Weekly Challenges
            </h3>
            
            <div className="space-y-3">
              {challenges.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 hover:bg-white/80 dark:hover:bg-gray-900/85 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-800 dark:text-white leading-normal">{c.title}</h4>
                      <span className="text-[9px] bg-eco-500/10 text-eco-600 dark:text-eco-400 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        {c.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal max-w-md">{c.description}</p>
                    <span className="text-[10px] text-eco-500 font-semibold mt-1 block">+{c.points} Green Points</span>
                  </div>
                  
                  {c.completed ? (
                    <span className="w-8 h-8 rounded-full bg-eco-500/10 text-eco-600 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      <FiCheck />
                    </span>
                  ) : (
                    <button 
                      onClick={() => completeChallenge(c._id)} 
                      className="btn-primary py-1.5 px-3 text-xs font-bold select-none"
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Badges Achievements */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-1.5">
              <FiAward className="text-purple-500" /> Milestone Badges
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(stats?.allBadges || []).map((badge) => {
                const earned = stats?.badges?.includes(badge.id);
                return (
                  <div key={badge.id} className={`p-4 rounded-2xl text-center border transition-all duration-500 flex flex-col justify-between min-h-[130px] ${
                    earned 
                      ? 'bg-eco-500/5 border-eco-500/30 text-gray-800 dark:text-white shadow-md shadow-eco-500/[0.02]' 
                      : 'bg-gray-100/50 dark:bg-gray-900/10 border-gray-200/50 dark:border-white/5 opacity-40'
                  }`}>
                    <div>
                      <p className="text-3xl mb-2 filter drop-shadow-sm select-none">{badge.icon}</p>
                      <p className="font-bold text-[11px] leading-tight">{badge.name}</p>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-normal mt-1">{badge.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Side: Leaderboard */}
        <div className="lg:col-span-5">
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-1.5">
              <FiAward className="text-amber-500" /> Community Leaderboard
            </h3>
            
            <div className="space-y-2.5">
              {leaderboard.map((u) => {
                const isTopThree = u.rank <= 3;
                return (
                  <div key={u.rank} className="flex items-center justify-between p-3 rounded-xl border border-gray-200/30 dark:border-white/[0.02] bg-white/40 dark:bg-gray-900/30 hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black select-none ${
                        u.rank === 1 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                        u.rank === 2 ? 'bg-gray-150 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400' :
                        u.rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-gray-900/50 text-gray-400'
                      }`}>
                        {u.rank}
                      </span>
                      <span className="text-xs font-bold text-gray-800 dark:text-white">{u.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-semibold">
                      <span className="text-eco-500">{u.greenPoints}</span> pts · <span className="text-ocean-500">Score {u.ecoScore}</span>
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
