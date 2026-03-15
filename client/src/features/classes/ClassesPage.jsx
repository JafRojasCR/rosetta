import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Calendar,
  ChevronDown,
  Lock,
  Search,
  ThumbsDown,
  ThumbsUp,
  Unlock,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import CustomVideoPlayer from '../../components/CustomVideoPlayer';
import FloatingCalendarButton from '../../components/FloatingCalendarButton';
import useAuth from '../../hooks/useAuth';

const formatDayMonth = (dateValue) => {
  if (!dateValue) return '--/--';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--/--';
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
};

const formatRightDate = (dateValue) => {
  if (!dateValue) return '--/--/----';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const ClassesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userEmail = String(user?.email || '').toLowerCase();

  const [isVisible, setIsVisible] = useState(false);
  const [classes, setClasses] = useState([]);
  const [expandedId, setExpandedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isAnimating, setIsAnimating] = useState(false);
  const [recordingAccessUrls, setRecordingAccessUrls] = useState({});
  const [loadingVideoByClass, setLoadingVideoByClass] = useState({});
  const [loadingCanvaByClass, setLoadingCanvaByClass] = useState({});
  const [votingByClass, setVotingByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sortAnimTimerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (sortAnimTimerRef.current) {
        clearTimeout(sortAnimTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await api.get('/classes');
        const data = response.data.data;
        setClasses(data);
      } catch (err) {
        setError('Error al cargar las clases');
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  const classesForStudent = useMemo(() => {
    const enriched = (classes || []).map((cls) => {
      const classStudents = cls.classStudents || [];
      const currentStudentEntry = classStudents.find(
        (entry) => entry?.student?.email?.toLowerCase() === userEmail
      );
      const unlocked = classStudents.some(
        (entry) =>
          entry?.student?.email?.toLowerCase() === userEmail &&
          entry?.unlocked === true
      );

      const dayMonth = formatDayMonth(cls.date);
      const title = String(cls.title || '').trim();
      const tutoredEntry = classStudents.find((entry) => entry?.type === 'tutored');
      const tutoredStudentName = tutoredEntry
        ? `${tutoredEntry?.student?.name || ''} ${tutoredEntry?.student?.lastName || ''}`.trim()
        : '';

      return {
        ...cls,
        isLocked: !unlocked,
        displayDateShort: dayMonth,
        displayDateLong: formatRightDate(cls.date),
        displayTitle: `Clase ${dayMonth}: ${title.toUpperCase()}`,
        tutoredStudentName,
        currentVote:
          currentStudentEntry?.vote === '1' || currentStudentEntry?.vote === '-1'
            ? currentStudentEntry.vote
            : null,
      };
    });

    return enriched
      .filter((cls) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const searchable = `${cls.displayTitle} ${cls.displayDateShort}`.toLowerCase();
        return searchable.includes(q);
      })
      .sort((a, b) => {
        let comparison = 0;

        if (sortBy === 'date') {
          comparison = new Date(a.date) - new Date(b.date);
        }

        if (sortBy === 'subject') {
          comparison = String(a.subject?.name || '').localeCompare(String(b.subject?.name || ''));
        }

        if (sortBy === 'status') {
          comparison = a.isLocked === b.isLocked ? 0 : a.isLocked ? 1 : -1;
        }

        return sortOrder === 'desc' ? comparison * -1 : comparison;
      });
  }, [classes, userEmail, searchQuery, sortBy, sortOrder]);

  const handleSort = (type) => {
    setIsAnimating(true);

    if (sortBy === type) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }

    if (sortAnimTimerRef.current) {
      clearTimeout(sortAnimTimerRef.current);
    }

    sortAnimTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  const handleToggleClass = async (cls) => {
    if (cls.isLocked) return;

    const nextExpanded = expandedId === cls.classCode ? '' : cls.classCode;
    setExpandedId(nextExpanded);

    if (!nextExpanded || recordingAccessUrls[cls.classCode] || !cls.recordingUrl) {
      return;
    }

    setLoadingVideoByClass((prev) => ({ ...prev, [cls.classCode]: true }));
    try {
      const tokenResponse = await api.get(`/classes/${cls.classCode}/embed-token`);
      const token = String(tokenResponse.data?.data?.token || '').trim();
      if (!token) {
        throw new Error('No se pudo generar el token de reproducción.');
      }

      const baseUrl = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
      const streamUrl = `${baseUrl}/classes/embed/${encodeURIComponent(token)}/stream`;
      setRecordingAccessUrls((prev) => ({ ...prev, [cls.classCode]: streamUrl }));
    } catch (_requestError) {
      setError('No se pudo preparar el acceso protegido del video.');
    } finally {
      setLoadingVideoByClass((prev) => ({ ...prev, [cls.classCode]: false }));
    }
  };

  const openCanvaResource = async (cls, event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!cls?.classCode) return;
    setLoadingCanvaByClass((prev) => ({ ...prev, [cls.classCode]: true }));

    try {
      const response = await api.get(`/classes/${cls.classCode}/canva-access`);
      const accessUrl = response.data?.data?.accessUrl || '';
      if (!accessUrl) {
        throw new Error('Sin URL de acceso.');
      }
      window.open(accessUrl, '_blank', 'noopener,noreferrer');
    } catch (_requestError) {
      setError('No se pudo abrir el recurso de Canva.');
    } finally {
      setLoadingCanvaByClass((prev) => ({ ...prev, [cls.classCode]: false }));
    }
  };

  const handleVote = async (cls, voteValue) => {
    if (cls.isLocked) return;

    const currentVote = cls.currentVote || null;
    const nextVote = currentVote === voteValue ? null : voteValue;

    setVotingByClass((prev) => ({ ...prev, [cls.classCode]: true }));
    setError('');

    try {
      await api.patch(`/classes/${cls.classCode}/vote`, { vote: nextVote });

      setClasses((prev) =>
        prev.map((entry) => {
          if (entry.classCode !== cls.classCode) return entry;

          const nextClassStudents = (entry.classStudents || []).map((studentEntry) => {
            if (studentEntry?.student?.email?.toLowerCase() !== userEmail) return studentEntry;
            return { ...studentEntry, vote: nextVote };
          });

          return { ...entry, classStudents: nextClassStudents };
        })
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo registrar tu voto.');
    } finally {
      setVotingByClass((prev) => ({ ...prev, [cls.classCode]: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Clases</h1>
        </div>

        <div className="hidden md:inline-flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          {[
            { id: 'date', label: 'Fecha', icon: <Calendar size={14} /> },
            { id: 'subject', label: 'Materia', icon: <BookOpen size={14} /> },
            { id: 'status', label: 'Estado', icon: <Lock size={14} /> },
          ].map((item) => {
            const isActive = sortBy === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSort(item.id)}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                }`}
                type="button"
              >
                <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                {item.label}

                <div
                  className={`flex items-center transition-all duration-500 ease-in-out ${
                    isActive ? 'w-4 opacity-100 ml-1' : 'w-0 opacity-0 ml-0'
                  }`}
                >
                  <ArrowUp
                    size={14}
                    className={`transition-transform duration-500 ease-out ${
                      sortOrder === 'desc' ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>

                {isActive && <span className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search
              className="text-gray-400 group-focus-within:text-blue-500 transition-colors"
              size={20}
            />
          </div>
          <input
            type="text"
            placeholder="Buscar por título o fecha..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] pl-14 pr-6 py-4 shadow-sm text-base font-medium outline-none transition-all"
          />
        </div>

        <div className="mt-4 md:hidden w-full bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex">
          {[
            { id: 'date', label: 'Fecha' },
            { id: 'subject', label: 'Materia' },
            { id: 'status', label: 'Estado' },
          ].map((item) => {
            const isActive = sortBy === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSort(item.id)}
                className={`group flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
                type="button"
              >
                <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                {item.label}

                <div
                  className={`flex items-center transition-all duration-500 ease-in-out ${
                    isActive ? 'w-4 opacity-100 ml-1' : 'w-0 opacity-0 ml-0'
                  }`}
                >
                  <ArrowUp
                    size={14}
                    className={`transition-transform duration-500 ease-out ${
                      sortOrder === 'desc' ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </div>

                {isActive && <span className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 mt-6">
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl font-semibold">{error}</div>
        </div>
      )}

      <main
        className={`max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 pb-28 sm:pb-32 space-y-4 transition-all duration-500 ${
          isAnimating ? 'opacity-50 scale-[0.99] grayscale-[0.2]' : 'opacity-100 scale-100'
        }`}
      >
        {classesForStudent.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 text-center text-gray-400 font-semibold">
            No se encontraron clases con ese criterio.
          </div>
        ) : (
          classesForStudent.map((cls) => (
            <div
              key={cls.classCode}
              className={`bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden ${
                expandedId === cls.classCode
                  ? 'border-blue-500 shadow-xl'
                  : 'border-transparent shadow-sm hover:border-gray-200'
              }`}
            >
              <div
                onClick={() => handleToggleClass(cls)}
                className={`p-6 flex items-center justify-between transition-colors duration-300 ${
                  cls.isLocked ? 'opacity-60 grayscale bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/30'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div
                    className={`p-4 rounded-2xl ${
                      cls.isLocked ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {cls.isLocked ? <Lock size={22} /> : <Unlock size={22} />}
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                      {cls.displayTitle}
                    </h3>
                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">
                      {cls.subject?.name || 'Sin materia'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="hidden sm:flex items-center gap-1.5 text-gray-400 font-bold text-sm tracking-tight">
                    <Calendar size={14} />
                    {cls.displayDateLong}
                  </span>
                  <div
                    className={`transition-all duration-300 ${
                      expandedId === cls.classCode ? 'rotate-180 text-blue-600' : 'text-gray-300'
                    }`}
                  >
                    <ChevronDown size={26} />
                  </div>
                </div>
              </div>

              {expandedId === cls.classCode && !cls.isLocked && (
                <div className="p-6 pt-0">
                  <div className="w-full h-px bg-gray-100 mb-6" />

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 relative">
                      <div className="aspect-video rounded-3xl overflow-hidden border border-gray-100 bg-gray-900 shadow-inner">
                        {loadingVideoByClass[cls.classCode] ? (
                          <div className="w-full h-full flex items-center justify-center text-white/90 font-bold">
                            Cargando video...
                          </div>
                        ) : recordingAccessUrls[cls.classCode] ? (
                          <CustomVideoPlayer
                            src={recordingAccessUrls[cls.classCode]}
                            title={`Video ${cls.displayTitle}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/90 font-bold">
                            Video no disponible
                          </div>
                        )}
                      </div>

                      {cls.canvaUrl && (
                        <a
                          href="#"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => openCanvaResource(cls, event)}
                          className="absolute top-3 right-3 bg-white p-2 rounded-xl shadow-lg hover:scale-105 transition-transform"
                          title="Abrir Canva"
                        >
                          {loadingCanvaByClass[cls.classCode] ? (
                            <span className="text-[10px] font-black text-gray-500 px-1">...</span>
                          ) : null}
                          <img src="/canvaicon.png" alt="Canva" className="w-7 h-7 object-contain" />
                        </a>
                      )}
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-3">
                      <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <BookOpen size={18} className="text-blue-500" />
                        <span className="text-sm font-bold tracking-tight">
                          Materia: {cls.subject?.name || 'Sin materia'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <Calendar size={18} className="text-blue-500" />
                        <span className="text-sm font-bold tracking-tight">
                          Fecha: {cls.displayDateLong}
                        </span>
                      </div>

                      {cls.tutoredStudentName && (
                        <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <BookOpen size={18} className="text-blue-500" />
                          <span className="text-sm font-bold tracking-tight">
                            Estudiante: {cls.tutoredStudentName}
                          </span>
                        </div>
                      )}

                      <div className="text-gray-500 font-medium leading-relaxed text-sm bg-white border border-gray-100 rounded-2xl p-4">
                        {cls.description || 'Sin descripcion registrada.'}
                      </div>

                      <div className="bg-white border border-gray-100 rounded-2xl p-4">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                          Vota esta clase
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleVote(cls, '1')}
                            disabled={Boolean(votingByClass[cls.classCode])}
                            aria-label="Me gustó"
                            className={`w-full py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                              cls.currentVote === '1'
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}
                          >
                            <ThumbsUp size={16} />
                            <span className="hidden sm:inline">Me gustó</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVote(cls, '-1')}
                            disabled={Boolean(votingByClass[cls.classCode])}
                            aria-label="No me gustó"
                            className={`w-full py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                              cls.currentVote === '-1'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            <ThumbsDown size={16} />
                            <span className="hidden sm:inline">No me gustó</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

      </main>

      <FloatingCalendarButton onClick={() => navigate('/calendario')} />

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default ClassesPage;
