import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Lock,
  Play,
  RotateCcw,
  Timer,
  XCircle,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const DEFAULT_NOTA_PRESENTACION = 100;

const DURATION_PRESETS = [
  { id: 'ucr', label: 'UCR / UNA', sublabel: '1h 50m', hours: 1, minutes: 50 },
  { id: 'tec', label: 'TEC', sublabel: '2h 30m', hours: 2, minutes: 30 },
  { id: 'custom', label: 'Manual', sublabel: 'Personalizado', hours: null, minutes: null },
];

const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const prepareQuestions = (data) => {
  return shuffleArray(data).map((q) => {
    const originalCorrectText = q.respuestas[q.correcta];
    const shuffledOptions = shuffleArray(q.respuestas);
    return {
      ...q,
      respuestas: shuffledOptions,
      correcta: shuffledOptions.indexOf(originalCorrectText),
    };
  });
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatMinutesLabel = (totalMinutes) => {
  const safe = Math.max(1, Number(totalMinutes) || 110);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
};

const BubbleSheetView = ({
  questions,
  bubbleAnswers,
  setBubbleAnswers,
  setView,
  onFinish,
}) => {
  const answeredCount = Object.keys(bubbleAnswers).length;

  return (
    <div className="bg-white w-full max-w-4xl mx-auto rounded-[2rem] shadow-sm border border-gray-100 p-6 sm:p-10 flex flex-col">
      <div className="text-center mb-6 pb-6 border-b border-gray-100">
        <span className="inline-block text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest mb-2">
          Calificación oficial • {answeredCount} de {questions.length} marcadas
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
          Hoja de Respuestas
        </h2>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          Marca una burbuja por pregunta. Haz clic de nuevo para desmarcarla.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
        {questions.map((q, i) => {
          const optionCount = q.respuestas?.length || 4;
          return (
            <div
              key={`bubble-row-${q._id || i}`}
              className="flex items-center justify-between py-2.5 px-4 bg-gray-50 border border-gray-100 rounded-2xl hover:border-blue-200 transition-colors"
            >
              <span className="font-black text-gray-400 w-8 text-sm">
                {String(i + 1).padStart(2, '0')}.
              </span>
              <div className="flex gap-1.5">
                {Array.from({ length: optionCount }).map((_, lIdx) => {
                  const isSelected = bubbleAnswers[i] === lIdx;
                  return (
                    <button
                      key={`bubble-${i}-${lIdx}`}
                      type="button"
                      onClick={() =>
                        setBubbleAnswers((prev) => {
                          const next = { ...prev };
                          if (next[i] === lIdx) {
                            delete next[i];
                          } else {
                            next[i] = lIdx;
                          }
                          return next;
                        })
                      }
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-black text-xs transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-105'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {String.fromCharCode(65 + lIdx)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setView('EXAM')}
          className="flex-1 py-4 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all uppercase text-xs tracking-widest"
        >
          Volver al Folleto
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-200 transition-all uppercase text-xs tracking-widest"
        >
          Finalizar y Calificar
        </button>
      </div>
    </div>
  );
};

const ExamPracticePage = () => {
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isIdleExiting, setIsIdleExiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingExamDetail, setLoadingExamDetail] = useState(false);
  const [error, setError] = useState('');

  const [availableExams, setAvailableExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [rawQuestions, setRawQuestions] = useState([]);

  // Pre-exam settings
  const [notaPresentacion, setNotaPresentacion] = useState(String(DEFAULT_NOTA_PRESENTACION));
  const [useUcrScale, setUseUcrScale] = useState(true);
  const [useBubbleSheet, setUseBubbleSheet] = useState(true);
  const [durationPreset, setDurationPreset] = useState('ucr');
  const [customHours, setCustomHours] = useState(1);
  const [customMinutes, setCustomMinutes] = useState(50);
  const [showGuides, setShowGuides] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // Testing state
  const [timerMode, setTimerMode] = useState('elapsed'); // elapsed | remaining
  const [timerAnimating, setTimerAnimating] = useState(false);
  const [phaseTransitioning, setPhaseTransitioning] = useState(false);
  const [status, setStatus] = useState('LIST'); // LIST | IDLE | TESTING | FINISHED
  const [view, setView] = useState('EXAM'); // EXAM | BUBBLE_SHEET
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bubbleAnswers, setBubbleAnswers] = useState({});
  const [draftAnswers, setDraftAnswers] = useState({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [cardTransitioning, setCardTransitioning] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await api.get('/exams');
        setAvailableExams(response.data?.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Error al cargar los exámenes disponibles.');
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const handleSelectExam = async (examItem) => {
    setError('');
    setLoadingExamDetail(true);
    try {
      const response = await api.get(`/exams/${examItem._id}`);
      const fullExam = response.data?.data;
      if (!fullExam) throw new Error('No se pudo cargar el examen.');

      const mins = Math.max(1, Number(fullExam.recommendedMinutes) || 110);
      if (mins === 110) {
        setDurationPreset('ucr');
        setCustomHours(1);
        setCustomMinutes(50);
      } else if (mins === 150) {
        setDurationPreset('tec');
        setCustomHours(2);
        setCustomMinutes(30);
      } else {
        setDurationPreset('custom');
        setCustomHours(Math.floor(mins / 60));
        setCustomMinutes(mins % 60);
      }

      setSelectedExam(fullExam);
      setRawQuestions(fullExam.questions || []);
      setUseBubbleSheet(fullExam.useBubbleSheetDefault !== false);
      setUseUcrScale(true);
      setInstructionsOpen(false);
      setStatus('IDLE');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el examen seleccionado.');
    } finally {
      setLoadingExamDetail(false);
    }
  };

  const examDurationSeconds = useMemo(() => {
    const h = Math.max(0, Math.min(12, Number(customHours) || 0));
    const m = Math.max(0, Math.min(59, Number(customMinutes) || 0));
    const total = h * 3600 + m * 60;
    return total > 0 ? total : 60;
  }, [customHours, customMinutes]);

  const formattedDurationText = useMemo(() => {
    const h = Math.floor(examDurationSeconds / 3600);
    const m = Math.floor((examDurationSeconds % 3600) / 60);
    const parts = [];
    if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
    if (m > 0) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
    return parts.join(' y ') || '1 minuto';
  }, [examDurationSeconds]);

  useEffect(() => {
    if (status !== 'TESTING') return undefined;

    const timer = setInterval(() => {
      setTimeElapsed((prev) => Math.min(examDurationSeconds, prev + 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [status, examDurationSeconds]);

  useEffect(() => {
    if (status === 'TESTING' && timeElapsed >= examDurationSeconds) {
      setShowConfirmFinish(false);
      setStatus('FINISHED');
    }
  }, [status, timeElapsed, examDurationSeconds]);

  const handleToggleTimerMode = () => {
    setTimerAnimating(true);
    setTimeout(() => {
      setTimerMode((prev) => (prev === 'elapsed' ? 'remaining' : 'elapsed'));
      setTimerAnimating(false);
    }, 140);
  };

  const subjectSummary = useMemo(() => {
    const counts = {};
    rawQuestions.forEach((q) => {
      const key = q.tipo || 'General';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts);
  }, [rawQuestions]);

  const startExam = () => {
    if (rawQuestions.length === 0 || phaseTransitioning) return;
    setPhaseTransitioning(true);
    setTimeout(() => {
      setQuestions(prepareQuestions(rawQuestions));
      setBubbleAnswers({});
      setDraftAnswers({});
      setCurrentIndex(0);
      setTimeElapsed(0);
      setStatus('TESTING');
      setView('EXAM');
      requestAnimationFrame(() => setPhaseTransitioning(false));
    }, 220);
  };

  const goToQuestion = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= questions.length || nextIndex === currentIndex) return;
    setCardTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setCardTransitioning(false);
    }, 140);
  };

  const activeAnswers = useBubbleSheet ? bubbleAnswers : draftAnswers;

  const calculateResult = useCallback(() => {
    let correctas = 0;
    questions.forEach((q, idx) => {
      if (activeAnswers[idx] === q.correcta) {
        correctas++;
      }
    });

    const total = questions.length || 1;
    const notaPAA = (correctas / total) * 100;
    const parsedNota = Number.parseFloat(notaPresentacion);
    const promedioMaterias = Number.isFinite(parsedNota)
      ? Math.min(100, Math.max(0, parsedNota))
      : DEFAULT_NOTA_PRESENTACION;

    const resultadoBase =
      (((notaPAA + promedioMaterias) / 2 - 67.1138) / 10.5151) * 100 + 500;
    const finalScore = (resultadoBase * 800) / 802.19;

    return {
      puntaje: finalScore.toFixed(2),
      correctas,
      total: questions.length,
      notaPAA: notaPAA.toFixed(1),
      tiempoRestante: Math.max(0, examDurationSeconds - timeElapsed),
    };
  }, [questions, activeAnswers, timeElapsed, notaPresentacion, examDurationSeconds]);

  if (loading || loadingExamDetail) return <LoadingSpinner />;

  const currentQ = questions[currentIndex];
  const answeredCount = Object.values(activeAnswers).filter((v) => v !== undefined).length;
  const omittedCount = Math.max(0, questions.length - answeredCount);

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transform transition-all duration-700 ease-out ${
        isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      {/* Top Navigation */}
      <nav className="bg-white px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm z-20 sticky top-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              if (status === 'IDLE') {
                setIsIdleExiting(true);
                setTimeout(() => {
                  setIsIdleExiting(false);
                  setStatus('LIST');
                  setSelectedExam(null);
                }, 300);
              } else {
                setIsExiting(true);
                setTimeout(() => navigate('/recursos'), 320);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            type="button"
            aria-label="Volver"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">
              Práctica de Examen
            </h1>
          </div>
        </div>

        {status === 'TESTING' && (
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {showGuides && (
              <button
                type="button"
                onClick={handleToggleTimerMode}
                title={
                  timerMode === 'elapsed'
                    ? 'Toca para ver tiempo restante'
                    : 'Toca para ver tiempo transcurrido'
                }
                className="inline-flex items-center gap-2 bg-gray-50 hover:bg-blue-50/70 border border-gray-100 hover:border-blue-200 px-3 sm:px-4 py-2 rounded-2xl text-gray-800 font-black text-sm sm:text-base transition-colors cursor-pointer select-none"
              >
                <Timer size={18} className="text-blue-600 flex-shrink-0" />
                <span
                  className={`inline-block transition-all duration-150 ${
                    timerAnimating ? 'opacity-40 scale-95' : 'opacity-100 scale-100'
                  }`}
                >
                  {timerMode === 'elapsed'
                    ? formatTime(timeElapsed)
                    : `-${formatTime(Math.max(0, examDurationSeconds - timeElapsed))}`}
                </span>
              </button>
            )}

            {useBubbleSheet && (
              <div className="inline-flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => setView('EXAM')}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                    view === 'EXAM'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Folleto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('BUBBLE_SHEET')}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                    view === 'BUBBLE_SHEET'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <ClipboardList size={14} />
                  <span className="hidden sm:inline">Hoja de Respuestas</span>
                  <span className="sm:hidden">Hoja</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                    {answeredCount}/{questions.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {error && (
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 mt-6">
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl font-semibold">{error}</div>
        </div>
      )}

      {/* LIST VIEW: Available Exams */}
      {status === 'LIST' && (
        <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <GraduationCap size={28} />
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Exámenes y Quices Disponibles
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              Selecciona una práctica para configurar tus preferencias y comenzar.
            </p>
          </div>

          {availableExams.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-gray-100 text-center space-y-2 max-w-2xl mx-auto">
              <p className="text-gray-700 font-bold text-lg">
                Aún no hay exámenes disponibles
              </p>
              <p className="text-gray-400 text-sm">
                Tu tutor o administrador debe publicar exámenes o quices para que aparezcan aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableExams.map((exam) => (
                <button
                  key={exam._id}
                  type="button"
                  onClick={() => handleSelectExam(exam)}
                  className="group bg-white rounded-[2rem] p-6 sm:p-7 text-left border-2 border-transparent hover:border-blue-500 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                        {exam.title}
                      </h3>
                      <span className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <ChevronRight size={18} />
                      </span>
                    </div>
                    {exam.description && (
                      <p className="text-sm text-gray-500 font-medium leading-relaxed">
                        {exam.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                      <BookOpen size={13} /> {exam.questionIds?.length || 0} preguntas
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                      <Timer size={13} className="text-blue-600" />{' '}
                      {formatMinutesLabel(exam.recommendedMinutes)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                      {exam.lockBubbleSheet && <Lock size={12} className="text-amber-500" />}
                      {exam.useBubbleSheetDefault ? 'Con hoja' : 'Solo folleto'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* IDLE VIEW: Pre-Exam Configuration */}
      {status === 'IDLE' && (
        <main
          className={`flex-1 flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ease-out ${
            phaseTransitioning || isIdleExiting
              ? 'opacity-0 scale-[0.98] translate-y-2'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          <div className="max-w-3xl w-full bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <GraduationCap size={32} />
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
                {selectedExam?.title || 'Práctica de Examen'}
              </h2>
              {selectedExam?.description && (
                <p className="text-sm text-gray-500 font-medium">{selectedExam.description}</p>
              )}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Simulador • Rosetta
              </p>
            </div>

            {rawQuestions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center space-y-2">
                <p className="text-gray-700 font-bold text-lg">
                  Este examen no tiene preguntas activas
                </p>
                <p className="text-gray-400 text-sm">
                  Selecciona otro examen de la lista o consulta con tu tutor.
                </p>
              </div>
            ) : (
              <>
                {subjectSummary.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {subjectSummary.map(([area, count]) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-black text-gray-700 uppercase tracking-wider"
                      >
                        <BookOpen size={13} className="text-blue-600" />
                        {area}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Acordeón de instrucciones */}
                <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setInstructionsOpen((prev) => !prev)}
                    aria-expanded={instructionsOpen}
                    className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-blue-100/50 transition-colors"
                  >
                    <span className="font-black text-sm text-blue-600 uppercase tracking-widest flex items-center gap-2">
                      <HelpCircle size={16} />
                      Instrucciones del simulacro
                    </span>
                    <ChevronDown
                      size={20}
                      className={`text-blue-600 transition-transform duration-300 ease-out flex-shrink-0 ${
                        instructionsOpen ? 'rotate-180' : 'rotate-0'
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      instructionsOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 pt-1">
                        <ul className="space-y-2.5 text-sm text-gray-700 list-disc pl-5 font-medium">
                          <li>
                            El examen consta de <strong>{rawQuestions.length} preguntas</strong> en orden aleatorio.
                          </li>
                          <li>
                            Dispones de un tiempo límite de <strong>{formattedDurationText}</strong>.
                          </li>
                          <li>
                            {useBubbleSheet ? (
                              <>
                                <strong>IMPORTANTE:</strong> Solo las respuestas marcadas en la{' '}
                                <strong>Hoja de Respuestas (Hoja de Bolitas)</strong> serán calificadas. Las marcas en el folleto son solo para tu referencia.
                              </>
                            ) : (
                              <>
                                <strong>IMPORTANTE:</strong> La hoja de respuestas está desactivada; tus respuestas marcadas directamente en el <strong>Folleto</strong> serán calificadas.
                              </>
                            )}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selector de Duración */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-black uppercase tracking-widest text-gray-500">
                        Duración del examen
                      </span>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Recomendado por tu tutor: {formatMinutesLabel(selectedExam?.recommendedMinutes)}. Puedes ajustarlo si deseas.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full self-start sm:self-auto">
                      <Timer size={14} /> {formattedDurationText}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {DURATION_PRESETS.map((preset) => {
                      const active = durationPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setDurationPreset(preset.id);
                            if (preset.hours !== null && preset.minutes !== null) {
                              setCustomHours(preset.hours);
                              setCustomMinutes(preset.minutes);
                            }
                          }}
                          className={`px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                            active
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          <p className="text-xs font-black uppercase tracking-wider">
                            {preset.label}
                          </p>
                          <p
                            className={`text-[11px] font-semibold mt-0.5 ${
                              active ? 'text-blue-100' : 'text-gray-400'
                            }`}
                          >
                            {preset.sublabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {durationPreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label
                          htmlFor="custom-hours-input"
                          className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5"
                        >
                          Horas
                        </label>
                        <input
                          id="custom-hours-input"
                          type="number"
                          min="0"
                          max="12"
                          value={customHours}
                          onChange={(e) =>
                            setCustomHours(Math.max(0, Math.min(12, Number(e.target.value) || 0)))
                          }
                          className="w-full bg-white border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 py-2.5 text-center font-black text-gray-900 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="custom-minutes-input"
                          className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5"
                        >
                          Minutos
                        </label>
                        <input
                          id="custom-minutes-input"
                          type="number"
                          min="0"
                          max="59"
                          value={customMinutes}
                          onChange={(e) =>
                            setCustomMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                          }
                          className="w-full bg-white border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 py-2.5 text-center font-black text-gray-900 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Hoja de Respuestas Toggle (respetando lock del admin) */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                      Hoja de respuestas (bolitas)
                      {selectedExam?.lockBubbleSheet && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Lock size={10} /> Fijado
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {useBubbleSheet
                        ? 'Solo se calificará lo marcado en la hoja de respuestas.'
                        : 'Se calificará directamente lo que marques en el folleto.'}
                    </p>
                  </div>
                  <div
                    className={`inline-flex bg-white p-1 rounded-2xl border border-gray-200 self-start sm:self-auto ${
                      selectedExam?.lockBubbleSheet ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <button
                      type="button"
                      disabled={Boolean(selectedExam?.lockBubbleSheet)}
                      onClick={() => setUseBubbleSheet(true)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        useBubbleSheet
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Activada
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(selectedExam?.lockBubbleSheet)}
                      onClick={() => setUseBubbleSheet(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        !useBubbleSheet
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Desactivada
                    </button>
                  </div>
                </div>

                {/* Escala 200-800 vs 0-100 + Nota de presentación animada */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="block text-xs font-black uppercase tracking-widest text-gray-500">
                        Resultado de admision
                      </span>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Elige entre puntaje estimado de admisión o nota del examen.
                      </p>
                    </div>
                    <div className="inline-flex bg-white p-1 rounded-2xl border border-gray-200 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setUseUcrScale(true)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          useUcrScale
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Admisión
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseUcrScale(false)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          !useUcrScale
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Examen
                      </button>
                    </div>
                  </div>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      useUcrScale
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-3 border-t border-gray-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <label
                            htmlFor="nota-presentacion-input"
                            className="block text-xs font-black uppercase tracking-widest text-gray-500"
                          >
                            Nota de presentación (Colegio)
                          </label>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">
                            Se utiliza para calcular tu puntaje estimado 200–800.
                          </p>
                        </div>
                        <input
                          id="nota-presentacion-input"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={notaPresentacion}
                          onChange={(e) => setNotaPresentacion(e.target.value)}
                          className="w-full sm:w-32 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-2xl px-4 py-2.5 text-center font-black text-gray-900 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guías / Modo realista */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-widest text-gray-500">
                      Guías durante el examen
                    </span>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      Oculta el reloj, el tipo/subtipo y los recordatorios del folleto para mayor realismo.
                    </p>
                  </div>
                  <div className="inline-flex bg-white p-1 rounded-2xl border border-gray-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setShowGuides(true)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        showGuides
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Guías
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGuides(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        !showGuides
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Realista
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startExam}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 sm:py-5 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.99] flex items-center justify-center gap-3 text-base sm:text-lg uppercase tracking-wider"
                >
                  <Play size={20} />
                  Comenzar Examen
                </button>
              </>
            )}
          </div>
        </main>
      )}

      {/* TESTING VIEW */}
      {status === 'TESTING' && (
        <main
          className={`flex-1 flex flex-col justify-between max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 transition-all duration-300 ease-out ${
            phaseTransitioning
              ? 'opacity-0 scale-[0.98] translate-y-2'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          {useBubbleSheet && view === 'BUBBLE_SHEET' ? (
            <div className="my-auto">
              <BubbleSheetView
                questions={questions}
                bubbleAnswers={bubbleAnswers}
                setBubbleAnswers={setBubbleAnswers}
                setView={setView}
                onFinish={() => setShowConfirmFinish(true)}
              />
            </div>
          ) : (
            <>
              <div
                className={`bg-white rounded-[2rem] shadow-sm border border-gray-100 border-l-[10px] border-l-blue-600 p-6 sm:p-10 md:p-12 transition-all duration-200 my-auto ${
                  cardTransitioning
                    ? 'opacity-0 translate-y-2 scale-[0.99]'
                    : 'opacity-100 translate-y-0 scale-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl font-black text-blue-600/20">
                      #{String(currentIndex + 1).padStart(2, '0')}
                    </span>
                    {showGuides && (
                      <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        {currentQ?.tipo}
                        {currentQ?.subtipo ? ` • ${currentQ.subtipo}` : ''}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold text-gray-400">
                    Pregunta {currentIndex + 1} de {questions.length}
                  </span>
                </div>

                <div className="space-y-8">
                  {currentQ?.imageUrl && (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-center">
                      <img
                        src={currentQ.imageUrl}
                        alt={`Imagen de apoyo pregunta ${currentIndex + 1}`}
                        className="max-h-72 sm:max-h-96 object-contain rounded-xl"
                      />
                    </div>
                  )}

                  <h3 className="text-lg sm:text-xl text-gray-800 leading-relaxed font-semibold whitespace-pre-line">
                    {currentQ?.pregunta}
                  </h3>

                  <div className="space-y-3">
                    {currentQ?.respuestas.map((opt, i) => {
                      const isDraftSelected = draftAnswers[currentIndex] === i;
                      return (
                        <button
                          key={`draft-opt-${currentIndex}-${i}`}
                          type="button"
                          onClick={() =>
                            setDraftAnswers((prev) => ({
                              ...prev,
                              [currentIndex]: prev[currentIndex] === i ? undefined : i,
                            }))
                          }
                          className={`w-full text-left p-4 rounded-2xl border-2 flex items-start gap-4 transition-all duration-200 ${
                            isDraftSelected
                              ? 'bg-blue-50 border-blue-500 text-blue-900'
                              : 'bg-gray-50/70 border-transparent hover:border-gray-200 text-gray-700'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full border-2 flex-shrink-0 flex items-center justify-center font-black text-sm transition-colors ${
                              isDraftSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-700'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className="text-base sm:text-lg leading-relaxed pt-0.5 font-medium">
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {useBubbleSheet && (
                  <div className="mt-8 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    {showGuides ? <span>Borrador del folleto (no califica)</span> : <span />}
                    <button
                      type="button"
                      onClick={() => setView('BUBBLE_SHEET')}
                      className="text-blue-600 hover:underline font-black"
                    >
                      Ir a Hoja de Respuestas →
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Pagination */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                  className="flex items-center gap-2 px-5 sm:px-7 py-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm font-black text-xs uppercase tracking-widest text-gray-600 hover:text-blue-600 disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft size={18} />
                  Anterior
                </button>

                {currentIndex === questions.length - 1 ? (
                  useBubbleSheet ? (
                    <button
                      type="button"
                      onClick={() => setView('BUBBLE_SHEET')}
                      className="flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 shadow-lg transition-all"
                    >
                      Ir a Hoja de Respuestas
                      <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmFinish(true)}
                      className="flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 transition-all"
                    >
                      Finalizar y Calificar
                      <ChevronRight size={18} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => goToQuestion(currentIndex + 1)}
                    className="flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    Siguiente
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      )}

      {/* FINISHED VIEW */}
      {status === 'FINISHED' && (() => {
        const res = calculateResult();
        return (
          <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 pb-16 space-y-8">
            <div className="bg-blue-600 rounded-[2rem] p-8 sm:p-12 text-white text-center shadow-xl shadow-blue-200">
              <p className="uppercase tracking-widest text-xs font-black mb-3 opacity-80">
                {useUcrScale ? 'Promedio de Admisión Estimado' : 'Calificación Obtenida (0 – 100)'}
              </p>
              <h2 className="text-6xl sm:text-8xl font-black tracking-tight mb-4">
                {useUcrScale ? res.puntaje : res.notaPAA}
              </h2>
              <div className="max-w-xs mx-auto h-1 bg-white/25 rounded-full mb-4" />
              <p className="text-base sm:text-lg font-bold">
                {res.correctas} aciertos de {res.total} preguntas
                {useUcrScale ? ` (${res.notaPAA}%)` : ''}
              </p>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-6 text-xs sm:text-sm font-bold opacity-85">
                <span>Tiempo empleado: {formatTime(timeElapsed)}</span>
                <span>Tiempo restante: {formatTime(res.tiempoRestante)}</span>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-sm border border-gray-100">
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-8 flex items-center gap-3 pb-5 border-b border-gray-100">
                <FileText className="text-blue-600" />
                Informe Detallado
              </h3>

              <div className="space-y-12">
                {questions.map((q, idx) => {
                  const userChoice = activeAnswers[idx];
                  const isCorrect = userChoice === q.correcta;
                  const wasAnswered = userChoice !== undefined;

                  return (
                    <div
                      key={`report-${q._id || idx}`}
                      className="border-b border-gray-100 pb-10 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-4 sm:gap-5 mb-6">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-white flex-shrink-0 text-base sm:text-lg ${
                            isCorrect ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                              {q.tipo}
                              {q.subtipo ? ` • ${q.subtipo}` : ''}
                            </span>
                            {!wasAnswered && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                                {useBubbleSheet ? 'Omitida en hoja' : 'Omitida'}
                              </span>
                            )}
                          </div>
                          {q.imageUrl && (
                            <div className="mb-4 bg-gray-50 border border-gray-100 rounded-2xl p-3 flex justify-center">
                              <img
                                src={q.imageUrl}
                                alt={`Imagen de apoyo pregunta ${idx + 1}`}
                                className="max-h-64 object-contain rounded-xl"
                              />
                            </div>
                          )}
                          <h4 className="text-base sm:text-lg text-gray-800 font-semibold leading-relaxed whitespace-pre-line">
                            {q.pregunta}
                          </h4>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-0 sm:ml-16">
                        {q.respuestas.map((ans, aIdx) => {
                          const isThisCorrect = aIdx === q.correcta;
                          const isThisUserChoice = aIdx === userChoice;

                          let cardClass = 'bg-gray-50 border-gray-100 text-gray-500 opacity-75';
                          if (isThisCorrect) {
                            cardClass =
                              'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold opacity-100';
                          }
                          if (isThisUserChoice && !isThisCorrect) {
                            cardClass =
                              'bg-red-50 border-red-500 text-red-900 font-bold opacity-100';
                          }

                          return (
                            <div
                              key={`ans-report-${idx}-${aIdx}`}
                              className={`p-4 rounded-2xl border-2 text-sm flex items-center gap-3 ${cardClass}`}
                            >
                              <div
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                  isThisUserChoice
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'border-current'
                                }`}
                              >
                                {String.fromCharCode(65 + aIdx)}
                              </div>
                              <span className="flex-1">{ans}</span>
                              {isThisCorrect && <CheckCircle2 size={18} className="flex-shrink-0" />}
                              {isThisUserChoice && !isThisCorrect && (
                                <XCircle size={18} className="flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explicacion && (
                        <div className="ml-0 sm:ml-16 mt-5 p-5 bg-blue-50/70 border-l-4 border-blue-600 rounded-r-2xl">
                          <p className="flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-wider mb-2">
                            <HelpCircle size={14} /> Explicación Académica
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">{q.explicacion}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('IDLE')}
                  className="flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                >
                  <RotateCcw size={18} /> Repetir Examen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus('LIST');
                    setSelectedExam(null);
                  }}
                  className="py-4 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all text-sm uppercase tracking-wider"
                >
                  Elegir Otro
                </button>
              </div>
            </div>
          </main>
        );
      })()}

      {/* Confirmation Modal */}
      {showConfirmFinish && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmFinish(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity"
        >
          <div className="bg-white max-w-md w-full p-8 rounded-[2rem] shadow-2xl border border-gray-100 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={34} />
            </div>
            <h4 className="text-2xl font-black text-gray-900">¿Finalizar Examen?</h4>
            <p className="text-gray-500 text-sm leading-relaxed">
              {useBubbleSheet ? (
                <>
                  Se calificarán únicamente las{' '}
                  <strong>{answeredCount} respuestas</strong> marcadas en la Hoja de Respuestas.
                </>
              ) : (
                <>
                  Se calificarán las <strong>{answeredCount} respuestas</strong> marcadas en el folleto.
                </>
              )}
              {omittedCount > 0 && (
                <>
                  {' '}
                  Tienes <strong>{omittedCount}</strong>{' '}
                  {omittedCount === 1 ? 'pregunta sin marcar' : 'preguntas sin marcar'}.
                </>
              )}
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStatus('FINISHED');
                  setShowConfirmFinish(false);
                }}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl tracking-wider uppercase text-xs shadow-lg shadow-red-200 transition-all"
              >
                Sí, entregar ahora
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmFinish(false)}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl tracking-wider uppercase text-xs transition-all"
              >
                Volver a revisar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default ExamPracticePage;
