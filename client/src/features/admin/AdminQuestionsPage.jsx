import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit3,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  Plus,
  Save,
  Search,
  Timer,
  Trash2,
  Unlock,
  UploadCloud,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { uploadToSignedUrl } from '../../services/directUpload';
import SubtypeSelectDropdown from '../../components/SubtypeSelectDropdown';

const QUICK_AREAS = ['Verbal', 'Matemática', 'Razonamiento'];

const createInitialQuestionForm = () => ({
  pregunta: '',
  respuestas: ['', '', '', ''],
  correcta: 0,
  tipo: 'Verbal',
  subtipo: '',
  explicacion: '',
  imageObjectKey: '',
  imagePreviewUrl: '',
  isActive: true,
});

const createInitialExamForm = () => ({
  title: '',
  description: '',
  questionIds: [],
  hours: 1,
  minutes: 50,
  useBubbleSheetDefault: true,
  lockBubbleSheet: false,
  isActive: true,
});

const formatMinutesLabel = (totalMinutes) => {
  const safe = Math.max(1, Number(totalMinutes) || 110);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
};

const AdminQuestionsPage = () => {
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('questions'); // questions | exams

  // Questions state
  const [form, setForm] = useState(createInitialQuestionForm);
  const [editingId, setEditingId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSubtypes, setLoadingSubtypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');

  // Exams state
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examForm, setExamForm] = useState(createInitialExamForm);
  const [editingExamId, setEditingExamId] = useState('');
  const [submittingExam, setSubmittingExam] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState('');
  const [examQuestionSearch, setExamQuestionSearch] = useState('');
  const [examQuestionArea, setExamQuestionArea] = useState('all');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const response = await api.get('/questions?includeInactive=true');
      setQuestions(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar las preguntas.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchSubtypes = async () => {
    setLoadingSubtypes(true);
    try {
      const response = await api.get('/question-subtypes');
      setSubtypes(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los subtipos.');
    } finally {
      setLoadingSubtypes(false);
    }
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const response = await api.get('/exams?includeInactive=true');
      setExams(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los exámenes.');
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchSubtypes();
    fetchExams();
  }, []);

  const availableAreas = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => {
      if (q.tipo) set.add(q.tipo);
    });
    return Array.from(set);
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesArea = areaFilter === 'all' || item.tipo === areaFilter;
      if (!matchesArea) return false;
      if (!q) return true;
      const haystack = `${item.pregunta} ${item.tipo} ${item.subtipo} ${item.explicacion}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [questions, searchQuery, areaFilter]);

  const filteredQuestionsForExam = useMemo(() => {
    const q = examQuestionSearch.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesArea = examQuestionArea === 'all' || item.tipo === examQuestionArea;
      if (!matchesArea) return false;
      if (!q) return true;
      const haystack = `${item.pregunta} ${item.tipo} ${item.subtipo}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [questions, examQuestionSearch, examQuestionArea]);

  // Subtype handlers
  const handleCreateSubtype = async (name) => {
    setError('');
    try {
      const response = await api.post('/question-subtypes', { name });
      const created = response.data?.data;
      await fetchSubtypes();
      return created?.name || name;
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear el subtipo.');
      return '';
    }
  };

  const handleDeleteSubtype = async (id) => {
    setError('');
    try {
      await api.delete(`/question-subtypes/${id}`);
      await fetchSubtypes();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el subtipo.');
    }
  };

  // Question handlers
  const handleOptionChange = (index, value) => {
    setForm((prev) => {
      const nextRespuestas = [...prev.respuestas];
      nextRespuestas[index] = value;
      return { ...prev, respuestas: nextRespuestas };
    });
  };

  const handleAddOption = () => {
    setForm((prev) => {
      if (prev.respuestas.length >= 6) return prev;
      return { ...prev, respuestas: [...prev.respuestas, ''] };
    });
  };

  const handleRemoveOption = (index) => {
    setForm((prev) => {
      if (prev.respuestas.length <= 2) return prev;
      const nextRespuestas = prev.respuestas.filter((_, i) => i !== index);
      let nextCorrecta = prev.correcta;
      if (index === prev.correcta) {
        nextCorrecta = 0;
      } else if (index < prev.correcta) {
        nextCorrecta = prev.correcta - 1;
      }
      return { ...prev, respuestas: nextRespuestas, correcta: nextCorrecta };
    });
  };

  const handleResetForm = () => {
    if (form.imagePreviewUrl && form.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }
    setForm(createInitialQuestionForm());
    setImageFile(null);
    setImageUploadProgress(0);
    setEditingId('');
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    if (form.imagePreviewUrl && form.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setForm((prev) => ({
      ...prev,
      imagePreviewUrl: previewUrl,
    }));
    setError('');
  };

  const handleRemoveImage = () => {
    if (form.imagePreviewUrl && form.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }
    setImageFile(null);
    setImageUploadProgress(0);
    setForm((prev) => ({
      ...prev,
      imageObjectKey: '',
      imagePreviewUrl: '',
    }));
  };

  const handleEdit = (item) => {
    setError('');
    setSuccess('');
    if (form.imagePreviewUrl && form.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreviewUrl);
    }
    setImageFile(null);
    setImageUploadProgress(0);
    setEditingId(item._id);
    setForm({
      pregunta: item.pregunta || '',
      respuestas:
        Array.isArray(item.respuestas) && item.respuestas.length >= 2
          ? [...item.respuestas]
          : ['', '', '', ''],
      correcta: typeof item.correcta === 'number' ? item.correcta : 0,
      tipo: item.tipo || 'Verbal',
      subtipo: item.subtipo || '',
      explicacion: item.explicacion || '',
      imageObjectKey: item.imageObjectKey || '',
      imagePreviewUrl: item.imageUrl || '',
      isActive: item.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    setError('');
    setSuccess('');
    setDeletingId(id);
    try {
      await api.delete(`/questions/${id}`);
      if (editingId === id) handleResetForm();
      setSuccess('Pregunta eliminada correctamente.');
      await fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar la pregunta.');
    } finally {
      setDeletingId('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedPregunta = form.pregunta.trim();
    const trimmedTipo = form.tipo.trim();
    const trimmedRespuestas = form.respuestas.map((r) => r.trim());

    if (!trimmedPregunta || !trimmedTipo) {
      setError('El enunciado de la pregunta y el área (tipo) son obligatorios.');
      return;
    }

    if (trimmedRespuestas.some((r) => !r)) {
      setError('Todas las opciones de respuesta deben tener texto.');
      return;
    }

    setSubmitting(true);
    try {
      let finalImageObjectKey = form.imageObjectKey || '';

      if (imageFile) {
        setImageUploadProgress(5);
        const initResponse = await api.post('/questions/image-upload/init', {
          fileName: imageFile.name,
          mimeType: imageFile.type || 'image/png',
          fileSize: imageFile.size,
        });

        const uploadUrl = initResponse.data?.data?.uploadUrl;
        const objectKey = String(initResponse.data?.data?.objectKey || '').trim();
        if (!uploadUrl || !objectKey) {
          throw new Error('No se pudo iniciar la carga de la imagen en Google Cloud.');
        }

        await uploadToSignedUrl({
          uploadUrl,
          file: imageFile,
          mimeType: imageFile.type || 'image/png',
          onProgress: ({ loaded, total }) => {
            if (!total || total <= 0) return;
            const percent = Math.round((loaded * 85) / total) + 5;
            setImageUploadProgress(Math.max(5, Math.min(90, percent)));
          },
        });

        await api.post('/questions/image-upload/complete', {
          objectKey,
          mimeType: imageFile.type || 'image/png',
        });

        setImageUploadProgress(100);
        finalImageObjectKey = objectKey;
      }

      const payload = {
        pregunta: trimmedPregunta,
        respuestas: trimmedRespuestas,
        correcta: form.correcta,
        tipo: trimmedTipo,
        subtipo: form.subtipo.trim(),
        explicacion: form.explicacion.trim(),
        imageObjectKey: finalImageObjectKey,
        isActive: Boolean(form.isActive),
      };

      if (editingId) {
        await api.put(`/questions/${editingId}`, payload);
        setSuccess('Pregunta actualizada correctamente.');
      } else {
        await api.post('/questions', payload);
        setSuccess('Pregunta agregada correctamente al banco.');
      }
      handleResetForm();
      await fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'No se pudo guardar la pregunta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exam handlers
  const handleToggleExamQuestion = (questionId) => {
    setExamForm((prev) => {
      const exists = prev.questionIds.includes(questionId);
      return {
        ...prev,
        questionIds: exists
          ? prev.questionIds.filter((id) => id !== questionId)
          : [...prev.questionIds, questionId],
      };
    });
  };

  const handleResetExamForm = () => {
    setExamForm(createInitialExamForm());
    setEditingExamId('');
  };

  const handleEditExam = (exam) => {
    setError('');
    setSuccess('');
    const totalMins = Math.max(1, Number(exam.recommendedMinutes) || 110);
    setEditingExamId(exam._id);
    setExamForm({
      title: exam.title || '',
      description: exam.description || '',
      questionIds: Array.isArray(exam.questionIds) ? [...exam.questionIds] : [],
      hours: Math.floor(totalMins / 60),
      minutes: totalMins % 60,
      useBubbleSheetDefault: exam.useBubbleSheetDefault !== false,
      lockBubbleSheet: Boolean(exam.lockBubbleSheet),
      isActive: exam.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExam = async (id) => {
    setError('');
    setSuccess('');
    setDeletingExamId(id);
    try {
      await api.delete(`/exams/${id}`);
      if (editingExamId === id) handleResetExamForm();
      setSuccess('Examen eliminado correctamente.');
      await fetchExams();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el examen.');
    } finally {
      setDeletingExamId('');
    }
  };

  const handleSubmitExam = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const title = examForm.title.trim();
    if (!title) {
      setError('El título del examen es obligatorio.');
      return;
    }

    if (examForm.questionIds.length === 0) {
      setError('Debes seleccionar al menos 1 pregunta para el examen.');
      return;
    }

    const recommendedMinutes = Math.max(
      1,
      (Number(examForm.hours) || 0) * 60 + (Number(examForm.minutes) || 0)
    );

    const payload = {
      title,
      description: examForm.description.trim(),
      questionIds: examForm.questionIds,
      recommendedMinutes,
      useBubbleSheetDefault: Boolean(examForm.useBubbleSheetDefault),
      lockBubbleSheet: Boolean(examForm.lockBubbleSheet),
      isActive: Boolean(examForm.isActive),
    };

    setSubmittingExam(true);
    try {
      if (editingExamId) {
        await api.put(`/exams/${editingExamId}`, payload);
        setSuccess('Examen actualizado correctamente.');
      } else {
        await api.post('/exams', payload);
        setSuccess('Examen creado correctamente.');
      }
      handleResetExamForm();
      await fetchExams();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el examen.');
    } finally {
      setSubmittingExam(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/recursos')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">
            Práctica y Exámenes
          </h1>
        </div>

        <div className="inline-flex bg-gray-50 p-1 rounded-2xl border border-gray-100 ml-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('questions');
              setError('');
              setSuccess('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'questions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BookOpen size={14} />
            <span>Preguntas ({questions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('exams');
              setError('');
              setSuccess('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'exams'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ClipboardList size={14} />
            <span>Exámenes ({exams.length})</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 pb-20 space-y-8 flex-grow">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl font-semibold text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl font-semibold text-sm">
            {success}
          </div>
        )}

        {activeTab === 'questions' ? (
          <>
            {/* Formulario de Preguntas */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {editingId ? 'Editar pregunta' : 'Nueva pregunta'}
                  </h2>
                  <p className="text-gray-500 text-sm font-medium mt-0.5">
                    Completa los campos para agregar preguntas al banco.
                  </p>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    <X size={14} /> Cancelar edición
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tipo y Subtipo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Área / Tipo *
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      {QUICK_AREAS.map((area) => {
                        const active = form.tipo === area;
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, tipo: area }))}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              active
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {area}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={form.tipo}
                      onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
                      placeholder="Ej: Verbal, Matemática..."
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Subtipo / Tema
                    </label>
                    <div className="md:mt-[38px]">
                      <SubtypeSelectDropdown
                        value={form.subtipo}
                        onChange={(val) => setForm((prev) => ({ ...prev, subtipo: val }))}
                        subtypes={subtypes}
                        onCreateSubtype={handleCreateSubtype}
                        onDeleteSubtype={handleDeleteSubtype}
                        loading={loadingSubtypes}
                      />
                    </div>
                  </div>
                </div>

                {/* Imagen opcional */}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Imagen de apoyo (opcional)
                  </label>

                  {form.imagePreviewUrl ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-center bg-white rounded-xl p-3 border border-gray-100">
                        <img
                          src={form.imagePreviewUrl}
                          alt="Vista previa de la pregunta"
                          className="max-h-64 object-contain rounded-lg"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-blue-600" />
                          {imageFile ? imageFile.name : 'Imagen cargada en Google Cloud'}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors">
                            Cambiar imagen
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors"
                          >
                            Quitar imagen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-6 bg-gray-50 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl cursor-pointer transition-colors">
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <UploadCloud size={22} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        Adjuntar imagen (figuras, patrones, gráficos)
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        PNG, JPG, WEBP o GIF • Máximo 15 MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}

                  {submitting && imageUploadProgress > 0 && imageUploadProgress < 100 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-black text-blue-600 mb-1">
                        <span>Subiendo imagen...</span>
                        <span>{imageUploadProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${imageUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Pregunta */}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Enunciado de la pregunta *
                  </label>
                  <textarea
                    rows={4}
                    value={form.pregunta}
                    onChange={(e) => setForm((prev) => ({ ...prev, pregunta: e.target.value }))}
                    placeholder="Escribe el texto, premisas o problema de la pregunta..."
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all"
                    required
                  />
                </div>

                {/* Opciones de respuesta */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                      Opciones de respuesta (marca la correcta) *
                    </label>
                    {form.respuestas.length < 6 && (
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Plus size={14} /> Agregar opción
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {form.respuestas.map((opt, idx) => {
                      const isCorrect = form.correcta === idx;
                      return (
                        <div
                          key={`form-opt-${idx}`}
                          className={`flex items-center gap-3 p-2.5 rounded-2xl border-2 transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/50 border-emerald-400'
                              : 'bg-gray-50 border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, correcta: idx }))}
                            title="Marcar como respuesta correcta"
                            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm transition-all ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-105'
                                : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </button>

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Opción ${String.fromCharCode(65 + idx)}`}
                            className="flex-1 bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-colors"
                            required
                          />

                          {isCorrect && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={12} /> Correcta
                            </span>
                          )}

                          {form.respuestas.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Quitar opción"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explicación */}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Explicación académica
                  </label>
                  <textarea
                    rows={3}
                    value={form.explicacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, explicacion: e.target.value }))}
                    placeholder="Explica brevemente por qué esa es la respuesta correcta..."
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Activa + Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-700">
                      Pregunta activa
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-60 text-sm uppercase tracking-wider"
                  >
                    <Save size={18} />
                    {submitting
                      ? 'Guardando...'
                      : editingId
                      ? 'Actualizar pregunta'
                      : 'Guardar pregunta'}
                  </button>
                </div>
              </form>
            </div>

            {/* Listado de preguntas */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-black text-gray-900">Preguntas registradas</h3>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaFilter('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      areaFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Todas
                  </button>
                  {availableAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setAreaFilter(area)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        areaFilter === area
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por enunciado, tema o explicación..."
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none transition-all"
                />
              </div>

              {loadingQuestions ? (
                <p className="text-gray-500 font-medium">Cargando preguntas...</p>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-semibold">
                  No hay preguntas que coincidan con el filtro actual.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((item, idx) => (
                    <div
                      key={item._id}
                      className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-gray-400">#{idx + 1}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                            <BookOpen size={12} /> {item.tipo}
                          </span>
                          {item.subtipo && (
                            <span className="text-[11px] font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full">
                              {item.subtipo}
                            </span>
                          )}
                          {!item.isActive && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                              Inactiva
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center"
                            title="Editar"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item._id)}
                            disabled={deletingId === item._id}
                            className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 transition-colors flex items-center justify-center"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {item.imageUrl && (
                        <div className="bg-white border border-gray-200 rounded-xl p-3 flex justify-center">
                          <img
                            src={item.imageUrl}
                            alt="Imagen de la pregunta"
                            className="max-h-56 object-contain rounded-lg"
                          />
                        </div>
                      )}

                      <p className="text-gray-900 font-semibold text-sm sm:text-base whitespace-pre-line">
                        {item.pregunta}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(item.respuestas || []).map((ans, aIdx) => {
                          const isCorrect = aIdx === item.correcta;
                          return (
                            <div
                              key={`${item._id}-opt-${aIdx}`}
                              className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                  : 'bg-white border-gray-200 text-gray-600'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {String.fromCharCode(65 + aIdx)}
                              </span>
                              <span className="flex-1">{ans}</span>
                            </div>
                          );
                        })}
                      </div>

                      {item.explicacion && (
                        <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-600 flex items-start gap-2">
                          <HelpCircle size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{item.explicacion}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Formulario de Exámenes / Quices */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {editingExamId ? 'Editar examen o quiz' : 'Crear examen o quiz'}
                  </h2>
                  <p className="text-gray-500 text-sm font-medium mt-0.5">
                    Define el título, tiempo recomendado, hoja de respuestas y las preguntas incluidas.
                  </p>
                </div>

                {editingExamId && (
                  <button
                    type="button"
                    onClick={handleResetExamForm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    <X size={14} /> Cancelar edición
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitExam} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Título del examen *
                    </label>
                    <input
                      type="text"
                      value={examForm.title}
                      onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Ej: Quiz #1 - Razonamiento Verbal"
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Tiempo recomendado
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                        <input
                          type="number"
                          min="0"
                          max="12"
                          value={examForm.hours}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              hours: Math.max(0, Math.min(12, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-16 bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-center text-sm font-black outline-none"
                        />
                        <span className="text-xs font-bold text-gray-500">hrs</span>
                      </div>

                      <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={examForm.minutes}
                          onChange={(e) =>
                            setExamForm((prev) => ({
                              ...prev,
                              minutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-16 bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-center text-sm font-black outline-none"
                        />
                        <span className="text-xs font-bold text-gray-500">min</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    value={examForm.description}
                    onChange={(e) =>
                      setExamForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Breve descripción o indicaciones para los estudiantes..."
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Configuración de Hoja de Respuestas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                      Hoja de respuestas por defecto
                    </span>
                    <div className="inline-flex bg-white p-1 rounded-2xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() =>
                          setExamForm((prev) => ({ ...prev, useBubbleSheetDefault: true }))
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          examForm.useBubbleSheetDefault
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Activada
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExamForm((prev) => ({ ...prev, useBubbleSheetDefault: false }))
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          !examForm.useBubbleSheetDefault
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Desactivada
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={examForm.lockBubbleSheet}
                        onChange={(e) =>
                          setExamForm((prev) => ({ ...prev, lockBubbleSheet: e.target.checked }))
                        }
                        className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <Lock size={14} className="text-blue-600" />
                          Bloquear opción para estudiantes
                        </span>
                        <p className="text-xs text-gray-400 font-medium">
                          Si se marca, el estudiante no podrá cambiar el uso de la hoja de respuestas.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selector de preguntas */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                      Preguntas incluidas ({examForm.questionIds.length} seleccionadas) *
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const visibleIds = filteredQuestionsForExam.map((q) => q._id);
                          setExamForm((prev) => ({
                            ...prev,
                            questionIds: Array.from(new Set([...prev.questionIds, ...visibleIds])),
                          }));
                        }}
                        className="text-xs font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        Seleccionar visibles
                      </button>
                      {examForm.questionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExamForm((prev) => ({ ...prev, questionIds: [] }))}
                          className="text-xs font-black text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          Limpiar selección
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={examQuestionSearch}
                        onChange={(e) => setExamQuestionSearch(e.target.value)}
                        placeholder="Filtrar preguntas para agregar..."
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExamQuestionArea('all')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          examQuestionArea === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Todas
                      </button>
                      {availableAreas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => setExamQuestionArea(area)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            examQuestionArea === area
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                    {filteredQuestionsForExam.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400 font-semibold">
                        No hay preguntas disponibles con ese filtro.
                      </p>
                    ) : (
                      filteredQuestionsForExam.map((q) => {
                        const checked = examForm.questionIds.includes(q._id);
                        return (
                          <div
                            key={`pick-${q._id}`}
                            onClick={() => handleToggleExamQuestion(q._id)}
                            className={`p-3.5 rounded-2xl border-2 cursor-pointer flex items-start gap-3 transition-all ${
                              checked
                                ? 'bg-blue-50/70 border-blue-500'
                                : 'bg-white border-transparent hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="mt-1 w-4 h-4 rounded accent-blue-600 pointer-events-none"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                  {q.tipo}
                                </span>
                                {q.subtipo && (
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {q.subtipo}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2">
                                {q.pregunta}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Activo + Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={examForm.isActive}
                      onChange={(e) =>
                        setExamForm((prev) => ({ ...prev, isActive: e.target.checked }))
                      }
                      className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-700">
                      Examen visible para estudiantes
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submittingExam}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-60 text-sm uppercase tracking-wider"
                  >
                    <Save size={18} />
                    {submittingExam
                      ? 'Guardando...'
                      : editingExamId
                      ? 'Actualizar examen'
                      : 'Crear examen'}
                  </button>
                </div>
              </form>
            </div>

            {/* Listado de Exámenes */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 space-y-5">
              <h3 className="text-xl font-black text-gray-900">Exámenes y quices creados</h3>

              {loadingExams ? (
                <p className="text-gray-500 font-medium">Cargando exámenes...</p>
              ) : exams.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-semibold">
                  Aún no has creado ningún examen o quiz.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map((exam) => (
                    <div
                      key={exam._id}
                      className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-lg font-black text-gray-900 leading-snug">
                            {exam.title}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditExam(exam)}
                              className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center"
                              title="Editar examen"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExam(exam._id)}
                              disabled={deletingExamId === exam._id}
                              className="w-8 h-8 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 transition-colors flex items-center justify-center"
                              title="Eliminar examen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {exam.description && (
                          <p className="text-xs text-gray-500 font-medium">{exam.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200/70">
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                          <BookOpen size={12} /> {exam.questionIds?.length || 0} preguntas
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                          <Timer size={12} /> {formatMinutesLabel(exam.recommendedMinutes)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                          {exam.lockBubbleSheet ? <Lock size={11} /> : <Unlock size={11} />}
                          {exam.useBubbleSheetDefault ? 'Con hoja' : 'Solo folleto'}
                        </span>
                        {!exam.isActive && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                            Oculto
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminQuestionsPage;
