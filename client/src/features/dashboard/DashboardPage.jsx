import { useEffect, useState } from 'react';
import { Book, BookOpen, CreditCard, FileText, LogOut, Settings, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const userCards = [
  {
    id: 'clases',
    title: 'Clases',
    subtitle: 'Ver tus clases disponibles',
    route: '/clases',
    image: '/dash1.jpg',
    titleColor: 'text-blue-600',
    icon: BookOpen,
  },
  {
    id: 'pagos',
    title: 'Pagos',
    subtitle: 'Sube tus comprobantes de pago',
    route: '/pagos',
    image: '/dash2.jpg',
    titleColor: 'text-emerald-600',
    icon: CreditCard,
  },
  {
    id: 'documentos',
    title: 'Recursos',
    subtitle: 'Accede a recursos útiles',
    route: '/recursos',
    image: '/dash3.jpg',
    titleColor: 'text-orange-500',
    icon: FileText,
  },
];

const adminCards = [
  {
    id: 'clases-admin',
    title: 'Clases',
    subtitle: 'Gestiona clases y contenidos',
    route: '/admin/clases',
    image: '/dash1.jpg',
    titleColor: 'text-blue-600',
    icon: BookOpen,
  },
  {
    id: 'pagos-admin',
    title: 'Pagos',
    subtitle: 'Valida pagos y comprobantes',
    route: '/admin/pagos',
    image: '/dash2.jpg',
    titleColor: 'text-emerald-600',
    icon: CreditCard,
  },
  {
    id: 'documentos-admin',
    title: 'Recursos',
    subtitle: 'Sube y organiza recursos',
    route: '/admin/recursos',
    image: '/dash3.jpg',
    titleColor: 'text-orange-500',
    icon: FileText,
  },
  {
    id: 'materias-admin',
    title: 'Materias',
    subtitle: 'Crea y organiza materias',
    route: '/admin/materias',
    image: '/dash4.jpg',
    titleColor: 'text-purple-600',
    icon: Book,
  },
  {
    id: 'usuarios-admin',
    title: 'Usuarios',
    subtitle: 'Administra estudiantes y accesos',
    route: '/admin/usuarios',
    image: '/dash5.jpg',
    titleColor: 'text-indigo-600',
    icon: Users,
  },
  {
    id: 'configuracion-admin',
    title: 'Configuracion',
    subtitle: 'Ajustes generales del sistema',
    route: '/configuracion',
    image: '/dash6.jpg',
    titleColor: 'text-slate-600',
    icon: Settings,
  },
];

const DashboardPage = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const isAdmin = String(role || user?.role || (user?.isAdmin ? 'admin' : 'student')).toLowerCase() === 'admin';
  const cards = isAdmin ? adminCards : userCards;
  const gridCols = isAdmin ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-3';
  const cardImageHeight = 'h-48 sm:h-56';
  const cardBodyPadding = 'p-7';

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dashboard-no-scrollbar');
    document.body.classList.add('dashboard-no-scrollbar');

    return () => {
      document.documentElement.classList.remove('dashboard-no-scrollbar');
      document.body.classList.remove('dashboard-no-scrollbar');
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex flex-col ${
        isAdmin ? 'overflow-hidden' : 'overflow-hidden'
      } transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}
      </style>

      <nav className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm z-20 sticky top-0">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-800 tracking-tight text-left">
          Proyecto Rosetta
        </h1>

        <div className="flex items-center justify-end gap-2 sm:gap-3 ml-auto">
          <button
            className="bg-red-50 text-red-500 hover:bg-red-100 w-11 h-11 sm:w-auto sm:h-auto sm:px-5 py-0 sm:py-2.5 rounded-full sm:rounded-xl font-semibold transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
            onClick={handleLogout}
            type="button"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </nav>

      <div
        className={`flex-grow flex flex-col items-center px-4 sm:px-6 ${
          isAdmin ? 'pt-6 pb-8 overflow-y-auto' : 'justify-center mt-3 sm:-mt-10'
        }`}
      >
        <header className="text-center mb-8 sm:mb-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2 tracking-tight">
            ¡Buenas, {user?.name || 'admin'}!
          </h2>
          <p className="text-lg sm:text-xl text-gray-500 font-medium">
            ¿Cuál es tu plan para hoy?
          </p>
        </header>

        <div className={`grid grid-cols-1 ${gridCols} gap-7 max-w-6xl w-full`}>
          {cards.map((card) => {
            const CardIcon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => navigate(card.route)}
                type="button"
                className="group relative bg-white rounded-[2.5rem] overflow-hidden text-left border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`relative ${cardImageHeight} w-full overflow-hidden`}>
                  <img
                    src={card.image}
                    alt={`Vista previa de ${card.title}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className={`${cardBodyPadding} bg-white border-t border-gray-100`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CardIcon size={20} className={card.titleColor} />
                    <h3 className={`text-3xl font-extrabold ${card.titleColor}`}>
                      {card.title}
                    </h3>
                  </div>
                  <p className="text-gray-500 text-base font-medium leading-tight">
                    {card.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="py-6 text-center text-gray-400 text-sm border-t border-gray-100 bg-white/60">
        © 2026 Rosetta - Plataforma de Aula Virtual
      </footer>
    </div>
  );
};

export default DashboardPage;
