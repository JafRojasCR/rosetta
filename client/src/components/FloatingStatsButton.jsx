import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp } from 'lucide-react';

const FloatingStatsButton = ({ onClick, label = 'Ver estadísticas', ariaLabel }) => {
  const [host, setHost] = useState(null);

  useEffect(() => {
    const portalHost = document.createElement('div');
    document.body.appendChild(portalHost);
    setHost(portalHost);

    return () => {
      document.body.removeChild(portalHost);
    };
  }, []);

  if (!host) return null;

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="fixed bottom-[5vh] right-[4vw] sm:bottom-[3vh] sm:right-[3vw] z-50 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-[0_18px_40px_rgba(15,23,42,0.35)]"
    >
      <TrendingUp size={16} />
      {label}
    </button>,
    host,
  );
};

export default FloatingStatsButton;
