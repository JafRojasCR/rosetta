import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex items-center justify-center px-4 transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <div className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 sm:p-10 border border-gray-100 shadow-sm text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-5">
          <AlertTriangle size={30} />
        </div>

        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Error 404</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">Página no encontrada</h1>
        <p className="text-gray-500 font-medium mt-4">
          La ruta que intentaste abrir no existe o fue movida.
        </p>

        <a
          href="https://rosetta.jafrojas.com/"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-all"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </a>
      </div>
    </div>
  );
};

export default NotFoundPage;
