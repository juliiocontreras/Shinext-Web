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

## Seguridad

Las reglas iniciales de Firestore y Storage son **deny-by-default**. Los permisos se abrirán de forma explícita conforme se implementen los módulos y cada cambio debe cubrirse con pruebas de Emulator Suite.

No se deben guardar secretos, llaves administrativas ni documentos de candidatos/trabajadores dentro del repositorio.


## Despliegue

El procedimiento de conexión, verificación, despliegue y rollback de Firebase está documentado en:

`docs/operations/firebase-deploy.md`

No se debe desplegar a producción hasta tener un proyecto Firebase real conectado y la suite de CI en verde.
