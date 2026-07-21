import { useState, useEffect } from 'react';
import { gamificationAPI } from '../services/api';
import toast from 'react-hot-toast';

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
      toast.success(`+${data.pointsEarned} points! ${data.badge ? '🏅 Badge earned!' : ''}`);
      const [s, c] = await Promise.all([gamificationAPI.getStats(), gamificationAPI.getChallenges()]);
      setStats(s.data);
      setChallenges(c.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete challenge');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-eco-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gamification</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Earn points, badges, and compete with the community</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card text-center">
          <p className="text-4xl mb-2">🌟</p>
          <p className="text-3xl font-bold text-eco-600">{stats?.ecoScore || 0}</p>
          <p className="text-sm text-gray-500">Eco Score</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-4xl mb-2">💚</p>
          <p className="text-3xl font-bold text-ocean-600">{stats?.greenPoints || 0}</p>
          <p className="text-sm text-gray-500">Green Points</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-4xl mb-2">🔥</p>
          <p className="text-3xl font-bold text-amber-600">{stats?.streak || 0}</p>
          <p className="text-sm text-gray-500">Day Streak</p>
        </div>
      </div>

      {/* Badges */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Badges & Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(stats?.allBadges || []).map((badge) => {
            const earned = stats?.badges?.includes(badge.id);
            return (
              <div key={badge.id} className={`p-4 rounded-xl text-center transition-all ${
                earned ? 'bg-eco-50 dark:bg-eco-900/30 border border-eco-200 dark:border-eco-700' : 'bg-gray-50 dark:bg-gray-800/30 opacity-50'
              }`}>
                <p className="text-3xl mb-2">{badge.icon}</p>
                <p className="font-semibold text-sm text-gray-800 dark:text-white">{badge.name}</p>
                <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Challenges */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Weekly Challenges</h3>
        <div className="space-y-3">
          {challenges.map((c) => (
            <div key={c._id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-white">{c.title}</h4>
                <p className="text-sm text-gray-500">{c.description}</p>
                <p className="text-xs text-eco-600 mt-1">+{c.points} points · {c.category}</p>
              </div>
              {c.completed ? (
                <span className="px-3 py-1 rounded-full bg-eco-100 dark:bg-eco-900/30 text-eco-600 text-sm font-medium">✓ Done</span>
              ) : (
                <button onClick={() => completeChallenge(c._id)} className="btn-primary text-sm px-4 py-2">
                  Complete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">🏆 Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.map((u) => (
            <div key={u.rank} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  u.rank === 1 ? 'bg-amber-100 text-amber-600' :
                  u.rank === 2 ? 'bg-gray-100 text-gray-600' :
                  u.rank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
                }`}>{u.rank}</span>
                <span className="font-medium text-gray-800 dark:text-white">{u.name}</span>
              </div>
              <div className="text-sm text-gray-500">
                {u.greenPoints} pts · Score {u.ecoScore}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
