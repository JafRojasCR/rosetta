const LoadingSpinner = ({ size = 'md', text = 'Cargando...', fullScreen = true }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const wrapperClasses = fullScreen
    ? "min-h-screen w-full flex flex-col items-center justify-center gap-4 px-6 font-['Poppins']"
    : "flex flex-col items-center justify-center p-8 gap-3 font-['Poppins']";

  return (
    <div className={wrapperClasses}>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}
      </style>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-blue-100 blur-md opacity-70" />
        <div
          className={`${sizes[size]} relative animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600`}
        />
      </div>
      {text && <p className="text-gray-500 text-sm sm:text-base font-semibold tracking-wide">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
