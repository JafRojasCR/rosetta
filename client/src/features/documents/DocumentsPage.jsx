import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
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

const mockResources = [
  {
    id: 1,
    title: 'Introduccion a la Gramatica Avanzada',
    type: 'pdf',
    category: 'Gramatica',
    author: 'Prof. Alberto Rojas',
    duration: '15 paginas',
    thumbnail: DOCUMENT_THUMB,
    date: '12 Oct 2023',
  },
  {
    id: 2,
    title: 'Tecnicas de Pronunciacion: Vocales',
    type: 'video',
    category: 'Fonetica',
    author: 'Dra. Elena Vizcaino',
    duration: '12:45 min',
    thumbnail: VIDEO_THUMB,
    date: '05 Nov 2023',
  },
  {
    id: 3,
    title: 'Historia del Arte Contemporaneo',
    type: 'pdf',
    category: 'Cultura',
    author: 'Msc. Roberto Saenz',
    duration: '42 paginas',
    thumbnail: DOCUMENT_THUMB,
    date: '20 Ene 2024',
  },
  {
    id: 4,
    title: 'Masterclass: Redaccion Creativa',
    type: 'video',
    category: 'Escritura',
    author: 'Lic. Marta Castillo',
    duration: '45:20 min',
    thumbnail: VIDEO_THUMB,
    date: '15 Feb 2024',
  },
];

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

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await api.get('/documents');
        setDocuments(response.data.data || []);
      } catch (err) {
        setError('Error al cargar los documentos');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const resources = useMemo(() => {
    if (documents.length > 0) {
      return documents.map(buildResource);
    }

    return mockResources;
  }, [documents]);

  const filteredResources = resources.filter((res) => {
    const matchesFilter = filter === 'all' || res.type === filter;
    const searchText = `${res.title} ${res.author} ${res.category}`.toLowerCase();
    const matchesSearch = searchText.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col overflow-x-hidden transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
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
            Biblioteca Publica
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
              {t === 'all' ? 'Todos' : t === 'video' ? 'Videos' : 'Documentos'}
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
            placeholder="Buscar por titulo, autor o categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] pl-16 pr-8 py-5 shadow-sm text-lg font-medium outline-none transition-all"
          />
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
              className="group bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row h-full"
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
                  {res.fileUrl ? (
                    <a
                      href={res.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-grow bg-gray-50 hover:bg-blue-600 hover:text-white text-blue-600 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 group/btn"
                    >
                      <span>{res.type === 'video' ? 'Ver Video' : 'Leer PDF'}</span>
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex-grow bg-gray-100 text-gray-400 font-black py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span>{res.type === 'video' ? 'Ver Video' : 'Leer PDF'}</span>
                      <ExternalLink size={16} />
                    </button>
                  )}

                  {res.fileUrl ? (
                    <a
                      href={res.fileUrl}
                      download
                      className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Download size={20} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="p-3 bg-gray-100 text-gray-300 rounded-xl transition-all cursor-not-allowed"
                    >
                      <Download size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredResources.length === 0 && (
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

      <footer className="py-6 text-center text-gray-400 text-sm border-t border-gray-100 bg-white/60 mt-auto">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default DocumentsPage;
