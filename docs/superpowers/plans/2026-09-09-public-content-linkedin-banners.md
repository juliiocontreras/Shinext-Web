# Shinext Public Content, LinkedIn and Banners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile-first Shinext PWA visibly promote its cleaning blog and add reusable banner placements ready for Firebase/CRM administration and LinkedIn distribution.

**Architecture:** Keep the current static PWA as the public layer. Add mobile blog prominence and a small banner schema/renderer in vanilla JS. LinkedIn distributes teasers that link back to canonical PWA articles; Firebase becomes the future persistence/admin layer.

**Tech Stack:** Static HTML/CSS/JavaScript, PWA manifest/service worker, GitHub; Firebase-ready data model.

**Spec:** `docs/superpowers/specs/2026-08-26-shinext-crm-workflow.md` plus the current Firebase direction established for Shinext.

## Global Constraints
- Preserve the official Shinext logo artwork.
- Mobile-first responsive UI is the priority.
- Cleaning blog must be visibly reachable from the home page on phones.
- Primary conversions remain “Solicitar limpieza” and “Quiero trabajar”.
- Banners must not create oversized mobile blocks or degrade conversion UX.
- Worker approval requires expediente review before operational account activation.
- GitHub remains source of truth; Firebase is the target backend/hosting architecture.
- LinkedIn posts link to canonical PWA articles rather than replacing them.

---

### Task 1: Mobile blog surface
**Files:** `index.html`, `styles.css`.
- [ ] Make “Blog de limpieza” a prominent home-page section.
- [ ] Preserve the three existing article routes.
- [ ] Keep cards compact and readable on phones.
- [ ] Run static assertions for title, routes and responsive selectors.
- [ ] Commit: `feat: improve mobile blog visibility`.

### Task 2: Reusable banner placements
**Files:** `index.html`, `styles.css`, `app.js`.
- [ ] Add named placements for hero, services/content, blog, distributor and CTA campaigns.
- [ ] Define banner fields: `id`, `type`, `placement`, `title`, `text`, `cta`, `href`, `image`, `active`, `audience`, `device`.
- [ ] Render only active banners matching placement/device/audience.
- [ ] Add accessible CTA and safe external-link behavior.
- [ ] Track `banner_impression` and `banner_click` through the existing event pipeline.
- [ ] Add mobile size limits.
- [ ] Run static assertions.
- [ ] Commit: `feat: add reusable banner placements`.

### Task 3: LinkedIn-to-PWA distribution map
**Files:** `docs/marketing/linkedin-content-map.md`, and article metadata only if required.
- [ ] Map each current article to a LinkedIn post hook and its PWA destination.
- [ ] Document: LinkedIn teaser → canonical PWA article → CTA.
- [ ] Verify canonical paths and social metadata.
- [ ] Commit: `docs: define linkedin blog distribution map`.

### Task 4: Firebase-ready banner model
**Files:** `docs/architecture/banner-manager.md`, `README.md`.
- [ ] Document banner fields, placements, targeting and campaign IDs.
- [ ] Document the future Firestore collection and admin-only writes.
- [ ] Document public read rules for active/publishable banners.
- [ ] Commit: `docs: define firebase banner manager model`.

### Task 5: Verification
- [ ] Verify manifest and service worker references remain intact.
- [ ] Verify blog routes and banner schema/hooks.
- [ ] Verify the official logo asset path is unchanged.
- [ ] Run local static QA and record results before claiming completion.
