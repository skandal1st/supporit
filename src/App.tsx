import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { TicketsPage } from './pages/TicketsPage';
import { ConsumablesPage } from './pages/ConsumablesPage';
import { BuildingsPage } from './pages/BuildingsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Компонент для перенаправления в зависимости от роли
const RedirectRoute = () => {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === 'employee' ? '/tickets' : '/dashboard'} replace />;
};

function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/unauthorized"
          element={<UnauthorizedPage />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRoles={['admin', 'it_specialist']}>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Placeholder routes for future pages */}
        <Route
          path="/equipment"
          element={
            <ProtectedRoute requiredRoles={['admin', 'it_specialist']}>
              <Layout>
                <EquipmentPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <Layout>
                <TicketsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/consumables"
          element={
            <ProtectedRoute requiredRoles={['admin', 'it_specialist']}>
              <Layout>
                <ConsumablesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRoles={['admin', 'it_specialist']}>
              <Layout>
                <div className="p-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Отчеты
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Страница отчетов и аналитики (в разработке)
                  </p>
                </div>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Layout>
                <UsersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buildings"
          element={
            <ProtectedRoute requiredRoles={['admin', 'it_specialist']}>
              <Layout>
                <BuildingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RedirectRoute />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
