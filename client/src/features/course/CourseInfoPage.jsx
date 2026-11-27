import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Code2,
  CreditCard,
  FileText,
  GraduationCap,
  HeartHandshake,
  Laptop,
  Layers,
  ListChecks,
  LogIn,
  Sparkles,
  Target,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import logo from '/logo.png';

const SYNC_FEATURES = [
  {
    icon: BookOpen,
    title: 'Bases Teóricas',
    desc: 'Dominio completo de los conceptos esenciales para el examen.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Target,
    title: 'Estrategias de Resolución',
    desc: 'Métodos paso a paso para resolver cada tipo de ítem según su nivel de complejidad.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: FileText,
    title: 'Ejemplos e Ítems Reales',
    desc: 'Análisis y resolución guiada de reactivos y exámenes de años anteriores.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Clock,
    title: 'Control de Tiempo y Presión',
    desc: 'Técnicas para optimizar tu rendimiento y confianza en el examen.',
    color: 'bg-red-50 text-red-600',
  },
  {
    icon: ClipboardCheck,
    title: 'Simulacros en Vivo',
    desc: 'Aplicación de pruebas diagnósticas con análisis posterior.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Users,
    title: 'Atención Personalizada',
    desc: 'Espacios dedicados para responder dudas directas y brindar tips específicos.',
    color: 'bg-amber-50 text-amber-600',
  },
];

const ASYNC_GROUPS = [
  {
    title: 'Plataforma Virtual 24/7',
    icon: Laptop,
    accent: 'border-blue-100 bg-blue-50/40',
    badge: 'bg-blue-600 text-white',
    items: [
      {
        icon: Video,
        title: 'Grabaciones de las clases',
        desc: 'Para revisar el contenido cuantas veces necesites.',
      },
      {
        icon: Layers,
        title: 'Extenso banco de preguntas interactivas',
        desc: 'Practica por temas y niveles de dificultad a tu propio ritmo.',
      },
      {
        icon: ClipboardCheck,
        title: 'Simulador con Hoja de Respuestas Digital',
        desc: 'Experimenta la presión y dinámica real del examen para ganar confianza e intuición.',
      },
    ],
  },
  {
    title: 'Guías de Optimización',
    icon: Sparkles,
    accent: 'border-purple-100 bg-purple-50/40',
    badge: 'bg-purple-600 text-white',
    items: [
      {
        icon: Brain,
        title: 'Uso de Inteligencia Artificial',
        desc: 'Aprende a utilizar herramientas de IA como tutor personal para generar tus propios exámenes y ejercicios de práctica.',
      },
      {
        icon: BookOpen,
        title: 'Técnicas de Lectura',
        desc: 'Métodos directos para extracción de ideas principales, secundarias y paráfrasis eficiente.',
      },
      {
        icon: Calculator,
        title: 'Cálculo Mental',
        desc: 'Atajos matemáticos para agilizar operaciones básicas sin perder tiempo.',
      },
    ],
  },
  {
    title: 'Vocabulario y Práctica',
    icon: ListChecks,
    accent: 'border-emerald-100 bg-emerald-50/40',
    badge: 'bg-emerald-600 text-white',
    items: [
      {
        icon: FileText,
        title: 'Listado de 500 Palabras Clave',
        desc: 'Un glosario curado de términos cultos y de uso frecuente en las pruebas de admisión que suelen confundir a los postulantes.',
      },
      {
        icon: Calendar,
        title: 'Quiz Quincenal (durante 9 meses)',
        desc: 'Mantiene la disciplina y el ritmo de práctica activo durante todo el año escolar.',
      },
    ],
  },
  {
    title: 'Mentalidad',
    icon: HeartHandshake,
    accent: 'border-orange-100 bg-orange-50/40',
    badge: 'bg-orange-500 text-white',
    items: [
      {
        icon: Award,
        title: 'Módulos de preparación mental',
        desc: 'Para mantener la calma, gestionar la ansiedad y desarrollar constancia antes y durante la aplicación del examen.',
      },
    ],
  },
];

const ENROLL_STEPS = [
  {
    step: 1,
    text: 'Registrarte en la página de inicio',
  },
  {
    step: 2,
    text: 'Dirígete a "Pagos"',
  },
  {
    step: 3,
    text: 'Selecciona el curso que vas a adquirir',
  },
  {
    step: 4,
    text: 'Realiza el pago vía SINPE Móvil poniendo en el detalle el código del curso',
    highlight: 'poniendo en el detalle el código del curso',
  },
  {
    step: 5,
    text: 'Sube el comprobante en dicha sección de Pagos',
  },
  {
    step: 6,
    text: 'Dale a "Enviar comprobante"',
  },
  {
    step: 7,
    text: '¡Listo! Disfruta de los recursos y clases de tu curso',
  },
];

const TUTOR_HIGHLIGHTS = [
  {
    icon: Award,
    text: 'Segundo Mejor Promedio de Admisión a la UCR en el Proceso 2026-2027',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: GraduationCap,
    text: 'Egresado del CTP Don Bosco como Primer Promedio',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Code2,
    text: 'Técnico Medio en Desarrollo Web',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Users,
    text: 'Más de 3 años dando clases a compañeros y estudiantes de otras instituciones',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Sparkles,
    text: 'Apoyo continuo y adaptabilidad de clases para que el estudiante no solo escuche, sino que entienda',
    color: 'bg-emerald-50 text-emerald-600',
  },
];

const CourseInfoPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isClosingEnrollModal, setIsClosingEnrollModal] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [isIntroExiting, setIsIntroExiting] = useState(false);
  const closeModalTimerRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));

    const exitTimer = setTimeout(() => {
      setIsIntroExiting(true);
    }, 2000);

    const hideTimer = setTimeout(() => {
      setShowIntro(false);
    }, 2750);

    return () => {
      cancelAnimationFrame(id);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
      if (closeModalTimerRef.current) {
        clearTimeout(closeModalTimerRef.current);
      }
    };
  }, []);

  const openEnrollModal = () => {
    if (closeModalTimerRef.current) {
      clearTimeout(closeModalTimerRef.current);
      closeModalTimerRef.current = null;
    }
    setIsClosingEnrollModal(false);
    setShowEnrollModal(true);
  };

  const closeEnrollModal = () => {
    if (!showEnrollModal || isClosingEnrollModal) return;
    setIsClosingEnrollModal(true);
    closeModalTimerRef.current = setTimeout(() => {
      setShowEnrollModal(false);
      setIsClosingEnrollModal(false);
      closeModalTimerRef.current = null;
    }, 180);
  };

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
          html { scroll-behavior: smooth; }
          @keyframes floatSlow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes modalPop {
            0% { opacity: 0; transform: scale(0.95) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes modalOut {
            0% { opacity: 1; transform: scale(1) translateY(0); }
            100% { opacity: 0; transform: scale(0.95) translateY(8px); }
          }
          @keyframes backdropIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes backdropOut {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes introZoomIn {
            0% { opacity: 0; transform: scale(0.88) translateY(14px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes curtainLift {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-100%); opacity: 0.96; }
          }
        `}
      </style>

      {showIntro &&
        createPortal(
          <div
            style={{
              animation: isIntroExiting
                ? 'curtainLift 0.75s cubic-bezier(0.77, 0, 0.175, 1) forwards'
                : 'none',
            }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div
              style={{ animation: 'introZoomIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              className="flex flex-col items-center gap-6 max-w-2xl"
            >
              <img
                src={logo}
                alt="Piedra Rosetta"
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_12px_32px_rgba(59,130,246,0.35)]"
              />
              <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
                ¿Quieres entrar a la <span className="text-blue-400">U Pública</span>?
              </h1>
              <div className="w-16 h-1.5 rounded-full bg-blue-500/80" />
            </div>
          </div>,
          document.body
        )}

      {/* Navbar */}
      <nav className="bg-white/95 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm sticky top-0 z-30 border-b border-gray-100">
        <div
          onClick={() => navigate('/login')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <img src={logo} alt="Piedra Rosetta" className="w-9 h-9 object-contain" />
          <span className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">
            Rosetta
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToSection('modalidad')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Modalidad
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('inversion')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Inversión
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contenido')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Contenido
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('tutor')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Tutor
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5"
          >
            <LogIn size={16} />
            <span className="hidden sm:inline">Iniciar sesión</span>
          </button>
          <button
            type="button"
            onClick={openEnrollModal}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            Inscríbete Ahora
          </button>
        </div>
      </nav>

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12 flex-1">
        {/* Hero */}
        <section className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-50 rounded-full opacity-70 pointer-events-none" />
          <div className="absolute -left-12 -bottom-16 w-56 h-56 bg-purple-50 rounded-full opacity-70 pointer-events-none" />

          <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-6">
             

              <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Rosetta es tu Curso de Preparación para la{' '}
                <span className="text-blue-600">Admisión Universitaria</span>
              </h1>

              <p className="text-gray-500 text-base sm:text-lg font-medium leading-relaxed max-w-2xl">
                Conoce a detalle la propuesta teórica y práctica diseñada para acompañarte paso a
                paso hasta alcanzar tu meta de ingresar a la universidad pública.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="px-7 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                >
                  Inscríbete Ahora
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('contenido')}
                  className="px-6 py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm sm:text-base transition-all"
                >
                  Ver contenido completo
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 flex justify-center">
              <div
                style={{ animation: 'floatSlow 4s ease-in-out infinite' }}
                className="w-full max-w-xs bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2.2rem] p-7 shadow-xl shadow-blue-200 space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-blue-100">
                    Acompañamiento en vivo
                  </p>
                  <p className="text-4xl font-extrabold mt-1">48 Horas</p>
                  <p className="text-sm text-blue-100 font-medium mt-1">
                    100% Virtual · Plataforma 24/7
                  </p>
                </div>
                <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs font-bold">
                  <span>Continúa para ver los</span>
                  <span className="bg-emerald-400 text-slate-900 px-3 py-1 rounded-full font-black">
                    BENEFICIOS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Estructura y Modalidad */}
        <section id="modalidad" className="space-y-6 scroll-mt-24">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Estructura y Modalidad
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Organización diseñada para maximizar tu aprendizaje durante todo el año
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Laptop,
                label: 'Modalidad',
                value: '100% Virtual',
                desc: 'Conéctate desde cualquier lugar con acceso en vivo y grabaciones.',
                accent: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Video,
                label: 'Fase 1 (Sincrónica intensiva)',
                value: '12 clases de 3h',
                desc: 'Entre enero y marzo para dominar todas las bases y estrategias.',
                accent: 'bg-indigo-50 text-indigo-600',
              },
              {
                icon: Sparkles,
                label: 'Fase 2 (Refuerzo previo)',
                value: '4 clases de 3h',
                desc: 'En julio, enfocadas en repaso intensivo previo al examen.',
                accent: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Clock,
                label: 'Total sincrónico',
                value: '48 horas en vivo',
                desc: 'Acompañamiento directo para resolver dudas y practicar.',
                accent: 'bg-emerald-50 text-emerald-600',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-12 h-12 rounded-2xl ${item.accent} flex items-center justify-center mb-4`}>
                      <Icon size={22} />
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                      {item.label}
                    </p>
                    <h3 className="text-xl font-extrabold text-gray-900 mt-1">{item.value}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Inversión y Formas de Pago */}
        <section id="inversion" className="space-y-6 scroll-mt-24">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Inversión y Formas de Pago
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Opciones accesibles para reservar tu espacio con anticipación
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white rounded-[2.2rem] p-7 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Precio Base
                </p>
                <p className="text-4xl font-extrabold text-gray-900 mt-2">50 000</p>
                <p className="text-sm text-gray-500 font-medium mt-2">
                  Acceso completo a las 48 horas sincrónicas y plataforma virtual 24/7.
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-[2.2rem] p-7 shadow-lg shadow-emerald-100 relative overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[11px] font-black uppercase tracking-widest mb-3">
                  <Sparkles size={13} />
                  Primeros 20 matriculados
                </div>
                <h3 className="text-xl font-extrabold">Matrícula Temprana · 20% OFF</h3>
                <p className="text-4xl font-black mt-2">40 000</p>
                <p className="text-xs text-emerald-50 font-medium mt-2">
                  Asegura tu cupo dentro de los primeros <b>20</b> estudiantes inscritos y obtén el precio especial.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-[2.2rem] p-7 sm:p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">Plan de Pago en 4 Tractos</h3>
                <p className="text-sm text-gray-500 font-medium mt-1 mb-6">
                  Divide tu inversión cómodamente en cuatro pagos mensuales
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { num: 'Tracto 1', title: 'Pago Inicial', month: 'Diciembre (reserva de cupo)' },
                    { num: 'Tracto 2', title: 'Primer Mes', month: 'Enero' },
                    { num: 'Tracto 3', title: 'Segundo Mes', month: 'Febrero' },
                    { num: 'Tracto 4', title: 'Tercer Mes', month: 'Marzo' },
                  ].map((tracto) => (
                    <div
                      key={tracto.num}
                      className="rounded-2xl bg-gray-50 border border-gray-100 p-4 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        {tracto.num}
                      </span>
                      <p className="text-base font-extrabold text-gray-900 mt-0.5">{tracto.title}</p>
                      <p className="text-xs font-semibold text-gray-500 mt-1">{tracto.month}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-gray-500">
                  ¿Listo para reservar tu lugar?
                </p>
                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all"
                >
                  Ver guía de matrícula
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Contenido del Curso */}
        <section id="contenido" className="space-y-10 scroll-mt-24">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Brain size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Contenido del Curso
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Combinación de clases en vivo y acompañamiento continuo en plataforma
              </p>
            </div>
          </div>

          {/* 1. Fase Sincrónica */}
          <div className="bg-white rounded-[2.5rem] p-7 sm:p-10 border border-gray-100 shadow-sm space-y-6">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-black uppercase tracking-widest mb-2">
                Parte 1
              </span>
              <h3 className="text-2xl font-extrabold text-gray-900">
                Fase Sincrónica (Clases en Vivo)
              </h3>
              <p className="text-sm text-gray-500 font-medium mt-1">
                En cada sesión sincrónica abordamos los pilares teóricos fundamentales para asegurar tu rendimiento:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SYNC_FEATURES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-3xl bg-gray-50 border border-gray-100 p-5 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className={`w-11 h-11 rounded-2xl ${item.color} flex items-center justify-center mb-3`}>
                      <Icon size={20} />
                    </div>
                    <h4 className="text-base font-extrabold text-gray-900">{item.title}</h4>
                    <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Fase Asincrónica */}
          <div className="space-y-5">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-[11px] font-black uppercase tracking-widest mb-2">
                Parte 2
              </span>
              <h3 className="text-2xl font-extrabold text-gray-900">
                Fase Asincrónica (Plataforma y Acompañamiento)
              </h3>
              <p className="text-sm text-gray-500 font-medium mt-1">
                El aprendizaje continúa fuera del aula virtual con recursos exclusivos diseñados para optimizar tu tiempo y rendimiento:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ASYNC_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div
                    key={group.title}
                    className={`bg-white rounded-[2.2rem] p-7 border shadow-sm hover:shadow-xl transition-all duration-300 ${group.accent}`}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`w-11 h-11 rounded-2xl ${group.badge} flex items-center justify-center shadow-sm`}>
                        <GroupIcon size={20} />
                      </div>
                      <h4 className="text-lg font-extrabold text-gray-900">{group.title}</h4>
                    </div>

                    <div className="space-y-4">
                      {group.items.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <div
                            key={sub.title}
                            className="bg-white rounded-2xl p-4 border border-gray-100 flex items-start gap-3"
                          >
                            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                              <SubIcon size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{sub.title}</p>
                              <p className="text-xs text-gray-500 font-medium mt-0.5 leading-relaxed">
                                {sub.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tutor */}
        <section id="tutor" className="space-y-6 scroll-mt-24">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Tutor
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Conoce quién te acompañará durante todo tu proceso de preparación
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-7 sm:p-10 border border-gray-100 shadow-sm grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-black uppercase tracking-widest">
                <Award size={14} />
                Instructor Principal
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                Jafet A. Rojas Bello
              </h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Para mí, no hay montaña tan alta ni valle tan bajo. Todo camino puede ser conquistado con disciplina, constancia y una mentalidad positiva. Es por eso que quiero ayudarde a lograr tus más grandes metas.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {TUTOR_HIGHLIGHTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.text}
                    className={`rounded-2xl bg-gray-50 border border-gray-100 p-4 flex items-center gap-3.5 hover:bg-white hover:shadow-md transition-all ${
                      idx === TUTOR_HIGHLIGHTS.length - 1 ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-snug">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-slate-900 text-white rounded-[2.5rem] p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              ¿Listo para dar el siguiente paso hacia la <span className="text-blue-500">Universidad Pública</span>?
            </h2>
            <p className="text-sm sm:text-base text-gray-300 font-medium">
              Sigue la guía de matrícula y comienza tu preparación con Rosetta.
            </p>
          </div>
          <button
            type="button"
            onClick={openEnrollModal}
            className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-0.5 active:scale-95 shrink-0 flex items-center gap-2"
          >
            Inscríbete Ahora
            <ArrowRight size={18} />
          </button>
        </section>
      </main>

      {/* Modal Guía de Matrícula (rendered via portal to stay viewport-centered) */}
      {showEnrollModal &&
        createPortal(
          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeEnrollModal();
              }
            }}
            style={{
              animation: isClosingEnrollModal
                ? 'backdropOut 0.18s ease-in forwards'
                : 'backdropIn 0.2s ease-out forwards',
            }}
            className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm p-4 flex items-center justify-center"
          >
            <div
              style={{
                animation: isClosingEnrollModal
                  ? 'modalOut 0.18s ease-in forwards'
                  : 'modalPop 0.22s ease-out forwards',
              }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-10 max-w-xl w-full shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto font-['Poppins']"
            >
              <button
                type="button"
                onClick={closeEnrollModal}
                className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-gray-100 hover:bg-red-500 hover:text-white text-gray-600 transition-colors flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    Guía de matrícula
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                    ¿Cómo me puedo inscribir?
                  </h3>
                </div>
              </div>

              <div className="space-y-3 mb-7">
                {ENROLL_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="flex items-center gap-3.5 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5"
                  >
                    <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">
                      {item.highlight ? (
                        <>
                          Realiza el pago vía SINPE Móvil{' '}
                          <strong className="text-blue-700 font-black">{item.highlight}</strong>
                        </>
                      ) : (
                        item.text
                      )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollModal(false);
                    navigate('/registro');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-sm transition-all"
                >
                  Ir a Registrarse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollModal(false);
                    navigate('/pagos');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-lg shadow-blue-200 transition-all"
                >
                  Ir a Pagos
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default CourseInfoPage;
