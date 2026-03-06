import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Link as LinkIcon,
  Plus,
  Save,
  Star,
  Trash2,
  Type,
  User,
  Users,
  Video,
} from 'lucide-react';
import api from '../../services/api';
import CustomSelectMenu from '../../components/CustomSelectMenu';
import { uploadToSignedUrl } from '../../services/directUpload';

const toDateInputValue = (value) => {
  if (!value) return '';

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const padOrder = (value) => String(value).padStart(2, '0');

const getOrderFromClassCode = (classCode = '') => {
  const match = String(classCode).match(/(\d{2})$/);
  return match?.[1] || '01';
};

const generateClassCode = (subjectId, date, order) => {
  if (!subjectId || !date) return '---';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return '---';
  const prefix = String(subjectId).slice(0, 3).toLowerCase();
  return `${prefix}${day}${month}${padOrder(order || '01')}`;
};

const calculateStarRating = (classStudents = []) => {
  const numericVotes = (classStudents || [])
    .map((entry) => {
      if (entry?.vote === '1') return 1;
      if (entry?.vote === '-1') return -1;
      return null;
    })
    .filter((value) => value !== null);

  if (numericVotes.length === 0) return null;

  const average = numericVotes.reduce((accumulator, value) => accumulator + value, 0) / numericVotes.length;
  const stars = ((average + 1) / 2) * 5;
  return Number(stars.toFixed(1));
};

const INITIAL_FORM = {
  title: '',
  description: '',
  subjectId: '',
  date: '',
  order: '01',
  price: '',
  canvaUrl: '',
  isTutoring: false,
  tutorStudentEmail: '',
  unlockedStudentEmails: [],
  recordingFile: null,
};

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const toIsoDate = (year, month, day) => {
  const normalizedMonth = String(month + 1).padStart(2, '0');
  const normalizedDay = String(day).padStart(2, '0');
  return `${year}-${normalizedMonth}-${normalizedDay}`;
};

const parseIsoDate = (value = '') => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
};

const formatReadableDate = (value = '') => {
  if (!value) return 'Seleccionar';
  const parsed = parseIsoDate(value);
  if (!parsed) return 'Seleccionar';

  const day = String(parsed.day).padStart(2, '0');
  const monthShort = MONTH_NAMES[parsed.month] || '---';
  const monthFormatted = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
  return `${day}/${monthFormatted}/${parsed.year}`;
};

const AdminClassesPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClassCode, setEditingClassCode] = useState('');
  const [busyClassCode, setBusyClassCode] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const datePickerRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const loadClasses = async (params = {}) => {
    const response = await api.get('/classes', { params });
    return response.data.data || [];
  };

  const loadClassCodesBySlot = async ({ date, subjectId }) => {
    const response = await api.get('/classes', {
      params: {
        date,
        subjectId,
        fields: 'minimal',
      },
    });

    return response.data.data || [];
  };

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');

    try {
      const [subjectsResponse, studentsResponse, classesResponse] = await Promise.all([
        api.get('/subjects'),
        api.get('/admin/students'),
        loadClasses(),
      ]);

      const nextSubjects = subjectsResponse.data.data || [];
      setSubjects(nextSubjects);
      setStudents(studentsResponse.data.data || []);
      setClasses(classesResponse);

      setForm((prev) => ({
        ...prev,
        subjectId: prev.subjectId || nextSubjects?.[0]?.subjectId || '',
      }));
    } catch (requestError) {
      setError('No se pudieron cargar las materias, estudiantes o clases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const parsed = parseIsoDate(form.date);
    if (!parsed) return;
    setCalendarViewDate(new Date(parsed.year, parsed.month, 1));
  }, [form.date]);

  useEffect(() => {
    if (!isDatePickerOpen) return undefined;

    const handlePointerDownOutside = (event) => {
      if (!datePickerRef.current?.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    calculateOrderByDateAndSubject({
      date: form.date,
      subjectId: form.subjectId,
      excludeClassCode: isEditing ? editingClassCode : '',
    });
  }, [form.date, form.subjectId, isEditing, editingClassCode]);

  const studentsByEmail = useMemo(() => {
    return students.reduce((accumulator, student) => {
      accumulator[student.email] = student;
      return accumulator;
    }, {});
  }, [students]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.subjectId === form.subjectId),
    [subjects, form.subjectId]
  );

  const subjectOptions = useMemo(
    () =>
      (subjects || []).map((subject) => ({
        value: subject.subjectId,
        label: `${subject.name} (${subject.subjectId})`,
      })),
    [subjects]
  );

  const studentOptions = useMemo(
    () =>
      (students || []).map((student) => ({
        value: student.email,
        label: `${student.name} ${student.lastName}`,
      })),
    [students]
  );

  const generatedClassCode = useMemo(
    () => generateClassCode(form.subjectId, form.date, form.order),
    [form.subjectId, form.date, form.order]
  );

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const jsWeekDay = firstDayOfMonth.getDay();
    const weekDayIndex = (jsWeekDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result = [];
    for (let i = 0; i < weekDayIndex; i += 1) {
      result.push({ key: `empty-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const isoValue = toIsoDate(year, month, day);
      result.push({ key: isoValue, empty: false, day, isoValue });
    }

    return result;
  }, [calendarViewDate]);

  const calendarTitle = `${MONTH_NAMES[calendarViewDate.getMonth()]} ${calendarViewDate.getFullYear()}`;

  const calculateOrderByDateAndSubject = async ({
    date,
    subjectId,
    excludeClassCode = '',
  }) => {
    if (!date || !subjectId) {
      setForm((prev) => ({ ...prev, order: '01' }));
      return;
    }

    try {
      const classesForSlot = await loadClassCodesBySlot({ date, subjectId });
      const filtered = (classesForSlot || []).filter(
        (cls) => cls.classCode !== excludeClassCode
      );

      const usedOrders = new Set(
        filtered
          .map((cls) => Number.parseInt(getOrderFromClassCode(cls.classCode), 10))
          .filter((value) => Number.isInteger(value) && value > 0)
      );

      let nextOrder = 1;
      while (usedOrders.has(nextOrder) && nextOrder < 100) {
        nextOrder += 1;
      }

      setForm((prev) => ({
        ...prev,
        order: padOrder(nextOrder),
      }));
    } catch (_requestError) {
      setForm((prev) => ({ ...prev, order: '01' }));
    }
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (name === 'isTutoring') {
      setForm((prev) => ({
        ...prev,
        isTutoring: checked,
        tutorStudentEmail: checked ? prev.tutorStudentEmail : '',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRecordingChange = (event) => {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, recordingFile: file }));
  };

  const handleTutorSelect = (event) => {
    const email = event.target.value;
    setForm((prev) => ({
      ...prev,
      tutorStudentEmail: email,
    }));
  };

  const shiftCalendarMonth = (offset) => {
    setCalendarViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handlePickDate = (isoDate) => {
    setForm((prev) => ({ ...prev, date: isoDate }));
    setIsDatePickerOpen(false);
  };

  const toggleStudentUnlock = (email) => {
    setForm((prev) => {
      const isSelected = prev.unlockedStudentEmails.includes(email);
      return {
        ...prev,
        unlockedStudentEmails: isSelected
          ? prev.unlockedStudentEmails.filter((entry) => entry !== email)
          : [...prev.unlockedStudentEmails, email],
      };
    });
  };

  const resetForm = (preserveDate = false) => {
    setForm((prev) => ({
      ...INITIAL_FORM,
      subjectId: subjects?.[0]?.subjectId || '',
      date: preserveDate ? prev.date : '',
    }));
  };

  const buildClassStudentsEntries = () => {
    const entriesByEmail = {};

    if (form.isTutoring && form.tutorStudentEmail) {
      const tutoredStudent = studentsByEmail[form.tutorStudentEmail];
      if (tutoredStudent) {
        entriesByEmail[form.tutorStudentEmail] = {
          student: {
            id: tutoredStudent._id || tutoredStudent.id || '',
            email: tutoredStudent.email || '',
            name: tutoredStudent.name || '',
            lastName: tutoredStudent.lastName || '',
            phone: tutoredStudent.phone || '',
          },
          type: 'tutored',
          unlocked: false,
          unlockedAt: null,
          paymentDate: null,
        };
      }
    }

    form.unlockedStudentEmails.forEach((email) => {
      const student = studentsByEmail[email];
      if (!student) return;

      const unlockedAt = new Date().toISOString();
      const existing = entriesByEmail[email];
      entriesByEmail[email] = {
        student: {
          id: student._id || student.id || '',
          email: student.email || '',
          name: student.name || '',
          lastName: student.lastName || '',
          phone: student.phone || '',
        },
        type: existing?.type === 'tutored' ? 'tutored' : 'normal',
        unlocked: true,
        unlockedAt,
        paymentDate: unlockedAt,
      };
    });

    return Object.values(entriesByEmail);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim() || !form.date || !form.subjectId || form.price === '') {
      setError('Completa titulo, materia, fecha y monto.');
      return;
    }

    if (!selectedSubject) {
      setError('Selecciona una materia valida.');
      return;
    }

    if (form.isTutoring && !form.tutorStudentEmail) {
      setError('Selecciona el estudiante de la tutoria.');
      return;
    }

    const numericPrice = Number(form.price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('El monto debe ser un numero mayor o igual a cero.');
      return;
    }

    setSaving(true);
    setUploadProgress(0);

    const uploadRecordingByChunks = async (file) => {
      const initResponse = await api.post('/classes/recording-upload/init', {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      const uploadUrl = initResponse.data?.data?.uploadUrl;
      const objectKey = String(initResponse.data?.data?.objectKey || '').trim();

      if (!uploadUrl) {
        throw new Error('No se pudo iniciar la carga directa del video.');
      }

      if (!objectKey) {
        throw new Error('No se obtuvo la llave del video en GCS.');
      }

      setUploadProgress(5);

      await uploadToSignedUrl({
        uploadUrl,
        file,
        mimeType: file.type || 'application/octet-stream',
        onProgress: ({ loaded, total }) => {
          if (!total || total <= 0) return;
          // 5-90% reserved for actual bytes uploaded to GCS
          const percent = Math.round((loaded * 85) / total) + 5;
          setUploadProgress(Math.max(5, Math.min(90, percent)));
        },
      });

      setUploadProgress((prev) => Math.max(prev, 90));

      const completeResponse = await api.post('/classes/recording-upload/complete', {
        objectKey,
        mimeType: file.type || 'application/octet-stream',
      });
      const uploadedObjectKey = String(completeResponse.data?.data?.objectKey || '').trim();

      if (!uploadedObjectKey) {
        throw new Error('No se pudo confirmar la subida del video en GCS.');
      }

      return uploadedObjectKey;
    };

    try {
      const payload = new FormData();
      const classStudentsEntries = buildClassStudentsEntries();
      payload.append('classCode', generatedClassCode);
      payload.append('title', form.title.trim());
      payload.append('description', form.description.trim());
      payload.append('date', form.date);
      payload.append('price', String(numericPrice));
      payload.append('canvaUrl', form.canvaUrl.trim());
      payload.append(
        'subject',
        JSON.stringify({
          subjectId: form.subjectId,
          name: selectedSubject.name,
        })
      );
      payload.append('classStudents', JSON.stringify(classStudentsEntries));

      if (form.recordingFile) {
        const uploadedRecordingObjectKey = await uploadRecordingByChunks(form.recordingFile);
        payload.append('recordingStorageObjectKey', uploadedRecordingObjectKey);
      }

      const requestConfig = {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            // Final API payload is small; only advance 95-99% here
            const next = 95 + Math.round((progressEvent.loaded * 4) / progressEvent.total);
            setUploadProgress((prev) => Math.max(prev, next));
            return;
          }

          setUploadProgress((prev) => Math.min(prev + 1, 99));
        },
      };

      if (isEditing) {
        await api.put(`/classes/${editingClassCode}`, payload, requestConfig);
        setSuccess('Clase actualizada correctamente.');
      } else {
        await api.post('/classes', payload, requestConfig);
        setSuccess('Clase publicada correctamente.');
      }

      const nextClasses = await loadClasses();
      setClasses(nextClasses);
      setUploadProgress(100);
      setIsEditing(false);
      setEditingClassCode('');
      resetForm(true);

      if (form.date) {
        await calculateOrderByDateAndSubject({
          date: form.date,
          subjectId: form.subjectId,
        });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar la clase.');
      setUploadProgress(0);
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const startEdit = (cls) => {
    const classStudents = cls.classStudents || [];
    const tutoredEntry = classStudents.find((entry) => entry?.type === 'tutored');
    const unlockedEmails = classStudents
      .filter((entry) => entry?.unlocked === true || Boolean(entry?.paymentDate))
      .map((entry) => entry?.student?.email)
      .filter(Boolean);

    setForm({
      title: cls.title || '',
      description: cls.description || '',
      subjectId: cls.subject?.subjectId || '',
      date: toDateInputValue(cls.date),
      order: getOrderFromClassCode(cls.classCode),
      price: cls.price ?? '',
      canvaUrl: cls.canvaUrl || '',
      isTutoring: Boolean(tutoredEntry),
      tutorStudentEmail: tutoredEntry?.student?.email || '',
      unlockedStudentEmails: unlockedEmails,
      recordingFile: null,
    });

    setIsEditing(true);
    setEditingClassCode(cls.classCode);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingClassCode('');
    resetForm();
  };

  const handleDeleteClass = async (classCode) => {
    setError('');
    setSuccess('');
    setBusyClassCode(classCode);

    try {
      await api.delete(`/classes/${classCode}`);
      setSuccess('Clase eliminada correctamente.');
      const nextClasses = await loadClasses();
      setClasses(nextClasses);
      if (editingClassCode === classCode) {
        cancelEdit();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar la clase.');
    } finally {
      setBusyClassCode('');
    }
  };

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
              Administrar clases
            </h1>
            <p className="text-sm text-gray-500">Publica y organiza clases/tutorias</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <BookOpen size={24} />
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-8 flex-1">
        <section className="lg:col-span-7">
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-8">
             
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">
                  {isEditing ? 'Editar clase' : 'Publicar clase'}
                </h2>
                <p className="text-sm text-gray-500">Publica el video y define acceso de estudiantes</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-3 text-sm font-semibold">
                {success}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-6 [&_input]:min-w-0 [&_input]:max-w-full [&_select]:min-w-0 [&_select]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 [&>*]:min-w-0">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Titulo
                  </label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleInputChange}
                      placeholder="Cotidiano 5"
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Materia
                  </label>
                  <CustomSelectMenu
                    value={form.subjectId}
                    onChange={(nextValue) => {
                      setForm((prev) => ({ ...prev, subjectId: nextValue }));
                    }}
                    options={subjectOptions}
                    placeholder={subjects.length === 0 ? 'No hay materias' : 'Selecciona una materia'}
                    disabled={subjects.length === 0}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Descripcion
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-gray-300" size={18} />
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Descripcion breve de la clase"
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-blue-50/40 rounded-3xl border border-blue-100 [&>*]:min-w-0">
                <div className="space-y-2">
                  <label className="text-xs font-black text-blue-600 uppercase tracking-widest ml-1">
                    Video de clase
                  </label>
                  <label className="w-full min-w-0 overflow-hidden bg-white border-2 border-blue-100 hover:border-blue-300 text-blue-700 rounded-2xl px-4 py-3.5 font-bold transition-all flex items-center gap-2 cursor-pointer">
                    <Video size={18} />
                    <span className="flex-1 min-w-0 truncate">
                      {form.recordingFile?.name || 'Selecciona video'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4,video/webm,video/quicktime,video/mpeg"
                      onChange={handleRecordingChange}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-blue-600 uppercase tracking-widest ml-1">
                    Link de Canva
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
                    <input
                      name="canvaUrl"
                      value={form.canvaUrl}
                      onChange={handleInputChange}
                      placeholder="https://canva.com/..."
                      className="w-full bg-white border-2 border-blue-100 focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 [&>*]:min-w-0">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Monto
                  </label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3.5 font-black text-gray-700 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Fecha
                  </label>
                  <div className="relative" ref={datePickerRef}>
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen((prev) => !prev)}
                      className="w-full text-left bg-gray-50 border-2 border-transparent hover:border-blue-200 focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none transition-all"
                    >
                      {formatReadableDate(form.date)}
                    </button>

                    {isDatePickerOpen && (
                      <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-2 w-[20rem] sm:w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-30">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            onClick={() => shiftCalendarMonth(-1)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
                            aria-label="Mes anterior"
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <p className="text-sm font-black text-gray-700 capitalize tracking-wide">{calendarTitle}</p>

                          <button
                            type="button"
                            onClick={() => shiftCalendarMonth(1)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
                            aria-label="Mes siguiente"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {WEEK_DAYS.map((dayName) => (
                            <div
                              key={dayName}
                              className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest"
                            >
                              {dayName}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((entry) => {
                            if (entry.empty) {
                              return <div key={entry.key} className="h-9" />;
                            }

                            const today = new Date();
                            const todayIso = toIsoDate(
                              today.getFullYear(),
                              today.getMonth(),
                              today.getDate()
                            );
                            const isSelected = form.date === entry.isoValue;
                            const isToday = todayIso === entry.isoValue;

                            return (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => handlePickDate(entry.isoValue)}
                                className={`h-9 rounded-xl text-sm font-bold transition-all ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : isToday
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {entry.day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                    Orden
                  </label>
                  <input
                    name="order"
                    value={form.order}
                    readOnly
                    className="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-5 py-3.5 font-black text-gray-700 outline-none text-center"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4 min-w-0">
                <div className="flex items-center gap-3">
                  <input
                    id="isTutoring"
                    type="checkbox"
                    name="isTutoring"
                    checked={form.isTutoring}
                    onChange={handleInputChange}
                    className="w-5 h-5 rounded accent-emerald-600"
                  />
                  <label htmlFor="isTutoring" className="text-sm font-bold text-gray-700">
                    Tutoría personalizada
                  </label>
                </div>

                {form.isTutoring && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <User size={12} />
                      Estudiante
                    </label>
                    <CustomSelectMenu
                      value={form.tutorStudentEmail}
                      onChange={(nextValue) => {
                        handleTutorSelect({ target: { value: nextValue } });
                      }}
                      options={studentOptions}
                      placeholder="Selecciona un estudiante"
                      disabled={students.length === 0}
                      buttonClassName="bg-white py-2.5 rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Users size={12} />
                    Desbloqueada para
                  </label>
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {students.map((student) => {
                      const email = student.email;
                      const isSelected = form.unlockedStudentEmails.includes(email);
                      return (
                        <button
                          key={email}
                          type="button"
                          onClick={() => toggleStudentUnlock(email)}
                          className={`max-w-full px-3 py-2 rounded-xl text-xs font-black border-2 transition-all truncate ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200'
                          }`}
                        >
                          {student.name} {student.lastName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Codigo generado
                  </p>
                  <p className="text-xl font-black tracking-widest text-emerald-400 mt-1 break-all">
                    {generatedClassCode}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto min-w-0">
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl font-black bg-gray-700 hover:bg-gray-600 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Save size={18} />
                    {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Publicar clase'}
                  </button>
                </div>
              </div>
            </form>

            {(saving || uploadProgress > 0) && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Progreso de carga
                  </span>
                  <span className="text-sm font-black text-blue-600">{uploadProgress}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold text-gray-900">Clases registradas</h3>
            <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-blue-600 border border-gray-100">
              {classes.length}
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 text-gray-500 font-medium">
              Cargando clases...
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 text-gray-500 font-medium">
              No hay clases registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => (
                <div
                  key={cls.classCode}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
                >
                  {(() => {
                    const rating = calculateStarRating(cls.classStudents || []);
                    const filledStars = rating === null ? 0 : Math.round(rating);

                    return (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">
                          Rating
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={`${cls.classCode}-star-${index}`}
                                size={14}
                                className={index < filledStars ? 'fill-current' : 'text-gray-200'}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-black text-gray-500 min-w-[4ch] text-right">
                            {rating === null ? '--' : rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">{cls.title}</p>
                      <p className="text-[10px] font-black tracking-widest uppercase text-gray-400 mt-1">
                        {cls.classCode}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(cls)}
                        className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center"
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.classCode)}
                        disabled={busyClassCode === cls.classCode}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 flex items-center justify-center"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs font-semibold text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{cls.subject?.name || 'Sin materia'}</span>
                    <span>Monto: {cls.price}</span>
                    <span>
                      Desbloqueados:{' '}
                      {(cls.classStudents || []).filter((entry) => entry?.unlocked === true).length}
                    </span>
                    <span>
                      Tutoría:{' '}
                      {(cls.classStudents || []).some((entry) => entry?.type === 'tutored')
                        ? 'Sí'
                        : 'No'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {cls.recordingUrl && (
                      <a
                        href={cls.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-50 text-blue-600"
                      >
                        Ver video
                      </a>
                    )}
                    {cls.canvaUrl && (
                      <a
                        href={cls.canvaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-purple-50 text-purple-600"
                      >
                        Ver Canva
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminClassesPage;
