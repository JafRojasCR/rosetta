import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ClassesPage from '../features/classes/ClassesPage';
import ClassDetailPage from '../features/classes/ClassDetailPage';
import PaymentsPage from '../features/payments/PaymentsPage';
import PaymentFormPage from '../features/payments/PaymentFormPage';
import DocumentsPage from '../features/documents/DocumentsPage';
import ProfilePage from '../features/profile/ProfilePage';

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
        path="/documentos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DocumentsPage />
            </MainLayout>
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;
