import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordService } from './authService';

const isPasswordStrong = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);

const RecoverPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [isVisible, setIsVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showPasswordGuidelines, setShowPasswordGuidelines] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!resetToken) {
      setError('El enlace de recuperación no es válido.');
    }
  }, [resetToken]);

  const passwordsMatch =
    isPasswordStrong(passwords.new) &&
    passwords.confirm.length > 0 &&
    passwords.new === passwords.confirm;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!passwordsMatch || !resetToken) return;

    setStatus('loading');
    setError('');

    try {
      await resetPasswordService(resetToken, passwords.new);
      setStatus('success');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1800);
    } catch (requestError) {
      setStatus('idle');
      setError(requestError.response?.data?.message || 'No se pudo restablecer la contraseña.');
    }
  };

  return (
    <div
      className={`min-h-screen bg-gray-50 font-['Poppins'] flex items-center justify-center px-4 transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div className="max-w-md w-full">
        {status !== 'success' && (
          <button
            onClick={() => navigate('/login')}
            className="mb-8 flex items-center gap-2 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors group"
          >
            <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-gray-100">
              <ArrowLeft size={18} />
            </div>
            Cancelar
          </button>
        )}

        <div className="bg-white rounded-[3.5rem] p-10 sm:p-14 shadow-2xl shadow-blue-100/50 border border-gray-100 relative overflow-hidden text-center">
          {status === 'success' ? (
            <div className="animate-in fade-in zoom-in-95 duration-500 py-6">
              <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-emerald-100 animate-bounce-subtle">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">¡Todo listo!</h2>
              <p className="text-gray-500 font-medium leading-relaxed">
                Tu contraseña ha sido actualizada correctamente. <br />
                <span className="text-blue-600 font-bold">Redirigiendo al inicio de sesión...</span>
              </p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-blue-200">
                <ShieldCheck size={36} />
              </div>

              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Nueva Clave</h2>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                Crea una contraseña segura que no hayas usado antes en esta plataforma.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={20}
                      className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                        passwords.new ? 'text-blue-600' : 'text-gray-300'
                      }`}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
                      value={passwords.new}
                      onChange={(event) => setPasswords({ ...passwords, new: event.target.value })}
                      onFocus={() => setShowPasswordGuidelines(true)}
                      onBlur={() => setShowPasswordGuidelines(false)}
                      className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-[1.5rem] pl-14 pr-14 py-5 font-bold transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div
                  className={`text-left bg-blue-50/70 border border-blue-100 rounded-2xl px-4 text-sm text-blue-900 overflow-hidden transform transition-all duration-200 ${
                    showPasswordGuidelines
                      ? 'max-h-56 py-3 opacity-100 translate-y-0'
                      : 'max-h-0 py-0 opacity-0 -translate-y-1 pointer-events-none'
                  }`}
                >
                  <div>
                    <p className="font-semibold flex items-center gap-2 mb-1">
                      <Info size={16} className="text-blue-600" />
                      Recomendaciones de contraseña
                    </p>
                    <ul className="space-y-1 text-blue-900/90">
                      <li>• La contraseña debe tener al menos 8 caracteres.</li>
                      <li>• Debe incluir al menos una letra mayúscula, una minúscula y un número.</li>
                      <li>• Se recomienda agregar símbolos para reforzar la seguridad.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={20}
                      className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                        passwordsMatch ? 'text-emerald-500' : 'text-gray-300'
                      }`}
                    />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repite tu clave"
                      value={passwords.confirm}
                      onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                      className={`w-full bg-gray-50 border-2 rounded-[1.5rem] pl-14 pr-14 py-5 font-bold transition-all outline-none ${
                        passwords.confirm
                          ? passwordsMatch
                            ? 'border-emerald-500 bg-emerald-50/10'
                            : 'border-red-300 bg-red-50/10'
                          : 'border-transparent focus:border-blue-500 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {passwords.confirm && !passwordsMatch && (
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-4 mt-2">
                      Las contraseñas no coinciden o no cumplen seguridad
                    </p>
                  )}
                </div>

                {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                <button
                  disabled={!passwordsMatch || status === 'loading' || !resetToken}
                  className={`w-full py-5 rounded-[1.5rem] font-black text-xl transition-all flex items-center justify-center gap-3 mt-4 ${
                    passwordsMatch && status !== 'loading' && resetToken
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {status === 'loading' ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Guardar Nueva Clave'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 2s infinite ease-in-out; }
        .animate-in { animation-duration: 0.5s; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .zoom-in-95 { animation-name: zoom-in-95; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoom-in-95 { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `,
        }}
      />
    </div>
  );
};

export default RecoverPasswordPage;
