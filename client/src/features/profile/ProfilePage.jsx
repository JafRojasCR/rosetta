import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Mail,
  Phone,
  Shield,
  ArrowLeft,
  Save,
  Trash2,
  Lock,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const ProfilePage = () => {
  const { user, role, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const [form, setForm] = useState({
    name: '',
    lastName: '',
    phone: '',
  });
  const [passwords, setPasswords] = useState({
    new: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState({
    new: false,
    confirm: false,
  });
  const [showPasswordGuidelines, setShowPasswordGuidelines] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  const passwordBoxRef = useRef(null);
  const [deleteModalMounted, setDeleteModalMounted] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const deletePhrase = 'borrar mi cuenta';
  const passwordsMatch = passwords.new.length > 0 && passwords.new === passwords.confirm;
  const isPasswordStrong = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  const roleLabel = useMemo(() => {
    const resolvedRole = String(role || user?.role || (user?.isAdmin ? 'admin' : 'student')).toLowerCase();
    if (resolvedRole === 'admin' || resolvedRole === 'administrator') return 'ADMINISTRADOR';
    return 'ESTUDIANTE';
  }, [role, user]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setForm({
      name: user?.name || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    });
  }, [user]);

  const handleProfileChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setProfileError('');
    setPasswordError('');
    setSavingAll(true);

    const hasPasswordInput = passwords.new.length > 0 || passwords.confirm.length > 0;

    if (hasPasswordInput) {
      if (!passwords.new || !passwords.confirm) {
        setSavingAll(false);
        return setPasswordError('Completa ambos campos de contraseña');
      }
      if (passwords.new !== passwords.confirm) {
        setSavingAll(false);
        return setPasswordError('Las contraseñas no coinciden');
      }
      if (!isPasswordStrong(passwords.new)) {
        setSavingAll(false);
        return setPasswordError(
          'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula y número.'
        );
      }
    }

    try {
      const response = await api.put('/admin/profile', form);
      updateUser(response.data.data);

      if (hasPasswordInput) {
        await api.put('/auth/change-password', { newPassword: passwords.new });
        setPasswords({ new: '', confirm: '' });
        openSuccessModal('Perfil y contraseña actualizados correctamente.');
      } else {
        openSuccessModal('Tu perfil se actualizó correctamente.');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error al guardar cambios';
      if (hasPasswordInput && err.config?.url?.includes('/auth/change-password')) {
        setPasswordError(message);
      } else {
        setProfileError(message);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (deleteInput !== deletePhrase) return;

    setProfileError('');
    setDeletingAccount(true);

    try {
      await api.delete('/admin/profile');
      logout();
      navigate('/login');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Error al eliminar la cuenta');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openDeleteModal = () => {
    setDeleteModalMounted(true);
    requestAnimationFrame(() => setDeleteModalVisible(true));
  };

  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setTimeout(() => {
      setDeleteModalMounted(false);
      setDeleteInput('');
    }, 220);
  };

  const openSuccessModal = (message) => {
    setSuccessModal({ open: true, message });
    setTimeout(() => setSuccessModal({ open: false, message: '' }), 1800);
  };

  const handlePasswordFocus = () => {
    setShowPasswordGuidelines(true);
  };

  const handlePasswordBlur = (event) => {
    const nextFocusTarget = event.relatedTarget;
    if (passwordBoxRef.current?.contains(nextFocusTarget)) return;
    setShowPasswordGuidelines(false);
  };

  return (
    <div
      className={`w-full bg-gray-100 font-['Poppins'] rounded-3xl overflow-x-hidden transition-opacity duration-500 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">Mi Perfil</h1>
        </div>

        <button
          className="bg-red-50 text-red-500 hover:bg-red-100 w-11 h-11 sm:w-auto sm:h-auto sm:px-5 py-0 sm:py-2.5 rounded-full sm:rounded-xl font-semibold transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
          onClick={handleLogout}
          type="button"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </button>
      </nav>

      <div className="flex-grow flex flex-col items-center px-4 sm:px-6 py-10">
        <div className="max-w-3xl w-full space-y-8">
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-row items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 rounded-2xl sm:rounded-[2rem] flex items-center justify-center text-blue-600 flex-shrink-0">
              <User className="w-8 h-8 sm:w-12 sm:h-12" strokeWidth={2.5} />
            </div>
            <div className="text-left min-w-0">
              <h2 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">
                {form.name} {form.lastName}
              </h2>
              <div className="mt-2 inline-flex items-center bg-blue-600 text-white font-black text-[10px] sm:text-xs tracking-widest uppercase px-3 sm:px-5 py-1 sm:py-1.5 rounded-full shadow-lg shadow-blue-100">
                {roleLabel}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-8 tracking-tight flex items-center gap-3">
              <Shield className="text-blue-600" size={28} />
              Información Personal
            </h3>

            {profileError && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm font-semibold">
                {profileError}
              </div>
            )}

            <form className="space-y-8" onSubmit={handleSaveAll}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleProfileChange}
                    className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleProfileChange}
                    className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-gray-100 text-gray-500 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-3.5 font-semibold outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Número de teléfono
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleProfileChange}
                    className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl pl-12 pr-5 py-3.5 font-semibold transition-all outline-none"
                  />
                </div>
              </div>

              <div className="w-full h-px bg-gray-100" />

              <div className="space-y-6">
                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Lock size={20} className="text-blue-600" />
                  Seguridad
                </h4>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm font-semibold">
                    {passwordError}
                  </div>
                )}

                <div ref={passwordBoxRef} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.new ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={passwords.new}
                        onFocus={handlePasswordFocus}
                        onBlur={handlePasswordBlur}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 pr-12 py-3.5 font-semibold transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {showPassword.new ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                      Verificar Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.confirm ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={passwords.confirm}
                        onFocus={handlePasswordFocus}
                        onBlur={handlePasswordBlur}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        className={`w-full bg-gray-50 border-2 focus:bg-white rounded-2xl px-5 pr-20 py-3.5 font-semibold transition-all outline-none ${
                          passwords.confirm && (passwordsMatch ? 'border-emerald-500' : 'border-red-400')
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {showPassword.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                      {passwordsMatch && (
                        <CheckCircle2
                          size={20}
                          className="absolute right-11 top-1/2 -translate-y-1/2 text-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  <div
                    className={`sm:col-span-2 text-left bg-blue-50/70 border border-blue-100 rounded-2xl px-4 text-sm text-blue-900 overflow-hidden transform transition-all duration-200 ${
                      showPasswordGuidelines
                        ? 'max-h-40 py-3 opacity-100 translate-y-0'
                        : 'max-h-0 py-0 opacity-0 -translate-y-1 pointer-events-none'
                    }`}
                  >
                    <div>
                      <p className="font-semibold flex items-center gap-2 mb-1">
                        <Info size={16} className="text-blue-600" />
                        Recomendaciones de contraseña
                      </p>
                      <ul className="space-y-1 text-blue-900/90">
                        <li>• La contraseña debe tener al menos 8 caracteres.</li>
                        <li>• Debe incluir al menos una letra mayúscula, una minúscula y un número.</li>
                        <li>• Se recomienda agregar símbolos para reforzar la seguridad.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingAll}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Save size={20} />
                  {savingAll ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-red-50/50 rounded-[2.5rem] p-8 sm:p-10 border border-red-100 shadow-sm">
            <h3 className="text-2xl font-extrabold text-red-600 mb-6 tracking-tight flex items-center gap-3">
              <Trash2 size={28} />
              Zona de Peligro
            </h3>
            <p className="text-red-900/60 font-medium mb-8 leading-relaxed">
              Si eliminas tu cuenta, todos tus datos, progreso y documentos asociados al Proyecto
              Rosetta se perderán permanentemente.
            </p>
            <button
              onClick={openDeleteModal}
              className="w-full flex items-center justify-center gap-3 p-5 bg-white rounded-2xl border border-red-200 text-red-600 font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
              type="button"
            >
              Eliminar cuenta
            </button>
          </div>
        </div>
      </div>

      {deleteModalMounted && (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-all duration-200 ${
            deleteModalVisible ? 'bg-gray-900/60 backdrop-blur-sm opacity-100' : 'bg-gray-900/0 opacity-0'
          }`}
          onClick={closeDeleteModal}
        >
          <div
            className={`bg-white rounded-[3rem] p-8 sm:p-12 max-w-lg w-full shadow-2xl transform transition-all duration-200 ${
              deleteModalVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 w-16 h-16 rounded-3xl flex items-center justify-center text-red-500 mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
              ¿Estás completamente seguro?
            </h3>
            <p className="text-gray-500 font-medium mb-8 leading-relaxed">
              Esta acción no se puede deshacer. Para confirmar, por favor escribe{' '}
              <span className="text-red-600 font-bold italic">borrar mi cuenta</span> abajo.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-6">
              <input
                type="text"
                placeholder='Escribe "borrar mi cuenta"'
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 focus:border-red-500 focus:bg-white rounded-2xl px-6 py-4 font-bold transition-all outline-none"
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={deleteInput !== deletePhrase || deletingAccount}
                  className={`flex-grow py-4 rounded-2xl font-black transition-all ${
                    deleteInput === deletePhrase && !deletingAccount
                      ? 'bg-red-600 text-white shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {deletingAccount ? 'Eliminando...' : 'Confirmar Eliminación'}
                </button>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {successModal.open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-emerald-100 text-center">
            <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">¡Actualización exitosa!</h3>
            <p className="mt-3 text-gray-500 font-medium">{successModal.message}</p>
          </div>
        </div>
      )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default ProfilePage;
