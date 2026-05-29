import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import TwoFactorPage from '../features/auth/TwoFactorPage';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage';
import RecoverPasswordPage from '../features/auth/RecoverPasswordPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ClassesPage from '../features/classes/ClassesPage';
import StudentCalendarPage from '../features/classes/StudentCalendarPage';
import ClassDetailPage from '../features/classes/ClassDetailPage';
import PaymentsPage from '../features/payments/PaymentsPage';
import PaymentFormPage from '../features/payments/PaymentFormPage';
import DocumentsPage from '../features/documents/DocumentsPage';
import AdminDocumentsPage from '../features/documents/AdminDocumentsPage';
import AdminClassesPage from '../features/admin/AdminClassesPage';
import AdminCalendarPage from '../features/admin/AdminCalendarPage';
import AdminPaymentsPage from '../features/admin/AdminPaymentsPage';
import AdminStatsPage from '../features/admin/AdminStatsPage';
import AdminUsersPage from '../features/admin/AdminUsersPage';
import AdminSubjectsPage from '../features/admin/AdminSubjectsPage';
import SettingsPage from '../features/settings/SettingsPage';
import ProfilePage from '../features/profile/ProfilePage';
import NotFoundPage from '../features/not-found/NotFoundPage';

const AppRouter = () => {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />
      <Route
        path="/registro"
        element={
          <AuthLayout>
            <RegisterPage />
          </AuthLayout>
        }
      />
      <Route
        path="/verificacion-2fa"
        element={
          <AuthLayout>
            <TwoFactorPage />
          </AuthLayout>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <AuthLayout>
            <ForgotPasswordPage />
          </AuthLayout>
        }
      />
      <Route
        path="/recoverPassword"
        element={
          <AuthLayout>
            <RecoverPasswordPage />
          </AuthLayout>
        }
      />

      {/* Rutas protegidas */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clases"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ClassesPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendario"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clases/:classCode"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ClassDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pagos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <PaymentsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pagos/nuevo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <PaymentFormPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recursos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DocumentsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/recursos"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clases"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/calendario"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route path="/clases/calendario" element={<Navigate to="/calendario" replace />} />
      <Route
        path="/admin/clases/calendario"
        element={<Navigate to="/admin/calendario" replace />}
      />
      <Route
        path="/admin/pagos"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPaymentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pagos/estadisticas"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminStatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/usuarios"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/materias"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminSubjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <ProtectedRoute requiredRole="admin">
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Redirecciones */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
