# Configuración del proyecto Firebase `shinex-e0c1f` (consola)

Solo el **dueño del proyecto** puede hacer estos pasos: requieren acceso a la consola de Firebase/Google Cloud.
Orden recomendado: plan → Firestore → Storage → Authentication → cuenta de servicio → DNS.

## Estado verificado (2026-10-11)

Comprobado con `scripts/production-preflight.mjs` (endpoints públicos, sin credenciales):

| Servicio | Estado | Qué falta |
|---|---|---|
| Hosting | Existe, sin despliegue (`shinex-e0c1f.web.app` responde "Site Not Found") | Desplegar |
| Cloud Firestore | **API deshabilitada / sin base de datos** | Crear la base |
| Cloud Storage | **El bucket `shinex-e0c1f.firebasestorage.app` no existe** | Activar Storage |
| Authentication | **Sin configurar** (`CONFIGURATION_NOT_FOUND`) | Habilitar Email/Password |
| Dominio `shinext.site` | Sirve GoDaddy Website Builder | Migrar el DNS |

## Decisión previa: plan y región

- **Plan Blaze obligatorio**: Cloud Storage for Firebase y Cloud Functions ya no funcionan en Spark para proyectos nuevos.
- **Región `us-central1`** para Firestore y Storage: coincide con la región de las Cloud Functions (`us-central1` en `firebase.json` y `firebase-client.js`). Firestore **no permite cambiar la ubicación después**.

## Paso 1 — Activar Blaze

1. Abre https://console.firebase.google.com/project/shinex-e0c1f/usage/details
2. **Modificar plan → Blaze (de pago por uso)** y vincula una cuenta de facturación.
3. Define un presupuesto/alertas en Google Cloud Billing (Hosting + Functions de bajo tráfico suelen quedarse en el nivel gratuito de Blaze).

## Paso 2 — Cloud Firestore

1. Abre https://console.firebase.google.com/project/shinex-e0c1f/firestore
2. **Crear base de datos** → modo **producción** → ubicación **`us-central1`** → Crear.
3. No pegues reglas de prueba: el repo despliega `firestore.rules` (deny-by-default). Si la consola crea la base en modo de prueba, el primer `deploy` de reglas lo corrige.

## Paso 3 — Cloud Storage

1. Abre https://console.firebase.google.com/project/shinex-e0c1f/storage
2. **Comenzar** → reglas de **producción** → ubicación **`us-central1`**.
3. Verifica que el bucket resultante sea `shinex-e0c1f.firebasestorage.app` (es el valor de `storageBucket` en la configuración web del proyecto).
4. Usa la consola (no `gcloud storage buckets create`) para que Firebase registre ese bucket como bucket predeterminado del proyecto; `firebase deploy --only storage` publica reglas sobre el bucket predeterminado.

## Paso 4 — Authentication

1. Abre https://console.firebase.google.com/project/shinex-e0c1f/authentication/providers
   - **Correo electrónico/contraseña → Habilitar** y guardar. Es el único método que usa el Portal del Trabajador y el CRM.
2. Abre https://console.firebase.google.com/project/shinex-e0c1f/authentication/settings
   - En **Dominios autorizados** agrega `shinext.site` y `www.shinext.site`.
   - `localhost`, `shinex-e0c1f.firebaseapp.com` y `shinex-e0c1f.web.app` ya están; el dominio propio hay que agregarlo explícitamente o el login fallará en producción.
3. No actives "protección contra correos enumerados" ni MFA por ahora: cambiarían el comportamiento del Portal.

## Paso 5 — Cuenta de servicio de despliegue y secreto

1. Abre https://console.cloud.google.com/iam-admin/serviceaccounts?project=shinex-e0c1f
2. **Crear cuenta de servicio** → nombre `shinext-deployer`.
3. Roles necesarios:

   | Rol | Para qué |
   |---|---|
   | `Firebase Hosting Admin` | publicar Hosting |
   | `Firebase Rules Admin` | reglas de Firestore y Storage |
   | `Cloud Datastore Index Admin` | índices de Firestore |
   | `Cloud Functions Admin` | funciones |
   | `Cloud Run Admin` | contenedores de Functions v2 |
   | `Service Account User` | que Functions use su cuenta |
   | `Storage Admin` | reglas de Storage |
   | `Service Usage Admin` | habilitar APIs en el primer deploy (Cloud Build, Artifact Registry, etc.) |

4. **Claves → Agregar clave → Crear clave nueva → JSON** y descarga el archivo.
5. Carga el secreto (no lo subas al repositorio ni lo pegues en un chat):

   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT_JSON --env production \
     --repo juliiocontreras/Shinext-Web < "ruta\a\clave.json"
   ```

   O desde https://github.com/juliiocontreras/Shinext-Web/settings/environments → `production` → *Add secret*.

6. Borra el JSON local.

## Paso 6 — Comprobar y desplegar

```bash
FIREBASE_PROJECT_ID=shinex-e0c1f SHINEXT_API_KEY=<web api key> node scripts/production-preflight.mjs
```

Con los pasos 1-5, Firestore y Storage deben pasar a `OK`. El aviso del dominio desaparece al migrar el DNS (Paso 7).

```bash
gh workflow run firebase-deploy.yml --repo juliiocontreras/Shinext-Web -f deploy_target=hosting
gh run list --repo juliiocontreras/Shinext-Web --limit 3
```

Después `-f deploy_target=rules` y `-f deploy_target=functions`.

## Paso 7 — DNS de `shinext.site` (panel de GoDaddy)

1. En https://console.firebase.google.com/project/shinex-e0c1f/hosting/main → **Agregar dominio personalizado** → `shinext.site`.
2. Copia los registros que muestre la consola: la consola manda. Los habituales son:
   - `A` → `151.101.1.195`
   - `A` → `151.101.65.195`
   - `TXT` → `google-site-verification=...` (solo verificación)
3. En GoDaddy: **Mis productos → Dominios → shinext.site → DNS**. Sustituye los dos `A` actuales (`13.248.243.5` y `76.223.105.230`) por los de Firebase y agrega el `TXT`.
4. Desconecta el sitio de **GoDaddy Website Builder** para no dejar contenido duplicado en el dominio.
5. Espera la propagación y el certificado SSL (hasta 24 h) y verifica:

   ```bash
   node scripts/production-smoke.mjs https://shinext.site
   ```

## Apéndice: ruta por CLI (alternativa)

Si prefieres automatizar todo desde tu máquina con `gcloud` y `firebase-tools` autenticados como propietario:

```bash
gcloud config set project shinex-e0c1f
gcloud beta billing projects link shinex-e0c1f --billing-account=XXXXXX-XXXXXX-XXXXXX   # Blaze
gcloud services enable firestore.googleapis.com storage.googleapis.com \
  identitytoolkit.googleapis.com cloudfunctions.googleapis.com
gcloud firestore databases create --location=us-central1
gcloud storage buckets create gs://shinex-e0c1f.firebasestorage.app --location=us-central1
```

Advertencias:

- `billing projects link` cambia el plan y la facturación del proyecto: es tu decisión, no la de un agente.
- Habilitar **Email/Password** no tiene un comando estable en `gcloud`; se hace en la consola (o con la Identity Platform Admin API).
- Crear el bucket con `gcloud` no lo registra como bucket predeterminado de Firebase en todos los casos; si `firebase deploy --only storage` se queja, usa la consola del Paso 3.
