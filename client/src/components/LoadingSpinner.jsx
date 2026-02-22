const LoadingSpinner = ({ size = 'md', text = 'Cargando...' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <div
        className={`${sizes[size]} animate-spin rounded-full border-4 border-primary-200 border-t-primary-600`}
      />
      {text && <p className="text-gray-500 text-sm">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
