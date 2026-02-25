import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import logo from '/logo.png';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    lastName: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(false);
    setErrorMessage('');

    try {
      await register(form);
      setIsSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err) {
      const message = err.response?.data?.message || 'Error al registrarse';
      setError(true);
      setErrorMessage(message);
      setIsLoading(false);
      setTimeout(() => setError(false), 500);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-['Poppins']">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
          .animate-shake {
            animation: shake 0.2s ease-in-out 0s 2;
          }
        `}
      </style>

      <div
        className={`bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl w-full max-w-[420px] text-center transform transition-all duration-450 ${
          isVisible ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'
        } ${
          isSuccess ? 'scale-0 opacity-0 pointer-events-none' : ''
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

        <h2 className="text-2xl font-bold text-gray-800 mb-6">Crear Cuenta</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`relative transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Nombre..."
                className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-all duration-300 placeholder:text-gray-400 ${
                  error ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
                }`}
                required
              />
            </div>
            <div className={`relative transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Apellido..."
                className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-all duration-300 placeholder:text-gray-400 ${
                  error ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
                }`}
                required
              />
            </div>
          </div>

          <div className={`relative transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Correo electrónico..."
              className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-all duration-300 placeholder:text-gray-400 ${
                error ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
              }`}
              required
            />
          </div>

          <div className={`relative transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Teléfono..."
              className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-all duration-300 placeholder:text-gray-400 ${
                error ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
              }`}
            />
          </div>

          <div className={`relative transition-all duration-300 ${error ? 'animate-shake' : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Contraseña..."
              minLength={6}
              className={`w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 transition-all duration-300 placeholder:text-gray-400 ${
                error ? 'border-red-400' : 'border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100'
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

          {error && (
            <p className="text-sm text-red-500 font-medium">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-3/5 py-3 mt-4 bg-[#2b78da] text-white font-semibold text-lg rounded-xl shadow-lg transition-all duration-300 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 disabled:bg-gray-400 ${
              isLoading ? 'animate-pulse' : ''
            }`}
          >
            {isLoading ? 'Creando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-8 text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => handleNavigate('/login')}
            className="text-blue-600 font-semibold hover:underline transition-all"
          >
            Inicia sesión
          </button>
        </div>
      </div>

      {isSuccess && (
        <div className="fixed inset-0 flex flex-col items-center justify-center animate-in fade-in duration-700 bg-black/40">
          <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl text-center animate-in zoom-in-75 slide-in-from-bottom-8 duration-700">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">¡Cuenta creada!</h1>
            <p className="text-gray-400 mt-3 text-lg font-light">Redirigiendo a tu panel...</p>
          </div>
        </div>
      )}

   
    </div>
  );
};

export default RegisterPage;
