import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const DocumentCard = ({ doc }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
    <div className="flex items-start justify-between mb-3">
      <span className="text-xs font-medium bg-purple-50 text-purple-600 px-2 py-1 rounded-full">
        {doc.subject?.name || 'General'}
      </span>
      <span className="text-xs text-gray-400">
        {new Date(doc.date).toLocaleDateString('es-CR')}
      </span>
    </div>
    <div className="flex-1">
      <h3 className="font-semibold text-gray-800 mb-1">{doc.title}</h3>
      <p className="text-sm text-gray-500 line-clamp-2">{doc.description}</p>
    </div>
    <a
      href={doc.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center justify-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
    >
      <span>📥</span>
      <span>Descargar</span>
    </a>
  </div>
);

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const params = subjectFilter ? { subjectId: subjectFilter } : {};
        const response = await api.get('/documents', { params });
        const data = response.data.data;
        setDocuments(data);

        const uniqueSubjects = [
          ...new Map(data.map((d) => [d.subject?.subjectId, d.subject])).values(),
        ].filter(Boolean);
        setSubjects(uniqueSubjects);
      } catch (err) {
        setError('Error al cargar los documentos');
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [subjectFilter]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 text-sm">{documents.length} documentos disponibles</p>
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todas las materias</option>
          {subjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📄</p>
          <p>No hay documentos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <DocumentCard key={doc.docId} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
