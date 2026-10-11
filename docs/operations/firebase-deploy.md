# Runbook: despliegue de Shinext en Firebase

## Estado actual (2026-10-11)

| Elemento | Estado |
|---|---|
| Proyecto Firebase | `shinex-e0c1f` |
| Hosting | Habilitado, **sin contenido desplegado** (`https://shinex-e0c1f.web.app` responde "Site Not Found") |
| Backend (Firestore / Storage / Auth) | **Sin configurar**: API de Firestore deshabilitada, ningún bucket de Storage y Authentication sin inicializar |
| Dominio público objetivo | `https://shinext.site` — **hoy sirve un sitio de GoDaddy Website Builder** (`A 13.248.243.5`, `76.223.105.230`); debe migrarse a Firebase |
| Variable `FIREBASE_PROJECT_ID` (environment `production`) | Configurada: `shinex-e0c1f` |
| Secreto `FIREBASE_SERVICE_ACCOUNT_JSON` | **Pendiente** — es la única causa del fallo del workflow de deploy |
| `Firebase CI` (rama `main`) | Verde |
| `Firebase Production Deploy` | Falla en 9 s en `Validate production configuration` (falta el secreto) |
| SEO | `canonical`, `og:url` y `og:image` absolutos a `https://shinext.site`, con `sitemap.xml` y directiva `Sitemap` en `robots.txt` |
| PWA | Iconos 192/512 + maskable, `apple-touch-icon` 180, `sw.js` en `shinext-shell-v6` |

## Prerrequisitos del proyecto Firebase (verificar en la consola)

1. **Hosting** habilitado para el proyecto.
2. **Cloud Firestore** creado en modo producción (la región no se puede cambiar después).
3. **Cloud Storage** creado.
4. **Authentication → Email/Password** habilitado (Portal del Trabajador y CRM).
5. **Plan Blaze**: obligatorio para desplegar Cloud Functions (las funciones v2 usan Cloud Run y Artifact Registry).
6. APIs que se habilitan en el primer deploy: Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Identity Toolkit y Firebase Rules.

Comprobación sin credenciales:

```bash
curl -sI https://shinex-e0c1f.web.app/     # 404 "Site Not Found" = Hosting existe y está vacío
```

Comprobación completa de los prerrequisitos (Hosting, dominio, Auth, Firestore y Storage):

```bash
FIREBASE_PROJECT_ID=shinex-e0c1f SHINEXT_API_KEY=<web api key> node scripts/production-preflight.mjs
```

La guía paso a paso en la consola, con enlaces directos, roles exactos y la región recomendada, está en
[`firebase-console-setup.md`](firebase-console-setup.md).

## Paso 1 — Credencial de despliegue (una sola vez)

1. Abre `https://console.cloud.google.com/iam-admin/serviceaccounts?project=shinex-e0c1f`.
2. **Crear cuenta de servicio** con el nombre `shinext-deployer`.
3. Asígnale estos roles (mínimos para desplegar Hosting, reglas, índices y Functions):

   | Rol | Para qué |
   |---|---|
   | `Firebase Hosting Admin` | publicar Hosting y canales |
   | `Firebase Rules Admin` | reglas de Firestore y Storage |
   | `Cloud Datastore Index Admin` | índices de Firestore |
   | `Cloud Functions Admin` | funciones |
   | `Cloud Run Admin` | contenedores de Functions v2 |
   | `Service Account User` | que Functions use su propia cuenta de servicio |
   | `Storage Admin` | reglas de Storage |

   Si prefieres simplificar, `Firebase Admin` cubre todo el conjunto (con permisos de más).

4. **Claves → Agregar clave → Crear clave nueva → JSON** y descarga el archivo. No lo subas al repositorio ni lo pegues en el chat.
5. Carga el secreto en el environment `production`:

   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT_JSON --env production \
     --repo juliiocontreras/Shinext-Web < "ruta\a\shinex-e0c1f-clave.json"
   ```

   Alternativa por interfaz: GitHub → repo → Settings → Environments → `production` → *Add secret* → nombre `FIREBASE_SERVICE_ACCOUNT_JSON`, valor = contenido completo del JSON.

6. Borra el archivo JSON local y, si la clave se filtra, revócala en GCP y repite el paso 4.

## Paso 2 — Migrar `shinext.site` a Firebase Hosting

El dominio hoy apunta a GoDaddy Website Builder; al cambiarlo, ese sitio deja de servirse.

1. Firebase Console → **Hosting → Agregar dominio personalizado** → `shinext.site` (repite para `www.shinext.site`).
2. Copia los registros que muestre la consola. **Los valores de la consola son los que mandan**; los habituales son:
   - `A` → `151.101.1.195` y `A` → `151.101.65.195`
   - `TXT` (solo verificación) → el valor `google-site-verification=...` de la consola
3. En el DNS de GoDaddy, reemplaza los dos `A` actuales por los de Firebase y agrega el `TXT`. Mantén `www` como `CNAME` a `shinext.site` (o al valor que indique la consola).
4. Espera la propagación y la emisión del certificado SSL (puede tardar hasta 24 h).
5. Desconecta el sitio de GoDaddy Website Builder para no dejar contenido duplicado en el dominio.
6. Verifica que el dominio ya sirve Firebase Hosting:

   ```bash
   curl -s https://shinext.site/__/firebase/init.json    # debe devolver {"projectId":"shinex-e0c1f",...}
   ```

7. Verifica el dominio propio. Los smoke checks automáticos del workflow usan `https://shinex-e0c1f.web.app`; para el dominio propio, ejecuta el script a mano:

   ```bash
   node scripts/production-smoke.mjs https://shinext.site
   ```

   El script exige que `https://dominio/__/firebase/init.json` responda, así que también sirve para comprobar que el DNS ya apunta a Firebase y no a GoDaddy.

## Paso 3 — Primer despliegue

Ejecuta antes `node scripts/production-preflight.mjs`: no debe reportar fallos.

Usa `workflow_dispatch` la primera vez, no un push:

1. **Actions → Firebase Production Deploy → Run workflow** con `deploy_target = hosting`.
   Publica la web y la PWA sin tocar Firestore, Storage ni Functions.
2. Revisa `https://shinex-e0c1f.web.app` y el smoke de Hosting que ejecuta el workflow.
3. Repite con `rules` (reglas + índices + Storage) y luego con `functions`.
4. Solo cuando todo esté verificado, usa `all` o deja que un push a `main` despliegue todo.

Cualquier push a `main` dispara el deploy completo (`all`). Si el backend todavía no está configurado, ese push falla y **no publica nada**; por eso el primer despliegue se hace por partes.

## Paso 4 — Verificación de producción

```bash
node scripts/production-smoke.mjs https://shinext.site
```

Después:

- Completar los smoke checks de la sección siguiente.
- Lighthouse en móvil: instalable (PWA), LCP < 2.5 s, CLS < 0.1.
- Google Search Console: verificar `shinext.site` y enviar `https://shinext.site/sitemap.xml`.
- Probar el flujo real: solicitud pública → CRM → asignación → Portal del Trabajador con datos de prueba.

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

## Rollback

Hosting:

```bash
firebase hosting:releases:list --project shinex-e0c1f
firebase hosting:rollback --project shinex-e0c1f
```

Antes de promover, puedes publicar en un canal de preview:

```bash
firebase hosting:channel:deploy preview --project shinex-e0c1f
```

Para reglas o Functions: vuelve a desplegar el commit conocido como bueno (`workflow_dispatch` sobre ese commit). Nunca debilites las reglas como parche de emergencia.

## Deuda conocida (post-lanzamiento)

1. **CSP completa.** `firebase.json` aplica `frame-ancestors`, `object-src` y `base-uri`, pero no restringe `script-src` ni `connect-src`. Antes de endurecerla hay que probar CRM y Portal en un canal de preview, porque el SDK de Firebase carga módulos desde `https://www.gstatic.com` y llama a `*.googleapis.com`, `*.firebaseio.com` (wss) y `*.cloudfunctions.net`.
2. **Asset de marca.** El `brand/shinext-logo-original.webp` original estaba corrupto: su chunk VP8L mide 14075 bytes (impar) y le faltaba el byte de padding RIFF, por lo que los decodificadores estrictos (libwebp/Pillow, ffmpeg) rechazaban el archivo completo y el logo no habría renderizado. Se recuperó el wordmark y el sitio usa ahora `brand/shinext-logo.webp` + iconos PNG. **Si tienes el original en SVG/PNG, súbelo**: los iconos y la imagen OG se regeneran a partir de él.
3. **Analytics.** El proyecto tiene `measurementId` `G-XGY4XZ8BZD`, pero la PWA todavía no carga `firebase-analytics` (solo usa `window.dataLayer` para eventos locales). Activarlo requiere importar el SDK y ampliar la CSP.
4. **Service worker.** `sw.js` responde primero desde caché para las rutas de `SHELL`; cada cambio en `styles.css`, `app.js`, HTML público o assets de `SHELL` exige subir `CACHE` (`shinext-shell-v6` → `v7`).
5. **Netlify.** `netlify.toml` queda como legado. Puede eliminarse cuando la verificación en producción esté completa; sus cabeceras de seguridad ya fueron portadas a `firebase.json`.
6. **Smoke checks contra el dominio propio.** Para que el workflow use `shinext.site` como URL base hace falta editar `.github/workflows/firebase-deploy.yml` (leer `SHINEXT_SITE_URL`), pero GitHub rechaza escribir `.github/workflows/**` con un token sin el scope `workflow`. Para habilitarlo:

   ```bash
   gh auth refresh -h github.com -s workflow
   ```

## Reglas de configuración

- `FIREBASE_PROJECT_ID` es una variable del environment `production`. `SHINEXT_SITE_URL` solo se usará cuando el workflow pueda leerla (ver deuda conocida 6).
- `FIREBASE_SERVICE_ACCOUNT_JSON` es un secreto del environment `production`; nunca en el repositorio ni en `firebase.json`.
- El cliente web obtiene la configuración pública desde `/__/firebase/init.json`, así que **no** se versionan claves ni se hardcodea `firebaseConfig`. `window.SHINEXT_FIREBASE_CONFIG` queda solo como override explícito.
