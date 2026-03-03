import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Image as ImageIcon,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const CHECK_LABELS = {
  hasBillNumber: 'Comprobante/documento detectado',
  hasDate: 'Fecha detectada',
  amountMatches: 'Monto correcto',
  detailMatches: 'Detalle correcto',
  recipientMatches: 'Destinatario correcto',
};

const formatDateTime = (value) => {
  if (!value) return '--/--/---- --:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--/---- --:--';
  return date.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getClassSubject = (cls) => cls?.subject?.name || 'Sin materia';

const getGoogleDriveFileId = (url = '') => {
  const normalizedUrl = String(url || '').trim();

  const idFromQuery = normalizedUrl.match(/[?&]id=([^&]+)/);
  if (idFromQuery?.[1]) return idFromQuery[1];

  const idFromPath = normalizedUrl.match(/\/d\/([^/?#]+)/);
  if (idFromPath?.[1]) return idFromPath[1];

  const idFromLh3 = normalizedUrl.match(/lh3\.googleusercontent\.com\/d\/([^/?#]+)/i);
  if (idFromLh3?.[1]) return idFromLh3[1];

  return '';
};

const getPaymentImageUrl = (billUrl = '') => {
  const fileId = getGoogleDriveFileId(billUrl);
  if (!fileId) return billUrl;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
};

const getPaymentImageDriveUrl = (billUrl = '') => {
  const fileId = getGoogleDriveFileId(billUrl);
  if (!fileId) return billUrl;
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

const getPaymentImageLh3Url = (billUrl = '') => {
  const fileId = getGoogleDriveFileId(billUrl);
  if (!fileId) return '';
  return `https://lh3.googleusercontent.com/d/${fileId}`;
};

const IMAGE_ZOOM_ANIMATION_MS = 220;
const APPROVAL_ANIMATION_MS = 360;

const AdminPaymentsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [expandedPendingId, setExpandedPendingId] = useState('');
  const [expandedRegisteredId, setExpandedRegisteredId] = useState('');
  const [payments, setPayments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [query, setQuery] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeClassInfoId, setActiveClassInfoId] = useState('');
  const [zoomedImageSrc, setZoomedImageSrc] = useState('');
  const [zoomedImageAlt, setZoomedImageAlt] = useState('');
  const [isZoomClosing, setIsZoomClosing] = useState(false);
  const [isZoomEntering, setIsZoomEntering] = useState(false);
  const [animatingApprovedIds, setAnimatingApprovedIds] = useState([]);
  const zoomCloseTimerRef = useRef(null);
  const zoomEnterRafRef = useRef(null);
  const approvalTimersRef = useRef({});

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentsResponse, classesResponse, studentsResponse] = await Promise.all([
          api.get('/payments/all'),
          api.get('/classes'),
          api.get('/admin/students'),
        ]);

        setPayments(paymentsResponse.data?.data || []);
        setClasses(classesResponse.data?.data || []);
        setStudents(studentsResponse.data?.data || []);
      } catch (_requestError) {
        setError('No se pudieron cargar los pagos para administración.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const isInsideTrigger = target.closest('[data-class-info-trigger="true"]');
      const isInsideBubble = target.closest('[data-class-info-bubble="true"]');
      if (!isInsideTrigger && !isInsideBubble) {
        setActiveClassInfoId('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (zoomCloseTimerRef.current) {
        clearTimeout(zoomCloseTimerRef.current);
      }
      if (zoomEnterRafRef.current) {
        cancelAnimationFrame(zoomEnterRafRef.current);
      }

      Object.values(approvalTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
    };
  }, []);

  const classesByCode = useMemo(() => {
    return (classes || []).reduce((accumulator, cls) => {
      accumulator[String(cls.classCode || '').trim()] = cls;
      return accumulator;
    }, {});
  }, [classes]);

  const studentsByEmail = useMemo(() => {
    return (students || []).reduce((accumulator, student) => {
      const email = String(student?.email || '').toLowerCase().trim();
      if (!email) return accumulator;

      const fullName = `${String(student?.name || '').trim()} ${String(student?.lastName || '').trim()}`.trim();
      accumulator[email] = fullName || student?.email || '';
      return accumulator;
    }, {});
  }, [students]);

  const getStudentDisplayName = (email = '') => {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    return studentsByEmail[normalizedEmail] || email || 'Estudiante';
  };

  const pendingPayments = useMemo(() => {
    return (payments || [])
      .filter((payment) => payment.status === 'pendiente')
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }, [payments]);

  const sortablePayments = useMemo(() => {
    const loweredQuery = String(query || '').toLowerCase().trim();

    const filtered = (payments || []).filter((payment) => {
      const cls = classesByCode[String(payment.classCode || '').trim()];
      const subjectName = getClassSubject(cls);
      const studentName = getStudentDisplayName(payment.studentEmail);
      const haystack = `${payment.paymentId} ${payment.studentEmail} ${studentName} ${payment.classCode} ${subjectName}`.toLowerCase();
      return loweredQuery ? haystack.includes(loweredQuery) : true;
    });

    return filtered.sort((left, right) => {
      const leftClass = classesByCode[String(left.classCode || '').trim()];
      const rightClass = classesByCode[String(right.classCode || '').trim()];

      let comparison = 0;
      if (sortBy === 'classCode') {
        comparison = String(left.classCode || '').localeCompare(String(right.classCode || ''));
      } else if (sortBy === 'studentEmail') {
        comparison = String(left.studentEmail || '').localeCompare(String(right.studentEmail || ''));
      } else if (sortBy === 'subject') {
        comparison = getClassSubject(leftClass).localeCompare(getClassSubject(rightClass));
      } else {
        comparison = new Date(left.createdAt) - new Date(right.createdAt);
      }

      return sortOrder === 'asc' ? comparison : comparison * -1;
    });
  }, [payments, classesByCode, sortBy, sortOrder, query, studentsByEmail]);

  const handleStatusUpdate = async (paymentId, status) => {
    if (!paymentId) return;

    setUpdatingId(paymentId);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(`/payments/${paymentId}/status`, { status });
      const updatedPayment = response.data?.data;

      if (updatedPayment?.paymentId) {
        if (status === 'aprobado') {
          setAnimatingApprovedIds((prev) =>
            prev.includes(paymentId) ? prev : [...prev, paymentId]
          );

          if (approvalTimersRef.current[paymentId]) {
            clearTimeout(approvalTimersRef.current[paymentId]);
          }

          approvalTimersRef.current[paymentId] = setTimeout(() => {
            setPayments((prev) =>
              prev.map((item) => (item.paymentId === updatedPayment.paymentId ? updatedPayment : item))
            );
            setAnimatingApprovedIds((prev) => prev.filter((id) => id !== paymentId));
            delete approvalTimersRef.current[paymentId];
          }, APPROVAL_ANIMATION_MS);
        } else {
          setPayments((prev) =>
            prev.map((item) => (item.paymentId === updatedPayment.paymentId ? updatedPayment : item))
          );
        }
      }

      if (expandedPendingId === paymentId && status !== 'pendiente') {
        setExpandedPendingId('');
      }

      setSuccess(
        status === 'aprobado'
          ? 'Pago aprobado correctamente.'
          : 'Pago rechazado y comprobante eliminado de Drive (si existía).'
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo actualizar el estado del pago.');
    } finally {
      setUpdatingId('');
    }
  };

  const closeImageZoom = () => {
    if (!zoomedImageSrc || isZoomClosing) return;

    setIsZoomClosing(true);
    if (zoomCloseTimerRef.current) {
      clearTimeout(zoomCloseTimerRef.current);
    }

    zoomCloseTimerRef.current = setTimeout(() => {
      setZoomedImageSrc('');
      setZoomedImageAlt('');
      setIsZoomClosing(false);
      setIsZoomEntering(false);
      zoomCloseTimerRef.current = null;
    }, IMAGE_ZOOM_ANIMATION_MS);
  };

  const openImageZoom = ({ src = '', alt = '' }) => {
    if (!src) return;

    if (zoomedImageSrc === src && !isZoomClosing) {
      closeImageZoom();
      return;
    }

    if (zoomCloseTimerRef.current) {
      clearTimeout(zoomCloseTimerRef.current);
      zoomCloseTimerRef.current = null;
    }

    if (zoomEnterRafRef.current) {
      cancelAnimationFrame(zoomEnterRafRef.current);
      zoomEnterRafRef.current = null;
    }

    setIsZoomClosing(false);
    setIsZoomEntering(true);
    setZoomedImageSrc(src);
    setZoomedImageAlt(alt || 'Comprobante');

    zoomEnterRafRef.current = requestAnimationFrame(() => {
      setIsZoomEntering(false);
      zoomEnterRafRef.current = null;
    });
  };

  const handleReceiptImageError = (event, billUrl = '') => {
    const image = event.currentTarget;
    const fallbackStep = Number(image.dataset.fallbackStep || '0');
    const originalUrl = String(billUrl || '').trim();
    const driveUrl = getPaymentImageDriveUrl(originalUrl);
    const lh3Url = getPaymentImageLh3Url(originalUrl);

    if (fallbackStep <= 0 && driveUrl) {
      image.dataset.fallbackStep = '1';
      image.src = driveUrl;
      return;
    }

    if (fallbackStep <= 1 && lh3Url) {
      image.dataset.fallbackStep = '2';
      image.src = lh3Url;
      return;
    }

    if (fallbackStep <= 2 && originalUrl) {
      image.dataset.fallbackStep = '3';
      image.src = originalUrl;
      return;
    }

    image.style.display = 'none';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col overflow-x-hidden transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-800 tracking-tight truncate">
              Administrar pagos
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Revisa pendientes y gestiona comprobantes</p>
          </div>
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
          <CreditCard size={20} className="sm:w-6 sm:h-6" />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 grid lg:grid-cols-12 gap-5 sm:gap-8 overflow-x-hidden">
        <section className="lg:col-span-7 w-full max-w-3xl lg:max-w-none mx-auto space-y-3 sm:space-y-4 min-w-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-3.5 sm:p-7 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">Pagos pendientes</h2>
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-100">
                {pendingPayments.length}
              </span>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-6 text-xs sm:text-sm font-semibold text-gray-500">
                No hay pagos pendientes por revisar.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {pendingPayments.map((payment) => {
                  const cls = classesByCode[String(payment.classCode || '').trim()];
                  const isExpanded = expandedPendingId === payment.paymentId;
                  const isApprovingAnimation = animatingApprovedIds.includes(payment.paymentId);
                  const isBusy = updatingId === payment.paymentId || isApprovingAnimation;
                  const isClassBubbleVisible = activeClassInfoId === payment.paymentId;
                  const expectedClassCode = String(cls?.classCode || payment.classCode || '--');
                  const shortExpectedClassCode =
                    expectedClassCode.length > 14
                      ? `${expectedClassCode.slice(0, 12)}…`
                      : expectedClassCode;
                  const expectedClassPrice = Number.isFinite(Number(cls?.price))
                    ? Number(cls?.price)
                    : '--';
                  const checks = payment.validationChecks || {};
                  const failedChecks = Object.entries(CHECK_LABELS).filter(([key]) => checks[key] === false);

                  return (
                    <div
                      key={payment.paymentId}
                      className={`rounded-xl sm:rounded-2xl border overflow-hidden min-w-0 transition-all duration-300 ease-out ${
                        isApprovingAnimation
                          ? 'opacity-0 scale-[0.985] -translate-y-1 border-emerald-200 bg-emerald-50'
                          : 'opacity-100 scale-100 translate-y-0 border-gray-100 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedPendingId((prev) => (prev === payment.paymentId ? '' : payment.paymentId));
                          setActiveClassInfoId('');
                        }}
                        className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 sm:gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-gray-900 truncate">{payment.classCode} · {cls?.title || 'Clase'}</p>
                          <p className="text-xs font-semibold text-gray-500 truncate">{getStudentDisplayName(payment.studentEmail)}</p>
                        </div>
                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-out ${
                          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="px-2.5 sm:px-4 pb-3 sm:pb-4 bg-gray-50 border-t border-gray-100 space-y-3 sm:space-y-4 min-w-0">
                          <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 min-w-0">
                            <div className="rounded-xl bg-white border border-gray-100 p-2.5 sm:p-3 relative min-w-0">
                              <button
                                type="button"
                                data-class-info-trigger="true"
                                onMouseEnter={() => setActiveClassInfoId(payment.paymentId)}
                                onMouseLeave={() => setActiveClassInfoId((prev) => (prev === payment.paymentId ? '' : prev))}
                                onClick={() =>
                                  setActiveClassInfoId((prev) =>
                                    prev === payment.paymentId ? '' : payment.paymentId
                                  )
                                }
                                className="w-full text-left"
                              >
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clase</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1 truncate">{cls?.title || 'Sin título'}</p>
                                <p className="text-xs text-gray-500 truncate">{getClassSubject(cls)}</p>
                              </button>

                              <div
                                data-class-info-bubble="true"
                                className={`absolute z-20 top-full left-0 mt-2 w-[10.5rem] max-w-[calc(100vw-4rem)] rounded-lg border border-blue-100 bg-white shadow-md px-2 py-1.5 transition-all duration-200 ease-out origin-top-left ${
                                  isClassBubbleVisible
                                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                                    : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'
                                }`}
                              >
                                <p className="text-[10px] font-semibold text-gray-700 leading-tight truncate">
                                  <span className="text-gray-400">Cod:</span> {shortExpectedClassCode}
                                </p>
                                <p className="text-[10px] font-semibold text-gray-700 leading-tight mt-0.5 truncate">
                                  <span className="text-gray-400">Monto:</span> {expectedClassPrice}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-2.5 sm:p-3 min-w-0">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comprobante</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1 break-all">{payment.billNumber || 'No detectado'}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(payment.createdAt)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                            <div className="rounded-xl bg-white border border-gray-100 p-2.5 min-w-0">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto leído</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1 truncate">{payment.amount ?? '--'}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-2.5 min-w-0">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Destinatario</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1 break-words max-h-10 overflow-hidden">{payment.recipient || '--'}</p>
                            </div>
                            <div className="rounded-xl bg-white border border-gray-100 p-2.5 min-w-0">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1 break-words max-h-10 overflow-hidden">{payment.detail || '--'}</p>
                            </div>
                          </div>

                          <div className="rounded-xl bg-white border border-gray-100 p-2.5 sm:p-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">¿Por qué quedó pendiente?</p>
                            {Array.isArray(payment.validationErrors) && payment.validationErrors.length > 0 ? (
                              <ul className="space-y-1">
                                {payment.validationErrors.map((reason) => (
                                  <li key={`${payment.paymentId}-${reason}`} className="text-xs font-bold text-amber-700">• {reason}</li>
                                ))}
                              </ul>
                            ) : failedChecks.length > 0 ? (
                              <ul className="space-y-1">
                                {failedChecks.map(([key, label]) => (
                                  <li key={`${payment.paymentId}-${key}`} className="text-xs font-bold text-amber-700">• {label}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs font-semibold text-gray-500">No hay errores detallados, requiere validación manual.</p>
                            )}
                          </div>

                          <div className="rounded-xl bg-white border border-gray-100 p-2.5 sm:p-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Imagen del comprobante</p>
                            {payment.billUrl ? (
                              <div className="space-y-2">
                                <img
                                  src={getPaymentImageUrl(payment.billUrl)}
                                  alt={`Comprobante ${payment.paymentId}`}
                                  data-fallback-step="0"
                                  className="w-full max-h-44 sm:max-h-56 object-contain bg-gray-50 rounded-lg border border-gray-100 cursor-zoom-in transition-transform duration-200 hover:scale-[1.01]"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const nextSrc = event.currentTarget.currentSrc || event.currentTarget.src;
                                    openImageZoom({
                                      src: nextSrc,
                                      alt: `Comprobante ${payment.paymentId}`,
                                    });
                                  }}
                                  onError={(event) => handleReceiptImageError(event, payment.billUrl)}
                                />
                                <a
                                  href={payment.billUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink size={14} /> Abrir comprobante
                                </a>
                                <p className="text-[11px] font-bold text-gray-400">
                                  Toca la imagen para hacer zoom.
                                </p>
                              </div>
                            ) : (
                              <div className="h-28 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-semibold">
                                <ImageIcon size={16} className="mr-2" /> No hay imagen disponible.
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(payment.paymentId, 'aprobado')}
                              disabled={isBusy}
                              className="w-full py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm transition-colors disabled:opacity-60"
                            >
                              <CheckCircle2 size={16} className="inline mr-2" />
                              {isBusy ? 'Procesando...' : 'Aprobar pago'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(payment.paymentId, 'rechazado')}
                              disabled={isBusy}
                              className="w-full py-2.5 sm:py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm transition-colors disabled:opacity-60"
                            >
                              <XCircle size={16} className="inline mr-2" />
                              {isBusy ? 'Procesando...' : 'Rechazar pago'}
                            </button>
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 w-full max-w-3xl lg:max-w-none mx-auto space-y-3 sm:space-y-4 min-w-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-3.5 sm:p-6 min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-3 sm:mb-4">Comprobantes registrados</h3>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por clase, estudiante o materia"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 outline-none focus:border-blue-500"
                />
              </div>

              
            </div>

            <div className="space-y-2 max-h-[55vh] sm:max-h-[65vh] overflow-y-auto pr-1">
              {sortablePayments.length === 0 ? (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-gray-500">
                  No hay comprobantes para mostrar.
                </div>
              ) : (
                sortablePayments.map((payment) => {
                  const cls = classesByCode[String(payment.classCode || '').trim()];
                  const isApproved = payment.status === 'aprobado';
                  const isExpanded = isApproved && expandedRegisteredId === payment.paymentId;
                  const statusStyles =
                    isApproved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : payment.status === 'rechazado'
                        ? 'bg-red-50 text-red-700 border-red-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100';

                  return (
                    <div key={payment.paymentId} className="rounded-xl border border-gray-100 bg-gray-50 min-w-0 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isApproved) return;
                          setExpandedRegisteredId((prev) =>
                            prev === payment.paymentId ? '' : payment.paymentId
                          );
                        }}
                        className={`w-full p-2.5 sm:p-3 text-left transition-colors ${
                          isApproved ? 'hover:bg-gray-100/60 cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-black text-gray-900 truncate">{payment.classCode} · {cls?.title || 'Clase'}</p>
                            <p className="text-xs font-semibold text-gray-500 truncate">{getStudentDisplayName(payment.studentEmail)}</p>
                            <p className="text-xs font-semibold text-gray-500">{getClassSubject(cls)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase ${statusStyles}`}>
                              {payment.status}
                            </span>
                            {isApproved ? (
                              <ChevronDown
                                size={14}
                                className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] font-bold text-gray-400">{formatDateTime(payment.updatedAt || payment.createdAt)}</p>
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-out ${
                          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          {isApproved ? (
                            <div className="px-2.5 sm:px-3 pb-3">
                              <div className="rounded-xl bg-white border border-gray-100 p-2.5 sm:p-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Imagen del comprobante</p>
                                {payment.billUrl ? (
                                  <div className="space-y-2">
                                    <img
                                      src={getPaymentImageUrl(payment.billUrl)}
                                      alt={`Comprobante ${payment.paymentId}`}
                                      data-fallback-step="0"
                                      className="w-full max-h-44 sm:max-h-56 object-contain bg-gray-50 rounded-lg border border-gray-100 cursor-zoom-in transition-transform duration-200 hover:scale-[1.01]"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        const nextSrc = event.currentTarget.currentSrc || event.currentTarget.src;
                                        openImageZoom({
                                          src: nextSrc,
                                          alt: `Comprobante ${payment.paymentId}`,
                                        });
                                      }}
                                      onError={(event) => handleReceiptImageError(event, payment.billUrl)}
                                    />
                                    <a
                                      href={payment.billUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <ExternalLink size={14} /> Abrir comprobante
                                    </a>
                                    <p className="text-[11px] font-bold text-gray-400">
                                      Toca la imagen para hacer zoom.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="h-28 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-semibold">
                                    <ImageIcon size={16} className="mr-2" /> No hay imagen disponible.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-3.5 sm:p-6 min-w-0">
            <div className="flex items-center gap-2 mb-2 text-amber-600">
              <ShieldAlert size={18} />
              <p className="text-sm font-black">Regla de revisión manual</p>
            </div>
            <p className="text-xs font-semibold text-gray-500 leading-relaxed">
              Todo pago pendiente requiere decisión explícita. Si se rechaza, el comprobante se elimina de Google Drive automáticamente.
            </p>
          </div>
        </section>

        {(success || error) && (
          <div className="lg:col-span-12">
            {success ? (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl px-4 py-3 text-sm font-black">
                {success}
              </div>
            ) : null}
            {error ? (
              <div className="bg-red-50 text-red-700 border border-red-100 rounded-2xl px-4 py-3 text-sm font-black mt-3">
                {error}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {zoomedImageSrc ? (
        <div
          className={`fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm transition-all duration-200 ${
            isZoomClosing || isZoomEntering ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={closeImageZoom}
        >
          <div
            className={`relative w-full h-full flex items-center justify-center transition-all duration-200 ${
              isZoomClosing || isZoomEntering ? 'scale-95' : 'scale-100'
            }`}
          >
            <img
              src={zoomedImageSrc}
              alt={zoomedImageAlt}
              className={`max-w-full max-h-full object-contain rounded-xl border border-white/20 shadow-2xl cursor-zoom-out transition-all duration-200 ${
                isZoomClosing || isZoomEntering ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                closeImageZoom();
              }}
            />

            <p className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 bg-black/55 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 whitespace-nowrap">
              Toca la imagen para cerrar el zoom.
            </p>
          </div>
        </div>
      ) : null}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminPaymentsPage;
