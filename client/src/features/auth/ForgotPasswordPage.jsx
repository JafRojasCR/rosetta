import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { forgotPasswordService } from './authService';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await forgotPasswordService(email.trim());
      setSuccess('Si el correo existe, enviamos un enlace para restablecer la contraseña.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-100 font-['Poppins'] flex items-center justify-center px-4 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div className="max-w-md w-full">
        <button
          onClick={() => navigate('/login')}
          className="mb-8 flex items-center gap-2 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors group"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-gray-100">
            <ArrowLeft size={18} />
          </div>
          Volver al inicio de sesión
        </button>

        <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-gray-100">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-blue-200">
            <Mail size={36} />
          </div>

          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight text-center">Recuperar contraseña</h2>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed text-center">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Correo electrónico..."
              required
              className="w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100 transition-all"
            />

            {error && (
              <p className="text-sm text-red-500 font-medium text-center">{error}</p>
            )}
            {success && (
              <p className="text-sm text-emerald-600 font-medium text-center">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 bg-[#2b78da] text-white font-black text-lg rounded-2xl shadow-lg transition-all duration-300 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Send size={18} />
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
