import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  ExternalLink,
  Database,
  HardDrive,
  Zap,
  Plus,
  Trash2,
  Lock,
  ArrowLeft,
  KeyRound,
  X,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatLastSeen = (value) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [admins, setAdmins] = useState([]);
  const [busyEmail, setBusyEmail] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    email: '',
    password: '',
  });

  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showAddAdminPassword, setShowAddAdminPassword] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdminToDelete, setSelectedAdminToDelete] = useState(null);

  const currentUserEmail = String(user?.email || '').toLowerCase();

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  const fetchAdmins = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/admin/admins');
      const normalized = (response.data.data || []).map((admin) => ({
        ...admin,
        lastSeen: formatLastSeen(admin.lastLoginAt),
      }));
      setAdmins(normalized);
    } catch (_requestError) {
      setError('No se pudieron cargar los administradores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const externalTools = useMemo(
    () => [
      {
        name: 'Google Cloud Storage',
        desc: 'Almacenamiento de archivos',
        icon: <HardDrive className="text-blue-500" />,
        url: 'https://console.cloud.google.com/storage/browser/rosetta-storage-prod;tab=objects?forceOnBucketsSortingFiltering=true&authuser=5&walkthrough_id=storage--storage_configure_cors&project=rosetta-488900&prefix=&forceOnObjectsSortingFiltering=false',
        color: 'hover:border-blue-200 hover:bg-blue-50/30',
      },
      {
        name: 'MongoDB Atlas',
        desc: 'Base de datos Cloud',
        icon: <Database className="text-emerald-500" />,
        url: 'https://cloud.mongodb.com/v2/68757f3107cb2153ed9aa94f#/explorer/693724cbad0a4d08d415dc9b',
        color: 'hover:border-emerald-200 hover:bg-emerald-50/30',
      },
      {
        name: 'Vercel',
        desc: 'Logs de despliegue',
        icon: <Zap className="text-purple-500" />,
        url: 'https://vercel.com/proyectorosetta-1708s-projects/rosetta-project',
        color: 'hover:border-purple-200 hover:bg-purple-50/30',
      },
    ],
    []
  );

  const handleOpenPassModal = (admin) => {
    setSelectedAdmin(admin);
    setNewPassword('');
    setShowUpdatePassword(false);
    setShowPassModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  const closePassModal = () => {
    setShowPassModal(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedAdminToDelete(null);
  };

  const handleDeleteAdmin = async (admin) => {
    const email = String(admin.email || '').toLowerCase();
    if (email === currentUserEmail) {
      setError('No puedes eliminar tu propia cuenta de administrador.');
      return;
    }

    setSelectedAdminToDelete(admin);
    setShowDeleteModal(true);
  };

  const confirmDeleteAdmin = async () => {
    const admin = selectedAdminToDelete;
    if (!admin?.email) {
      setShowDeleteModal(false);
      return;
    }

    const email = String(admin.email || '').toLowerCase();

    setBusyEmail(email);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/admin/admins/${encodeURIComponent(admin.email)}`);
      setAdmins((prev) => prev.filter((entry) => String(entry.email || '').toLowerCase() !== email));
      setSuccess('Administrador eliminado correctamente.');
      setShowDeleteModal(false);
      setSelectedAdminToDelete(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar el administrador.');
    } finally {
      setBusyEmail('');
    }
  };

  const handleAddAdmin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/admin/admins', {
        email: newAdminForm.email.trim(),
        password: newAdminForm.password,
      });

      const created = {
        ...(response.data.data || {}),
        lastSeen: formatLastSeen(response.data.data?.lastLoginAt),
      };
      setAdmins((prev) => [created, ...prev]);
      setSuccess('Administrador agregado correctamente.');
      setNewAdminForm({ email: '', password: '' });
      setShowAddAdminPassword(false);
      setShowAddModal(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo agregar el administrador.');
    }
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (!selectedAdmin?.email) return;

    setError('');
    setSuccess('');

    try {
      await api.put(`/admin/admins/${encodeURIComponent(selectedAdmin.email)}/password`, {
        newPassword,
      });
      setSuccess('Contraseña del administrador actualizada.');
      setShowPassModal(false);
      setNewPassword('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo actualizar la contraseña.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-50 font-['Poppins'] flex flex-col transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Panel de Control</h1>
        </div>
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <Settings size={24} />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-2">
            Infraestructura
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {externalTools.map((tool) => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all duration-300 group ${tool.color}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-white transition-colors shadow-sm">
                    {tool.icon}
                  </div>
                  <ExternalLink
                    size={18}
                    className="text-gray-300 group-hover:text-gray-900 transition-colors"
                  />
                </div>
                <h4 className="text-lg font-black text-gray-900">{tool.name}</h4>
                <p className="text-sm text-gray-400 font-medium">{tool.desc}</p>
              </a>
            ))}
          </div>

          <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-100 transition-transform hover:scale-[1.02] duration-500">
            <Lock className="absolute -right-4 -bottom-4 opacity-10" size={120} />
            <h4 className="text-xl font-black mb-2 leading-tight">Acceso Restringido</h4>
            <p className="text-blue-100 text-sm font-medium leading-relaxed">
              Este panel contiene enlaces sensibles a la base de datos y archivos maestros del
              proyecto.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">
              Cuentas con Privilegios
            </h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              type="button"
            >
              <Plus size={18} />
              Agregar Admin
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4 font-semibold">
              {success}
            </div>
          )}

          {admins.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-gray-100 text-center text-gray-500 font-semibold">
              No hay administradores registrados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-500">
              {admins.map((admin) => {
                const isCurrentAdmin = admin.email.toLowerCase() === currentUserEmail;
                return (
                  <article
                    key={admin._id || admin.email}
                    className="bg-white rounded-[1.7rem] p-5 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isCurrentAdmin
                                ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                : 'bg-gray-300'
                            }`}
                          />
                          <h4 className="text-lg font-extrabold text-gray-900 truncate">{admin.email}</h4>
                          {isCurrentAdmin && (
                            <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                              Tú
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                          Última conexión: {admin.lastSeen}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleOpenPassModal(admin)}
                          className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center"
                          title="Editar contraseña"
                          type="button"
                        >
                          <KeyRound size={18} />
                        </button>

                        <button
                          disabled={isCurrentAdmin}
                          onClick={() => handleDeleteAdmin(admin)}
                          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${
                            isCurrentAdmin
                              ? 'bg-gray-50 text-gray-200 cursor-not-allowed'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                          title={isCurrentAdmin ? 'No puedes eliminarte a ti mismo' : 'Eliminar Admin'}
                          type="button"
                        >
                          {busyEmail === String(admin.email || '').toLowerCase() ? (
                            <div className="w-5 h-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAddModal();
            }
          }}
        >
          <div
            className="bg-white rounded-[3rem] p-8 sm:p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                <Plus size={28} />
              </div>
              <button
                onClick={closeAddModal}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                type="button"
              >
                <X size={24} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2">Agregar Administrador</h3>
            <p className="text-gray-400 text-sm font-medium mb-8">
              Crea una nueva cuenta con privilegios administrativos.
            </p>

            <form className="space-y-6" onSubmit={handleAddAdmin}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Correo
                </label>
                <input
                  type="email"
                  value={newAdminForm.email}
                  onChange={(event) =>
                    setNewAdminForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="admin@rosetta.edu"
                  required
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 py-4 font-bold transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showAddAdminPassword ? 'text' : 'password'}
                    value={newAdminForm.password}
                    onChange={(event) =>
                      setNewAdminForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    placeholder="Mínimo 8, mayúscula, minúscula y número"
                    required
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 pr-14 py-4 font-bold transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddAdminPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {showAddAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                type="submit"
              >
                <Save size={20} />
                Guardar Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {showPassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePassModal();
            }
          }}
        >
          <div
            className="bg-white rounded-[3rem] p-8 sm:p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                <KeyRound size={28} />
              </div>
              <button
                onClick={closePassModal}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                type="button"
              >
                <X size={24} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2">Nueva Contraseña</h3>
            <p className="text-gray-400 text-sm font-medium mb-8">
              Estás modificando el acceso de{' '}
              <span className="text-blue-600 font-bold">{selectedAdmin?.email}</span>
            </p>

            <form className="space-y-6" onSubmit={handleUpdatePassword}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showUpdatePassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 pr-14 py-4 font-bold transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpdatePassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {showUpdatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2" type="submit">
                <Save size={20} />
                Actualizar Credenciales
              </button>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteModal();
            }
          }}
        >
          <div
            className="bg-white rounded-[3rem] p-8 sm:p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="bg-red-50 p-4 rounded-2xl text-red-600">
                <Trash2 size={28} />
              </div>
              <button
                onClick={closeDeleteModal}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                type="button"
              >
                <X size={24} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2">Eliminar Administrador</h3>
            <p className="text-gray-400 text-sm font-medium mb-8">
              ¿Seguro que deseas eliminar a{' '}
              <span className="text-red-600 font-bold">{selectedAdminToDelete?.email}</span>? Esta acción no se puede deshacer.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="w-full py-3.5 rounded-2xl font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAdmin}
                className="w-full py-3.5 rounded-2xl font-black bg-red-600 text-white hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                disabled={busyEmail === String(selectedAdminToDelete?.email || '').toLowerCase()}
              >
                {busyEmail === String(selectedAdminToDelete?.email || '').toLowerCase() ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={18} />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .animate-in { animation-duration: 0.4s; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .zoom-in-95 { animation-name: zoom-in-95; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoom-in-95 { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `,
        }}
      />
    </div>
  );
};

export default SettingsPage;
