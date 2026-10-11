# Shinext Web

Sitio oficial y plataforma operativa de Shinext para Saltillo, Coahuila.

## Arquitectura objetivo

GitHub es la fuente de verdad. La plataforma está migrando a Firebase:

- Firebase Hosting: web pública, Blog/PWA, Portal del Trabajador y CRM.
- Firebase Authentication: Colaboradores y Trabajadores Shinext.
- Cloud Firestore: datos operativos.
- Cloud Storage: expedientes y adjuntos privados.
- Cloud Functions: operaciones privilegiadas y auditoría.
- Firebase Emulator Suite: desarrollo y pruebas locales.

Mientras no exista un despliegue Firebase de producción verificado, la configuración previa de Netlify se conserva únicamente como legado de transición.

## Estado de publicación (2026-10-11)

- Proyecto Firebase: **`shinex-e0c1f`**.
- Dominio público objetivo: **`https://shinext.site`** (hoy sirve un sitio de GoDaddy Website Builder; el DNS debe apuntar a Firebase Hosting).
- `Firebase CI` está verde en `main`. El workflow de deploy está listo y espera dos datos del entorno `production`:
  - variable `FIREBASE_PROJECT_ID` = `shinex-e0c1f` ✅ ya configurada;
  - secreto `FIREBASE_SERVICE_ACCOUNT_JSON` ⏳ pendiente de crear en Google Cloud.
- `SHINEXT_SITE_URL` se configura en el entorno `production` después de migrar el DNS; los smoke checks la usan como URL base.

Los pasos exactos, prerrequisitos, verificación y rollback están en
[`docs/operations/firebase-deploy.md`](docs/operations/firebase-deploy.md).

## Desarrollo local de Firebase

Requisitos: Node.js 20+ y Java 21 recomendado para los emuladores.

```bash
npm install
npm --prefix functions install
npm run emulators
```

En otra terminal:

```bash
npm test
```

También puede ejecutarse la suite en una sola operación:

```bash
npm run emulators:exec
```

El proyecto local usa `demo-shinext-local` para impedir llamadas accidentales a recursos reales. Para conectar un proyecto Firebase real, copia `.firebaserc.example` a `.firebaserc` y reemplaza el identificador solo en tu entorno local. `.firebaserc` no se versiona.

Cuando la app se sirve desde Firebase Hosting, el cliente web obtiene automáticamente la configuración pública del proyecto desde `/__/firebase/init.json`. No es necesario versionar ni insertar manualmente la configuración web de Firebase.

## Marca, PWA y SEO

- `brand/shinext-logo.webp` es el wordmark en uso; `brand/shinext-icon-192.png`, `brand/shinext-icon-512.png`, `brand/shinext-icon-maskable-512.png` y `brand/apple-touch-icon-180.png` son los iconos instalables.
- `brand/shinext-og.png` (1200×630) es la imagen de Open Graph/Twitter.
- El asset original `brand/shinext-logo-original.webp` estaba corrupto (le faltaba el byte de padding RIFF y ningún decodificador estricto podía abrirlo); se recuperó el wordmark y se reemplazó. Si recuperas el original en SVG/PNG, súbelo para regenerar iconos e imagen social.
- Rutas públicas indexables: `/`, `/trabaja/`, `/blog/` y los tres artículos. `sitemap.xml` y `robots.txt` los declaran con URLs absolutas; `/crm/` y `/portal/` quedan `noindex` y fuera del sitemap.
- Al cambiar cualquier archivo de la lista `SHELL` de `sw.js` hay que subir la versión de `CACHE`.

## Seguridad

Las reglas iniciales de Firestore y Storage son **deny-by-default**. Los permisos se abrirán de forma explícita conforme se implementen los módulos y cada cambio debe cubrirse con pruebas de Emulator Suite.

No se deben guardar secretos, llaves administrativas ni documentos de candidatos/trabajadores dentro del repositorio. La configuración pública de Firebase se obtiene de Hosting, no del código.

`firebase.json` aplica `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y una CSP mínima (`frame-ancestors`, `object-src`, `base-uri`). La CSP completa de `script-src`/`connect-src` queda pendiente de probar en un canal de preview.

## Despliegue

El procedimiento de conexión, verificación, despliegue y rollback de Firebase está documentado en:

`docs/operations/firebase-deploy.md`

No se debe desplegar a producción hasta tener el secreto de despliegue configurado, el proyecto Firebase preparado (Firestore, Storage, Auth y plan Blaze) y la suite de CI en verde.
