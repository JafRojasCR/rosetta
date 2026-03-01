import { useEffect, useMemo, useRef, useState } from 'react';
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
  const wrapperRef = useRef(null);

  const selectedOption = useMemo(
    () => (options || []).find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasOptions = Array.isArray(options) && options.length > 0;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          if (!disabled && hasOptions) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center justify-between bg-gray-50 border-2 rounded-2xl px-5 py-3.5 transition-all duration-300 ${
          isOpen ? 'border-blue-500 bg-white shadow-lg' : 'border-transparent'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${buttonClassName}`}
        disabled={disabled}
      >
        <span className={`font-semibold text-left truncate ${selectedOption ? 'text-gray-800' : 'text-gray-400'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${menuClassName}`}
        >
          <div className="max-h-60 overflow-y-auto py-2">
            {!hasOptions ? (
              <p className="px-6 py-4 text-sm font-semibold text-gray-400">{emptyMessage}</p>
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
                  <div>
                    <p className="font-black text-gray-900 text-sm">{option.label}</p>
                    {option.description ? (
                      <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-tighter">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  {value === option.value ? <CheckCircle2 size={18} className="text-blue-500" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelectMenu;
