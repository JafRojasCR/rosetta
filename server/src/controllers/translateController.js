const https = require('https');

// Predefined high-fidelity Spanish-to-English dictionary for instant Rosetta UI translations
const PREDEFINED_DICTIONARY = {
  // Main headers & labels
  "Proyecto Rosetta": "Rosetta Project",
  "Clases": "Classes",
  "Pagos": "Payments",
  "Recursos": "Resources",
  "Materias": "Subjects",
  "Usuarios": "Users",
  "Configuración": "Settings",
  "Cerrar Sesión": "Log Out",
  "Perfil": "Profile",
  "¡Buenas, admin!": "Hello, admin!",
  "¿Cuál es tu plan para hoy?": "What's your plan for today?",
  "Ver tus clases disponibles": "View your available classes",
  "Sube tus comprobantes de pago": "Upload your payment receipts",
  "Accede a recursos útiles": "Access useful resources",
  "Gestiona clases y contenidos": "Manage classes and contents",
  "Valida pagos y comprobantes": "Validate payments and receipts",
  "Sube y organiza recursos": "Upload and organize resources",
  "Crea y organiza materias": "Create and organize subjects",
  "Administra estudiantes y accesos": "Manage students and access",
  "Ajustes generales del sistema": "General system settings",
  "Rosetta - Plataforma de Aula Virtual": "Rosetta - Virtual Classroom Platform",
  
  // Dashboard & actions
  "Vota esta clase": "Vote this class",
  "Me gustó": "I liked it",
  "No me gustó": "I didn't like it",
  "Buscar por título o fecha...": "Search by title or date...",
  "Fecha": "Date",
  "Materia": "Subject",
  "Estado": "Status",
  "Cargando video...": "Loading video...",
  "Video no disponible": "Video not available",
  "Sin descripcion registrada.": "No description registered.",
  "Sin materia": "No subject",
  "Estudiante": "Student",
  "Rating": "Rating",
  "Mes anterior": "Previous month",
  "Mes siguiente": "Next month",
  
  // Calendar
  "Lunes": "Monday",
  "Martes": "Tuesday",
  "Miércoles": "Wednesday",
  "Jueves": "Thursday",
  "Viernes": "Friday",
  "Sábado": "Saturday",
  "Domingo": "Sunday",
  "Calendario": "Calendar",
  "Calendario de Clases": "Class Calendar",
  
  // Forms & Classes Admin
  "Administrar clases": "Manage Classes",
  "Publica y organiza clases/tutorias": "Publish and organize classes/tutoring",
  "Editar clase": "Edit Class",
  "Publicar clase": "Publish Class",
  "Monto": "Amount",
  "Orden": "Order",
  "Tutoría personalizada": "Personalized Tutoring",
  "Selecciona un estudiante": "Select a student",
  "Desbloqueada para": "Unlocked for",
  "Codigo generado": "Generated Code",
  "Cancelar": "Cancel",
  "Guardar cambios": "Save Changes",
  "Guardando...": "Saving...",
  "Clases registradas": "Registered Classes",
  "No hay clases registradas.": "No registered classes.",
  "Cargando clases...": "Loading classes...",
  "Monto cobrado": "Amount charged",
  "Fecha de clase": "Class date",
  "Link Canva": "Canva Link",
  "Video de clase": "Class video",
  "Selecciona video": "Select video",
  "Link de Canva": "Canva Link",
  "Descripcion": "Description",
  "Descripcion breve de la clase": "Brief description of the class",
  "Titulo": "Title",
  "Completa titulo, materia, fecha y monto.": "Complete title, subject, date and amount.",
  "Selecciona una materia valida.": "Select a valid subject.",
  "El monto debe ser un numero mayor o igual a cero.": "The amount must be a number greater than or equal to zero.",
  "Clase publicada correctamente.": "Class published successfully.",
  "Clase actualizada correctamente.": "Class updated successfully.",
  "Clase eliminada correctamente.": "Class deleted successfully.",
  "No se pudo guardar la clase.": "Could not save the class.",
  "No se pudo eliminar la clase.": "Could not delete the class.",
  "Rating promedio": "Average Rating",
  "Ver video": "Watch video",
  "Editar": "Edit",
  "Eliminar": "Delete",
  "Acciones": "Actions",
  
  // General text
  "Atrás": "Back",
  "Regresar": "Go Back",
  "Guardar": "Save",
  "Cargando...": "Loading...",
  "Error": "Error",
  "Éxito": "Success",
  
  // Payments Page
  "Comprobantes de Pago": "Payment Receipts",
  "Sube y gestiona tus comprobantes de pago": "Upload and manage your payment receipts",
  "Subir Comprobante": "Upload Receipt",
  "Seleccionar archivo": "Select file",
  "Monto pagado": "Amount paid",
  "Subir pago": "Upload payment",
  "Estado de pagos": "Payment status",
  "Validar pago": "Validate payment",
  "Pago validado correctamente": "Payment validated successfully",
  "Pendiente": "Pending",
  "Aprobado": "Approved",
  "Rechazado": "Rejected",
  
  // Resources / Documents Page
  "Recursos Compartidos": "Shared Resources",
  "Accede a documentos y archivos de clase": "Access documents and class files",
  "Subir Recurso": "Upload Resource",
  "Nombre del recurso": "Resource name",
  "Tipo de archivo": "File type",
  "Descargar": "Download",
  
  // Profile
  "Información de Perfil": "Profile Information",
  "Nombre": "Name",
  "Apellido": "Last Name",
  "Correo Electrónico": "Email Address",
  "Teléfono": "Phone",
  "Cambiar Contraseña": "Change Password",
  "Eliminar Cuenta": "Delete Account",
  "Guardar Perfil": "Save Profile"
};

// Dynamic runtime in-memory cache to prevent redundant API queries
const dynamicCache = new Map();

/**
 * Fetch a single string translation via Google Translate's public API endpoint
 */
function fetchTranslation(text, targetLang = 'en') {
  return new Promise((resolve) => {
    const trimmed = text.trim();
    
    // Quick checks: return if empty, pure numbers, or date-like formats
    if (!trimmed || /^[0-9\/\-:\s.,\(\)]+$/.test(trimmed)) {
      return resolve(text);
    }

    // Check predefined dictionary first
    if (PREDEFINED_DICTIONARY[trimmed]) {
      return resolve(PREDEFINED_DICTIONARY[trimmed]);
    }

    // Check dynamic cache next
    const cacheKey = `${trimmed}_${targetLang}`;
    if (dynamicCache.has(cacheKey)) {
      return resolve(dynamicCache.get(cacheKey));
    }

    // Otherwise, perform the Google Translate request
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`;

    https.get(url, (res) => {
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && parsed[0]) {
            const translated = parsed[0].map(item => item[0]).join('');
            dynamicCache.set(cacheKey, translated);
            resolve(translated);
          } else {
            resolve(text);
          }
        } catch (err) {
          resolve(text);
        }
      });
    }).on('error', () => {
      // Gracefully fall back to original text on connection failure
      resolve(text);
    });
  });
}

/**
 * Express handler to translate an array of text strings
 */
exports.translateTexts = async (req, res) => {
  try {
    const { texts, target = 'en' } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "texts" debe ser un arreglo de cadenas de texto.'
      });
    }

    // Translate all strings in parallel
    const translations = await Promise.all(
      texts.map(text => fetchTranslation(String(text || ''), target))
    );

    return res.status(200).json({
      success: true,
      data: {
        translations
      }
    });
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error en el servidor de traducción.'
    });
  }
};
