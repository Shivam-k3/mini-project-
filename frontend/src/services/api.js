import axios from 'axios';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // Prefer the live Supabase session access token; fall back to a stored token
  // for legacy/rollback builds that predate Supabase.
  let token = null;
  if (isSupabaseConfigured()) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || null;
  }
  if (!token) token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (isSupabaseConfigured()) {
        supabase.auth.signOut().catch(() => {});
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const superAdminAPI = {
  getColleges: () => api.get('/superadmin/colleges'),
  createCollege: (data) => api.post('/superadmin/colleges', data),
  updateCollege: (id, data) => api.put(`/superadmin/colleges/${id}`, data),
  deleteCollege: (id) => api.delete(`/superadmin/colleges/${id}`),
  provisionAdmin: (id, data) => api.post(`/superadmin/colleges/${id}/admin`, data),
  getGlobalAnalytics: () => api.get('/superadmin/analytics/global'),
  getCollegesCompare: () => api.get('/superadmin/analytics/colleges-compare'),
  getAnnouncements: () => api.get('/superadmin/announcements'),
  createAnnouncement: (data) => api.post('/superadmin/announcements', data),
};

export const collegeAdminAPI = {
  getDepartments: () => api.get('/collegeadmin/departments'),
  createDepartment: (data) => api.post('/collegeadmin/departments', data),
  updateDepartment: (id, data) => api.put(`/collegeadmin/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/collegeadmin/departments/${id}`),
  getUsers: (params) => api.get('/collegeadmin/users', { params }),
  createUser: (data) => api.post('/collegeadmin/users', data),
  updateUser: (id, data) => api.put(`/collegeadmin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/collegeadmin/users/${id}`),
  resetPassword: (id) => api.post(`/collegeadmin/users/${id}/reset-password`),
  importStudents: (csvText) => api.post('/collegeadmin/users/import-csv', { csvText }),
  getCampusAnalytics: () => api.get('/collegeadmin/analytics/campus'),
  getChallenges: () => api.get('/collegeadmin/challenges'),
  createChallenge: (data) => api.post('/collegeadmin/challenges', data),
};

export const facultyAPI = {
  getDeptAnalytics: () => api.get('/faculty/analytics/department'),
  getStudentsParticipation: () => api.get('/faculty/students/participation'),
  getChallenges: () => api.get('/faculty/challenges'),
  createChallenge: (data) => api.post('/faculty/challenges', data),
};

export const carbonAPI = {
  create: (data) => api.post('/carbon', data),
  getAll: (params) => api.get('/carbon', { params }),
  getDashboard: () => api.get('/carbon/dashboard'),
  delete: (id) => api.delete(`/carbon/${id}`),
};

// Emission factors are resolved server-side (single source of truth); the
// frontend only ever asks which factor applies.
export const factorsAPI = {
  resolve: (params) => api.get('/factors/resolve', { params }),
  getModes: () => api.get('/factors/modes'),
};

export const simulatorAPI = {
  getScenarios: () => api.get('/simulator/scenarios'),
  simulate: (data) => api.post('/simulator/simulate', data),
  getHistory: () => api.get('/simulator/history'),
};

export const twinAPI = {
  get: () => api.get('/twin'),
  refresh: () => api.post('/twin/refresh'),
  getReplacements: () => api.get('/twin/replacements'),
  saveScenario: (data) => api.post('/twin/scenarios', data),
  deleteScenario: (id) => api.delete(`/twin/scenarios/${id}`),
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

export default api;
