const fs = require('fs/promises');
const path = require('path');

const DIGIT_ONLY = /\D+/g;
const debugOcrEnabled =
  String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production' &&
  ['1', 'true', 'yes', 'on'].includes(String(process.env.DEBUG_OCR || '').toLowerCase());

const MAX_LOG_TEXT = 1500;

const truncateForLog = (value = '') => {
  const stringValue = String(value || '');
  if (stringValue.length <= MAX_LOG_TEXT) return stringValue;
  return `${stringValue.slice(0, MAX_LOG_TEXT)}... [truncated ${stringValue.length - MAX_LOG_TEXT} chars]`;
};

const logOcr = (stage, payload) => {
  if (!debugOcrEnabled) return;

  try {
    console.log(`[PAYMENT_OCR][${stage}] ${JSON.stringify(payload)}`);
  } catch (_error) {
    console.log(`[PAYMENT_OCR][${stage}]`, payload);
  }
};

const logOcrError = (stage, err) => {
  if (!debugOcrEnabled) return;
  console.error(`[PAYMENT_OCR][${stage}_ERROR] ${err?.message || 'Unknown error'}`);
};

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const MONTHS_MAP = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SETIEMBRE: 9,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

const cleanupSpaces = (value = '') =>
  String(value || '')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

const isVercelRuntime = Boolean(process.env.VERCEL);
const defaultTesseractCorePath =
  process.env.TESSERACT_CORE_PATH ||
  (isVercelRuntime
    ? 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js'
    : '');

const getTesseractRecognizeOptions = () => {
  const options = {};
  if (defaultTesseractCorePath) {
    options.corePath = defaultTesseractCorePath;
  }

  if (debugOcrEnabled) {
    options.logger = (message) => {
      if (message?.status) {
        logOcr('TESSERACT_PROGRESS', {
          status: message.status,
          progress: Number.isFinite(message.progress)
            ? Number((message.progress * 100).toFixed(2))
            : null,
        });
      }
    };
  }

  return options;
};

const parseDateFromText = (text = '') => {
  const source = normalizeText(text);

  const numericPattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;
  const numericMatch = source.match(numericPattern);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    let year = Number(numericMatch[3]);
    if (year < 100) year += 2000;

    let day = first;
    let month = second;

    if (first <= 12 && second > 12) {
      day = second;
      month = first;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const namedMonthPattern = /(\d{1,2})\s*(?:DE\s+)?([A-Z]+)\s*,?\s*(\d{4})/;
  const namedMatch = source.match(namedMonthPattern);
  if (namedMatch) {
    const day = Number(namedMatch[1]);
    const month = MONTHS_MAP[namedMatch[2]];
    const year = Number(namedMatch[3]);

    if (month) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
};

const parseAmountCandidate = (raw = '') => {
  const value = String(raw || '').replace(/[^\d.,]/g, '');
  if (!value) return null;

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  let normalized = value;
  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = value.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = value.split(',');
    if (parts[parts.length - 1]?.length === 2) {
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      const thousandPattern = /^\d{1,3}(,\d{3})+$/;
      normalized = thousandPattern.test(value) ? value.replace(/,/g, '') : value.replace(/,/g, '');
    }
  } else {
    const thousandPattern = /^\d{1,3}(\.\d{3})+$/;
    normalized = thousandPattern.test(value) ? value.replace(/\./g, '') : value.replace(/,/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
};

const isDateLikeLine = (line = '') => {
  const normalized = normalizeText(line);
  if (/(FECHA|PAGO|HORA|ANO|AÑO)/.test(normalized)) return true;
  if (/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(normalized)) return true;
  if (/\b\d{1,2}\s*(?:DE\s+)?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SETIEMBRE|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*,?\s*\d{4}\b/.test(normalized)) {
    return true;
  }
  return false;
};

const isLikelyMetadataLine = (line = '') => {
  const normalized = normalizeText(line);
  return /(COMISION|COSTO\s*DE\s*TRANSACCION|TELEFONO|NUMERO\s*DE\s*TELEFONO|CUENTA|ORIGEN|DESTINO|REFERENCIA|COMPROBANTE|DOCUMENTO)/.test(normalized);
};

const isInvalidAmountToken = ({ rawToken = '', parsedAmount = null, line = '' }) => {
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return true;

  const digitsOnly = String(rawToken).replace(DIGIT_ONLY, '');
  if (!digitsOnly) return true;
  if (/^0+$/.test(digitsOnly)) return true;

  // Documento/referencia largos nunca deben ser monto
  if (digitsOnly.length >= 10) return true;

  // Para esta plataforma, montos esperados son razonables y no astronómicos
  if (parsedAmount > 1000000) return true;

  // Evitar confundir años como 2025/2026 cuando no tienen formato de dinero
  const tokenHasAmountFormatting = /[.,]/.test(String(rawToken || ''));
  const isYearLike =
    parsedAmount >= 1900 &&
    parsedAmount <= 2100 &&
    digitsOnly.length === 4 &&
    !tokenHasAmountFormatting;
  if (isYearLike) return true;

  if (isDateLikeLine(line) && String(digitsOnly).length <= 4) return true;

  return false;
};

const buildAmountTokenVariants = (rawToken = '') => {
  const token = String(rawToken || '').trim();
  const variants = new Set([token]);

  const repeatedLeadingDigitWithSeparator = token.match(/^(\d)\1([.,]\d{3}(?:[.,]\d{2})?)$/);
  if (repeatedLeadingDigitWithSeparator) {
    variants.add(`${repeatedLeadingDigitWithSeparator[1]}${repeatedLeadingDigitWithSeparator[2]}`);
  }

  const repeatedLeadingDigitWithoutSeparator = token.match(/^(\d)\1(\d{3,})$/);
  if (repeatedLeadingDigitWithoutSeparator) {
    variants.add(`${repeatedLeadingDigitWithoutSeparator[1]}${repeatedLeadingDigitWithoutSeparator[2]}`);
  }

  return Array.from(variants).filter(Boolean);
};

const isProbablyDetailValue = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/(COMPROBANTE|REFERENCIA|FECHA|HORA|MONTO|DESTINATARIO|BENEFICIARIO|CUENTA|ORIGEN|DESTINO|COMISION)/.test(normalized)) {
    return false;
  }

  const lettersCount = (normalized.match(/[A-Z]/g) || []).length;
  const digitsCount = (normalized.match(/\d/g) || []).length;
  const xMaskCount = (normalized.match(/X/g) || []).length;

  if (xMaskCount >= 4 && lettersCount <= 3) return false;
  if (lettersCount === 0 && digitsCount > 0) return false;

  return true;
};

const isProbablyRecipientValue = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  if (normalized.includes('85344277')) return true;
  if (normalized.includes('ROJAS') || normalized.includes('JAFET') || normalized.includes('BELLO')) return true;

  if (/(COLON|COLONES|CRC|₡|MONTO|COMISION|COSTO|REFERENCIA|COMPROBANTE)/.test(normalized)) {
    return false;
  }

  const lettersCount = (normalized.match(/[A-Z]/g) || []).length;
  return lettersCount >= 5;
};

const extractLongDocumentNumber = (text = '') => {
  const candidates = String(text).match(/\b\d{10,40}\b/g) || [];
  if (candidates.length === 0) return null;

  const sorted = candidates.sort((left, right) => right.length - left.length);
  return sorted[0] || null;
};

const extractBillNumber = (text = '') => {
  const patterns = [
    /(COMPROBANTE|NUMERO\s*DE\s*COMPROBANTE|N[°º]?\s*COMPROBANTE|NRO\.?\s*COMPROBANTE)\s*[:#-]?\s*([A-Z0-9-]{4,})/gi,
    /(REFERENCIA\s*SINPE|REFERENCIA|ID\s*DE\s*TRANSACCION|NUMERO\s*DE\s*TRANSACCION|TRANSACCION|NUMERO\s*DE\s*OPERACION|OPERACION)\s*[:#-]?\s*([A-Z0-9-]{4,})/gi,
    /(DOCUMENTO)\s*[:#-]?\s*([A-Z0-9-]{4,})/gi,
  ];

  const detected = [];
  for (const pattern of patterns) {
    const matches = String(text).matchAll(pattern);
    for (const match of matches) {
      if (!match?.[2]) continue;
      const value = cleanupSpaces(match[2]);
      detected.push(value);
    }
  }

  if (detected.length > 0) {
    const sorted = detected.sort((left, right) => right.replace(/[^A-Z0-9]/gi, '').length - left.replace(/[^A-Z0-9]/gi, '').length);
    const longEnough = sorted.find((value) => value.replace(DIGIT_ONLY, '').length >= 10);
    if (longEnough) return longEnough;
    return sorted[0];
  }

  const longFallback = extractLongDocumentNumber(text);
  if (longFallback) return longFallback;

  const genericFallback = String(text).match(/\b[A-Z0-9-]{8,40}\b/gi) || [];
  if (genericFallback.length > 0) {
    return genericFallback.sort((left, right) => right.length - left.length)[0];
  }

  return null;
};

const extractClassCode = (text = '') => {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => cleanupSpaces(line))
    .filter(Boolean);

  const keywordPattern = /(CONCEPTO|DETALLE|REFERENCIA|DESCRIPCION)/i;
  const classCodePattern = /\b([A-Z]{2,5}\d{4,8})\b/i;

  for (const line of lines) {
    if (!keywordPattern.test(line)) continue;
    const match = line.match(classCodePattern);
    if (match?.[1]) return cleanupSpaces(match[1]);
  }

  const fallback = String(text).match(classCodePattern);
  if (fallback?.[1]) return cleanupSpaces(fallback[1]);

  return null;
};

const extractDetail = (text = '') => {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => cleanupSpaces(line))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeText(line);

    if (/(DETALLE|CONCEPTO|MOTIVO|DESCRIPCION|MENSAJE)/.test(normalizedLine)) {
      const detailMatch = normalizedLine.match(/(DETALLE|CONCEPTO|MOTIVO|DESCRIPCION|MENSAJE)[\s:#-]*(.*)$/);
      if (detailMatch?.[2]) {
        const value = cleanupSpaces(detailMatch[2]);
        if (value && isProbablyDetailValue(value)) return value;
      }

      const nextLine = lines[index + 1] || '';
      const normalizedNext = normalizeText(nextLine);
      if (
        nextLine &&
        !/(FECHA|HORA|MONTO|COMISION|REFERENCIA|COMPROBANTE|DESTINATARIO|BENEFICIARIO)/.test(normalizedNext) &&
        isProbablyDetailValue(nextLine)
      ) {
        return cleanupSpaces(nextLine);
      }

      const previousLine = lines[index - 1] || '';
      const normalizedPrevious = normalizeText(previousLine);
      if (
        previousLine &&
        !/(FECHA|HORA|MONTO|COMISION|REFERENCIA|COMPROBANTE|DESTINATARIO|BENEFICIARIO)/.test(normalizedPrevious) &&
        isProbablyDetailValue(previousLine)
      ) {
        return cleanupSpaces(previousLine);
      }
    }
  }

  return null;
};

const extractAmount = (text = '', expectedAmount = null) => {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => cleanupSpaces(line))
    .filter(Boolean);

  const amountKeywords = /(MONTO|TOTAL|IMPORTE|PAGADO|TRANSFERIDO|ENVIADO|DEBITADO|ACREDITADO|TRANSFERENCIA)/i;
  const currencyKeywords = /(COLON|COLONES|CRC|₡)/i;

  const scoredCandidates = [];
  const expected = Number.isFinite(Number(expectedAmount)) ? Number(expectedAmount) : null;

  for (const line of lines) {
    if (isLikelyMetadataLine(line) && !/(MONTO|TOTAL|IMPORTE|PAGADO|TRANSFERIDO|ENVIADO|DEBITADO|ACREDITADO|TRANSFERENCIA)/i.test(line)) {
      continue;
    }

    const tokens = line.match(/\d[\d.,]*/g) || [];
    for (const token of tokens) {
      const tokenVariants = buildAmountTokenVariants(token);

      for (const variant of tokenVariants) {
        const parsed = parseAmountCandidate(variant);
        if (isInvalidAmountToken({ rawToken: variant, parsedAmount: parsed, line })) continue;

        let score = 0;
        if (amountKeywords.test(line)) score += 8;
        if (currencyKeywords.test(line)) score += 5;
        if (/MONTO\s*(DEBITADO|ACREDITADO|TRANSFERENCIA)?/i.test(line)) score += 4;
        if (/(COMISION|COSTO\s*DE\s*TRANSACCION)/i.test(line)) score -= 8;
        if (isDateLikeLine(line)) score -= 5;
        if (parsed >= 500) score += 1;

        if (variant !== token) score -= 1;

        if (expected !== null && expected > 0) {
          const diff = Math.abs(parsed - expected);
          const ratio = diff / expected;

          if (diff === 0) {
            score += 50;
          } else if (ratio <= 0.02) {
            score += 20;
          } else if (ratio <= 0.1) {
            score += 8;
          } else if (parsed > expected * 4) {
            score -= 20;
          }
        }

        scoredCandidates.push({ parsed, score, token, variant, line });
      }
    }
  }

  const sortedCandidates = scoredCandidates.sort((left, right) => right.score - left.score);
  const bestCandidate = sortedCandidates.find((candidate) => candidate.score > 0);
  if (bestCandidate) return bestCandidate.parsed;

  const fallbackLines = lines.filter((line) => !isDateLikeLine(line));
  for (const line of fallbackLines) {
    if (isLikelyMetadataLine(line) && !/(MONTO|TOTAL|IMPORTE|PAGADO|TRANSFERIDO|ENVIADO|DEBITADO|ACREDITADO|TRANSFERENCIA)/i.test(line)) {
      continue;
    }

    const tokens = line.match(/\d[\d.,]*/g) || [];
    for (const token of tokens) {
      const variants = buildAmountTokenVariants(token);
      for (const variant of variants) {
        const parsed = parseAmountCandidate(variant);
        if (isInvalidAmountToken({ rawToken: variant, parsedAmount: parsed, line })) continue;
        if (expected !== null) {
          const diff = Math.abs(parsed - expected);
          if (diff <= Math.max(5, Math.round(expected * 0.02))) return parsed;
        }
        if (parsed >= 500) return parsed;
      }
    }
  }

  return null;
};

const extractRecipient = (text = '') => {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => cleanupSpaces(line))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalizeText(line);

    if (/(DESTINATARIO|BENEFICIARIO|A\s*NOMBRE\s*DE|SINPE\s*MOVIL\s*DESTINO|DESTINO|HACIA|TRANSFERIDO\s*A)/.test(normalizedLine)) {
      const match = line.match(/(DESTINATARIO|BENEFICIARIO|A\s*NOMBRE\s*DE|SINPE\s*MOVIL\s*DESTINO|DESTINO|HACIA|TRANSFERIDO\s*A)[\s:#-]*(.*)$/i);
      const sameLineValue = cleanupSpaces(match?.[2] || '');
      if (sameLineValue && isProbablyRecipientValue(sameLineValue)) return sameLineValue;

      const nextLine = cleanupSpaces(lines[index + 1] || '');
      if (nextLine && isProbablyRecipientValue(nextLine)) return nextLine;

      const previousLine = cleanupSpaces(lines[index - 1] || '');
      if (previousLine && isProbablyRecipientValue(previousLine)) return previousLine;
    }
  }

  const normalized = normalizeText(text);
  if (normalized.includes('85344277')) return '85344277';
  if (normalized.includes('ROJAS BELLO JAFET ALONSO')) return 'ROJAS BELLO JAFET ALONSO';

  return null;
};

const isAllowedRecipient = (input = '') => {
  const normalized = normalizeText(input);
  const compactDigits = normalized.replace(DIGIT_ONLY, '');

  if (compactDigits.includes('85344277')) return true;

  const hasJafet = normalized.includes('JAFET');
  const hasRojas = normalized.includes('ROJAS');
  const hasBello = normalized.includes('BELLO');
  return hasJafet && hasRojas && hasBello;
};

const extractTextFromPdf = async (filePath) => {
  const pdfParse = require('pdf-parse');
  const pdfBuffer = await fs.readFile(filePath);
  const parsed = await pdfParse(pdfBuffer);
  return cleanupSpaces(parsed.text || '');
};

const extractTextFromPdfBuffer = async (buffer) => {
  const pdfParse = require('pdf-parse');
  const parsed = await pdfParse(buffer);
  return cleanupSpaces(parsed.text || '');
};

const extractTextFromImage = async (filePath) => {
  const Tesseract = require('tesseract.js');
  const options = getTesseractRecognizeOptions();
  const { data } = await Tesseract.recognize(filePath, 'spa+eng', options);
  return cleanupSpaces(data?.text || '');
};

const extractTextFromImageBuffer = async (buffer) => {
  const Tesseract = require('tesseract.js');
  const options = getTesseractRecognizeOptions();
  const { data } = await Tesseract.recognize(buffer, 'spa+eng', options);
  return cleanupSpaces(data?.text || '');
};

const extractRawText = async (filePath) => {
  const extension = path.extname(filePath || '').toLowerCase();

  try {
    if (extension === '.pdf') {
      const text = await extractTextFromPdf(filePath);
      logOcr('RAW_TEXT_PDF', {
        filePath,
        extension,
        extractedChars: String(text || '').length,
        preview: truncateForLog(text),
      });
      return text;
    }

    const text = await extractTextFromImage(filePath);
    logOcr('RAW_TEXT_IMAGE', {
      filePath,
      extension,
      extractedChars: String(text || '').length,
      preview: truncateForLog(text),
    });
    return text;
  } catch (err) {
    logOcrError('RAW_TEXT', err);
    return '';
  }
};

const extractRawTextFromBuffer = async ({ buffer, mimeType = '', fileName = '', source = 'buffer' }) => {
  const extensionFromName = path.extname(fileName || '').toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();
  const isPdf = normalizedMime.includes('pdf') || extensionFromName === '.pdf';

  try {
    if (isPdf) {
      const text = await extractTextFromPdfBuffer(buffer);
      logOcr('RAW_TEXT_PDF_BUFFER', {
        source,
        mimeType,
        fileName,
        extractedChars: String(text || '').length,
        preview: truncateForLog(text),
      });
      return text;
    }

    const text = await extractTextFromImageBuffer(buffer);
    logOcr('RAW_TEXT_IMAGE_BUFFER', {
      source,
      mimeType,
      fileName,
      extractedChars: String(text || '').length,
      preview: truncateForLog(text),
    });
    return text;
  } catch (err) {
    logOcrError('RAW_TEXT_BUFFER', err);
    return '';
  }
};

const buildExtractedPaymentFields = ({ text = '', contextLabel = '' }) => {
  const normalizedText = normalizeText(text);

  const safelyExtract = (label, extractor) => {
    try {
      const value = extractor();
      logOcr('FIELD_EXTRACTED', {
        label,
        value,
        contextLabel,
      });
      return value;
    } catch (err) {
      logOcrError(`FIELD_${label}`, err);
      return null;
    }
  };

  const billNumber = safelyExtract('billNumber', () => extractBillNumber(text));
  const paymentDate = safelyExtract('date', () => parseDateFromText(text));
  const amount = safelyExtract('amount', () => extractAmount(text));
  const classCode = safelyExtract('classCode', () => extractClassCode(text));
  const detail = safelyExtract('detail', () => extractDetail(text));
  const recipient = safelyExtract('recipient', () => extractRecipient(text));

  return {
    rawText: text,
    normalizedText,
    billNumber,
    date: paymentDate,
    amount,
    classCode,
    detail,
    recipient,
  };
};

const extractPaymentData = async (filePath) => {
  const text = await extractRawText(filePath);
  const extracted = buildExtractedPaymentFields({ text, contextLabel: 'filePath' });

  logOcr('EXTRACTION_SUMMARY', {
    filePath,
    rawTextChars: String(text || '').length,
    rawTextPreview: truncateForLog(text),
    normalizedPreview: truncateForLog(extracted.normalizedText),
    extracted,
    guess: {
      guessedBillNumber: extracted.billNumber,
      guessedDateISO: extracted.date ? new Date(extracted.date).toISOString() : null,
      guessedAmount: extracted.amount,
      guessedClassCode: extracted.classCode,
      guessedRecipient: extracted.recipient,
      guessedDetail: extracted.detail,
    },
  });

  return extracted;
};

const extractPaymentDataFromBuffer = async ({ buffer, mimeType = '', fileName = '', source = 'buffer' }) => {
  const text = await extractRawTextFromBuffer({ buffer, mimeType, fileName, source });
  const extracted = buildExtractedPaymentFields({ text, contextLabel: source });

  logOcr('EXTRACTION_SUMMARY_BUFFER', {
    source,
    mimeType,
    fileName,
    rawTextChars: String(text || '').length,
    rawTextPreview: truncateForLog(text),
    normalizedPreview: truncateForLog(extracted.normalizedText),
    extracted,
  });

  return extracted;
};

const validatePayment = async (billNumber) => {
  const Payment = require('../models/Payment');
  const existing = await Payment.findOne({ billNumber });
  return !existing;
};

const validateExtractedPayment = ({ extractedData, classCode, classPrice }) => {
  const expectedCode = normalizeText(classCode).replace(/\s+/g, '');
  const detectedClassCode = normalizeText(extractedData?.classCode || '').replace(/\s+/g, '');
  const normalizedSource = normalizeText(
    `${extractedData?.normalizedText || ''} ${extractedData?.detail || ''}`
  ).replace(/\s+/g, '');

  const hasDate = Boolean(extractedData?.date);
  const expectedClassPrice = Number(classPrice);
  const resolvedAmountFromRaw = extractAmount(
    extractedData?.rawText || extractedData?.normalizedText || '',
    expectedClassPrice
  );
  const resolvedAmount = Number.isFinite(resolvedAmountFromRaw)
    ? resolvedAmountFromRaw
    : extractedData?.amount;
  const hasAmount = Number.isFinite(resolvedAmount);
  const amountMatches = hasAmount && Number(resolvedAmount) === expectedClassPrice;
  const detailMatches = expectedCode
    ? normalizedSource.includes(expectedCode) || detectedClassCode === expectedCode
    : false;
  const recipientMatches = isAllowedRecipient(
    `${extractedData?.recipient || ''} ${extractedData?.normalizedText || ''}`
  );

  const checks = {
    hasBillNumber: Boolean(extractedData?.billNumber),
    hasDate,
    amountMatches,
    detailMatches,
    recipientMatches,
  };

  const errors = [];
  if (!checks.hasBillNumber) errors.push('No se detectó número de comprobante/documento en la imagen.');
  if (!checks.hasDate) errors.push('No se detectó una fecha de pago válida.');
  if (!checks.amountMatches) errors.push('El monto detectado no coincide con el monto de la clase.');
  if (!checks.detailMatches) errors.push('El detalle del pago no coincide con el código de la clase.');
  if (!checks.recipientMatches) errors.push('El destinatario no coincide con la cuenta autorizada.');

  logOcr('VALIDATION_SUMMARY', {
    expected: {
      classCode,
      classPrice,
    },
    extracted: {
      billNumber: extractedData?.billNumber || null,
      date: extractedData?.date || null,
      amount: extractedData?.amount ?? null,
      resolvedAmount: Number.isFinite(resolvedAmount) ? resolvedAmount : null,
      classCode: extractedData?.classCode || null,
      detail: extractedData?.detail || null,
      recipient: extractedData?.recipient || null,
    },
    checks,
    errors,
    isValid: errors.length === 0,
  });

  return {
    checks,
    errors,
    resolvedAmount: Number.isFinite(resolvedAmount) ? resolvedAmount : null,
    isValid: errors.length === 0,
  };
};

module.exports = {
  extractPaymentData,
  extractPaymentDataFromBuffer,
  validatePayment,
  validateExtractedPayment,
};
