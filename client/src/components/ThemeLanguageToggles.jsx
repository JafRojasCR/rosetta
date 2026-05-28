import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { Sun, Moon, Languages } from 'lucide-react';

const ThemeLanguageToggles = () => {
  const { darkMode, setDarkMode, isEnglish, setIsEnglish } = useThemeLanguage();

  return (
    <div className="flex items-center gap-2 no-translate">
      {/* Translation Button */}
      <button
        onClick={() => setIsEnglish(!isEnglish)}
        className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer shadow-sm border-0 ${
          darkMode
            ? 'bg-green-950/60 hover:bg-green-950/80 text-green-300'
            : 'bg-green-100 hover:bg-green-200 text-green-600'
        }`}
        type="button"
        aria-label="Translate to English"
        title={isEnglish ? "Cambiar a Español" : "Translate to English"}
      >
        <Languages size={18} />
      </button>

      {/* Dark Mode Button */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer shadow-sm border-0 ${
          darkMode
            ? 'bg-orange-950/60 hover:bg-orange-950/80 text-orange-400'
            : 'bg-orange-100 hover:bg-orange-200 text-orange-600'
        }`}
        type="button"
        aria-label="Toggle Dark Mode"
        title={darkMode ? "Modo Claro" : "Modo Oscuro"}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
};

export default ThemeLanguageToggles;