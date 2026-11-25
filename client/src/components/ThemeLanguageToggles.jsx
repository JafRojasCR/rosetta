import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { Sun, Moon } from 'lucide-react';

const ThemeLanguageToggles = () => {
  const { darkMode, setDarkMode } = useThemeLanguage();

  return (
    <div className="flex items-center gap-2 no-translate">
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
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
};

export default ThemeLanguageToggles;