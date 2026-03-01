import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Search, Trash2, User, Users } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatDate = (value) => {
  if (!value) return '--/--/----';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyEmail, setBusyEmail] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/admin/students');
      setStudents(response.data.data || []);
    } catch (_requestError) {
      setError('No se pudieron cargar los estudiantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const fullName = `${student.name || ''} ${student.lastName || ''}`.toLowerCase();
      const email = String(student.email || '').toLowerCase();
      const phone = String(student.phone || '').toLowerCase();
      return (
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query)
      );
    });
  }, [students, searchQuery]);

  const handleDeleteStudent = async (student) => {
    const fullName = `${student.name || ''} ${student.lastName || ''}`.trim();
    const confirmed = window.confirm(
      `¿Eliminar a ${fullName || student.email}? Esta accion tambien quitara su acceso dentro de classStudents en todas las clases.`
    );

    if (!confirmed) return;

    setBusyEmail(student.email);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/admin/students/${encodeURIComponent(student.email)}`);
      setStudents((prev) => prev.filter((entry) => entry.email !== student.email));
      setSuccess('Estudiante eliminado correctamente.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar el estudiante.');
    } finally {
      setBusyEmail('');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">
              Administrar usuarios
            </h1>
            <p className="text-sm text-gray-500">Visualiza y elimina estudiantes</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
          <Users size={24} />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-gray-100 shadow-sm">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search
                className="text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={18}
              />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nombre, correo o telefono..."
              className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-11 pr-4 py-3 font-semibold text-gray-700 outline-none transition-all"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="font-black text-indigo-600 uppercase tracking-widest">
              Estudiantes
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black">
              {filteredStudents.length}
            </span>
          </div>
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

        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 text-center text-gray-500 font-semibold">
            No se encontraron estudiantes con ese criterio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStudents.map((student) => {
              const fullName = `${student.name || ''} ${student.lastName || ''}`.trim() || 'Sin nombre';
              return (
                <article
                  key={student.email}
                  className="bg-white rounded-[1.7rem] p-5 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-gray-900 truncate">{fullName}</h3>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                        Registro: {formatDate(student.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(student)}
                      disabled={busyEmail === student.email}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0"
                      title="Eliminar estudiante"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 min-w-0">
                      <Mail size={14} className="text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{student.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 min-w-0">
                      <Phone size={14} className="text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{student.phone || 'Sin telefono'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 min-w-0">
                      <User size={14} className="text-indigo-500 flex-shrink-0" />
                      <span className="truncate">ID: {student._id || 'N/A'}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminUsersPage;
