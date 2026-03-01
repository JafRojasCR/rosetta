import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';

const AdminPaymentsPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
              Administrar pagos
            </h1>
            <p className="text-sm text-gray-500">Panel preliminar de validacion</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
          <CreditCard size={24} />
        </div>
      </nav>

      <div className="flex-grow flex items-center justify-center px-4 sm:px-6">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 text-center max-w-xl w-full">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
            Revisa y valida comprobantes
          </h2>
          <p className="text-gray-500 font-medium">
            Aqui puedes agregar herramientas para gestionar pagos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
