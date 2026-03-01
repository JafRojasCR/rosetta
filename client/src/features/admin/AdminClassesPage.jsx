import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Edit3,
  FileText,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
  Type,
  User,
  Users,
  Video,
} from 'lucide-react';
import api from '../../services/api';

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

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const loadClasses = async (params = {}) => {
    const response = await api.get('/classes', { params });
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

  const generatedClassCode = useMemo(
    () => generateClassCode(form.subjectId, form.date, form.order),
    [form.subjectId, form.date, form.order]
  );

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
      const classesForSlot = await loadClasses({ date, subjectId });
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
      payload.append('recordingFile', form.recordingFile);
    }

    setSaving(true);
    setUploadProgress(0);

    const requestConfig = {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const next = Math.min(95, Math.round((progressEvent.loaded * 95) / progressEvent.total));
          setUploadProgress((prev) => Math.max(prev, next));
          return;
        }

        setUploadProgress((prev) => Math.min(prev + 4, 95));
      },
    };

    try {
      if (isEditing) {
        await api.put(`/classes/${editingClassCode}`, payload, requestConfig);
        setSuccess('Clase actualizada correctamente.');
      } else {
        await api.post('/classes', payload, requestConfig);
        setSuccess('Clase publicada correctamente.');
      }

      const nextClasses = await loadClasses();
      setClasses(nextClasses);
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

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-8">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <select
                    name="subjectId"
                    value={form.subjectId}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3.5 font-semibold text-gray-700 outline-none"
                    disabled={subjects.length === 0}
                  >
                    {subjects.length === 0 ? (
                      <option value="">No hay materias</option>
                    ) : (
                      subjects.map((subject) => (
                        <option key={subject.subjectId} value={subject.subjectId}>
                          {subject.name} ({subject.subjectId})
                        </option>
                      ))
                    )}
                  </select>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-blue-50/40 rounded-3xl border border-blue-100">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={handleInputChange}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none"
                    />
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

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
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
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                      Estudiante
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <select
                        value={form.tutorStudentEmail}
                        onChange={handleTutorSelect}
                        className="w-full bg-white border-2 border-transparent focus:border-blue-500 rounded-2xl pl-12 pr-5 py-3.5 font-semibold text-gray-700 outline-none"
                      >
                        <option value="">Selecciona un estudiante</option>
                        {students.map((student) => (
                          <option key={student.email} value={student.email}>
                            {student.name} {student.lastName} ({student.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Users size={12} />
                    Desbloqueada para
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {students.map((student) => {
                      const email = student.email;
                      const isSelected = form.unlockedStudentEmails.includes(email);
                      return (
                        <button
                          key={email}
                          type="button"
                          onClick={() => toggleStudentUnlock(email)}
                          className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all ${
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

              <div className="bg-gray-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Codigo generado
                  </p>
                  <p className="text-xl font-black tracking-widest text-emerald-400 mt-1">
                    {generatedClassCode}
                  </p>
                </div>

                <div className="flex gap-3">
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-5 py-3 rounded-2xl font-black bg-gray-700 hover:bg-gray-600 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="px-6 py-3 rounded-2xl font-black bg-blue-600 hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default AdminClassesPage;
