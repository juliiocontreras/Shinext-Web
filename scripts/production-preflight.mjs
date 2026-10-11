/**
 * Preflight de publicación de Shinext.
 *
 * Comprueba, solo con endpoints públicos (sin credenciales de Google), si el
 * proyecto Firebase está listo para desplegar: Hosting, dominio personalizado,
 * Authentication (Email/Password + dominios autorizados), Firestore y Storage.
 *
 * Uso:
 *   FIREBASE_PROJECT_ID=shinex-e0c1f SHINEXT_API_KEY=<web api key> \
 *     node scripts/production-preflight.mjs
 *
 * La API key es la clave web pública del proyecto (la misma que publica
 * /__/firebase/init.json). Si Hosting ya está desplegado, el script la obtiene
 * solo y no hace falta pasarla.
 *
 * Salida: informe legible y código 1 si el proyecto aún no está listo.
 */

const projectId = process.env.FIREBASE_PROJECT_ID || process.argv[2];
const explicitKey = process.env.SHINEXT_API_KEY || process.argv[3];
const customDomain = process.env.SHINEXT_SITE_URL || "https://shinext.site";

if (!projectId) {
  console.error("Define FIREBASE_PROJECT_ID (por ejemplo shinex-e0c1f).");
  process.exit(2);
}
if (projectId.startsWith("demo-")) {
  console.error("Este script es para proyectos reales, no para demo-*.");
  process.exit(2);
}

const results = [];
function record(area, status, detail) {
  results.push({ area, status, detail });
  const icon = status === "ok" ? "OK  " : status === "warn" ? "WARN" : "FAIL";
  console.log(`${icon} ${area}: ${detail}`);
}

async function get(url) {
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body, text };
}

// --------------------------------------------------------------- Hosting
const hostingBase = `https://${projectId}.web.app`;
let apiKey = explicitKey || "";

try {
  const init = await get(`${hostingBase}/__/firebase/init.json`);
  if (init.ok && init.body?.projectId) {
    apiKey = apiKey || init.body.apiKey || "";
    record("Hosting", "ok", `desplegado en ${hostingBase} (projectId=${init.body.projectId})`);
  } else {
    const home = await get(`${hostingBase}/`);
    if (home.status === 404 && /Site Not Found/i.test(home.text)) {
      record("Hosting", "warn", `${hostingBase} existe pero está vacío: aún no hay despliegue`);
    } else {
      record("Hosting", "warn", `${hostingBase} responde HTTP ${home.status}`);
    }
  }
} catch (error) {
  record("Hosting", "fail", `no se pudo consultar ${hostingBase}: ${error.message}`);
}

// -------------------------------------------------- Dominio personalizado
try {
  const init = await get(customDomain + "/__/firebase/init.json");
  if (init.ok && init.body?.projectId === projectId) {
    apiKey = apiKey || init.body.apiKey || "";
    record("Dominio", "ok", `${customDomain} sirve Firebase Hosting de ${projectId}`);
  } else if (init.ok && init.body?.projectId) {
    record("Dominio", "fail", `${customDomain} sirve otro proyecto (${init.body.projectId})`);
  } else {
    record("Dominio", "warn", `${customDomain} todavía no sirve Firebase Hosting (migrar el DNS a Firebase)`);
  }
} catch (error) {
  record("Dominio", "warn", `${customDomain} no responde: ${error.message}`);
}

// -------------------------------------------------------- Authentication
if (!apiKey) {
  record("Authentication", "warn", "sin API key no se puede comprobar Auth (pasa SHINEXT_API_KEY)");
} else {
  const auth = await get(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
  if (auth.ok) {
    const domains = auth.body.authorizedDomains || [];
    const emailEnabled = auth.body.signIn?.email?.enabled === true;
    record(
      "Authentication",
      emailEnabled ? "ok" : "warn",
      emailEnabled
        ? `Email/Password habilitado · dominios autorizados: ${domains.join(", ") || "(ninguno)"}`
        : `Email/Password no está habilitado · dominios autorizados: ${domains.join(", ") || "(ninguno)"}`,
    );
    const host = new URL(customDomain).hostname;
    const authorized = domains.some(
      (domain) => domain === host || (domain.startsWith("*.") && host.endsWith(domain.slice(1))),
    );
    if (emailEnabled && !authorized) {
      record("Authentication", "fail", `${host} no está autorizado: el login fallará en producción`);
    }
  } else {
    const message = auth.body?.error?.message || auth.text.slice(0, 120);
    record(
      "Authentication",
      "fail",
      message === "CONFIGURATION_NOT_FOUND"
        ? "Authentication sin configurar: habilita Email/Password en la consola"
        : `Identity Toolkit respondió ${auth.status}: ${message}`,
    );
  }
}

// ------------------------------------------------------------- Firestore
// El endpoint databases.get rechaza API keys, así que se lee un documento:
// 403 PERMISSION_DENIED = la base existe (reglas deny-by-default);
// 404 con "does not exist for project" = no hay base de datos;
// SERVICE_DISABLED = la API está deshabilitada.
const firestore = await get(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/__preflight__${apiKey ? `?key=${apiKey}` : ""}`,
);
const firestoreMessage = firestore.body?.error?.message || firestore.text.slice(0, 200);
if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(firestoreMessage)) {
  record("Firestore", "fail", "la API de Cloud Firestore está deshabilitada: crea la base de datos en la consola");
} else if (/does not exist for project/i.test(firestoreMessage)) {
  record("Firestore", "fail", "no existe la base de datos (default)");
} else if (firestore.status === 403) {
  record("Firestore", "ok", "base de datos (default) presente y protegida por reglas");
} else if (firestore.status === 404) {
  record("Firestore", "ok", "base de datos (default) presente (documento de prueba inexistente)");
} else if (firestore.ok) {
  record("Firestore", "ok", "base de datos (default) presente y con lectura anónima habilitada");
} else if (firestore.status === 401) {
  record("Firestore", "warn", "sin señal concluyente (el endpoint no acepta API keys)");
} else {
  record("Firestore", "warn", `HTTP ${firestore.status}: ${firestoreMessage}`);
}

// --------------------------------------------------------------- Storage
// La API JSON de GCS responde 404 solo si el bucket no existe; si existe y es
// privado, responde 401/403 de forma anónima.
for (const bucket of [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`]) {
  const storage = await get(`https://storage.googleapis.com/storage/v1/b/${bucket}`);
  if (storage.ok) {
    record("Storage", "ok", `bucket ${bucket} accesible`);
  } else if (storage.status === 404) {
    record("Storage", "fail", `el bucket ${bucket} no existe: activa Cloud Storage en la consola`);
  } else if (storage.status === 401 || storage.status === 403) {
    record("Storage", "ok", `bucket ${bucket} existe (acceso anónimo denegado, esperado)`);
  } else {
    record("Storage", "warn", `bucket ${bucket}: HTTP ${storage.status}`);
  }
}

// --------------------------------------------------------------- Resumen
const failures = results.filter((item) => item.status === "fail");
const warnings = results.filter((item) => item.status === "warn");
console.log("");
console.log(
  `${results.length} comprobaciones: ${results.filter((r) => r.status === "ok").length} ok, ` +
    `${warnings.length} avisos, ${failures.length} fallos.`,
);
if (failures.length) {
  console.log("El proyecto todavía no está listo para un despliegue completo.");
  process.exit(1);
}
if (warnings.length) {
  console.log("El proyecto está listo para desplegar; revisa los avisos.");
} else {
  console.log("El proyecto está listo para desplegar.");
}
