# Manual de Administrador — Rosetta

Versión: borrador operativo para pasar a Word  
Fecha: 2026-03-02

---

## 1) Alcance del rol administrador

El administrador puede:

- Iniciar sesión con verificación por correo (2FA).
- Gestionar clases (crear, editar, eliminar, publicar).
- Subir recursos académicos (PDF/videos).
- Revisar y decidir pagos (aprobar, pendiente, rechazar).
- Gestionar usuarios.
- Gestionar materias.
- Gestionar cuentas administrativas y credenciales desde Configuración.

AÑADIR IMAGEN DE: Dashboard de administrador AQUI

---

## 2) Acceso seguro al panel admin

### Pasos de acceso
1. Ir a login.
2. Ingresar correo y contraseña de administrador.
3. Escribir código 2FA recibido por correo.

### Reglas de seguridad
- Contraseña robusta.
- No compartir cuenta.
- Cerrar sesión al finalizar.

AÑADIR IMAGEN DE: Login administrador AQUI  
AÑADIR IMAGEN DE: Verificación 2FA admin AQUI

---

## 3) Sesión única y toma de sesión

Si la cuenta admin ya está activa en otro dispositivo, el sistema muestra conflicto de sesión.

### Opciones
- **Cancelar**: mantener sesión anterior.
- **Mover sesión aquí**: revoca la sesión anterior y activa la actual.

### Uso recomendado
- Si cambiaste de equipo o navegador, usar **Mover sesión aquí**.

AÑADIR IMAGEN DE: Popup de conflicto de sesión admin AQUI

---

## 4) Estructura del panel administrador

Módulos principales:

- **Clases**
- **Pagos**
- **Recursos/Documentos**
- **Usuarios**
- **Materias**
- **Configuración**

AÑADIR IMAGEN DE: Menú lateral o navegación admin AQUI

---

## 5) Gestión de Clases

### Crear clase
1. Ir a **Clases**.
2. Seleccionar **Crear clase**.
3. Completar datos:
   - Título
   - Materia
   - Fecha
   - Descripción (si aplica)
   - Enlace Canva (opcional)
4. Cargar grabación/video de clase.
5. Guardar.

### Editar clase
1. Buscar clase.
2. Abrir acciones.
3. Editar campos requeridos.
4. Guardar cambios.

### Eliminar clase
1. Seleccionar clase.
2. Confirmar eliminación.

### Buenas prácticas
- Títulos claros y consistentes.
- Verificar materia correcta antes de guardar.
- Confirmar subida completa de video antes de cerrar.

AÑADIR IMAGEN DE: Formulario crear/editar clase AQUI  
AÑADIR IMAGEN DE: Tabla de clases con acciones AQUI

---

## 6) Carga de archivos grandes (clases/recursos)

La plataforma maneja subidas por bloques (chunk upload) para mayor estabilidad.

### Recomendaciones operativas
- Usar conexión estable.
- Evitar cerrar la pestaña durante la carga.
- Esperar confirmación final de subida.
- Si hay error temporal, reintentar.

### Si falla una carga
- Reintentar con el mismo archivo.
- Verificar tamaño, formato y estabilidad de red.
- Revisar panel de estado/errores.

AÑADIR IMAGEN DE: Barra de progreso de carga AQUI  
AÑADIR IMAGEN DE: Mensaje de carga completada AQUI

---

## 7) Gestión de Recursos / Documentos

### Crear recurso
1. Ir a **Recursos/Documentos**.
2. Seleccionar **Nuevo recurso**.
3. Definir:
   - Título
   - Tipo (PDF/Video)
   - Materia o categoría
4. Cargar archivo.
5. Guardar/publicar.

### Editar recurso
- Modificar nombre, categoría o archivo según necesidad.

### Eliminar recurso
- Confirmar borrado en acción de eliminar.

AÑADIR IMAGEN DE: Pantalla de recursos admin AQUI  
AÑADIR IMAGEN DE: Formulario de carga de recurso AQUI

---

## 8) Gestión de Pagos

### Flujo general
Los estudiantes suben comprobantes. El sistema puede:

- Aprobar automáticamente en casos claros.
- Marcar como pendiente para revisión manual.
- Rechazar cuando no cumple reglas mínimas.

### Revisión manual admin
1. Ir a **Pagos**.
2. Revisar lista de pendientes/historial.
3. Abrir detalle de comprobante.
4. Validar:
   - Fecha
   - Monto
   - Destinatario
   - Concepto/Detalle
5. Tomar decisión:
   - Aprobar
   - Mantener pendiente
   - Rechazar

### Criterios prácticos de revisión
- Comprobante legible.
- Datos clave visibles.
- Coherencia entre clase, monto y concepto.

AÑADIR IMAGEN DE: Lista de pagos admin AQUI  
AÑADIR IMAGEN DE: Detalle de comprobante con zoom AQUI  
AÑADIR IMAGEN DE: Historial de pagos aprobados AQUI

---

## 9) Gestión de Usuarios

### Funciones
- Listar estudiantes.
- Buscar por nombre/correo.
- Revisar estado de cuenta.
- Aplicar acciones administrativas disponibles.

### Buenas prácticas
- Confirmar identidad antes de cambios críticos.
- Registrar motivo interno cuando se realicen ajustes sensibles.

AÑADIR IMAGEN DE: Tabla de usuarios AQUI

---

## 10) Gestión de Materias

### Qué permite
- Crear materias.
- Editar nombres.
- Eliminar materias no usadas.

### Recomendación
- Definir nomenclatura estandarizada (ej. MAYÚSCULAS o Título).

AÑADIR IMAGEN DE: Módulo de materias AQUI

---

## 11) Configuración de administradores

### Operaciones disponibles
- Agregar nuevo administrador.
- Cambiar contraseña de administrador.
- Eliminar administrador.

### UX importante
Los popups/modales pueden cerrarse al hacer clic fuera del cuadro de diálogo.

### Seguridad recomendada
- Mantener mínimo de cuentas admin activas.
- Rotar contraseñas periódicamente.
- Retirar accesos no utilizados.

AÑADIR IMAGEN DE: Configuración admin AQUI  
AÑADIR IMAGEN DE: Modal agregar admin AQUI  
AÑADIR IMAGEN DE: Modal cambio de contraseña AQUI

---

## 12) Cierre de sesión

### Procedimiento
- Usar botón **Cerrar sesión**.
- Esto revoca la sesión activa actual.

### Recomendación
Cerrar sesión siempre en equipos compartidos.

AÑADIR IMAGEN DE: Botón cerrar sesión admin AQUI

---

## 13) Errores frecuentes y respuesta operativa

### “Sesión revocada / conflicto de sesión”
- Validar si hubo inicio en otro dispositivo.
- Reingresar y usar **Mover sesión aquí** si corresponde.

### “Código 2FA inválido o expirado”
- Reenviar código y usar el más reciente.
- Verificar tiempo de expiración.

### “Pago no concluyente (pendiente)”
- Revisar manualmente comprobante y decidir acción.

### “Error en carga de archivo”
- Reintentar.
- Verificar red.
- Confirmar formato/tamaño.

---

## 14) Checklist operativo diario (admin)

- [ ] Revisar pagos pendientes.
- [ ] Validar nuevas clases publicadas.
- [ ] Verificar recursos recién subidos.
- [ ] Revisar incidencias de usuarios.
- [ ] Confirmar que no existan sesiones admin no autorizadas.

---

## 15) Checklist de capturas para versión Word

- [ ] Login admin
- [ ] 2FA admin
- [ ] Popup de sesión activa
- [ ] Dashboard admin
- [ ] Clases (tabla y formulario)
- [ ] Progreso de subida de video
- [ ] Recursos (tabla y formulario)
- [ ] Pagos (tabla y detalle con zoom)
- [ ] Usuarios
- [ ] Materias
- [ ] Configuración (modales)
- [ ] Cierre de sesión

---

## 16) Glosario administrativo

- **2FA**: verificación en dos pasos mediante código de correo.
- **Sesión única**: una sesión activa principal por cuenta.
- **Mover sesión aquí**: revoca dispositivo anterior y autoriza el actual.
- **Pendiente**: pago requiere revisión humana.
- **Chunk upload**: carga de archivos por bloques para mayor estabilidad.
