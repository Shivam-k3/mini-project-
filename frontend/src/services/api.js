import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const carbonAPI = {
  create: (data) => api.post('/carbon', data),
  getAll: (params) => api.get('/carbon', { params }),
  getDashboard: () => api.get('/carbon/dashboard'),
  delete: (id) => api.delete(`/carbon/${id}`),
};

export const simulatorAPI = {
  getScenarios: () => api.get('/simulator/scenarios'),
  simulate: (data) => api.post('/simulator/simulate', data),
  getHistory: () => api.get('/simulator/history'),
};

export const aiAPI = {
  chat: (message) => api.post('/ai/chat', { message }),
};

export const gamificationAPI = {
  getStats: () => api.get('/gamification/stats'),
  getChallenges: () => api.get('/gamification/challenges'),
  completeChallenge: (id) => api.post(`/gamification/challenges/${id}/complete`),
  getLeaderboard: () => api.get('/gamification/leaderboard'),
};

export const reportsAPI = {
  downloadPDF: () => api.get('/reports/pdf', { responseType: 'blob' }),
};

export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  getAnalytics: () => api.get('/admin/analytics'),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  exportData: () => api.get('/admin/export', { responseType: 'blob' }),
};

export default api;
