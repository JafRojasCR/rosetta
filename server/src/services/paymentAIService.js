// Servicio de IA para extracción de datos de comprobantes de pago (mock)
// En producción, integrar con un servicio de OCR o IA real

const extractPaymentData = async (filePath) => {
  // Mock: retorna datos simulados extraídos del comprobante
  // En producción, usar Google Vision API, AWS Textract, o similar
  console.log(`[AI SERVICE] Procesando comprobante: ${filePath}`);

  return {
    classCode: null,      // Código de clase extraído del comprobante
    date: new Date(),     // Fecha del pago
    billNumber: `COMP-${Date.now()}`, // Número de comprobante
    amount: null,         // Monto del pago
  };
};

const validatePayment = async (billNumber) => {
  // Verificar que el comprobante no haya sido utilizado antes
  const Payment = require('../models/Payment');
  const existing = await Payment.findOne({ billNumber });
  return !existing;
};

module.exports = { extractPaymentData, validatePayment };
