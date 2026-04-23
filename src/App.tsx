import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ReportProvider } from './contexts/ReportContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CalendarView } from './pages/Calendar';
import { CreateEvent } from './pages/CreateEvent';
import { EditEvent } from './pages/EditEvent';
import { EventDetails } from './pages/EventDetails';
import { AdminPanel } from './pages/AdminPanel';
import { PrivateDashboard } from './pages/PrivateDashboard';
import { isSuperAdmin, isBoss, isDiretoria } from './lib/permissions';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="events/create" element={<CreateEvent />} />
        <Route path="events/:id" element={<EventDetails />} />
        <Route path="events/:id/edit" element={<EditEvent />} />

        {/* Rotas de Admin - apenas super admins */}
        <Route path="admin" element={
          <AdminRoute>
            <AdminPanel />
          </AdminRoute>
        } />

        {/* Dashboard Privado - apenas o patrão */}
        <Route path="private-dashboard" element={
          <BossRoute>
            <PrivateDashboard />
          </BossRoute>
        } />
      </Route>
    </Routes>
  );
}

// Componente para proteger rotas de Admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin(user.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Componente para proteger rota do patrão e diretoria
function BossRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6f0f]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Permite proprietários ou diretoria acessarem a agenda pessoal
  if (!isBoss(user.email) && !isDiretoria(user)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}


export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReportProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ReportProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
