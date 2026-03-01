# Guía OCR de pagos (Tesseract + reglas de validación)

## 1) ¿Qué es Tesseract y qué hace?

Tesseract es un motor de OCR (Reconocimiento Óptico de Caracteres). Su trabajo principal es:

1. Recibir una imagen (o una página) con texto.
2. Detectar zonas de texto.
3. Reconocer letras/números.
4. Entregar texto plano (string).

En este proyecto no se usa Tesseract para “decidir” si un pago es válido. Tesseract solo extrae texto. Luego, nuestro backend aplica reglas de negocio para interpretar ese texto.

---

## 2) ¿Cómo lo usamos en este proyecto?

Flujo general al subir comprobante:

1. Frontend envía comprobante + código de clase a `POST /api/payments`.
2. Backend guarda temporalmente archivo (multer).
3. `paymentAIService` extrae texto:
   - Imagen: `tesseract.js`
   - PDF: `pdf-parse`
4. Se normaliza texto (mayúsculas, sin tildes, espacios limpios).
5. Se extraen campos: comprobante, fecha, monto, destinatario, detalle/código.
6. Se comparan contra los valores esperados de la clase.
7. Se decide estado:
   - `aprobado` si todo está correcto
   - `pendiente` si falla exactamente 1 de (monto/detalle/destinatario)
   - error (no guarda) si fallan 2 o más de esos 3

---

## 3) “Entrenar” Tesseract vs “entrenar” reglas

### 3.1 Lo que NO estamos haciendo
No estamos reentrenando pesos de Tesseract (LSTM custom con dataset etiquetado).

### 3.2 Lo que SÍ hacemos (práctico y recomendado en MVP)
“Entrenamiento por reglas” (heurísticas) sobre el texto OCR:

- reconocer múltiples etiquetas por banco (`Detalle`, `Motivo`, `Mensaje`, `Descripción`, etc.)
- priorizar referencias largas para comprobante
- interpretar fechas numéricas y con mes en texto
- filtrar falsos positivos en monto (años, referencias largas, comisión)
- validar destinatario por nombre o número esperado (`85344277`)

Este enfoque es más rápido de iterar con comprobantes reales de usuarios.

---

## 4) ¿Dónde está cada parte en el código?

- Extracción OCR + parseo de campos:
  - [server/src/services/paymentAIService.js](server/src/services/paymentAIService.js)
- Reglas de negocio de creación/estado de pago:
  - [server/src/controllers/paymentController.js](server/src/controllers/paymentController.js)
- Rutas de pagos:
  - [server/src/routes/paymentRoutes.js](server/src/routes/paymentRoutes.js)
- Subida de archivo (multer):
  - [server/src/middlewares/upload.js](server/src/middlewares/upload.js)
- UI de pagos y feedback de flags:
  - [client/src/features/payments/PaymentsPage.jsx](client/src/features/payments/PaymentsPage.jsx)

---

## 5) ¿Cómo toma los datos de la imagen?

En `paymentAIService`:

1. `extractRawText(filePath)`
   - Si es PDF: usa `pdf-parse`
   - Si es imagen: usa `tesseract.js` con idiomas `spa+eng`

2. Normalización
   - `normalizeText`: mayúsculas, elimina tildes
   - `cleanupSpaces`: limpia tabs/saltos/espacios repetidos

3. Extractores por campo
   - `extractBillNumber`
   - `parseDateFromText`
   - `extractAmount`
   - `extractRecipient`
   - `extractDetail`
   - `extractClassCode`

Cada extractor tiene fallback para OCR desordenado (valor en línea anterior/siguiente, alias de etiquetas, etc.).

---

## 6) ¿Cómo y dónde se comparan contra “lo que debería ser”?

La comparación formal se hace en:

- `validateExtractedPayment({ extractedData, classCode, classPrice })`
  - Archivo: [server/src/services/paymentAIService.js](server/src/services/paymentAIService.js)

Checks principales:

- `hasBillNumber`
- `hasDate`
- `amountMatches` (contra precio de clase)
- `detailMatches` (debe contener código de clase esperado)
- `recipientMatches` (nombre/teléfono autorizados)

Resultado:

- `checks`: booleans por criterio
- `errors`: mensajes legibles
- `resolvedAmount`: monto final corregido por heurística
- `isValid`: verdadero si todo está bien

---

## 7) Reglas de estado actuales de negocio

En `createPayment` de [server/src/controllers/paymentController.js](server/src/controllers/paymentController.js):

1. Si falta comprobante o fecha -> error y no guarda.
2. Si comprobante ya usado -> error y no guarda.
3. Evaluación del núcleo:
   - núcleo = monto + destinatario + detalle
4. Si fallan 2 o 3 del núcleo -> error y no guarda.
5. Si falla exactamente 1 del núcleo -> guarda como `pendiente` (revisión manual).
6. Si no falla ninguno -> `aprobado` automático y desbloquea clase.

---

## 8) ¿Cómo se desbloquea la clase y qué fechas usa?

Al aprobar pago:

- `unlockedAt`: fecha/hora del request (momento real de habilitación)
- `paymentDate`: fecha detectada en comprobante OCR

Esto se actualiza en `classStudents` en [server/src/controllers/paymentController.js](server/src/controllers/paymentController.js).

---

## 9) Logging y depuración OCR

Se genera logging estructurado (si está habilitado):

- `RAW_TEXT_IMAGE` / `RAW_TEXT_PDF`
- `FIELD_EXTRACTED`
- `EXTRACTION_SUMMARY`
- `VALIDATION_SUMMARY`

Configuración:

- `DEBUG_OCR=true`
- y `NODE_ENV` distinto de `production`

En producción, los logs OCR no salen.

---

## 10) ¿Cómo mejorar precisión aún más?

### A corto plazo (sin reentrenar modelo)

- agregar más alias por banco (nuevas etiquetas)
- mantener lista de falsos positivos reales y reglas de descarte
- guardar top candidatos de monto y score para auditoría
- test unitarios con corpus de OCR real anonimizados

### A mediano plazo (más robusto)

- preprocesamiento de imagen (deskew, denoise, contraste)
- pipeline por tipo de banco (clasificación + parser específico)
- OCR secundario como fallback (p. ej. Vision API)

### A largo plazo (entrenamiento real)

- dataset etiquetado por campo (comprobante/fecha/monto/detalle/destinatario)
- fine-tuning OCR y/o modelo de extracción estructurada
- evaluación continua con métricas (precision/recall por campo)

---

## 11) Resumen ejecutivo

- Tesseract en este proyecto extrae texto, no valida pagos por sí solo.
- La “inteligencia” principal está en reglas de extracción + validación contra la clase.
- El sistema actual ya soporta múltiples formatos de comprobante y maneja errores OCR comunes.
- La decisión de `aprobado/pendiente/error` está centralizada y es trazable por checks.
