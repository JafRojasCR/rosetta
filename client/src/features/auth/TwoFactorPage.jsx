import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  Mail,
  RefreshCcw,
  CheckCircle2,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const maskEmail = (email = '') => {
  const [name = '', domain = ''] = String(email).split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

const TwoFactorPage = () => {
  const navigate = useNavigate();
  const { user, pendingTwoFactor, verifyTwoFactor, resendTwoFactor } = useAuth();

  const [isVisible, setIsVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputs = useRef([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    if (inputs.current[0]) inputs.current[0].focus();
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!pendingTwoFactor?.verificationToken && !user) {
      navigate('/login', { replace: true });
    }
  }, [pendingTwoFactor, user, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasteData = event.clipboardData.getData('text').slice(0, 6).split('');
    if (pasteData.every((char) => /^\d$/.test(char))) {
      const newCode = [...code];
      pasteData.forEach((char, index) => {
        newCode[index] = char;
      });
      setCode(newCode);
      const focusIndex = Math.min(pasteData.length, 5);
      if (inputs.current[focusIndex]) {
        inputs.current[focusIndex].focus();
      }
    }
  };

  const handleVerify = async () => {
    const finalCode = code.join('');
    if (finalCode.length !== 6) return;

    setIsVerifying(true);
    setError('');
    setSuccess('');

    try {
      await verifyTwoFactor(finalCode);
      setSuccess('Código verificado correctamente.');
      setIsSuccess(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo verificar el código.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setSuccess('');
    try {
      await resendTwoFactor();
      setResendCooldown(60);
      setSuccess('Código reenviado. Revisa tu correo.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo reenviar el código.');
    }
  };

  const isComplete = code.every((digit) => digit !== '');
  const maskedEmail = useMemo(() => maskEmail(pendingTwoFactor?.email || ''), [pendingTwoFactor?.email]);

  return (
    <div
      onAnimationEnd={() => {
        if (isSuccess) {
          navigate('/dashboard', { replace: true });
        }
      }}
      className={`min-h-screen bg-gray-50 font-['Poppins'] flex items-center justify-center px-4 transform transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={isSuccess ? { animation: 'twoFactorFall 0.95s forwards' } : {}}
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

        <div className="bg-white rounded-[3.5rem] p-10 sm:p-14 shadow-2xl shadow-blue-100/50 border border-gray-100 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-blue-50 opacity-10">
            <ShieldCheck size={240} />
          </div>

          <div className="relative z-10 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-blue-200 animate-bounce-subtle">
              <Mail size={36} />
            </div>

            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Verifica tu correo</h2>
            <p className="text-gray-500 font-medium mb-2 leading-relaxed">
              Para entrar, revisa tu correo electrónico y coloca el{' '}
              <span className="text-blue-600 font-black">código de 6 dígitos</span> que te hemos enviado.
            </p>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">
              Enviado a {maskedEmail || 'tu correo'}
            </p>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-3 text-sm font-semibold">
                {success}
              </div>
            )}

            <div className="flex justify-between gap-2 sm:gap-3 mb-10" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  className={`w-full aspect-square text-center text-2xl font-black rounded-2xl border-2 transition-all outline-none ${
                    digit
                      ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-lg shadow-blue-100'
                      : 'border-gray-100 bg-gray-50 text-gray-400 focus:border-blue-300 focus:bg-white'
                  }`}
                />
              ))}
            </div>

            <button
              disabled={!isComplete || isVerifying}
              onClick={handleVerify}
              className={`w-full py-5 rounded-[1.5rem] font-black text-xl transition-all flex items-center justify-center gap-3 mb-8 ${
                isComplete && !isVerifying
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              {isVerifying ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={24} />
                  Verificar Código
                </>
              )}
            </button>

            <div className="space-y-4 group/help">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">
                ¿No recibiste nada?
              </p>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className={`flex items-center gap-2 mx-auto font-black text-sm transition-all ${
                  resendCooldown > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                <RefreshCcw size={16} className={resendCooldown > 0 ? '' : 'animate-spin-slow'} />
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código de seguridad'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes twoFactorFall {
          0%   { transform: translateY(0); opacity: 1; }
          18%  { transform: translateY(-12px); opacity: 1; }
          100% { transform: translateY(120vh); opacity: 0.35; }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
        .animate-spin-slow { animation: rotate 4s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `,
        }}
      />
    </div>
  );
};

export default TwoFactorPage;
