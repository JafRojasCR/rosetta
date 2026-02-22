// Servicio de correo electrónico (mock para 2FA)
// En producción, configurar con nodemailer y un proveedor de correo real

const { nodeEnv } = require('../config/env');

const send2FACode = async (email, code) => {
  if (nodeEnv === 'development') {
    // Solo en desarrollo: imprimir en consola para facilitar pruebas
    console.log(`[EMAIL SERVICE - DEV] Código 2FA enviado a ${email}`);
  }
  // En producción, usar nodemailer:
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ to: email, subject: 'Código de verificación', text: `Tu código es: ${code}` });
  return true;
};

const sendPasswordReset = async (email) => {
  if (nodeEnv === 'development') {
    console.log(`[EMAIL SERVICE - DEV] Correo de recuperación enviado a ${email}`);
  }
  return true;
};

module.exports = { send2FACode, sendPasswordReset };
