import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  X,
  Clock,
  Download,
  ExternalLink,
  PlayCircle,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const DOCUMENT_THUMB =
  'https://images.unsplash.com/photo-1544640808-32ca72ac7f37?q=80&w=600&auto=format&fit=crop';
const VIDEO_THUMB =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';
const MODAL_EXIT_ANIMATION_MS = 220;

const normalizeType = (resource) => {
  const explicitType = resource?.type?.toLowerCase();
  if (explicitType === 'video' || explicitType === 'pdf') return explicitType;

  const fileUrl = resource?.fileUrl || resource?.url || '';
  if (fileUrl.match(/\.(mp4|mov|webm)$/i)) return 'video';

  return 'pdf';
};

const buildResource = (doc) => {
  const type = normalizeType(doc);
  const dateValue = doc?.date || doc?.createdAt || doc?.updatedAt;
  const formattedDate = dateValue
    ? new Date(dateValue).toLocaleDateString('es-CR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return {
    id: doc?.docId || doc?.id,
    title: doc?.title || 'Recurso sin titulo',
    description: String(doc?.description || '').trim(),
    type,
    category: doc?.subject?.name || 'General',
    author: doc?.author || doc?.teacher || doc?.createdBy || 'Equipo Rosetta',
    duration: doc?.duration || (type === 'pdf' ? 'Documento PDF' : 'Video'),
    thumbnail: doc?.thumbnail || (type === 'video' ? VIDEO_THUMB : DOCUMENT_THUMB),
    date: formattedDate,
    fileUrl: doc?.fileUrl || doc?.url || '',
  };
};

const DocumentsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerType, setViewerType] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [descriptionDialogTitle, setDescriptionDialogTitle] = useState('');
  const [descriptionDialogText, setDescriptionDialogText] = useState('');
  const [viewerClosing, setViewerClosing] = useState(false);
  const [descriptionDialogClosing, setDescriptionDialogClosing] = useState(false);
  const viewerCloseTimerRef = useRef(null);
  const descriptionCloseTimerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setIsVisible(false);
      return undefined;
    }

    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await api.get('/documents');
        setDocuments(response.data.data || []);
      } catch (err) {
        setError('Error al cargar los recursos');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  useEffect(() => {
    return () => {
      if (viewerCloseTimerRef.current) {
        clearTimeout(viewerCloseTimerRef.current);
      }
      if (descriptionCloseTimerRef.current) {
        clearTimeout(descriptionCloseTimerRef.current);
      }
    };
  }, []);

  const resources = useMemo(() => documents.map(buildResource), [documents]);

  const filteredResources = resources.filter((res) => {
    const matchesFilter = filter === 'all' || res.type === filter;
    const searchText = `${res.title} ${res.author} ${res.category}`.toLowerCase();
    const matchesSearch = searchText.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const closeViewer = () => {
    if (!viewerOpen || viewerClosing) return;
    setViewerClosing(true);

    if (viewerCloseTimerRef.current) {
      clearTimeout(viewerCloseTimerRef.current);
    }

    viewerCloseTimerRef.current = setTimeout(() => {
      setViewerOpen(false);
      setViewerLoading(false);
      setViewerError('');
      setViewerTitle('');
      setViewerType('');
      setViewerUrl('');
      setViewerClosing(false);
      viewerCloseTimerRef.current = null;
    }, MODAL_EXIT_ANIMATION_MS);
  };

  const openViewer = async (resource) => {
    if (!resource?.fileUrl) return;

    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError('');
    setViewerTitle(resource.title || 'Recurso');
    setViewerType(resource.type || 'pdf');
    setViewerUrl('');
    setViewerClosing(false);

    try {
      if (resource.type === 'video') {
        const response = await api.get(`/documents/${resource.id}/embed-token`);
        const iframeUrl = response.data?.data?.iframeUrl || '';
        if (!iframeUrl) {
          throw new Error('No se pudo preparar el reproductor del video.');
        }
        setViewerUrl(iframeUrl);
      } else {
        const accessResponse = await api.get(`/documents/${resource.id}/access-url`, {
          params: { mode: 'inline' },
        });
        const accessUrl = accessResponse.data?.data?.accessUrl || '';
        if (!accessUrl) {
          throw new Error('No se pudo preparar el acceso al documento.');
        }
        setViewerUrl(accessUrl);
      }
    } catch (requestError) {
      setViewerError(
        requestError.response?.data?.message ||
          requestError.message ||
          'No se pudo abrir el recurso.'
      );
    } finally {
      setViewerLoading(false);
    }
  };

  const openDescriptionDialog = (resource) => {
    setDescriptionDialogTitle(resource?.title || 'Descripción');
    setDescriptionDialogText(
      String(resource?.description || '').trim() || 'Este recurso no tiene descripción registrada.'
    );
    setDescriptionDialogOpen(true);
    setDescriptionDialogClosing(false);
  };

  const closeDescriptionDialog = () => {
    if (!descriptionDialogOpen || descriptionDialogClosing) return;
    setDescriptionDialogClosing(true);

    if (descriptionCloseTimerRef.current) {
      clearTimeout(descriptionCloseTimerRef.current);
    }

    descriptionCloseTimerRef.current = setTimeout(() => {
      setDescriptionDialogOpen(false);
      setDescriptionDialogTitle('');
      setDescriptionDialogText('');
      setDescriptionDialogClosing(false);
      descriptionCloseTimerRef.current = null;
    }, MODAL_EXIT_ANIMATION_MS);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col overflow-x-hidden transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            type="button"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight">
            Recursos
          </h1>
        </div>

        <div className="hidden md:flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
          {['all', 'video', 'pdf'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all uppercase tracking-widest ${
                filter === t
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              type="button"
            >
              {t === 'all' ? 'Todos' : t === 'video' ? 'Videos' : 'Docs'}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-10">
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search
              className="text-gray-400 group-focus-within:text-blue-500 transition-colors"
              size={22}
            />
          </div>
          <input
            type="text"
            placeholder="Buscar por titulo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] pl-16 pr-8 py-5 shadow-sm text-lg font-medium outline-none transition-all"
          />
        </div>

        <div className="md:hidden mt-4">
          <div className="bg-white p-1 rounded-2xl border border-gray-100 flex">
            {['all', 'video', 'pdf'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${
                  filter === t
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                type="button"
              >
                {t === 'all' ? 'Todos' : t === 'video' ? 'Videos' : 'Docs'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              onClick={() => openViewer(res)}
              className={`group bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row h-full ${
                res.fileUrl ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="relative w-full sm:w-56 h-48 sm:h-auto overflow-hidden flex-shrink-0">
                <img
                  src={res.thumbnail}
                  alt={res.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  {res.type === 'video' ? (
                    <PlayCircle
                      className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300"
                      size={60}
                    />
                  ) : (
                    <BookOpen
                      className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300"
                      size={60}
                    />
                  )}
                </div>
                <div className="absolute top-4 left-4">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white ${
                      res.type === 'video' ? 'bg-red-500' : 'bg-blue-600'
                    }`}
                  >
                    {res.type}
                  </span>
                </div>
              </div>

              <div className="p-8 flex flex-col justify-between flex-grow">
                <div>
                  <span className="text-blue-600 text-xs font-black uppercase tracking-widest mb-2 block">
                    {res.category}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                    {res.title}
                  </h3>
                  <p className="text-gray-400 text-sm font-medium mb-4">Por {res.author}</p>

                  <div className="flex items-center gap-4 text-gray-400 mb-6">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Clock size={14} />
                      {res.duration}
                    </div>
                    <div className="w-1 h-1 bg-gray-200 rounded-full" />
                    <div className="text-xs font-bold">{res.date}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDescriptionDialog(res);
                    }}
                    className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <BookOpen size={18} />
                    
                  </button>

                  {res.fileUrl ? (
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        try {
                          const accessResponse = await api.get(`/documents/${res.id}/access-url`, {
                            params: { mode: 'download' },
                          });
                          const accessUrl = accessResponse.data?.data?.accessUrl || '';
                          if (accessUrl) {
                            window.open(accessUrl, '_blank', 'noopener,noreferrer');
                          }
                        } catch (_requestError) {
                          setError('No se pudo obtener el enlace de descarga seguro.');
                        }
                      }}
                      className="w-full bg-gray-50 hover:bg-blue-600 hover:text-white text-blue-600 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      <span>Descargar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full bg-gray-100 text-gray-400 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Download size={18} />
                      <span>Descargar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {descriptionDialogOpen && (
          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeDescriptionDialog();
              }
            }}
            className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center transition-opacity duration-200 ${
              descriptionDialogClosing ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div
              className={`w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden transition-all duration-200 ${
                descriptionDialogClosing
                  ? 'opacity-0 scale-95 translate-y-2'
                  : 'opacity-100 scale-100 translate-y-0'
              }`}
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Descripción del recurso
                  </p>
                  <h4 className="text-sm font-black text-gray-900 truncate">{descriptionDialogTitle}</h4>
                </div>
                <button
                  type="button"
                  onClick={closeDescriptionDialog}
                  className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-red-600 hover:text-white text-gray-600 transition-colors flex items-center justify-center shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm leading-relaxed text-gray-700 font-medium max-h-[45vh] overflow-auto">
                  {descriptionDialogText}
                </div>
              </div>
            </div>
          </div>
        )}

        {resources.length === 0 && (
          <div className="text-center py-20">
            <h4 className="text-3xl font-black text-gray-800">No hay recursos por ahora</h4>
          </div>
        )}

        {resources.length > 0 && filteredResources.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white w-20 h-20 rounded-3xl flex items-center justify-center text-gray-200 mx-auto mb-6">
              <Search size={40} />
            </div>
            <h4 className="text-2xl font-black text-gray-800">No encontramos resultados</h4>
            <p className="text-gray-400 font-medium">
              Intenta con otros terminos de busqueda o filtros.
            </p>
          </div>
        )}
      </div>

      {viewerOpen && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeViewer();
            }
          }}
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center transition-opacity duration-200 ${
            viewerClosing ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div
            className={`w-full max-w-6xl h-[96vh] bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden transition-all duration-200 ${
              viewerClosing
                ? 'opacity-0 scale-[0.985] translate-y-2'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {viewerType === 'video' ? 'Visualizador de video' : 'Visualizador PDF'}
                </p>
                <h3 className="text-sm sm:text-lg font-black text-gray-900 truncate">{viewerTitle}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {viewerType === 'pdf' && viewerUrl && (
                  <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-blue-600 hover:text-white text-blue-600 transition-colors flex items-center justify-center"
                    title="Abrir en otra ventana"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-red-600 hover:text-white text-gray-600 transition-colors flex items-center justify-center"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-gray-900/95">
              {viewerLoading ? (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  Cargando visualizador...
                </div>
              ) : viewerError ? (
                <div className="w-full h-full flex items-center justify-center px-6 text-center text-red-200 font-semibold">
                  {viewerError}
                </div>
              ) : viewerUrl ? (
                viewerType === 'video' ? (
                  <iframe
                    src={viewerUrl}
                    title={`Video ${viewerTitle}`}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts"
                    allow="autoplay; encrypted-media"
                  />
                ) : (
                  <iframe
                    src={viewerUrl}
                    title={`PDF ${viewerTitle}`}
                    className="w-full h-full border-0 bg-white"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/80 font-semibold">
                  Recurso no disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="py-4 sm:py-6 text-center text-gray-400 text-xs sm:text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default DocumentsPage;
