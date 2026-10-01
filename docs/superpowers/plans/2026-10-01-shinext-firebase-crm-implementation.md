# Shinext Firebase CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Shinext a una base Firebase segura y desplegable, añadir Portal del Trabajador y Shinext CRM, y convertir Blog/banners/multimedia en superficies administrables sin romper la PWA pública.

**Architecture:** La web pública/PWA permanece como frontend ligero y Firebase pasa a ser la capa de identidad, datos, archivos privados y operaciones privilegiadas. Los Trabajadores y Colaboradores comparten Authentication pero usan perfiles, permisos y superficies separadas; las operaciones sensibles se encapsulan en Cloud Functions y se prueban con Emulator Suite.

**Tech Stack:** HTML/CSS/JavaScript existente, Firebase Hosting, Authentication, Cloud Firestore, Cloud Storage, Cloud Functions (TypeScript), Firebase Emulator Suite, Vitest/Node test runner según el scaffold Firebase, Playwright para E2E cuando el entorno lo permita.

**Spec:** `docs/superpowers/specs/2026-10-01-shinext-firebase-crm-design.md`

## Global Constraints
- GitHub continúa como fuente de verdad.
- Correo + contraseña para Trabajadores y Colaboradores.
- Candidatura no habilita acceso operativo hasta aprobación por Dirección o Reclutamiento.
- Asignación de trabajadores es manual por Shinext; el trabajador acepta/rechaza.
- Pago V1 ocurre fuera de la plataforma, pero se registran importes/estados.
- Portal Trabajador mobile-first, simple, visual y con pocas acciones por pantalla.
- No alterar el arte del logo oficial Shinext.
- Saltillo es la cobertura inicial.
- Conservar PWA y rutas “Solicitar limpieza” / “Quiero trabajar”.
- Blog es superficie principal SEO/SEM; video es complemento, no sustituto del contenido escrito.
- Seguridad por denegación predeterminada; UI nunca sustituye reglas/backend.

## Review Focus
- Dos trabajadores intentan aceptar el mismo servicio: solo una asignación debe confirmarse.
- Usuario trabajador intenta leer expedientes, margen o datos de otro trabajador: acceso denegado.
- Reclutamiento intenta cambiar roles/configuración crítica: acceso denegado aunque pueda aprobar candidatos.
- Fallo de red durante nota/incidencia/insumo: UI no debe mostrar éxito falso y debe permitir reintento.
- Embed de video inválido o externo no soportado: artículo sigue renderizando texto/CTA sin ejecutar HTML arbitrario.

---

### Task 1: Firebase foundation and local test environment

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc.example`
- Create: `firestore.rules`
- Create: `storage.rules`
- Create: `firestore.indexes.json`
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Create: `tests/emulator/smoke.test.mjs`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces Firebase emulator ports/configuration and deploy targets consumed by all later tasks.
- Produces callable Functions export surface from `functions/src/index.ts`.

- [ ] **Step 1: Write emulator smoke test**
  Assert Firestore emulator is reachable and unauthenticated writes to a protected test document are denied.
- [ ] **Step 2: Run test and verify it fails before Firebase config exists**
  Run: `npm test` (or repository test command established in this task).
- [ ] **Step 3: Add Firebase Hosting/Firestore/Storage/Functions/Emulator configuration**
  Hosting must serve current public root without changing public routes; local emulator config must not contain production secrets.
- [ ] **Step 4: Add deny-by-default baseline rules and Functions TypeScript scaffold**
- [ ] **Step 5: Run emulator smoke test**
  Expected: emulator reachable; unauthorized protected write denied.
- [ ] **Step 6: Commit**
  `git commit -m "build: add Firebase foundation and emulators"`

### Task 2: Identity, roles, permissions, and audit contracts

**Files:**
- Create: `functions/src/auth/roles.ts`
- Create: `functions/src/auth/permissions.ts`
- Create: `functions/src/audit/writeAudit.ts`
- Create: `functions/test/auth/permissions.test.ts`
- Modify: `firestore.rules`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Produces `UserRole = director | recruitment | operations | accounting | purchasing | sales | worker`.
- Produces `hasPermission(role, permission): boolean`.
- Produces `writeAudit(event): Promise<void>`.
- Custom claims identify broad role; Firestore collaborator profile holds explicit permission overrides.

- [ ] **Step 1: Write failing permission matrix tests**
  Assert Director full access; Recruitment candidate approve/read-worker access but no role-management/financial-margin access; Worker has no CRM permissions.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement role/permission contracts and audit writer**
- [ ] **Step 4: Extend Firestore rules to enforce authenticated role boundaries**
  Include explicit test that worker cannot read another worker or administrative collections.
- [ ] **Step 5: Run unit + emulator rule tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add Shinext roles permissions and audit"`

### Task 3: Candidate application, private expediente, and approval

**Files:**
- Create: `trabaja/index.html`
- Create: `assets/js/worker-application.js`
- Create: `functions/src/recruitment/approveWorker.ts`
- Create: `functions/src/recruitment/updateApplication.ts`
- Create: `functions/test/recruitment/approveWorker.test.ts`
- Modify: `storage.rules`
- Modify: `firestore.rules`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Application states: `received | in_review | information_pending | approved | rejected`.
- `approveWorker(applicationId, actorUid)` creates/enables worker profile, records approver/time and audit event.
- Storage path: `worker-applications/{applicationId}/{documentType}/{file}`.

- [ ] **Step 1: Write failing approval tests**
  Assert Recruitment and Director can approve; Operations cannot; approval creates worker exactly once; repeat approval is idempotent.
- [ ] **Step 2: Write failing Storage rule tests**
  Public/worker reads of expediente denied; authorized Recruitment/Director read allowed.
- [ ] **Step 3: Implement application form and private uploads**
  Require ID and proof of address; studies document optional.
- [ ] **Step 4: Implement privileged approval/update functions**
- [ ] **Step 5: Run unit + emulator tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add worker application and approval flow"`

### Task 4: Worker Portal shell, login, and dashboard

**Files:**
- Create: `portal/index.html`
- Create: `portal/login.html`
- Create: `portal/portal.css`
- Create: `portal/portal.js`
- Create: `assets/js/firebase-client.js`
- Create: `tests/ui/portal-smoke.spec.js`

**Interfaces:**
- `firebase-client.js` exports auth/db client initialization without secrets beyond normal Firebase web config.
- Portal sections: Inicio, Servicios, Calendario, Mis ganancias, Mis insumos.
- Worker route guard requires authenticated approved worker.

- [ ] **Step 1: Write portal smoke test**
  Assert unauthenticated visitor is sent to login and approved worker sees five primary sections.
- [ ] **Step 2: Run test; expect failure**
- [ ] **Step 3: Build mobile-first portal shell and email/password login**
  Use large tap targets, text+icons, bottom navigation and clear empty/loading/error states.
- [ ] **Step 4: Implement worker route guard and profile load**
- [ ] **Step 5: Run UI test and responsive checks**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add Shinext worker portal shell"`

### Task 5: Service requests, manual offers, and atomic acceptance

**Files:**
- Create: `functions/src/services/createOffer.ts`
- Create: `functions/src/services/respondToOffer.ts`
- Create: `functions/src/services/serviceState.ts`
- Create: `functions/test/services/respondToOffer.test.ts`
- Modify: `portal/portal.js`
- Modify: `firestore.rules`

**Interfaces:**
- Service request, offer, confirmed service remain separate documents.
- `respondToOffer(offerId, workerUid, decision)` where decision is `accept | reject`.
- Valid service states: `scheduled | en_route | started | completed | cancelled | incident`.

- [ ] **Step 1: Write failing offer tests**
  Include simultaneous acceptance by two workers; exactly one confirmed assignment must result.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement offer creation and transactional acceptance/rejection**
- [ ] **Step 4: Render worker offer cards with service essentials and worker earning only**
- [ ] **Step 5: Run tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add manual service offers and atomic acceptance"`

### Task 6: Service notes and incident timeline

**Files:**
- Create: `functions/src/services/addServiceNote.ts`
- Create: `functions/src/services/reportIncident.ts`
- Create: `functions/test/services/serviceNotes.test.ts`
- Modify: `portal/portal.js`
- Modify: `firestore.rules`

**Interfaces:**
- Note fields: authorUid, authorType, createdAt, serviceStage, text, visibility.
- Visibility: `worker | internal_shinext`.
- `reportIncident` creates timeline entry plus actionable alert.

- [ ] **Step 1: Write failing note/incident tests**
  Assert notes append rather than overwrite; worker cannot create/read internal-only note; incident creates open alert.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement append-only notes and incident function**
- [ ] **Step 4: Add “Agregar nota” and “Reportar incidencia” UI with retryable network errors**
  Add test proving a failed write never displays success.
- [ ] **Step 5: Run tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add service notes and incidents"`

### Task 7: Worker earnings and payment status

**Files:**
- Create: `functions/src/finance/closeService.ts`
- Create: `functions/src/finance/earnings.ts`
- Create: `functions/test/finance/earnings.test.ts`
- Modify: `portal/portal.js`
- Modify: `firestore.rules`

**Interfaces:**
- `closeService(serviceId, actorUid)` creates worker earning once after valid completion.
- Worker-visible fields exclude client total, internal costs and Shinext margin.
- Payment status: `pending | paid`.

- [ ] **Step 1: Write failing earnings/privacy tests**
  Assert closing twice does not duplicate earning; worker can read own earning but not margin/internal financial fields.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement close-service/earning logic and finance rules**
- [ ] **Step 4: Build “Mis ganancias” summary/history**
- [ ] **Step 5: Run tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add worker earnings and payment tracking"`

### Task 8: Supply requests and basic purchasing workflow

**Files:**
- Create: `functions/src/supplies/createSupplyRequest.ts`
- Create: `functions/src/supplies/updateSupplyRequest.ts`
- Create: `functions/test/supplies/supplyRequests.test.ts`
- Modify: `portal/portal.js`
- Modify: `firestore.rules`

**Interfaces:**
- Categories: `cleaning_products | tools | uniform`.
- States: `reported | reviewed | preparing_purchasing | ready_for_delivery | delivered`.

- [ ] **Step 1: Write failing supply request tests**
  Worker can create own request; cannot mark delivered; Purchasing/Director can advance valid transitions.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement supply request functions/rules**
- [ ] **Step 4: Build three-category worker UI with quantity, note and optional photo**
- [ ] **Step 5: Run tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add worker supply request workflow"`

### Task 9: Shinext CRM shell and department-aware navigation

**Files:**
- Create: `crm/index.html`
- Create: `crm/crm.css`
- Create: `crm/crm.js`
- Create: `crm/modules/dashboard.js`
- Create: `crm/modules/recruitment.js`
- Create: `crm/modules/operations.js`
- Create: `crm/modules/accounting.js`
- Create: `crm/modules/purchasing.js`
- Create: `crm/modules/sales.js`
- Create: `tests/ui/crm-permissions.spec.js`

**Interfaces:**
- CRM menu is generated from effective permissions, not only department name.
- Director sees all modules.
- Each module reads only authorized Firestore views/queries.

- [ ] **Step 1: Write failing navigation/permission UI tests**
  Recruitment must not see role management or margin; Director sees all; worker cannot enter CRM.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement CRM shell, permission-aware navigation and dashboard alerts**
- [ ] **Step 4: Implement V1 module surfaces**
  Recruitment and Operations full V1 workflows; Accounting/Purchasing/Sales basic lists/actions defined by spec.
- [ ] **Step 5: Run UI + emulator authorization tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: add Shinext CRM role-aware workspace"`

### Task 10: Blog CMS model, video embeds, and banner campaigns

**Files:**
- Create: `functions/src/content/media.ts`
- Create: `functions/src/content/publicContent.ts`
- Create: `functions/test/content/media.test.ts`
- Create: `assets/js/content-loader.js`
- Modify: `blog/index.html`
- Modify: existing article templates/pages
- Modify: `app.js`
- Modify: `firestore.rules`

**Interfaces:**
- `mediaEmbeds` accepts only normalized YouTube/TikTok URLs/IDs and never raw arbitrary embed HTML.
- `bannerCampaigns` replaces local `window.ShinextBanners` as source, with safe local fallback during migration.
- Public content query exposes only active/published records.

- [ ] **Step 1: Write failing media validation tests**
  Accept supported YouTube/TikTok URLs; reject javascript URLs, arbitrary iframe/html and unsupported hosts. Article must still render text/CTA when media is invalid.
- [ ] **Step 2: Run tests; expect failure**
- [ ] **Step 3: Implement normalized media parser and public content queries**
- [ ] **Step 4: Add lazy/preview embeds and optional VideoObject JSON-LD for eligible YouTube content**
- [ ] **Step 5: Migrate banner renderer to Firestore-backed campaigns with fallback**
- [ ] **Step 6: Run content tests, HTML validation and performance smoke checks**
- [ ] **Step 7: Commit**
  `git commit -m "feat: add managed blog media and banner campaigns"`

### Task 11: SEO/SEM, conversion measurement, and sitemap

**Files:**
- Create/Modify: `sitemap.xml` once production Firebase/custom domain is known
- Modify: `robots.txt`
- Modify: `app.js`
- Modify: blog templates/pages
- Create: `tests/seo/metadata.test.mjs`

**Interfaces:**
- Existing conversion events remain compatible.
- Article metadata includes canonical, OG, description and Article structured data; eligible video adds VideoObject.
- Sitemap uses absolute production URLs only.

- [ ] **Step 1: Write failing SEO metadata tests**
  Assert canonical/description/Article data and no placeholder domain in sitemap.
- [ ] **Step 2: Run tests; expect failure where production-domain work is incomplete**
- [ ] **Step 3: Implement metadata generation/static template requirements and UTM-safe conversion tracking**
- [ ] **Step 4: When Firebase/custom domain is established, generate sitemap and add Sitemap directive to robots**
- [ ] **Step 5: Run SEO tests; expect pass**
- [ ] **Step 6: Commit**
  `git commit -m "feat: strengthen Shinext SEO and campaign measurement"`

### Task 12: End-to-end verification and Firebase deployment

**Files:**
- Create: `tests/e2e/worker-lifecycle.spec.js`
- Create: `tests/e2e/service-lifecycle.spec.js`
- Create: `docs/operations/firebase-deploy.md`
- Modify: `README.md`

**Interfaces:**
- Deployment consumes tested Firebase config/rules/functions from Tasks 1–11.
- No production deployment occurs without a real Firebase project connection and successful rules tests.

- [ ] **Step 1: Write E2E lifecycle tests**
  Candidate → approval → worker login; request → offer → acceptance → note/incident → completion → earning; supply request → purchasing transition.
- [ ] **Step 2: Run full emulator suite and E2E tests**
  Expected: all pass; unauthorized access cases denied.
- [ ] **Step 3: Run responsive/PWA/SEO verification**
  Verify manifest/service worker, mobile portal navigation, CRM desktop/mobile sanity, structured data and lazy media.
- [ ] **Step 4: Connect the real Firebase project only with user-authorized project credentials/config**
  Do not commit secrets. Replace `.firebaserc.example` with local/project mapping as appropriate.
- [ ] **Step 5: Deploy rules, indexes, Functions and Hosting; run production smoke tests**
- [ ] **Step 6: Document rollback/deploy procedure and commit**
  `git commit -m "docs: add Shinext Firebase deployment runbook"`

## Delivery Gates
After Tasks 1–3: secure Firebase/recruitment foundation is independently usable in emulators.
After Tasks 4–8: Trabajador Shinext can operate end-to-end on mobile.
After Task 9: Colaboradores can run V1 operations through Shinext CRM.
After Tasks 10–11: Blog/SEO/SEM/media/banners are administrable and conversion-oriented.
After Task 12: system is eligible for Firebase production deployment after explicit project connection and verification.
