import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import logo from '/logo.png';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [nextPath, setNextPath] = useState('/dashboard');
  const [isVisible, setIsVisible] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [highlightError, setHighlightError] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(id);
  }, []);

  const handleNavigate = (path) => {
    if (isSwitching) return;
    setIsSwitching(true);
    setIsVisible(false);
    setTimeout(() => navigate(path), 250);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setHighlightError(false);
    setErrorMessage('');

    try {
      const response = await login(email, password);
      setNextPath(response?.requiresTwoFactor ? '/verificacion-2fa' : '/dashboard');
      setIsSuccess(true);
      // navigation is triggered by onAnimationEnd on the card
    } catch (err) {
      if (err.response?.status === 401 || err.response?.data?.errors?.code === 'INVALID_CREDENTIALS') {
        // Si es error de credenciales (401), solo mostramos la animación del borde rojo
        setHighlightError(true);
        setErrorMessage('');
        setTimeout(() => setHighlightError(false), 1000);
      } else {
        // Para otros errores, mostramos el mensaje
        const message = err.response?.data?.message || 'Error al iniciar sesión';
        setErrorMessage(message);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen overflow-hidden flex flex-col items-center justify-center p-4 font-['Poppins'] transition-colors duration-700 ${isSuccess ? 'bg-white' : 'bg-gray-100'}`}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
          @keyframes loginFall {
            0%   { transform: translateY(0);      animation-timing-function: ease-out; }
            18%  { transform: translateY(-14px);  animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
            100% { transform: translateY(120vh); }
          }
        `}
      </style>

      <div
        onAnimationEnd={() => {
          if (isSuccess) navigate(nextPath);
        }}
        style={isSuccess ? { animation: 'loginFall 1.05s forwards' } : {}}
        className={`bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl w-full max-w-[420px] text-center ${
          isSuccess
            ? 'pointer-events-none'
            : `transform transition-all duration-500 pointer-events-auto ${
                isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
              }`
        }`}
      >
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-inner">
            <img
              src={logo}
              alt="Piedra Rosetta"
              className="w-16 h-16 object-contain"
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">Iniciar Sesión</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative transition-all duration-500">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-colors duration-500 placeholder:text-gray-400 ${
                highlightError ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
              }`}
              required
            />
          </div>

          <div className="relative transition-all duration-500">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-colors duration-500 placeholder:text-gray-400 ${
                highlightError ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-500 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-500 font-medium">{errorMessage}</p>
          )}

          <div className="text-left">
            <button
              type="button"
              onClick={() => handleNavigate('/forgot-password')}
              className="text-xs text-gray-500 hover:text-blue-500 transition-colors ml-1"
            >
              Olvidé mi contraseña...
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-3/5 py-3 mt-4 bg-[#2b78da] text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 disabled:bg-gray-400 ${
              isLoading ? 'animate-pulse' : ''
            }`}
          >
            {isLoading ? 'Cargando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-8 text-sm text-gray-500">
          ¿No has ingresado?{' '}
          <button
            type="button"
            onClick={() => handleNavigate('/registro')}
            className="text-blue-600 font-semibold hover:underline transition-all"
          >
            Regístrate
          </button>
        </div>
      </div>

      
    </div>
  );
};

export default LoginPage;
