# Shinext Firebase + CRM Design

**Date:** 2026-10-01  
**Status:** Approved conversational design, pending written-spec review  
**Repository:** juliiocontreras/Shinext-Web

## 1. Objective

Build the operational core of Shinext on Firebase without breaking the existing public PWA. GitHub remains the source of truth. Firebase becomes the hosting and backend platform for authentication, operational data, private documents, server-side workflows, and later notifications/payments.

The system distinguishes two fundamentally different populations:

- **Colaboradores Shinext:** internal company staff such as Director, Contabilidad, Reclutamiento, Administrativo/Operaciones, Compras, and Ventas.
- **Trabajadores Shinext:** cleaning personnel who perform services and use a deliberately simple, mobile-first worker portal.

## 2. Platform architecture

Use:
- Firebase Hosting for the public site/PWA and authenticated portals.
- Firebase Authentication with **email + password** for approved workers and collaborators.
- Cloud Firestore for operational and CRM data.
- Cloud Storage for private applicant/worker documents and optional service/supply evidence.
- Cloud Functions for privileged transitions and validations.
- GitHub as source control and deployment source.

Privileged state changes must not depend on client-side writes alone. Approval, role changes, financial adjustments, and other sensitive transitions go through server-controlled operations and create audit records.

## 3. Identity, roles, and permissions

### 3.1 Colaboradores Shinext

The CRM uses roles plus explicit permissions rather than hard-wiring every screen to a job title.

Initial role families:
- **Director:** full cross-functional access, collaborator management, permissions, configuration, audit, operations, finance, and reporting.
- **Reclutamiento:** applicants, private application documents, observations, worker approval/rejection, worker directory and status.
- **Operaciones/Administrativo:** clients, service requests, scheduling, worker selection, offers, assignments, service lifecycle, notes, incidents, and cancellations.
- **Contabilidad:** client charges, worker earnings/payments, service costs, Shinext margin, payment states, and financial exports.
- **Compras:** supply requests, purchasing/preparation workflow, deliveries, basic inventory, and suppliers.
- **Ventas:** prospects, clients, quotes, follow-up, recurring services, and commercial pipeline.

Director can grant additional permissions to a collaborator without changing their primary department.

### 3.2 Trabajadores Shinext

Workers are operational users, not CRM users. They receive a separate mobile-first portal and can only access their own permitted data.

A worker account is not operational until the application has been reviewed and approved. Either **Director** or an authorized **Reclutamiento** collaborator can approve definitively; no second approval is required.

## 4. Applicant-to-worker lifecycle

A public “Quiero trabajar” submission creates an application/expediente, not an active worker account.

Required/expected documents:
- photo ID,
- proof of address,
- latest proof of studies when available.

Application states:
- `received`
- `under_review`
- `information_required`
- `approved`
- `rejected`

Documents remain private in Cloud Storage. Firestore stores references, review metadata, and status.

On approval, a backend operation records approver and timestamp and enables/creates the Worker Shinext identity/profile for email/password access.

## 5. Worker portal

The worker portal must be simple, intuitive, visual, and mobile-first. Avoid dense enterprise tables, unexplained icons, and long administrative forms. Important actions use large buttons, short labels, clear confirmation states, and icons paired with text.

Primary navigation:
1. **Inicio:** next service, new requests, important alerts.
2. **Servicios:** pending offers, upcoming services, completed services, service details.
3. **Calendario:** simple service calendar.
4. **Mis ganancias:** generated amount, completed services, paid and pending earnings, history.
5. **Mis insumos:** report low/missing cleaning products, tools, or uniform items.

Service offers show only information needed to make the decision, including date/time, service type, zone/reference, estimated duration, and **worker earning**. They do not expose Shinext’s client price or internal margin.

## 6. Service request, offer, assignment, and lifecycle

Keep three distinct records/concepts:
- **Service Request:** what the client requests.
- **Service Offer:** an invitation sent by Shinext to a selected compatible worker.
- **Confirmed Service:** the operational assignment after acceptance.

Initial assignment mode is manual: Shinext/Operations selects one or more compatible workers and sends offers. Workers can accept or reject individually. Once an offer is accepted and assignment is confirmed, conflicting outstanding offers can be closed as covered.

Core service states:
- `scheduled`
- `en_route`
- `started`
- `completed`

Exceptional states include:
- `cancelled`
- `incident`

The data model must preserve status history rather than only the latest status.

## 7. Service notes and incidents

Every confirmed service has a chronological service log.

A Worker Shinext can add a note/comment before, during, or after the service. Notes are append-only records and preserve:
- author identity,
- author type,
- timestamp,
- service stage/status at creation,
- text,
- visibility.

Normal notes provide context. **Reportar incidencia** is a distinct action that creates an operational alert requiring attention.

Collaborators with permission can add internal notes. Visibility supports at minimum:
- `worker_visible`
- `internal_shinext`

Workers must never see internal administrative or financial notes.

## 8. Earnings and payments

Version 1 processes money outside the platform but records the economics and payment status in CRM. The model is intentionally compatible with later online payments.

Workers see only their own earnings:
- earnings by period,
- completed service count,
- paid amount,
- pending amount,
- earning history.

Authorized internal roles can see the full service economics:
- amount charged to client,
- worker earning/payment,
- service-related costs,
- other applicable expenses,
- Shinext margin,
- client payment status,
- worker payment status.

Financial adjustments are privileged and audited.

## 9. Supplies, purchasing, and inventory

Workers report shortages through three simple categories:
- cleaning products,
- cleaning tools,
- uniform.

The worker can select the item, approximate quantity, optional note, and optional evidence/photo when useful.

Supply request states:
- `reported`
- `reviewed`
- `purchasing_or_preparing`
- `ready_for_delivery`
- `delivered`

Compras receives a consolidated queue. The schema also prepares basic inventory and supplier records so Shinext can later analyze consumption without forcing ERP complexity into v1.

## 10. CRM departmental experience

### Director
Executive dashboard with new requests, today’s services, unassigned services, worker availability, open incidents, pending applicants, collections/payments, supply requests, and alerts. Full module access, collaborator/permission management, and audit history.

### Operaciones / Administrativo
General schedule, incoming requests, manual worker selection, offers, assignments, active services, cancellations, incidents, and chronological service logs.

### Reclutamiento
Pipeline: New → Under review → Information required → Approved → Rejected. Private document review, observations, definitive approval/rejection, and active/inactive worker directory.

### Contabilidad
Service-level financial records, client payment state, worker payment state, costs, margins, worker earnings history, and later exports.

### Compras
Supply queue: New → Reviewed → Purchasing/preparing → Ready → Delivered, plus basic inventory and suppliers.

### Ventas
Prospects, clients, quotes, follow-up, recurring services, and opportunities.

The first implementation prioritizes Director, Reclutamiento, Operaciones, Worker Portal, clients/services, basic earnings/payments, and supplies. Contabilidad, Compras, and Ventas receive stable navigation/data boundaries now and can gain advanced features incrementally.

## 11. Core data model

Initial Firestore domain collections:
- `users`
- `collaborators`
- `workerApplications`
- `workers`
- `clients`
- `serviceRequests`
- `serviceOffers`
- `services`
- `serviceNotes`
- `incidents`
- `workerEarnings`
- `payments`
- `supplyRequests`
- `inventory`
- `suppliers`
- `auditLog`

Implementation may use subcollections where security/query patterns make them preferable, but these domain boundaries must remain explicit.

## 12. Central service record

A confirmed service is the operational center connecting client, location, request, schedule, assigned worker, status, economics, supplies, notes, incidents, and change history.

Departments see only fields/actions allowed by their permissions. Sensitive financial and internal data must not be exposed through worker-readable documents.

## 13. Alerts and pending work

CRM provides an action-oriented pending/alerts surface. Initial alert types include:
- service without worker,
- service offer awaiting response,
- open incident,
- applicant awaiting review,
- missing applicant information,
- client payment pending,
- worker payment pending,
- supply request awaiting action.

The event/data model should later support email and push notifications without redesigning the operational records.

## 14. Security and audit

Security is enforced in backend rules/functions, not only hidden UI.

Requirements:
- workers can access only their own authorized operational records;
- workers cannot enumerate other workers, applicants, CRM data, internal notes, or internal economics;
- applicant documents are private;
- collaborators access modules according to role/permissions;
- Director has full authorized access;
- approval/rejection, permission changes, assignments, significant cancellations, financial adjustments, and important inventory/supply transitions create audit entries;
- privileged transitions validate current state to prevent contradictory assignments or unauthorized status changes.

## 15. PWA and public-site continuity

The existing public site, blog, banner system, SEO surfaces, and official Shinext branding remain intact while Firebase is introduced. Worker and CRM authenticated surfaces are separate routes/areas and must not weaken public-site performance or indexing.

The official Shinext logo artwork must not be altered.

## 16. Testing and acceptance

Before rollout:
- Firebase emulator tests cover Firestore/Storage security rules and privileged Cloud Functions.
- Role tests prove workers cannot access CRM/internal financial/private applicant data.
- Workflow tests cover applicant approval, manual service offering, accept/reject, assignment conflict prevention, service notes/incidents, earnings creation, and supply-request lifecycle.
- Mobile UI tests cover the worker’s primary flows at common phone widths.
- Existing public PWA/SEO behavior receives regression checks.

Success means a candidate can become an approved worker, receive and accept/reject a manually selected service, execute it with contextual notes/incidents, have earnings recorded, report missing supplies, and have authorized collaborators manage the corresponding work without exposing restricted data.
