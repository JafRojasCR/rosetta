import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleProfileChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) =>
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setLoading(true);

    try {
      const response = await api.put('/admin/profile', form);
      updateUser(response.data.data);
      setProfileSuccess('Perfil actualizado correctamente');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setPasswordError('Las contraseñas no coinciden');
    }
    if (passwordForm.newPassword.length < 6) {
      return setPasswordError('La contraseña debe tener al menos 6 caracteres');
    }

    setLoading(true);
    try {
      // TODO: implementar endpoint PUT /api/auth/change-password con verificación de contraseña actual
      setPasswordError('Función de cambio de contraseña no disponible en esta versión.');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) {
      return;
    }
    setDeletingAccount(true);
    try {
      await api.delete('/admin/profile');
      logout();
      navigate('/login');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Error al eliminar la cuenta');
      setDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>

      {/* Información personal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Información Personal</h2>

        {profileSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">
            {profileSuccess}
          </div>
        )}
        {profileError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {profileError}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="+506 8888-8888"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Cambiar Contraseña</h2>

        {passwordSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">
            {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña actual
            </label>
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Repite la contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-gray-800 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cambiar contraseña
          </button>
        </form>
      </div>

      {/* Zona de peligro */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Zona de peligro</h2>
        <p className="text-sm text-gray-500 mb-4">
          Una vez eliminada tu cuenta, no podrás recuperar tu información.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="bg-red-50 text-red-700 border border-red-200 px-6 py-2.5 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deletingAccount ? 'Eliminando...' : 'Eliminar mi cuenta'}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
