import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Book, Pencil, Trash2, Check, X } from 'lucide-react';
import api from '../../services/api';

const AdminSubjectsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    name: '',
    subjectId: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [subjectIdTouched, setSubjectIdTouched] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', subjectId: '' });
  const [busySubjectId, setBusySubjectId] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const response = await api.get('/subjects');
      setSubjects(response.data.data || []);
    } catch (err) {
      setError('No se pudieron cargar las materias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const createSuggestedCode = (name) => {
    const sanitized = (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    if (!sanitized) return '';
    return sanitized.replace(/\s+/g, '').slice(0, 3);
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    const suggested = createSuggestedCode(newName);

    setForm((prev) => ({
      ...prev,
      name: newName,
      subjectId: subjectIdTouched ? prev.subjectId : suggested,
    }));
  };

  const handleCodeChange = (event) => {
    setSubjectIdTouched(true);
    setForm((prev) => ({
      ...prev,
      subjectId: event.target.value.toLowerCase(),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.subjectId.trim()) {
      setError('Completa nombre y codigo de materia.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/subjects', {
        name: form.name.trim(),
        subjectId: form.subjectId.trim().toLowerCase(),
      });
      setSuccess('Materia creada correctamente.');
      setForm({ name: '', subjectId: '' });
      setSubjectIdTouched(false);
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear la materia.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (subject) => {
    setError('');
    setSuccess('');
    setEditingSubjectId(subject.subjectId);
    setEditForm({
      name: subject.name,
      subjectId: subject.subjectId,
    });
  };

  const cancelEdit = () => {
    setEditingSubjectId('');
    setEditForm({ name: '', subjectId: '' });
  };

  const saveEdit = async (originalSubjectId) => {
    setError('');
    setSuccess('');

    if (!editForm.name.trim() || !editForm.subjectId.trim()) {
      setError('Completa nombre y codigo para editar la materia.');
      return;
    }

    setBusySubjectId(originalSubjectId);
    try {
      await api.put(`/subjects/${originalSubjectId}`, {
        name: editForm.name.trim(),
        subjectId: editForm.subjectId.trim().toLowerCase(),
      });
      setSuccess('Materia actualizada correctamente.');
      setEditingSubjectId('');
      setEditForm({ name: '', subjectId: '' });
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar la materia.');
    } finally {
      setBusySubjectId('');
    }
  };

  const deleteSubject = async (subjectId) => {
    setError('');
    setSuccess('');

    setBusySubjectId(subjectId);
    try {
      await api.delete(`/subjects/${subjectId}`);
      setSuccess('Materia eliminada correctamente.');
      if (editingSubjectId === subjectId) {
        cancelEdit();
      }
      await fetchSubjects();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar la materia.');
    } finally {
      setBusySubjectId('');
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
              Administrar materias
            </h1>
          </div>
        </div>
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
          <Book size={24} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Crear materia</h2>
          <p className="text-gray-500 font-medium mb-8">
            El codigo se autocompleta con las primeras 3 letras en minuscula.
          </p>

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

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <input
              type="text"
              value={form.name}
              onChange={handleNameChange}
              placeholder="Nombre de materia"
              className="sm:col-span-2 bg-gray-50 border-transparent border-2 focus:border-purple-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
            />
            <input
              type="text"
              value={form.subjectId}
              onChange={handleCodeChange}
              placeholder="Codigo"
              className="bg-gray-50 border-transparent border-2 focus:border-purple-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none lowercase"
            />
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-purple-600 text-white hover:bg-purple-700 px-8 py-3 rounded-2xl font-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar materia'}
              </button>
            </div>
          </form>

          <h3 className="text-lg font-bold text-gray-900 mb-3">Materias registradas</h3>
          {loading ? (
            <p className="text-gray-500 font-medium">Cargando materias...</p>
          ) : subjects.length === 0 ? (
            <p className="text-gray-500 font-medium">No hay materias registradas.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subjects.map((subject) => (
                <div key={subject.subjectId} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  {editingSubjectId === subject.subjectId ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        className="w-full bg-white border-transparent border-2 focus:border-purple-500 rounded-xl px-4 py-2.5 font-semibold outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editForm.subjectId}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              subjectId: event.target.value.toLowerCase(),
                            }))
                          }
                          className="flex-1 bg-white border-transparent border-2 focus:border-purple-500 rounded-xl px-4 py-2.5 font-semibold outline-none lowercase"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(subject.subjectId)}
                          disabled={busySubjectId === subject.subjectId}
                          className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 flex items-center justify-center"
                          title="Guardar"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={busySubjectId === subject.subjectId}
                          className="w-10 h-10 rounded-xl bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-60 flex items-center justify-center"
                          title="Cancelar"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-gray-900 font-bold">{subject.name}</p>
                        <p className="text-xs uppercase tracking-widest text-gray-400 font-black mt-1">
                          {subject.subjectId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(subject)}
                          disabled={busySubjectId === subject.subjectId}
                          className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-60 flex items-center justify-center"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(subject.subjectId)}
                          disabled={busySubjectId === subject.subjectId}
                          className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-gray-400 text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminSubjectsPage;
