import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const ClassCard = ({ cls }) => (
  <Link
    to={`/clases/${cls.classCode}`}
    className="block bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all hover:-translate-y-0.5"
  >
    <div className="flex items-start justify-between mb-3">
      <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
        {cls.subject?.name || 'Sin materia'}
      </span>
      <span className="text-xs text-gray-400">
        {new Date(cls.date).toLocaleDateString('es-CR')}
      </span>
    </div>
    <h3 className="font-semibold text-gray-800 mb-1">{cls.title}</h3>
    <p className="text-sm text-gray-500 line-clamp-2">{cls.description}</p>
    <div className="mt-3 flex items-center justify-between">
      <span className="text-sm font-medium text-green-600">
        ₡{cls.price?.toLocaleString('es-CR')}
      </span>
      {cls.isPublic ? (
        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Pública</span>
      ) : (
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">De pago</span>
      )}
    </div>
  </Link>
);

const ClassesPage = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const params = subjectFilter ? { subjectId: subjectFilter } : {};
        const response = await api.get('/classes', { params });
        const data = response.data.data;
        setClasses(data);

        // Extraer materias únicas para el filtro
        const uniqueSubjects = [...new Map(data.map((c) => [c.subject?.subjectId, c.subject])).values()].filter(Boolean);
        setSubjects(uniqueSubjects);
      } catch (err) {
        setError('Error al cargar las clases');
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [subjectFilter]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clases</h1>
          <p className="text-gray-500 text-sm">{classes.length} clases disponibles</p>
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

      {classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🎓</p>
          <p>No hay clases disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <ClassCard key={cls.classCode} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
