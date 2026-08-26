# Shinext CRM MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un sitio de alta conversión y un CRM operativo para captar clientes y aspirantes, aprobar personal, enviar ofertas de servicio y controlar asignaciones y margen.

**Architecture:** React + Vite publicado en Netlify. El navegador usa Appwrite Client SDK únicamente para sesiones y datos permitidos. Las acciones privilegiadas y los formularios públicos pasan por Netlify Functions usando Appwrite Server SDK y secretos en variables de entorno. Appwrite Cloud concentra Auth, Databases, Storage privado y Realtime. GitHub es la fuente maestra.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Appwrite Web SDK, Appwrite Node SDK en Netlify Functions, Netlify, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-shinext-crm-design.md`

## Global Constraints
- No documentos personales en GitHub, assets públicos o correo.
- Deny-by-default en Appwrite; Row/File Security activado donde corresponda.
- Una aspirante no recibe cuenta operativa hasta que Shinext la aprueba.
- Solo personal aprobado y activo puede recibir ofertas.
- Dirección completa del cliente no se muestra antes de la asignación.
- Cada servicio guarda precio cliente, pago al personal, costos y margen Shinext.
- El sitio público prioriza dos CTAs: `Necesito limpieza` y `Quiero trabajar con Shinext`.
- Ninguna API key de Appwrite Server se entrega al navegador.
- Las operaciones de aceptación de oferta deben ser idempotentes para impedir doble asignación.

---

## Workflow de entrega

### Fase 0 — Infraestructura segura
GitHub → Netlify → Appwrite Cloud. No construir CRM hasta verificar autenticación, variables y almacenamiento privado.

### Fase 1 — Conversión pública
Landing simple, cotización y registro de aspirante. Cada formulario crea datos reales en Appwrite.

### Fase 2 — Expediente y aprobación
Carga privada de documentos, checklist administrativo y aprobación/rechazo. La aprobación crea la cuenta operativa.

### Fase 3 — CRM operativo
Clientes, solicitudes, personal, disponibilidad, ofertas y asignaciones.

### Fase 4 — Portal de personal
Disponibilidad, ofertas, aceptar/rechazar e historial.

### Fase 5 — Finanzas y auditoría
Margen, costos, estados de pago y bitácora.

### Fase 6 — QA y producción
Responsive, seguridad, pruebas E2E, backups/versionado y deploy estable.

---

### Task 1: Scaffold de producción

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `netlify.toml`
- Create: `.env.example`
- Create: `tests/smoke.spec.ts`

**Interfaces:**
- Produces: frontend Vite compilable y deployable a `dist/`.

- [ ] Crear primero `tests/smoke.spec.ts` verificando que `/` renderiza `Necesito limpieza` y `Quiero trabajar con Shinext`.
- [ ] Ejecutar Playwright y confirmar que falla porque no existe la app.
- [ ] Crear scaffold React/Vite/Tailwind mínimo.
- [ ] Configurar `netlify.toml` con build `npm run build`, publish `dist` y fallback SPA a `/index.html`.
- [ ] Ejecutar `npm run build` y Playwright; ambos deben pasar.
- [ ] Commit: `chore: scaffold Shinext web app`.

### Task 2: Design system y landing de conversión

**Files:**
- Create: `src/components/BrandLogo.tsx`
- Create: `src/components/Header.tsx`
- Create: `src/components/MobileConversionBar.tsx`
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/home/ServiceCards.tsx`
- Create: `src/features/home/TrustSection.tsx`
- Test: `src/features/home/HomePage.test.tsx`

**Interfaces:**
- Produces: rutas públicas y CTAs a `/solicitar` y `/trabaja-con-nosotros`.

- [ ] Escribir test de jerarquía: H1 único, dos CTAs principales y cinco servicios.
- [ ] Confirmar RED.
- [ ] Implementar dirección marketplace + premium: fotografía dominante, azul Shinext, violeta secundario, poco texto, tarjetas abiertas sin exceso de contenedores.
- [ ] Añadir barra móvil fija con los dos CTAs.
- [ ] Verificar 375x667 y 1280x800 sin overflow.
- [ ] Commit: `feat: simplify landing around two conversions`.

### Task 3: Cliente Appwrite y contratos de datos

**Files:**
- Create: `src/lib/appwrite/client.ts`
- Create: `src/lib/appwrite/types.ts`
- Create: `src/lib/appwrite/ids.ts`
- Create: `src/lib/validation/customer.ts`
- Create: `src/lib/validation/applicant.ts`
- Test: `src/lib/validation/validation.test.ts`

**Interfaces:**
- Produces: `CustomerInput`, `ServiceRequestInput`, `ApplicantInput`, `WorkerAvailabilityInput`, IDs de database/table/bucket leídos de variables públicas no secretas.

- [ ] Escribir tests para campos requeridos, teléfonos y documentos permitidos.
- [ ] Confirmar RED.
- [ ] Implementar validadores puros sin dependencia de UI.
- [ ] Inicializar Appwrite Web Client usando solo endpoint y project ID públicos.
- [ ] Confirmar tests y build.
- [ ] Commit: `feat: add Appwrite client contracts and validation`.

### Task 4: Gateway seguro en Netlify Functions

**Files:**
- Create: `netlify/functions/_appwrite.ts`
- Create: `netlify/functions/create-service-request.ts`
- Create: `netlify/functions/create-applicant.ts`
- Create: `netlify/functions/upload-applicant-document.ts`
- Create: `netlify/functions/admin-review-applicant.ts`
- Create: `netlify/functions/admin-create-offers.ts`
- Create: `netlify/functions/accept-offer.ts`
- Test: `netlify/functions/functions.test.ts`

**Interfaces:**
- Consumes: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, resource IDs.
- Produces: JSON endpoints para operaciones que no deben ejecutarse con privilegios desde navegador.

- [ ] Escribir tests para rechazo de payload inválido, autorización admin y doble aceptación.
- [ ] Confirmar RED.
- [ ] Crear factory Server SDK solo en Functions.
- [ ] Implementar create-service-request con deduplicación de cliente por teléfono/email normalizado.
- [ ] Implementar create-applicant sin crear usuario Auth.
- [ ] Implementar upload con whitelist `image/jpeg,image/png,application/pdf`, límite de tamaño y Storage privado.
- [ ] Implementar revisión admin; solo `approved` puede crear usuario operativo y worker.
- [ ] Implementar creación de ofertas solo para workers aprobados/activos.
- [ ] Implementar aceptación atómica/idempotente: si existe assignment para la solicitud, devolver conflicto y no crear otro.
- [ ] Confirmar suite verde.
- [ ] Commit: `feat: add secure Appwrite server gateway`.

### Task 5: Provisionamiento Appwrite reproducible

**Files:**
- Create: `appwrite.config.json`
- Create: `scripts/appwrite-bootstrap.md`
- Create: `scripts/appwrite-permissions.md`

**Interfaces:**
- Produces: database `shinext`, tablas definidas en spec, bucket `worker-documents`, índices y permisos.

- [ ] Crear tablas: `customers`, `service_requests`, `applicants`, `applicant_documents`, `workers`, `worker_availability`, `offers`, `assignments`, `service_finance`, `audit_events`.
- [ ] Activar Row Security en tablas con datos privados.
- [ ] Crear índices por `status`, `customer_id`, `worker_id`, `service_request_id`, `zone`, `requested_date`, `expires_at`.
- [ ] Crear bucket `worker-documents` con File Security, cifrado, whitelist de extensiones y límite de archivo.
- [ ] Configurar equipo `shinext-admin`.
- [ ] Documentar matriz de permisos exacta y verificar que un usuario no autenticado no pueda listar filas/archivos.
- [ ] Commit: `infra: define Appwrite data model and permissions`.

### Task 6: Flujo de solicitud de cliente

**Files:**
- Create: `src/features/quote/QuotePage.tsx`
- Create: `src/features/quote/QuoteStepper.tsx`
- Create: `src/features/quote/estimate.ts`
- Test: `src/features/quote/QuotePage.test.tsx`
- Test: `tests/customer-request.spec.ts`

**Interfaces:**
- Produces: `POST /.netlify/functions/create-service-request`.

- [ ] Testear paso 1 servicio, paso 2 espacio/materiales, paso 3 fecha/zona, paso 4 contacto/confirmación.
- [ ] Confirmar RED.
- [ ] Implementar máximo cuatro pasos y estimado no vinculante.
- [ ] Guardar `supplies_source` como `customer`, `worker` o `shinext`.
- [ ] Mostrar confirmación con ID corto de solicitud.
- [ ] Verificar E2E desktop y mobile.
- [ ] Commit: `feat: add four-step customer request flow`.

### Task 7: Registro de aspirante y expediente

**Files:**
- Create: `src/features/applicant/ApplicantPage.tsx`
- Create: `src/features/applicant/ApplicantForm.tsx`
- Create: `src/features/applicant/DocumentUploader.tsx`
- Test: `src/features/applicant/ApplicantPage.test.tsx`
- Test: `tests/applicant-registration.spec.ts`

**Interfaces:**
- Produces: aspirante `pending_review` y documentos privados.

- [ ] Testear que identificación y domicilio sean obligatorios y estudios opcionales.
- [ ] Confirmar RED.
- [ ] Añadir consentimiento explícito para tratamiento de datos.
- [ ] Subir documentos uno por uno mediante Function y asociarlos al applicant.
- [ ] Nunca mostrar URL pública permanente del documento.
- [ ] Confirmar éxito solo cuando requeridos estén registrados.
- [ ] Commit: `feat: add applicant dossier intake`.

### Task 8: Autenticación y shell del CRM

**Files:**
- Create: `src/features/auth/LoginPage.tsx`
- Create: `src/features/auth/AuthGuard.tsx`
- Create: `src/features/crm/CrmLayout.tsx`
- Create: `src/features/crm/DashboardPage.tsx`
- Test: `tests/crm-auth.spec.ts`

**Interfaces:**
- Produces: acceso `/crm` solo para miembros admin autenticados.

- [ ] Testear redirect de anónimo.
- [ ] Confirmar RED.
- [ ] Implementar login Appwrite y sesión.
- [ ] Verificar rol/membresía admin antes de montar CRM.
- [ ] Implementar navegación: Dashboard, Clientes, Aspirantes, Personal, Solicitudes, Finanzas.
- [ ] Commit: `feat: add protected CRM shell`.

### Task 9: Revisión y aprobación de aspirantes

**Files:**
- Create: `src/features/crm/applicants/ApplicantsPage.tsx`
- Create: `src/features/crm/applicants/ApplicantDetail.tsx`
- Create: `src/features/crm/applicants/DocumentReview.tsx`
- Test: `tests/applicant-review.spec.ts`

**Interfaces:**
- Consumes: admin-review Function.
- Produces: `needs_information`, `rejected`, `approved` y cuenta worker solo en aprobación.

- [ ] Testear checklist documental y decisión.
- [ ] Confirmar RED.
- [ ] Mostrar documento mediante descarga autenticada temporal, nunca URL pública.
- [ ] Registrar nota y actor de revisión en audit_events.
- [ ] Al aprobar, crear usuario Auth + worker y marcar applicant approved.
- [ ] Verificar que rejected no cree usuario.
- [ ] Commit: `feat: add applicant review and approval workflow`.

### Task 10: CRM de clientes y solicitudes

**Files:**
- Create: `src/features/crm/customers/CustomersPage.tsx`
- Create: `src/features/crm/requests/RequestsPage.tsx`
- Create: `src/features/crm/requests/RequestDetail.tsx`
- Test: `tests/crm-requests.spec.ts`

**Interfaces:**
- Produces: transición de solicitud `new → qualified → ready_to_offer`.

- [ ] Testear listado, filtros por estado/fecha/servicio y ficha de cliente.
- [ ] Confirmar RED.
- [ ] Implementar lista compacta en desktop y cards funcionales en mobile.
- [ ] Añadir validación de datos antes de `ready_to_offer`.
- [ ] Commit: `feat: add customer and request CRM`.

### Task 11: Matching y ofertas

**Files:**
- Create: `src/features/crm/matching/rankWorkers.ts`
- Create: `src/features/crm/matching/MatchingPanel.tsx`
- Create: `src/features/crm/offers/OffersPanel.tsx`
- Test: `src/features/crm/matching/rankWorkers.test.ts`
- Test: `tests/offer-assignment.spec.ts`

**Interfaces:**
- Produces: ranking determinista y ofertas con expiración.

- [ ] Testear exclusión de inactivos/no aprobados/no disponibles.
- [ ] Confirmar RED.
- [ ] Puntuar zona exacta > servicio compatible > disponibilidad > rating.
- [ ] Permitir admin seleccionar candidatas y pago ofrecido.
- [ ] Crear una oferta por candidata con `expires_at`.
- [ ] Confirmar que solo una aceptación termina en assignment.
- [ ] Commit: `feat: add worker matching and offers`.

### Task 12: Portal del personal

**Files:**
- Create: `src/features/worker/WorkerLayout.tsx`
- Create: `src/features/worker/AvailabilityPage.tsx`
- Create: `src/features/worker/OffersPage.tsx`
- Create: `src/features/worker/HistoryPage.tsx`
- Test: `tests/worker-portal.spec.ts`

**Interfaces:**
- Produces: disponibilidad y respuesta a oferta.

- [ ] Testear que worker solo vea sus filas/ofertas.
- [ ] Confirmar RED.
- [ ] Implementar calendario simple de disponibilidad, sin calendario complejo externo.
- [ ] Mostrar en oferta solo zona aproximada, fecha, horario, servicio, duración, materiales y pago.
- [ ] Aceptar/rechazar con motivo opcional.
- [ ] Tras aceptación confirmada, mostrar datos operativos necesarios del servicio.
- [ ] Commit: `feat: add approved worker portal`.

### Task 13: Servicio, finanzas y auditoría

**Files:**
- Create: `src/features/crm/assignments/AssignmentDetail.tsx`
- Create: `src/features/crm/finance/FinancePage.tsx`
- Create: `src/lib/finance/margin.ts`
- Test: `src/lib/finance/margin.test.ts`
- Test: `tests/service-completion.spec.ts`

**Interfaces:**
- Produces: cierre de servicio y margen.

- [ ] Testear `margin = customerPrice - workerPay - materialsCost - transportCost - otherCost`.
- [ ] Confirmar RED.
- [ ] Implementar estados del servicio y registro de incidencia.
- [ ] Calcular `margin_percent` sobre precio cliente, protegiendo división por cero.
- [ ] Registrar eventos de cambios críticos.
- [ ] Commit: `feat: add assignment finance and audit trail`.

### Task 14: Realtime y caducidad de ofertas

**Files:**
- Create: `src/lib/appwrite/realtime.ts`
- Create: `netlify/functions/expire-offers.ts`
- Test: `tests/offer-expiration.spec.ts`

**Interfaces:**
- Produces: refresco de portal/CRM y expiración determinista.

- [ ] Testear que una oferta vencida no pueda aceptarse.
- [ ] Confirmar RED.
- [ ] Suscribir CRM/portal únicamente a recursos autorizados.
- [ ] Implementar función de expiración idempotente ejecutable por schedule de Netlify.
- [ ] Commit: `feat: add realtime offer updates and expiration`.

### Task 15: Seguridad, privacidad y hardening

**Files:**
- Create: `docs/security/data-access-matrix.md`
- Create: `docs/security/document-retention.md`
- Create: `tests/security.spec.ts`

**Interfaces:**
- Produces: matriz auditable de acceso.

- [ ] Testear acceso anónimo denegado a CRM, workers, documentos y finanzas.
- [ ] Testear worker A no puede leer ofertas/servicios de worker B.
- [ ] Testear URL/ID de documento sin permiso no devuelve archivo.
- [ ] Revisar headers de seguridad de Netlify y CSP compatible con Appwrite.
- [ ] Documentar retención y eliminación de expedientes.
- [ ] Commit: `security: harden Shinext CRM access controls`.

### Task 16: QA de conversión y producción

**Files:**
- Modify: `tests/*.spec.ts`
- Create: `docs/release/checklist.md`

**Interfaces:**
- Produces: release candidata para Netlify production.

- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar unit/integration tests completos.
- [ ] Ejecutar Playwright 1280x800 y 375x667 para cliente, aspirante, admin y worker.
- [ ] Verificar imágenes/logo, sin recursos rotos.
- [ ] Verificar Core Web Vitals básicos, carga diferida de imágenes y ausencia de overflow móvil.
- [ ] Verificar flujo E2E: cliente crea solicitud → admin califica → envía oferta → worker acepta → assignment único → admin completa → margen calculado.
- [ ] Publicar preview Netlify, revisar, después promover a producción.
- [ ] Commit: `release: Shinext CRM MVP`.

---

## Secuencia óptima de desarrollo
1. Infraestructura + seguridad.
2. Landing + cliente.
3. Aspirante + expediente.
4. CRM admin + aprobación.
5. Matching + ofertas.
6. Portal worker.
7. Finanzas + realtime.
8. Hardening + QA.

No desarrollar pagos, IA ni geolocalización antes de completar y medir este flujo principal.

## Métricas MVP
- Conversión visitante → solicitud de cliente.
- Conversión visitante → expediente de aspirante completado.
- % aspirantes aprobados.
- Tiempo solicitud → primera oferta.
- % ofertas aceptadas.
- Tiempo solicitud → asignación.
- Margen bruto por servicio y por tipo de servicio.
- Cancelaciones por cliente y por personal.
- Servicios completados por trabajadora.
