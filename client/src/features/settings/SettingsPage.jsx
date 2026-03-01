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
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const currentUserEmail = String(user?.email || '').toLowerCase();

  const [admins] = useState([
    { id: 1, email: 'jafet@rosetta.edu', lastSeen: 'Hoy, 14:20', role: 'Super Admin' },
    { id: 2, email: 'soporte@rosetta.edu', lastSeen: 'Ayer, 09:15', role: 'Editor' },
    { id: 3, email: 'admin2@rosetta.edu', lastSeen: '15 Feb 2026', role: 'Admin' },
  ]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const externalTools = useMemo(
    () => [
      {
        name: 'Google Drive',
        desc: 'Almacenamiento de archivos',
        icon: <HardDrive className="text-blue-500" />,
        url: 'https://drive.google.com',
        color: 'hover:border-blue-200 hover:bg-blue-50/30',
      },
      {
        name: 'MongoDB Atlas',
        desc: 'Base de datos Cloud',
        icon: <Database className="text-emerald-500" />,
        url: 'https://cloud.mongodb.com',
        color: 'hover:border-emerald-200 hover:bg-emerald-50/30',
      },
      {
        name: 'Vercel',
        desc: 'Logs de despliegue',
        icon: <Zap className="text-purple-500" />,
        url: 'https://vercel.com',
        color: 'hover:border-purple-200 hover:bg-purple-50/30',
      },
    ],
    []
  );

  const handleOpenPassModal = (admin) => {
    setSelectedAdmin(admin);
    setShowPassModal(true);
  };

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
          <Settings size={24} className="animate-[spin_10s_linear_infinite]" />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
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
            <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">
              <Plus size={18} />
              Agregar Admin
            </button>
          </div>

          <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Email Administrador
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Rol
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Última Conexión
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="group hover:bg-gray-50/80 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              admin.email.toLowerCase() === currentUserEmail
                                ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                : 'bg-gray-300'
                            }`}
                          />
                          <span className="font-bold text-gray-800">{admin.email}</span>
                          {admin.email.toLowerCase() === currentUserEmail && (
                            <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                              Tú
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-4 py-1.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black tracking-widest uppercase">
                          {admin.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-bold text-gray-400 italic">{admin.lastSeen}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleOpenPassModal(admin)}
                            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Cambiar Contraseña"
                            type="button"
                          >
                            <KeyRound size={20} />
                          </button>

                          <button
                            disabled={admin.email.toLowerCase() === currentUserEmail}
                            className={`p-2.5 rounded-xl transition-all ${
                              admin.email.toLowerCase() === currentUserEmail
                                ? 'text-gray-200 cursor-not-allowed'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={
                              admin.email.toLowerCase() === currentUserEmail
                                ? 'No puedes eliminarte a ti mismo'
                                : 'Eliminar Admin'
                            }
                            type="button"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-8 sm:p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                <KeyRound size={28} />
              </div>
              <button
                onClick={() => setShowPassModal(false)}
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

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Contraseña Temporal
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 py-4 font-bold transition-all outline-none"
                />
              </div>

              <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2" type="button">
                <Save size={20} />
                Actualizar Credenciales
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] bg-white/60 border-t border-gray-100">
        Rosetta Infrastructure Console • 2026
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
