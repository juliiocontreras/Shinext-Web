# Shinext Firebase + CRM Design

**Fecha:** 2026-10-01
**Estado:** diseño aprobado en conversación; pendiente de revisión del documento antes del plan de implementación.

## 1. Objetivo
Convertir Shinext en una plataforma operativa sobre Firebase sin perder la web/PWA pública existente. El sistema conectará clientes, Colaboradores Shinext y Trabajadores Shinext, con seguridad por roles, trazabilidad y una experiencia mobile-first.

La interfaz debe ser limpia, intuitiva y llamativa. El Portal del Trabajador prioriza acciones simples y lenguaje directo. El Shinext CRM concentra operación, reclutamiento, dirección, finanzas básicas, compras e información comercial. El Blog Shinext es el centro de adquisición SEO/SEM y puede incorporar videos oficiales de YouTube o TikTok como apoyo multimedia sin sustituir contenido escrito indexable.

## 2. Arquitectura
- GitHub continúa como fuente de verdad del código.
- Firebase Hosting sirve sitio público, blog, PWA, Portal del Trabajador y CRM.
- Firebase Authentication usa correo + contraseña para Trabajadores y Colaboradores.
- Cloud Firestore almacena datos operativos y permisos.
- Cloud Storage almacena expedientes/documentos privados y adjuntos.
- Cloud Functions ejecuta operaciones privilegiadas: aprobaciones, habilitación de cuentas, asignaciones sensibles, cálculos/ajustes económicos y auditoría.
- PWA conserva instalación móvil y service worker.
- Futuro: Firebase Cloud Messaging para alertas push y proveedor de pagos para cobro en línea.

## 3. Tipos de usuario
### 3.1 Colaboradores Shinext
Equipo interno: Director, Contabilidad, Reclutamiento, Administrativo/Operaciones, Compras, Ventas y futuros departamentos.

Se usa RBAC con roles + permisos específicos, no pantallas rígidas por puesto. Dirección tiene acceso total y puede administrar permisos. Reclutamiento puede aprobar definitivamente expedientes sin segunda autorización del Director.

### 3.2 Trabajadores Shinext
Personal que presta servicios de limpieza. No comparte el CRM interno. Tiene un portal separado, mobile-first y simplificado.

Una candidatura no crea acceso operativo. El acceso se habilita únicamente tras la aprobación del expediente por Dirección o Reclutamiento.

## 4. Portal del Trabajador
Navegación principal:
1. Inicio: próximo servicio, solicitudes nuevas, avisos.
2. Servicios: ofertas pendientes, aceptar/rechazar, próximos, realizados y detalle.
3. Calendario: agenda simple de servicios.
4. Mis ganancias: total generado, servicios realizados, pagado, pendiente e historial.
5. Mis insumos: Productos, Herramientas y Uniforme.

Cada oferta muestra solo la información necesaria para decidir y ejecutar, incluyendo la ganancia del trabajador; no muestra precio total al cliente ni margen Shinext.

Accesibilidad práctica: botones grandes, iconos acompañados de texto, pocas acciones por pantalla, confirmaciones claras y navegación inferior móvil.

## 5. Candidatos y expedientes
Estados: recibido, en_revision, informacion_pendiente, aprobado, rechazado.

Documentos esperados:
- identificación con fotografía;
- comprobante de domicilio;
- último comprobante de estudios cuando exista.

Los archivos viven en Storage privado. Firestore guarda referencias, metadatos y estado de revisión.

Al aprobar:
1. se registra aprobador y fecha;
2. se habilita/crea la identidad operativa;
3. se crea el perfil de Trabajador Shinext;
4. el trabajador puede definir disponibilidad.

## 6. Solicitudes, ofertas y servicios
Entidades separadas:
- solicitud del cliente;
- oferta enviada a trabajador;
- servicio confirmado.

Shinext selecciona manualmente uno o varios trabajadores compatibles. Cada trabajador acepta o rechaza. La aceptación válida confirma la asignación; las ofertas restantes pueden cerrarse como cubiertas.

Estados normales del servicio: programado, en_camino, iniciado, finalizado.
Estados excepcionales: cancelado, incidencia.

## 7. Notas e incidencias
Cada servicio posee bitácora cronológica. Trabajadores y Colaboradores autorizados pueden agregar notas.

Cada nota conserva:
- autor;
- tipo de autor;
- fecha/hora;
- etapa del servicio;
- texto;
- visibilidad: trabajador o interno_shinext.

Las notas no se sobrescriben; se agregan como historial.

“Reportar incidencia” es distinto de “Agregar nota”. Una incidencia crea una alerta para Operaciones y mantiene estado de seguimiento/resolución.

## 8. Ganancias y pagos
V1: el pago ocurre fuera de Shinext. El CRM registra importes y estados.

Trabajador ve únicamente sus ganancias, pagos y pendientes.

Dirección/Contabilidad pueden ver:
- importe cobrado al cliente;
- costos;
- pago/ganancia del trabajador;
- otros gastos;
- margen Shinext;
- estado de cobro;
- estado de pago.

El modelo debe permitir integrar cobro en línea después sin reemplazar las entidades de servicio.

## 9. Insumos e inventario
Trabajador reporta faltantes mediante tres categorías visuales: productos de limpieza, herramientas y uniforme. Puede indicar artículo, cantidad aproximada, nota y foto opcional.

Estados: reportado, revisado, preparando_comprando, listo_entrega, entregado.

Compras recibe bandeja consolidada. Se conservan historial y relación opcional con servicio. Inventario y proveedores se modelan desde V1 de forma básica para crecer posteriormente.

## 10. Shinext CRM
### Dirección
Resumen ejecutivo, solicitudes, servicios del día, pendientes de asignación, disponibilidad, incidencias, candidatos, cobros/pagos, insumos y alertas. Acceso transversal, usuarios, roles, permisos y auditoría.

### Operaciones/Administrativo
Agenda general, solicitudes, ofertas, asignaciones, servicios activos, cancelaciones, incidencias y bitácoras.

### Reclutamiento
Embudo de candidatos, revisión documental, observaciones, solicitud de correcciones, aprobación/rechazo y directorio de trabajadores. Sin acceso financiero interno salvo permiso explícito.

### Contabilidad
Cobros, pagos, costos, margen, ganancias de trabajadores y reportes/exportación básica.

### Compras
Solicitudes de insumos, preparación/compra/entrega, inventario básico y proveedores.

### Ventas
Prospectos, clientes, cotizaciones, seguimiento y servicios recurrentes.

La V1 concentra funcionalidad profunda en Dirección, Reclutamiento, Operaciones, Portal del Trabajador, servicios, ganancias/pagos básicos e insumos. Contabilidad, Compras y Ventas tendrán estructura preparada y capacidades básicas sin construir un ERP completo.

## 11. Modelo de datos
Colecciones principales:
- users
- collaborators
- workerApplications
- workers
- clients
- serviceRequests
- serviceOffers
- services
- serviceNotes
- incidents
- workerEarnings
- payments
- supplyRequests
- inventory
- suppliers
- alerts
- auditLog
- blogPosts
- mediaEmbeds
- bannerCampaigns

Los documentos deben incluir createdAt/updatedAt cuando aplique y referencias por ID. Los movimientos sensibles se registran en auditLog.

## 12. Seguridad
- Denegación por defecto en reglas.
- Trabajador solo lee/escribe datos expresamente asociados a su UID y acciones permitidas.
- Ningún Trabajador puede leer expedientes, otros trabajadores, margen Shinext, permisos o datos administrativos.
- Expedientes en Storage privado con rutas por candidato y acceso restringido.
- Cambios de roles/permisos, aprobaciones, asignaciones críticas, ajustes económicos y cierres sensibles pasan por backend privilegiado.
- Reclutamiento accede a expedientes y trabajadores, pero no a configuración crítica.
- Dirección tiene acceso total.
- Validación tanto en UI como en reglas/backend; la UI nunca es el control de seguridad.

## 13. Alertas
Centro de pendientes para:
- servicio sin trabajador;
- oferta sin respuesta;
- incidencia abierta;
- expediente pendiente;
- información faltante;
- cobro/pago pendiente;
- solicitud de insumos.

La misma capa podrá alimentar notificaciones push o correo en fases posteriores.

## 14. Blog, SEO/SEM y multimedia
El Blog Shinext es una superficie principal de adquisición y no una sección secundaria.

Cada artículo debe soportar:
- título y slug;
- resumen/meta description;
- contenido escrito útil;
- categoría/etiquetas;
- imagen principal;
- autor/fecha;
- CTA hacia cotización o servicio;
- enlaces internos;
- video oficial opcional.

mediaEmbeds permite asociar YouTube o TikTok a artículos sin editar código. YouTube se prioriza para contenido evergreen; TikTok se usa como refuerzo social/visual. Los embeds deben cargarse de forma diferida o mediante preview para proteger Core Web Vitals. Cuando proceda se generará structured data VideoObject, además del marcado del artículo. Un video nunca reemplaza el contenido textual indexable.

El blog debe facilitar campañas SEM con páginas/artículos que lleven a conversión, manteniendo medición de eventos y UTMs.

## 15. Banner manager
Los banners existentes migrarán del arreglo local a bannerCampaigns en Firestore. Campos: placement, type, title, text, cta, href, active, audience, device, fechas opcionales, media opcional y prioridad. La web pública consume únicamente campañas activas publicables.

## 16. Errores y consistencia
- Las operaciones multi-documento críticas usan transacciones/batches o Cloud Functions idempotentes.
- Aceptar un servicio debe evitar doble asignación.
- Errores de red muestran estado recuperable y no simulan éxito.
- Las escrituras privilegiadas devuelven códigos claros para UI.
- Las notas e historial financiero no se borran silenciosamente; correcciones relevantes generan nuevos registros/auditoría.

## 17. Testing y QA
- Pruebas unitarias para permisos, transiciones de estado y cálculos.
- Firebase Emulator Suite para reglas de Firestore/Storage y Functions.
- Pruebas de integración para aprobación de candidato, oferta/aceptación, cierre/ganancia e insumos.
- Pruebas E2E de los flujos críticos.
- QA responsive en móvil primero, luego escritorio.
- Verificación PWA, service worker, manifest, SEO técnico, datos estructurados y rendimiento de embeds.
- No desplegar a producción sin reglas probadas y sin confirmar que los expedientes no sean públicos.

## 18. Entregas
1. Núcleo Firebase, configuración, emuladores, Auth, roles, reglas y auditoría.
2. Candidatos/expedientes y aprobación.
3. Portal del Trabajador.
4. Solicitudes, ofertas, asignaciones, notas e incidencias.
5. Ganancias/pagos básicos e insumos.
6. Shinext CRM por departamentos.
7. Blog administrable, multimedia, banners y SEO/SEM.
8. QA, migración, Hosting y despliegue.

## 19. Restricciones de producto
- Conservar la identidad visual azul/navy/blanco/gris con acentos moderados.
- No alterar el arte del logo oficial Shinext.
- Mobile-first y PWA.
- Saltillo como cobertura inicial.
- Mantener rutas claras “Solicitar limpieza” y “Quiero trabajar”.
- Evitar funciones avanzadas sin uso inmediato; dejar interfaces preparadas para crecimiento.
- Las decisiones menores se resolverán favoreciendo simplicidad, seguridad, mantenibilidad y velocidad de uso.
