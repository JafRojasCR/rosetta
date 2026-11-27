import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react';
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
  const [courseSubjects, setCourseSubjects] = useState([]);
  const [selectedCourseByEmail, setSelectedCourseByEmail] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyEmail, setBusyEmail] = useState('');
  const [updatingCoursesEmail, setUpdatingCoursesEmail] = useState('');

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  const fetchStudents = async () => {
    setLoading(true);
    setError('');

    try {
      const [studentsResponse, subjectsResponse] = await Promise.all([
        api.get('/admin/students'),
        api.get('/subjects'),
      ]);
      setStudents(studentsResponse.data.data || []);
      const allSubjects = subjectsResponse.data.data || [];
      setCourseSubjects(allSubjects.filter((s) => Boolean(s?.isCourse)));
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

  const courseNameById = useMemo(() => {
    return (courseSubjects || []).reduce((acc, subj) => {
      const id = String(subj?.subjectId || '').trim().toLowerCase();
      if (id) acc[id] = subj.name || id;
      return acc;
    }, {});
  }, [courseSubjects]);

  const handleUpdateStudentCourses = async (studentEmail, nextCursos, successMsg) => {
    setUpdatingCoursesEmail(studentEmail);
    setError('');
    setSuccess('');

    try {
      const response = await api.put(`/admin/students/${encodeURIComponent(studentEmail)}`, {
        cursos: nextCursos,
      });
      const updatedStudent = response.data?.data;
      if (updatedStudent) {
        setStudents((prev) =>
          prev.map((entry) => (entry.email === studentEmail ? updatedStudent : entry))
        );
      }
      setSuccess(successMsg);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'No se pudieron actualizar los cursos del estudiante.'
      );
    } finally {
      setUpdatingCoursesEmail('');
    }
  };

  const handleAddCourseToStudent = async (student) => {
    const currentCursos = Array.isArray(student.cursos)
      ? student.cursos.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const available = courseSubjects.filter(
      (subj) => !currentCursos.includes(String(subj.subjectId || '').trim().toLowerCase())
    );
    const chosenId =
      selectedCourseByEmail[student.email] ||
      String(available[0]?.subjectId || '').trim().toLowerCase();

    if (!chosenId) return;
    if (currentCursos.includes(chosenId)) return;

    const nextCursos = [...currentCursos, chosenId];
    await handleUpdateStudentCourses(
      student.email,
      nextCursos,
      `Curso "${courseNameById[chosenId] || chosenId}" asignado a ${student.email}.`
    );
    setSelectedCourseByEmail((prev) => ({ ...prev, [student.email]: '' }));
  };

  const handleRemoveCourseFromStudent = async (student, courseIdToRemove) => {
    const normalizedRemove = String(courseIdToRemove || '').trim().toLowerCase();
    const currentCursos = Array.isArray(student.cursos)
      ? student.cursos.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const nextCursos = currentCursos.filter((c) => c !== normalizedRemove);

    await handleUpdateStudentCourses(
      student.email,
      nextCursos,
      `Curso "${courseNameById[normalizedRemove] || normalizedRemove}" removido de ${student.email}.`
    );
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

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6 flex-1">
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

          <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-black text-indigo-600 uppercase tracking-widest">Estudiantes</span>
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
                        Última vez: {formatDate(student.lastLoginAt)}
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
                    {Array.isArray(student.cursos) && student.cursos.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {student.cursos.map((courseId) => {
                          const normalizedId = String(courseId || '').trim().toLowerCase();
                          const label = courseNameById[normalizedId] || normalizedId;
                          return (
                            <span
                              key={`${student.email}-${normalizedId}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100"
                            >
                              <span>{label}</span>
                              <button
                                type="button"
                                disabled={updatingCoursesEmail === student.email}
                                onClick={() => handleRemoveCourseFromStudent(student, normalizedId)}
                                className="hover:text-red-600 disabled:opacity-50 transition-colors"
                                title="Quitar curso"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {(() => {
                      const currentCursos = new Set(
                        (Array.isArray(student.cursos) ? student.cursos : [])
                          .map((c) => String(c || '').trim().toLowerCase())
                          .filter(Boolean)
                      );
                      const availableCourses = courseSubjects.filter(
                        (subj) => !currentCursos.has(String(subj.subjectId || '').trim().toLowerCase())
                      );
                      if (availableCourses.length === 0) return null;

                      const selectedVal =
                        selectedCourseByEmail[student.email] ||
                        String(availableCourses[0]?.subjectId || '').trim().toLowerCase();

                      return (
                        <div className="pt-2 flex items-center gap-2">
                          <select
                            value={selectedVal}
                            onChange={(e) =>
                              setSelectedCourseByEmail((prev) => ({
                                ...prev,
                                [student.email]: e.target.value,
                              }))
                            }
                            disabled={updatingCoursesEmail === student.email}
                            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-purple-500"
                          >
                            {availableCourses.map((subj) => (
                              <option key={subj.subjectId} value={subj.subjectId}>
                                {subj.name} ({subj.subjectId})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddCourseToStudent(student)}
                            disabled={updatingCoursesEmail === student.email}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black disabled:opacity-60 transition-colors shrink-0"
                            title="Añadir curso"
                          >
                            <Plus size={14} />
                            Añadir
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminUsersPage;
