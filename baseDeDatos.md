# Diseño de la Base de Datos

Tipo: Base de datos NoSQL — MongoDB (Mongoose)

Tablas/colecciones principales (correspondencia con modelos):
- `usuario` → `Student` (modelo `server/src/models/Student.js`)
- `admin` → `Admin` (modelo `server/src/models/Admin.js`)
- `tokens` → `AuthVerificationToken` (modelo `server/src/models/AuthVerificationToken.js`)
- `clase` → `Class` (modelo `server/src/models/Class.js`)
- `pago` → `Payment` (modelo `server/src/models/Payment.js`)
- `materia` → `Subject` (modelo `server/src/models/Subject.js`)
- `recurso` → `Document` (modelo `server/src/models/Document.js`)

Relaciones entre tablas (en modelo no relacional):
- Se usan referencias por `ObjectId` cuando aplica (por ejemplo, `class.classStudents[].student.id` referencia a `Student`).
- Muchos documentos embeben información relevante para lectura rápida (ej.: `subject` embebido en `Class` y `Document`).
- Índices y campos referenciados (email, userId, tokenHash) se usan para búsquedas eficientes.

Justificación del diseño:
- MongoDB permite esquemas flexibles: no todas las clases comparten la misma estructura (grabaciones, Canva, campos opcionales), por lo que la flexibilidad es útil.
- Almacenar metadatos en documentos y archivos voluminosos en GCS/Drive aporta escalabilidad y reduce costos de réplica.
- Modelos embebidos para lecturas frecuentes (ej. `subject` embebido) mejoran rendimiento en consultas de listado.

Fragmentos de creación (modelos Mongoose relevantes encontrados en el proyecto):

- `Student` (resumen):
```js
const studentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, default: '' },
  // campos de sesión y 2FA
}, { timestamps: true });
```

- `Admin` (resumen):
```js
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // sesión
}, { timestamps: true });
```

- `AuthVerificationToken` (resumen):
```js
const authVerificationTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ['student','admin'], required: true },
  purpose: { type: String, enum: ['login_2fa','password_reset'] },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });
```

- `Class` (resumen):
```js
const classSchema = new mongoose.Schema({
  classCode: { type: String, required: true, unique: true },
  title: String,
  date: Date,
  price: Number,
  recordingUrl: String,
  subject: { subjectId: String, name: String },
  classStudents: [{ student: { id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, email: String, name: String }, type: String }]
}, { timestamps: true });
```

- `Payment` (resumen):
```js
const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  billNumber: String,
  billUrl: String,
  studentEmail: String,
  classCode: String,
  amount: Number,
  status: { type: String, enum: ['pendiente','aprobado','rechazado'], default: 'pendiente' }
}, { timestamps: true });
```

- `Subject` y `Document` (resúmenes):
```js
const subjectSchema = new mongoose.Schema({ subjectId: String, name: String });
const documentSchema = new mongoose.Schema({ docId: String, title: String, fileUrl: String, type: { type: String, enum: ['pdf','video'] } });
```

Notas sobre scripts de creación:
- Al tratarse de MongoDB con Mongoose, la creación de colecciones y esquemas se maneja desde los modelos JS. Los fragmentos anteriores se corresponden con los modelos en `server/src/models/`.
- Si desea un script de inicialización (p. ej. inserción de materias iniciales), se puede añadir un `seed` en `server/scripts/seed.js` que use los modelos Mongoose para crear documentos.
