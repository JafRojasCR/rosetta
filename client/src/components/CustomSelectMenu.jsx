import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';

const CustomSelectMenu = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar',
  disabled = false,
  emptyMessage = 'No hay opciones disponibles',
  buttonClassName = '',
  menuClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuEntered, setIsMenuEntered] = useState(false);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const updateMenuPosition = () => {
    const triggerRect = wrapperRef.current?.getBoundingClientRect();
    if (!triggerRect) return false;

    setMenuPosition({
      top: triggerRect.bottom + 8,
      left: triggerRect.left,
      width: triggerRect.width,
    });

    return true;
  };

  const selectedOption = useMemo(
    () => (options || []).find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideWrapper = wrapperRef.current?.contains(event.target);
      const clickedInsideMenu = menuRef.current?.contains(event.target);

      if (!clickedInsideWrapper && !clickedInsideMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    setIsMenuEntered(false);
    const animationFrame = requestAnimationFrame(() => {
      setIsMenuEntered(true);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  const hasOptions = Array.isArray(options) && options.length > 0;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          if (!disabled && hasOptions) {
            if (isOpen) {
              setIsOpen(false);
              return;
            }

            setIsMenuEntered(false);
            const hasPosition = updateMenuPosition();
            if (hasPosition) {
              setIsOpen(true);
            }
          }
        }}
        className={`w-full flex items-center justify-between bg-gray-50 border-2 rounded-2xl px-5 py-3.5 transition-all duration-300 ${
          isOpen ? 'border-blue-500 bg-white shadow-lg' : 'border-transparent'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${buttonClassName}`}
        disabled={disabled}
      >
        <span
          className={`text-sm font-semibold text-left truncate ${
            selectedOption ? 'text-gray-800' : 'text-gray-400'
          }`}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                width: `${menuPosition.width}px`,
              }}
              className={`font-['Poppins'] bg-white rounded-3xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden origin-top transition-all duration-200 ease-out ${
                isMenuEntered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              } ${menuClassName}`}
            >
              <div className="max-h-52 overflow-y-auto py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {!hasOptions ? (
                  <p className="px-6 py-4 text-sm font-medium text-gray-400">{emptyMessage}</p>
                ) : (
                  options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`w-full px-6 py-4 hover:bg-blue-50 transition-colors flex items-center justify-between text-left ${
                        value === option.value ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {option.description ? (
                            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-tight">
                              {option.description}
                            </p>
                          ) : null}
                          {option.code ? (
                            <span className="ml-auto inline-flex items-center bg-gray-100 text-gray-600 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                              Código: {option.code}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {value === option.value ? <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0 ml-2" /> : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default CustomSelectMenu;
