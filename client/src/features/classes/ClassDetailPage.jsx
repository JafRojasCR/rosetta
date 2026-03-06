import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const ClassDetailPage = () => {
  const { classCode } = useParams();
  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resourceError, setResourceError] = useState('');

  useEffect(() => {
    const fetchClass = async () => {
      try {
        const response = await api.get(`/classes/${classCode}`);
        setCls(response.data.data);
      } catch (err) {
        setError('Clase no encontrada');
      } finally {
        setLoading(false);
      }
    };
    fetchClass();
  }, [classCode]);

  const openProtectedResource = async (endpoint) => {
    setResourceError('');
    try {
      const response = await api.get(endpoint);
      const accessUrl = response.data?.data?.accessUrl || '';
      if (accessUrl) {
        window.open(accessUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_requestError) {
      setResourceError('No se pudo abrir el recurso solicitado.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/clases" className="text-primary-600 text-sm hover:underline mb-4 inline-block">
        ← Volver a clases
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-start justify-between mb-4">
          <span className="text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
            {cls.subject?.name}
          </span>
          <span className="text-sm text-gray-400">
            {new Date(cls.date).toLocaleDateString('es-CR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{cls.title}</h1>
        <p className="text-gray-600 mb-6">{cls.description}</p>

        <div className="flex items-center gap-4 mb-6">
          <span className="text-xl font-bold text-green-600">
            ₡{cls.price?.toLocaleString('es-CR')}
          </span>
          {cls.hasPaid ? (
            <span className="bg-green-50 text-green-600 text-sm px-3 py-1 rounded-full font-medium">
              ✓ Pagada
            </span>
          ) : (
            <span className="bg-yellow-50 text-yellow-600 text-sm px-3 py-1 rounded-full font-medium">
              ⚠ Sin pagar
            </span>
          )}
        </div>

        {cls.hasPaid || cls.isPublic ? (
          <div className="space-y-3">
            {resourceError && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-medium rounded-lg px-4 py-2">
                {resourceError}
              </div>
            )}
            {cls.recordingUrl && (
              <button
                type="button"
                onClick={() => openProtectedResource(`/classes/${cls.classCode}/recording-access`)}
                className="flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-3 rounded-lg hover:bg-primary-100 transition-colors font-medium"
              >
                <span>🎬</span>
                <span>Ver grabación</span>
              </button>
            )}
            {cls.canvaUrl && (
              <button
                type="button"
                onClick={() => openProtectedResource(`/classes/${cls.classCode}/canva-access`)}
                className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-3 rounded-lg hover:bg-purple-100 transition-colors font-medium"
              >
                <span>🎨</span>
                <span>Ver presentación en Canva</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-gray-700 font-medium mb-2">Clase bloqueada</p>
            <p className="text-gray-500 text-sm mb-4">
              Debes realizar el pago para acceder al contenido
            </p>
            <Link
              to={`/pagos?classCode=${encodeURIComponent(cls.classCode || '')}`}
              className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Ir a Pagos
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassDetailPage;
