// Servicio de correo electrónico (mock para 2FA)
// En producción, configurar con nodemailer y un proveedor de correo real

const send2FACode = async (email, code) => {
  // Mock: en desarrollo solo imprime el código
  console.log(`[EMAIL SERVICE] Código 2FA para ${email}: ${code}`);
  // En producción, usar nodemailer:
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ ... });
  return true;
};

const sendPasswordReset = async (email, token) => {
  console.log(`[EMAIL SERVICE] Token de recuperación para ${email}: ${token}`);
  return true;
};

module.exports = { send2FACode, sendPasswordReset };
