# Propuesta de mejoras futuras

Funcionalidades pendientes y sugerencias:
- Sección de retroalimentación en clases: permitir comentarios y valoraciones por parte de estudiantes.
- Mejora del pipeline de validación de comprobantes: usar un servicio externo robusto para reconocimiento (p. ej. API como Ridivi) para reducir falsos positivos/negativos.
- Sistema de notificaciones en tiempo real (WebSockets) para avisos sobre nuevas clases o aprobaciones de pago.

Posibles optimizaciones:
- Mejorar el proceso de búsqueda y cacheo de recursos estáticos y metadatos (Redis para caches frecuentes).
- Pipeline asíncrono para procesamiento de comprobantes (colas, workers) para no bloquear requests.
- Optimizar índices en MongoDB según consultas reales en producción.

Ideas de evolución del sistema:
- Integrar IA para resumen y notas de vídeos: generar timestamps, extractos y resúmenes automáticos de grabaciones.
- Implementar un espacio de notas personal por vídeo/clase con resúmenes automáticos y búsqueda por texto.
- Sistema de recomendaciones de clases basado en histórico de visualizaciones y pagos.

Pequeñas mejoras UX/DevOps:
- Añadir tests end-to-end para flujos críticos (registro, compra de clase, subida de comprobante).
- Pipeline CI que ejecute linters y tests antes de merge.
- Documentación interna para procesos de mantenimiento y scripts de seed.
