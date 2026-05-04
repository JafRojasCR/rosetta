import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  ShieldAlert,
  User as UserIcon,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import useAuth from '../../hooks/useAuth';
import CustomSelectMenu from '../../components/CustomSelectMenu';

const statusColors = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-100',
  aprobado: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rechazado: 'bg-red-50 text-red-700 border-red-100',
};

const statusLabels = {
  pendiente: 'Pendiente de revisión manual',
  aprobado: 'Aprobada automáticamente',
  rechazado: 'Rechazada automáticamente',
};

const getStatusLabel = (payment) => {
  if (payment?.status === 'aprobado' && payment?.approvedManually) {
    return 'Aprobado manualmente';
  }

  return statusLabels[payment?.status] || payment?.status;
};

const CHECK_LABELS = {
  hasBillNumber: 'Comprobante/documento detectado',
  hasDate: 'Fecha detectada',
  amountMatches: 'Monto correcto',
  detailMatches: 'Detalle correcto',
  recipientMatches: 'Destinatario correcto',
};

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

const formatTime = (value) => {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PaymentsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClassCode, setSelectedClassCode] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialAccepted, setTutorialAccepted] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState('');
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [lastChecks, setLastChecks] = useState(null);
  const [cancelingPaymentId, setCancelingPaymentId] = useState('');
  const [classCodeSearch, setClassCodeSearch] = useState('');
  const fileInputRef = useRef(null);

  const userEmail = String(user?.email || '').toLowerCase();

  const pendingClassCodes = useMemo(() => {
    return new Set(
      (payments || [])
        .filter((payment) => payment.status === 'pendiente')
        .map((payment) => String(payment.classCode || '').trim())
        .filter(Boolean)
    );
  }, [payments]);

  const rejectedClassCodes = useMemo(() => {
    return new Set(
      (payments || [])
        .filter((payment) => payment.status === 'rechazado')
        .map((payment) => String(payment.classCode || '').trim())
        .filter(Boolean)
    );
  }, [payments]);

  const blockedClassCodes = useMemo(() => {
    return new Set([...pendingClassCodes, ...rejectedClassCodes]);
  }, [pendingClassCodes, rejectedClassCodes]);

  const availableClassesToPay = useMemo(() => {
    return (classes || [])
      .filter((cls) => {
        const studentEntry = (cls.classStudents || []).find(
          (entry) => String(entry?.student?.email || '').toLowerCase() === userEmail
        );
        const classCode = String(cls.classCode || '').trim();
        return !studentEntry?.unlocked && !blockedClassCodes.has(classCode);
      })
      .map((cls) => ({
        id: cls.classCode,
        name: cls.title || `Clase ${cls.classCode}`,
        topic: cls.title || 'Clase',
        price: Number(cls.price || 0),
        code: cls.classCode,
        subject: cls.subject?.name || 'Sin materia',
        description: cls.description || 'Sin descripción',
        tutoredStudentName: (() => {
          const tutoredEntry = (cls.classStudents || []).find((entry) => entry?.type === 'tutored');
          if (!tutoredEntry) return '';
          return `${tutoredEntry?.student?.name || ''} ${tutoredEntry?.student?.lastName || ''}`.trim();
        })(),
      }));
  }, [classes, userEmail, blockedClassCodes]);

  const availableClassOptions = useMemo(
    () =>
      availableClassesToPay
        .filter((item) =>
          classCodeSearch.trim() === ''
            ? true
            : String(item.code || '')
                .toLowerCase()
                .includes(String(classCodeSearch || '').toLowerCase())
        )
        .map((item) => ({
          value: item.code,
          label: `${item.name} • ${item.subject}`,
          description: item.tutoredStudentName
            ? `Tutoría para: ${item.tutoredStudentName}`
            : 'Clase grupal',
          code: item.code,
        })),
    [availableClassesToPay, classCodeSearch]
  );

  const selectedClassData = useMemo(
    () => availableClassesToPay.find((item) => item.code === selectedClassCode) || null,
    [availableClassesToPay, selectedClassCode]
  );

  const approvedPayments = useMemo(
    () => (payments || []).filter((payment) => payment.status === 'aprobado'),
    [payments]
  );

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const [paymentsResponse, classesResponse] = await Promise.all([
          api.get('/payments/my'),
          api.get('/classes'),
        ]);

        setPayments(paymentsResponse.data.data || []);
        setClasses(classesResponse.data.data || []);
      } catch (_requestError) {
        setError('Error al cargar pagos y clases disponibles.');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const classCodeFromQuery = String(params.get('classCode') || '').trim();
    if (!classCodeFromQuery) return;

    const exists = availableClassesToPay.some((item) => item.code === classCodeFromQuery);
    if (exists) {
      setSelectedClassCode(classCodeFromQuery);
    }
  }, [location.search, availableClassesToPay]);

  const openFileBrowser = () => {
    if (!selectedClassCode) {
      setError('Primero selecciona la clase que vas a pagar.');
      return;
    }

    if (!tutorialAccepted) {
      setShowTutorial(true);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError('');
    setSuccess('');
    setWarning('');
    setLastChecks(null);
  };

  const handleAcceptTutorial = () => {
    setTutorialAccepted(true);
    setShowTutorial(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 200);
  };

  const handleSubmitPayment = async () => {
    if (!selectedClassCode || !uploadedFile) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    setWarning('');
    setLastChecks(null);

    try {
      const payload = new FormData();
      payload.append('classCode', selectedClassCode);
      payload.append('bill', uploadedFile);

      const response = await api.post('/payments', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const message = response.data.message || 'Pago enviado correctamente.';
      const createdPayment = response.data.data?.payment;
      const checks = response.data.data?.checks || null;

      if (checks) {
        setLastChecks(checks);
      }

      if (createdPayment) {
        setPayments((prev) => [createdPayment, ...prev]);
      }

      if (createdPayment?.status === 'pendiente') {
        setWarning(message);
      } else {
        setSuccess(message);
      }
      setSelectedClassCode('');
      setUploadedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl('');

      const classesResponse = await api.get('/classes');
      setClasses(classesResponse.data.data || []);
    } catch (requestError) {
      const checks = requestError.response?.data?.errors?.checks || null;
      if (checks) {
        setLastChecks(checks);
      }
      setError(requestError.response?.data?.message || 'No se pudo validar el comprobante.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPendingPayment = async (paymentId) => {
    if (!paymentId) return;

    setCancelingPaymentId(paymentId);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      await api.delete(`/payments/${paymentId}`);
      setPayments((prev) => prev.filter((entry) => entry.paymentId !== paymentId));
      setSuccess('Pago eliminado del historial. Ya puedes subir un nuevo comprobante.');
      if (expandedPaymentId === paymentId) {
        setExpandedPaymentId('');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cancelar la solicitud pendiente.');
    } finally {
      setCancelingPaymentId('');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Pagos</h1>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-sm">
          <CreditCard size={16} />
          {payments.length} pagos
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-4 py-10 flex flex-col lg:grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <CreditCard size={120} />
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <div className="space-y-4 w-full">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Comprobante de pago
                </label>

                <div
                  className={`aspect-[3/4] rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer group relative overflow-hidden ${
                    uploadedFile
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-gray-200 hover:border-blue-400 bg-gray-50'
                  }`}
                  onClick={openFileBrowser}
                >
                  {uploadedFile ? (
                    <>
                      {uploadedFile.type.startsWith('image/') ? (
                        <img
                          src={previewUrl}
                          alt="Comprobante"
                          className="absolute inset-0 w-full h-full object-cover opacity-20"
                        />
                      ) : null}
                      <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                      <span className="text-emerald-700 font-black text-lg">¡Listo!</span>
                      <span className="text-emerald-600/60 text-sm font-medium break-all px-2">
                        {uploadedFile.name}
                      </span>
                      <span className="text-emerald-600/60 text-sm font-medium">Click para cambiar</span>
                    </>
                  ) : (
                    <>
                      <div className="bg-white p-6 rounded-3xl shadow-md mb-6 group-hover:scale-110 transition-transform">
                        <ImageIcon size={40} className="text-gray-400" />
                      </div>
                      <span className="text-gray-900 font-black text-xl mb-2">Agregar comprobante</span>
                      <span className="text-gray-400 text-sm font-medium px-4">
                        Sube una captura clara de tu transferencia SINPE
                      </span>
                    </>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                  />
                </div>

                <p className="text-[11px] font-bold text-gray-400 px-2">
                  Formatos permitidos: JPG, PNG, PDF (máximo 5MB)
                </p>
              </div>

              <div className="flex flex-col h-full space-y-8 py-2">
                <div className="space-y-3 relative">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Clase a pagar
                  </label>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={classCodeSearch}
                      onChange={(e) => setClassCodeSearch(e.target.value)}
                      placeholder="Buscar por código (ej: mat030501)"
                      className="w-full px-6 py-3 border-2 border-gray-200 rounded-2xl text-sm font-medium placeholder-gray-400 transition-all focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-md"
                    />
                    
                    <CustomSelectMenu
                      value={selectedClassCode}
                      onChange={(nextValue) => {
                        setSelectedClassCode(nextValue);
                        setClassCodeSearch('');
                        setError('');
                      }}
                      options={availableClassOptions}
                      placeholder={
                        availableClassesToPay.length === 0
                          ? 'No hay clases disponibles para pagar'
                          : availableClassOptions.length === 0 && classCodeSearch.trim() !== ''
                          ? 'No se encontraron clases con ese código'
                          : 'Seleccionar clase'
                      }
                      disabled={availableClassesToPay.length === 0}
                      buttonClassName="px-6 py-4"
                    />
                  </div>

                  {rejectedClassCodes.size > 0 ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm font-semibold text-red-700 flex items-start gap-2">
                      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                      Tienes pagos rechazados en {rejectedClassCodes.size} clase(s). Debes eliminar ese pago rechazado en el historial antes de volver a pagar esa clase.
                    </div>
                  ) : null}
                </div>

                <div
                  className={`transition-all duration-500 ${
                    selectedClassData ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                  }`}
                >
                  {selectedClassData ? (
                    <div
                      key={selectedClassData.code}
                      className="bg-blue-50/50 rounded-[2.5rem] p-8 border border-blue-100 shadow-sm relative overflow-hidden group animate-[classInfoSwap_280ms_ease-out]"
                    >
                      <div className="absolute -right-6 -bottom-6 text-blue-500 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                        <BookOpen size={120} />
                      </div>

                      <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Info size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-[0.2em] block leading-none mb-1">
                              Detalles de sesión
                            </span>
                            <h4 className="text-2xl font-black text-gray-900 leading-none">
                              {selectedClassData.topic}
                            </h4>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              Descripción
                            </span>
                            <p className="text-gray-500 text-sm font-medium leading-relaxed italic">
                              "{selectedClassData.description}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="bg-white/60 p-3 rounded-2xl border border-blue-100/50">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                                Materia
                              </span>
                              <div className="flex items-center gap-2 text-gray-800 font-bold text-xs">
                                <BookOpen size={14} className="text-blue-500" />
                                {selectedClassData.subject}
                              </div>
                            </div>
                            <div className="bg-white/60 p-3 rounded-2xl border border-blue-100/50">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                                Código
                              </span>
                              <div className="flex items-center gap-2 text-gray-800 font-bold text-xs">
                                <Hash size={14} className="text-blue-500" />
                                {selectedClassData.code}
                              </div>
                            </div>
                            {selectedClassData.tutoredStudentName ? (
                              <div className="bg-white/60 p-3 rounded-2xl border border-blue-100/50 sm:col-span-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                                  Tutoría para
                                </span>
                                <div className="flex items-center gap-2 text-gray-800 font-bold text-xs">
                                  <UserIcon size={14} className="text-blue-500" />
                                  {selectedClassData.tutoredStudentName}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-blue-100/50">
                          <span className="text-sm font-bold text-gray-400">Total a pagar:</span>
                          <span className="text-2xl font-black text-blue-600 tracking-tight">
                            {Number(selectedClassData.price || 0).toLocaleString('es-CR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={!selectedClassCode || !uploadedFile || submitting}
                  onClick={handleSubmitPayment}
                  className={`w-full py-5 rounded-[1.5rem] font-black text-xl transition-all flex items-center justify-center gap-3 ${
                    selectedClassCode && uploadedFile
                      ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-600 active:scale-95'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                 
                  {submitting ? 'Validando...' : 'Enviar comprobante'}
                </button>

                {error ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-semibold">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4 text-sm font-semibold">
                    {success}
                  </div>
                ) : null}

                {warning ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-4 text-sm font-semibold">
                    {warning}
                  </div>
                ) : null}

                {lastChecks ? (
                  <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                      Resultado de verificación
                    </p>
                    <div className="space-y-2">
                      {Object.entries(CHECK_LABELS).map(([key, label]) => {
                        const passed = Boolean(lastChecks[key]);
                        return (
                          <div
                            key={key}
                            className={`rounded-xl px-3 py-2 text-xs font-black border ${
                              passed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}
                          >
                            {passed ? '✓' : '✕'} {label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center justify-between">
            Historial de pagos
            <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-blue-600 border border-gray-100 shadow-sm">
              {payments.length}
            </span>
          </h3>

          {payments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center text-gray-400 font-bold">
              Aún no has enviado comprobantes.
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((item) => {
                const classData = classes.find((cls) => cls.classCode === item.classCode);
                const statusTimestamp = item.updatedAt || item.createdAt || item.date;
                return (
                  <div
                    key={item.paymentId}
                    className={`bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
                      expandedPaymentId === item.paymentId ? 'border-blue-500 shadow-lg' : 'border-transparent shadow-sm'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPaymentId((prev) => (prev === item.paymentId ? '' : item.paymentId))
                      }
                      className="w-full p-5 flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-10 rounded-full transition-all ${
                            expandedPaymentId === item.paymentId ? 'bg-blue-500' : 'bg-gray-100'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-gray-900 text-lg leading-none">
                              {classData?.title || item.classCode}
                            </h4>
                            {item.status === 'pendiente' ? <AlertTriangle size={16} className="text-amber-500" /> : null}
                            {item.status === 'rechazado' ? <ShieldAlert size={16} className="text-red-500" /> : null}
                          </div>
                          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                            {item.billNumber}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        size={24}
                        className={`transition-all duration-300 ${
                          expandedPaymentId === item.paymentId ? 'rotate-180 text-blue-500' : 'text-gray-300'
                        }`}
                      />
                    </button>

                    {expandedPaymentId === item.paymentId ? (
                      <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="w-full h-px bg-gray-50 mb-5" />

                        <div className="space-y-4">
                          <div
                            className={`flex items-center gap-2 text-[10px] font-black w-full px-4 py-2 rounded-xl uppercase tracking-widest border ${
                              statusColors[item.status] || 'bg-gray-50 text-gray-700 border-gray-100'
                            }`}
                          >
                            {item.status === 'pendiente' ? <AlertTriangle size={14} /> : null}
                            {item.status === 'rechazado' ? <ShieldAlert size={14} /> : null}
                            {item.status === 'aprobado' ? <CheckCircle2 size={14} /> : null}
                            {getStatusLabel(item)} • {formatDate(statusTimestamp)} {formatTime(statusTimestamp)}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-bold">
                            <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight block mb-1">
                                Materia
                              </span>
                              <p className="text-gray-700 flex items-center gap-1.5">
                                <BookOpen size={11} className="text-blue-500" />
                                {classData?.subject?.name || 'Sin materia'}
                              </p>
                            </div>
                            <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight block mb-1">
                                Código
                              </span>
                              <p className="text-gray-700 flex items-center gap-1.5">
                                <Hash size={11} className="text-blue-500" />
                                {item.classCode}
                              </p>
                            </div>
                            <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight block mb-1">
                                Monto detectado
                              </span>
                              <p className="text-gray-700 flex items-center gap-1.5">
                                <CreditCard size={11} className="text-blue-500" />
                                {Number.isFinite(item.amount)
                                  ? `₡${Number(item.amount).toLocaleString('es-CR')}`
                                  : 'No detectado'}
                              </p>
                            </div>
                            <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight block mb-1">
                                Destinatario
                              </span>
                              <p className="text-gray-700 flex items-center gap-1.5 truncate">
                                <UserIcon size={11} className="text-blue-500" />
                                {item.recipient || 'No detectado'}
                              </p>
                            </div>
                            {(classData?.classStudents || []).some((entry) => entry?.type === 'tutored') ? (
                              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-100 sm:col-span-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight block mb-1">
                                  Tutoría para
                                </span>
                                <p className="text-gray-700 flex items-center gap-1.5">
                                  <UserIcon size={11} className="text-blue-500" />
                                  {(() => {
                                    const tutoredEntry = (classData?.classStudents || []).find(
                                      (entry) => entry?.type === 'tutored'
                                    );
                                    const tutoredName = `${tutoredEntry?.student?.name || ''} ${tutoredEntry?.student?.lastName || ''}`.trim();
                                    return tutoredName || 'Estudiante asignado';
                                  })()}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          {item.validationChecks ? (
                            <div className="bg-white border border-gray-100 rounded-2xl p-3">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                                Verificación automática
                              </span>
                              <div className="space-y-2">
                                {Object.entries(CHECK_LABELS).map(([key, label]) => {
                                  const passed = Boolean(item.validationChecks?.[key]);
                                  return (
                                    <div
                                      key={`${item.paymentId}-${key}`}
                                      className={`rounded-xl px-3 py-2 text-xs font-black border ${
                                        passed
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                          : 'bg-red-50 border-red-200 text-red-700'
                                      }`}
                                    >
                                      {passed ? '✓' : '✕'} {label}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {Array.isArray(item.validationErrors) && item.validationErrors.length > 0 ? (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-2">
                                Motivos de rechazo
                              </span>
                              <ul className="space-y-1">
                                {item.validationErrors.map((reason) => (
                                  <li key={`${item.paymentId}-${reason}`} className="text-xs font-bold text-red-700">
                                    • {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {item.status !== 'aprobado' ? (
                            <button
                              type="button"
                              onClick={() => handleCancelPendingPayment(item.paymentId)}
                              disabled={cancelingPaymentId === item.paymentId}
                              className="w-full py-3 rounded-xl font-black text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            >
                              {cancelingPaymentId === item.paymentId
                                ? 'Eliminando pago...'
                                : 'Eliminar este pago'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Clases pagadas</p>
            <p className="text-3xl font-black text-emerald-600 leading-none">{approvedPayments.length}</p>
          </div>
        </div>
      </main>

      {showTutorial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] p-8 sm:p-12 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-blue-50 opacity-10">
              <AlertCircle size={240} />
            </div>

            <div className="relative z-10">
              <div className="bg-blue-600 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white mb-8 shadow-xl shadow-blue-100">
                <Info size={32} />
              </div>

              <h3 className="text-3xl font-black text-gray-900 mb-6 tracking-tight">Guía de comprobantes</h3>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                Para validar tu pago automáticamente, el comprobante debe mostrar esta información claramente:
              </p>

              <div className="space-y-5 mb-10">
                {[
                  'Número de comprobante o documento (no reutilizado).',
                  'Fecha de la transferencia.',
                  'Monto exacto de la clase.',
                  'Detalle con el código de clase.',
                  'Destinatario: 85344277 o Jafet Alonso Rojas Bello.',
                ].map((text) => (
                  <div key={text} className="flex gap-4 items-start">
                    <div className="mt-1 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Check size={14} strokeWidth={4} />
                    </div>
                    <span className="text-gray-700 font-bold text-sm sm:text-base leading-snug">{text}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAcceptTutorial}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Entendido, continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .animate-in { animation-duration: 0.4s; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .zoom-in-95 { animation-name: zoom-in-95; }
        .slide-in-from-top-2 { animation-name: slide-in-top; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoom-in-95 { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slide-in-top { from { transform: translateY(-0.5rem); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes classInfoSwap {
          0% { opacity: 0; transform: translateY(8px) scale(0.995); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `,
        }}
      />
    </div>
  );
};

export default PaymentsPage;
