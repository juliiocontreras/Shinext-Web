# Shinext CRM — Diseño funcional y de arquitectura

## Objetivo
Convertir Shinext en una plataforma simple de conversión y operación que conecte clientes que necesitan limpieza con personal previamente validado por Shinext, conservando control administrativo, privacidad documental y trazabilidad económica por servicio.

## Principios
- Dos conversiones públicas principales: `Necesito limpieza` y `Quiero trabajar con Shinext`.
- Nadie entra a la red operativa sin expediente revisado y aprobación manual de Shinext.
- Los documentos sensibles nunca viven en GitHub ni en almacenamiento público.
- El personal aprobado decide qué solicitudes aceptar.
- El CRM conserva control del cliente, solicitud, oferta, asignación, servicio, pago y margen.
- GitHub es la fuente maestra del código; Netlify publica el frontend; Appwrite Cloud gestiona Auth, Database, Storage privado y eventos.

## Roles
### Administrador Shinext
Acceso total a clientes, aspirantes, expedientes, personal aprobado, solicitudes, ofertas, asignaciones, estados y finanzas.

### Aspirante
Puede crear una solicitud de ingreso y cargar su expediente. No tiene acceso a solicitudes de clientes ni a perfiles de terceros.

### Personal aprobado
Obtiene cuenta operativa solo después de aprobación. Puede editar disponibilidad, consultar ofertas dirigidas a su perfil, aceptar/rechazar y consultar su historial.

### Cliente
En el MVP no requiere cuenta. Captura datos y crea una solicitud de servicio. El CRM conserva su expediente comercial interno.

## Workflow principal
### Cliente
1. Entra al sitio.
2. Selecciona tipo de servicio.
3. Captura zona, fecha, frecuencia, tamaño y quién proporciona materiales.
4. Recibe estimado no vinculante.
5. Envía solicitud.
6. CRM crea/actualiza cliente y crea `service_request`.

### Aspirante
1. Abre `Quiero trabajar con Shinext`.
2. Captura datos personales, contacto, zona, experiencia y disponibilidad inicial.
3. Carga identificación oficial con foto y comprobante de domicilio.
4. Carga último comprobante de estudios solo cuando cuente con él.
5. Registro queda en `pending_review`.
6. Shinext puede marcar `needs_information`, `rejected` o `approved`.
7. Solo `approved` genera/habilita el perfil operativo y acceso del personal.

### Asignación
1. Una solicitud validada pasa a `ready_to_offer`.
2. El sistema obtiene personal aprobado compatible por zona, servicio y disponibilidad.
3. Shinext selecciona candidatos o usa el ranking sugerido.
4. Se crean ofertas individuales con expiración.
5. Cada trabajadora ve zona aproximada, fecha, ventana horaria, servicio, duración estimada, materiales y pago ofrecido.
6. Al aceptar, la oferta pasa a `accepted` y el CRM bloquea la asignación para evitar doble aceptación.
7. Las demás ofertas pasan a `closed`.
8. Se revelan los datos operativos necesarios del cliente únicamente a la persona asignada.

## Estados
### Aspirante
`draft` → `pending_review` → `needs_information` | `rejected` | `approved`

### Solicitud
`new` → `qualified` → `ready_to_offer` → `offered` → `assigned` → `in_progress` → `completed`
Estados laterales: `cancelled`, `expired`.

### Oferta
`pending` → `accepted` | `rejected` | `expired` | `closed`

### Servicio
`scheduled` → `en_route` → `in_progress` → `completed`
Estados laterales: `cancelled`, `incident`.

## Modelo de datos
### customers
`id`, `full_name`, `phone`, `email`, `primary_zone`, `notes`, `created_at`, `updated_at`.

### service_requests
`id`, `customer_id`, `service_type`, `address`, `zone`, `requested_date`, `time_window`, `size`, `cleaning_level`, `frequency`, `urgency`, `supplies_source`, `details`, `estimated_min`, `estimated_max`, `status`, `created_at`.

### applicants
`id`, `full_name`, `phone`, `email`, `zone`, `experience_summary`, `has_own_supplies`, `status`, `review_notes`, `submitted_at`, `reviewed_at`.

### applicant_documents
`id`, `applicant_id`, `document_type`, `storage_file_id`, `status`, `uploaded_at`, `reviewed_at`.
Tipos: `official_id`, `address_proof`, `education_proof`.

### workers
`id`, `applicant_id`, `appwrite_user_id`, `active`, `rating`, `service_types`, `zones`, `has_own_supplies`, `created_at`.

### worker_availability
`id`, `worker_id`, `date`, `start_time`, `end_time`, `status`.

### offers
`id`, `service_request_id`, `worker_id`, `offered_pay`, `expires_at`, `status`, `responded_at`, `rejection_reason`.

### assignments
`id`, `service_request_id`, `worker_id`, `offer_id`, `status`, `scheduled_start`, `scheduled_end`, `assigned_at`.

### service_finance
`id`, `assignment_id`, `customer_price`, `worker_pay`, `materials_cost`, `transport_cost`, `other_cost`, `shinext_margin`, `margin_percent`, `payment_status`.

### audit_events
`id`, `actor_type`, `actor_id`, `entity_type`, `entity_id`, `action`, `metadata`, `created_at`.

## Seguridad Appwrite
- Deny-by-default para tablas y archivos; Appwrite no concede permisos por defecto cuando se crean recursos desde servidor/console. Usar permisos explícitos y Row Security. 
- Equipo `shinext-admin` para administración.
- Personal aprobado obtiene permisos únicamente sobre su perfil, disponibilidad y ofertas dirigidas.
- Bucket privado `worker-documents` con File Security habilitado y cifrado; solo administración puede leer documentos una vez cargados.
- La carga pública de aspirantes pasa por una Function/endpoint controlado que valida extensión, tamaño y tipo antes de crear el archivo con permisos privados.
- Nunca exponer API keys de servidor en Netlify frontend.
- Datos completos de dirección del cliente se ocultan en ofertas y solo se liberan después de asignación confirmada.

## Arquitectura de frontend
- `/` Landing de conversión.
- `/solicitar` Solicitud de limpieza.
- `/trabaja-con-nosotros` Registro de aspirante y expediente.
- `/personal` Portal de personal aprobado.
- `/crm` CRM privado Shinext.

## CRM
### Dashboard
Solicitudes nuevas, pendientes de revisión, ofertas esperando respuesta, servicios de hoy, ingresos, pagos pendientes y margen.

### Clientes
Ficha, historial de solicitudes, notas y servicios.

### Aspirantes
Expediente, documentos, checklist, notas y decisión.

### Personal
Perfil aprobado, zonas, servicios, disponibilidad, historial y estado activo/inactivo.

### Solicitudes
Kanban/lista por estado con detalle operativo y económico.

### Asignación
Ranking de candidatas compatibles y acción `Enviar oferta`.

### Finanzas
Precio cliente, pago personal, materiales, traslado, margen bruto y estado de pago.

## Criterios de matching MVP
Filtro obligatorio: `approved && active`, servicio compatible, zona compatible y disponibilidad solapada.
Ranking simple: cercanía/zona exacta, experiencia/servicio, disponibilidad y rating. No usar IA en el MVP.

## Optimización UX pública
- Primer viewport con solo dos acciones principales.
- Cotizador en máximo 4 pasos cortos.
- Menos texto, más imágenes reales, iconos y prueba de confianza.
- CTA móvil fijo: `Solicitar limpieza` / `Quiero trabajar`.
- Evitar registro de cliente obligatorio en el MVP.

## Privacidad y cumplimiento operativo
- Consentimiento explícito para tratamiento de datos y documentos del aspirante.
- Política de retención: expedientes rechazados/cancelados deben poder eliminarse según política interna y obligaciones legales aplicables.
- Acceso documental auditado mediante `audit_events`.
- No almacenar copias de documentos en GitHub, Netlify static assets ni correo.

## Alcance fuera del MVP
- Pagos automáticos.
- Geolocalización en tiempo real.
- App móvil nativa.
- Matching con IA.
- Calificaciones bidireccionales avanzadas.
- Facturación automática.
