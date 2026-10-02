# Shinext Firebase deployment runbook

## Purpose

Deploy the tested Shinext web/PWA, Worker Portal, CRM, Firestore rules, Storage rules, indexes and Cloud Functions to the real Firebase project without committing credentials or project-specific secrets.

## Preconditions

1. The target Firebase project belongs to Shinext and the operator has the required Firebase permissions.
2. Email/Password authentication is enabled.
3. Firestore and Cloud Storage are created in the intended production region.
4. The branch being deployed has a green **Firebase CI** workflow.
5. The production Firebase web configuration is available for the public frontend.
6. Candidate expediente paths remain private under the tested Storage rules.

## Local project mapping

Copy the example file without committing it:

```bash
cp .firebaserc.example .firebaserc
```

Replace the example project id in `.firebaserc` with the real Firebase project id.

Authenticate using the Firebase CLI on the authorized machine:

```bash
firebase login
firebase use <PROJECT_ID>
```

Never place service-account JSON, private keys, passwords or administrative tokens in this repository.

## Pre-deploy verification

Install and build:

```bash
npm install
npm --prefix functions install
npm --prefix functions run build
npm run emulators:exec
```

The suite must pass before production deployment. Local tests use a project id prefixed with `demo-` so the Emulator Suite does not attempt production project lookups. It covers Firestore and Storage authorization, role boundaries, Worker Portal/CRM contracts, SEO metadata and the service lifecycle through Firebase emulators.

## Frontend Firebase configuration

When served from Firebase Hosting, the browser client automatically fetches the project's public web configuration from the reserved Hosting endpoint `/__/firebase/init.json`. This keeps the same code deployable across Firebase projects without embedding project-specific values in source control.

`window.SHINEXT_FIREBASE_CONFIG` remains available only as an explicit override for nonstandard hosting or controlled diagnostics.

Do not expose Admin SDK credentials, service-account JSON, private keys or administrative tokens.

## Deployment order

Deploy backend security and indexes first:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Then deploy Functions:

```bash
firebase deploy --only functions
```

Finally deploy Hosting:

```bash
firebase deploy --only hosting
```

A combined deploy can be used only after the first production verification is complete.

## Production smoke checks

After deployment verify:

1. Public home and Blog load without authentication.
2. Static Blog content remains readable if managed video content fails to load.
3. A public user cannot read draft Blog records, inactive banners or private media.
4. A Worker account can enter `/portal/` but cannot enter `/crm/`.
5. A Worker cannot read another worker, candidate expedientes, internal alerts, client pricing or Shinext margin.
6. Recruitment can review/approve candidate records but cannot manage roles or financial data.
7. Operations can view service requests and assignments.
8. Accounting can read earnings/payments but cannot operate services unless explicitly granted.
9. Purchasing can read supply requests and attached photos.
10. Director can access all CRM modules, including Content.
11. Two Workers cannot claim the same service.
12. Service completion generates one Worker earning only.
13. Payment status changes are audited.
14. A Blog video added from CRM accepts only supported YouTube/TikTok URLs.
15. Banner fallback remains visible if Firestore content is unavailable.

## Custom domain and SEO

Do not publish a production `sitemap.xml` with placeholder URLs.

Once the final Firebase Hosting or custom domain is confirmed:

1. Update canonical and Open Graph URLs to absolute production URLs.
2. Generate `sitemap.xml` with production URLs.
3. Add the Sitemap directive to `robots.txt`.
4. Verify the domain in Google Search Console.
5. Validate Article and eligible VideoObject structured data.
6. Submit the sitemap.

## Rollback

Hosting:

```bash
firebase hosting:channel:list
```

Use Firebase Hosting release history to roll back to the last known-good release.

For rules or Functions, redeploy the previous known-good Git commit. Do not manually weaken rules as an emergency workaround.

## Migration note

Netlify configuration is legacy transition material. Firebase Hosting becomes authoritative only after the real Firebase project is connected, CI is green, the production smoke checks pass and the public domain is confirmed.


## GitHub Actions production deployment

The repository includes a manual workflow at `.github/workflows/firebase-deploy.yml`.

Before the first production deploy, configure the GitHub **production** environment with:

- Repository/environment variable `FIREBASE_PROJECT_ID`: the real Shinext Firebase project id.
- Environment secret `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON credentials for a dedicated deployment service account with only the Firebase/GCP permissions required to deploy Hosting, Firestore rules/indexes, Storage rules and Cloud Functions.

The workflow always rebuilds and runs the automated test suite before any deployment. It rejects project ids starting with `demo-`.

Run it from **Actions → Firebase Production Deploy → Run workflow** and choose `all` for the first deployment. After the first production verification, the narrower `hosting`, `functions`, or `rules` targets may be used when appropriate.

Prefer short-lived federation credentials in the future if Shinext adopts Google Cloud Workload Identity Federation; the current service-account secret is an explicit first-release deployment mechanism and must remain inside the protected GitHub production environment.
