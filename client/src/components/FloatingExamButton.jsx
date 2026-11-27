import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCheck, Lock } from 'lucide-react';

const FloatingExamButton = ({
  onClick,
  label = 'Práctica de Examen',
  ariaLabel,
  locked = false,
  lockedMessage = 'Debes adquirir un curso para desbloquear la Práctica de Examen.',
}) => {
  const [host, setHost] = useState(null);
  const [showLockedTooltip, setShowLockedTooltip] = useState(false);
  const tooltipTimerRef = useRef(null);

  useEffect(() => {
    const portalHost = document.createElement('div');
    document.body.appendChild(portalHost);
    setHost(portalHost);

    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
      document.body.removeChild(portalHost);
    };
  }, []);

  const triggerLockedTooltip = () => {
    setShowLockedTooltip(true);
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = setTimeout(() => {
      setShowLockedTooltip(false);
      tooltipTimerRef.current = null;
    }, 3000);
  };

  if (!host) return null;

  return createPortal(
    <div className="fixed bottom-[5vh] right-[4vw] sm:bottom-[3vh] sm:right-[3vw] z-50 flex flex-col items-end gap-2">
      {locked && showLockedTooltip && (
        <div className="max-w-xs bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-in fade-in duration-200">
          {lockedMessage}
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          if (locked) {
            event.preventDefault();
            triggerLockedTooltip();
            return;
          }
          onClick?.(event);
        }}
        onMouseEnter={() => {
          if (locked) {
            triggerLockedTooltip();
          }
        }}
        aria-label={ariaLabel ?? label}
        aria-disabled={locked}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_18px_40px_rgba(15,23,42,0.35)] ${
          locked
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed hover:bg-gray-300'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {locked ? <Lock size={16} /> : <ClipboardCheck size={16} />}
        {label}
      </button>
    </div>,
    host
  );
};

export default FloatingExamButton;
