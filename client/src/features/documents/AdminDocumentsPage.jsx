import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Trash2 } from 'lucide-react';
import api from '../../services/api';
import CustomSelectMenu from '../../components/CustomSelectMenu';

const DOCUMENT_UPLOAD_CHUNK_SIZE_BYTES = 32 * 1024 * 1024;

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
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState('');
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

  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await api.get('/documents');
      setDocuments(response.data.data || []);
    } catch (err) {
      setError('No se pudieron cargar los recursos.');
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
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

    setLoading(true);
    try {
      const initResponse = await api.post('/documents/upload/init', {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      const uploadUrl = initResponse.data?.data?.uploadUrl;
      const chunkSize = Number(initResponse.data?.data?.chunkSize) || DOCUMENT_UPLOAD_CHUNK_SIZE_BYTES;
      if (!uploadUrl) {
        throw new Error('No se pudo iniciar la carga del recurso en Drive.');
      }

      let offset = 0;
      let uploadedFileId = '';

      while (offset < file.size) {
        const endExclusive = Math.min(offset + chunkSize, file.size);
        const chunk = file.slice(offset, endExclusive);
        const chunkBuffer = await chunk.arrayBuffer();
        const chunkStart = offset;
        const chunkEnd = endExclusive - 1;

        const uploadResponse = await api.put('/documents/upload/chunk', chunkBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Upload-Url': uploadUrl,
            'X-Chunk-Start': String(chunkStart),
            'X-Chunk-End': String(chunkEnd),
            'X-File-Size': String(file.size),
            'X-Mime-Type': file.type || 'application/octet-stream',
          },
        });

        const chunkData = uploadResponse.data?.data || {};

        if (chunkData.done) {
          uploadedFileId = String(chunkData.fileId || '').trim();
        }

        offset = endExclusive;
      }

      if (!uploadedFileId) {
        throw new Error('Google Drive no devolvió fileId al completar la carga.');
      }

      const completeResponse = await api.post('/documents/upload/complete', {
        fileId: uploadedFileId,
      });

      const uploadedFileUrl = completeResponse.data?.data?.fileUrl || '';
      if (!uploadedFileUrl) {
        throw new Error('No se pudo obtener la URL pública del recurso.');
      }

      await api.post('/documents', {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: {
          subjectId: form.subjectId.trim(),
          name: selectedSubject.name,
        },
        fileUrl: uploadedFileUrl,
        driveFileId: uploadedFileId,
        mimeType: file.type || 'application/octet-stream',
      });

      setSuccess('Recurso cargado correctamente.');
      setForm({ title: '', description: '', subjectId: '' });
      setFile(null);
      await fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el recurso.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    setError('');
    setSuccess('');
    setDeletingDocId(docId);

    try {
      await api.delete(`/documents/${docId}`);
      setSuccess('Recurso eliminado correctamente.');
      await fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el recurso.');
    } finally {
      setDeletingDocId('');
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
              Subir recursos
            </h1>
            <p className="text-sm text-gray-500">Panel de gestión de recursos</p>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <UploadCloud size={26} />
        </div>
      </nav>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-sm border border-gray-100">
          <div className="mb-8">
            <h2 className="text-xl font-extrabold text-gray-900">Carga de documentos</h2>
            <p className="text-sm text-gray-500">
              Carga recursos en PDF o video para tus estudiantes.
            </p>
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
                  placeholder="Titulo del recurso"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Materia
                </label>
                <CustomSelectMenu
                  value={form.subjectId}
                  onChange={(nextValue) =>
                    setForm((prev) => ({
                      ...prev,
                      subjectId: nextValue,
                    }))
                  }
                  options={subjects.map((subject) => ({
                    value: subject.subjectId,
                    label: `${subject.name} (${subject.subjectId})`,
                  }))}
                  placeholder={
                    loadingSubjects
                      ? 'Cargando materias...'
                      : subjects.length === 0
                        ? 'No hay materias disponibles'
                        : 'Selecciona una materia'
                  }
                  disabled={loadingSubjects || subjects.length === 0}
                />
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
                    accept=".pdf,.mp4,.webm,.mov,.mpeg"
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
                {loading ? 'Subiendo...' : 'Subir recurso'}
              </button>
            </div>
          </form>

          <div className="mt-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Recursos registrados</h3>
            {loadingDocuments ? (
              <p className="text-gray-500 font-medium">Cargando recursos...</p>
            ) : documents.length === 0 ? (
              <p className="text-gray-500 font-medium">No hay recursos registrados.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.docId}
                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-gray-900 font-bold">{doc.title}</p>
                      <p className="text-xs uppercase tracking-widest text-gray-400 font-black mt-1">
                        {doc.docId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.docId)}
                      disabled={deletingDocId === doc.docId}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 flex items-center justify-center"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default AdminDocumentsPage;
