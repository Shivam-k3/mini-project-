import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Simulator from './pages/Simulator';
import Assistant from './pages/Assistant';
import Gamification from './pages/Gamification';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

function AppLayout() {
  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><Admin /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
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
          <Route path="/*" element={
            <ProtectedRoute><AppLayout /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
