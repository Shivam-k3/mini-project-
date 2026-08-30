import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Simulator from './pages/Simulator';
import Assistant from './pages/Assistant';
import Gamification from './pages/Gamification';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import ExplainableAI from './pages/ExplainableAI';
import Landing from './pages/Landing';
import Legal from './pages/Legal';

function AppLayout() {
  // Roles with full personal mobility-tool access (spec §1/§4):
  const PERSONAL_TOOLS = ['student', 'individual', 'faculty'];
  return (
    <Layout>
      <PageTransition>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calculator" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><Calculator /></ProtectedRoute>
          } />
          <Route path="/simulator" element={
            <ProtectedRoute allowedRoles={PERSONAL_TOOLS}><Simulator /></ProtectedRoute>
          } />
          <Route path="/assistant" element={
            <ProtectedRoute allowedRoles={PERSONAL_TOOLS}><Assistant /></ProtectedRoute>
          } />
          <Route path="/gamification" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><Gamification /></ProtectedRoute>
          } />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/explainable-ai" element={
            <ProtectedRoute allowedRoles={['student', 'individual']}><ExplainableAI /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['super_admin', 'college_admin']}><Admin /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PageTransition>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/legal/privacy" element={<Legal />} />
          <Route path="/legal/terms" element={<Legal />} />
          <Route path="/legal/security" element={<Legal />} />
          <Route path="/legal/cookies" element={<Legal />} />
          <Route path="/change-password" element={
            <ProtectedRoute allowFirstLogin><ChangePassword /></ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute><AppLayout /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
