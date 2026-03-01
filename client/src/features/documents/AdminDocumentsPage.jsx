import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText } from 'lucide-react';
import api from '../../services/api';

const AdminDocumentsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    subjectId: '',
  });
  const [subjects, setSubjects] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const response = await api.get('/subjects');
        setSubjects(response.data.data || []);
      } catch (err) {
        setError('No se pudieron cargar las materias.');
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const selectedSubject = subjects.find((subject) => subject.subjectId === form.subjectId);

    if (!form.title || !form.subjectId || !selectedSubject || !file) {
      setError('Completa todos los campos obligatorios y adjunta un archivo.');
      return;
    }

    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('description', form.description.trim());
    payload.append('subject[subjectId]', form.subjectId.trim());
    payload.append('subject[name]', selectedSubject.name);
    payload.append('file', file);

    setLoading(true);
    try {
      await api.post('/documents', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Documento cargado correctamente.');
      setForm({ title: '', description: '', subjectId: '' });
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el documento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] transform transition-all duration-700 ease-out ${
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
              Subir documentos
            </h1>
            <p className="text-sm text-gray-500">Panel preliminar para pruebas</p>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UploadCloud size={26} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Carga de documentos</h2>
              <p className="text-sm text-gray-500">
                Los archivos permitidos actuales son PDF, JPG y PNG.
              </p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Titulo
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
                  placeholder="Titulo del documento"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Materia
                </label>
                <select
                  name="subjectId"
                  value={form.subjectId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      subjectId: event.target.value,
                    }))
                  }
                  className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
                  disabled={loadingSubjects || subjects.length === 0}
                >
                  <option value="">
                    {loadingSubjects
                      ? 'Cargando materias...'
                      : subjects.length === 0
                        ? 'No hay materias disponibles'
                        : 'Selecciona una materia'}
                  </option>
                  {subjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      {subject.name} ({subject.subjectId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Descripcion
                </label>
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-2xl px-5 py-3.5 font-semibold transition-all outline-none"
                  placeholder="Descripcion opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                Archivo
              </label>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <label className="flex-1 flex items-center gap-3 px-5 py-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                  <FileText className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-600">
                    {file ? file.name : 'Selecciona un archivo para subir'}
                  </span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white hover:bg-blue-700 px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Subiendo...' : 'Subir documento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDocumentsPage;
