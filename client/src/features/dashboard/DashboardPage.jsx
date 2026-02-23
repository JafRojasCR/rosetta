import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const DashboardCard = ({ to, icon, title, description, color }) => (
  <Link
    to={to}
    className={`block p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1 bg-white`}
  >
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-2xl ${color}`}>
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    <p className="text-gray-500 text-sm mt-1">{description}</p>
  </Link>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setIsVisible(true), 30);
    return () => clearTimeout(id);
  }, []);

  const cards = [
    {
      to: '/clases',
      icon: '🎓',
      title: 'Clases',
      description: 'Accede a tus clases y grabaciones',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      to: '/pagos',
      icon: '💳',
      title: 'Pagos',
      description: 'Gestiona y sube tus comprobantes',
      color: 'bg-green-50 text-green-600',
    },
    {
      to: '/documentos',
      icon: '📄',
      title: 'Documentos',
      description: 'Descarga materiales educativos',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      to: '/perfil',
      icon: '👤',
      title: 'Mi Perfil',
      description: 'Edita tu información personal',
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          ¡Bienvenido, {user?.name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">¿Qué quieres hacer hoy?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <DashboardCard key={card.to} {...card} />
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
