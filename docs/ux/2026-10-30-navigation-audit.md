# Auditoría UX de navegación — Shinext

Fecha: 2026-10-30

## Alcance

Revisión estructural y de flujo sobre el código actual de:

1. Inicio público
2. Solicitud de limpieza
3. Alta de prestador
4. Portal del prestador
5. CRM de Operaciones

La captura visual con navegador no estuvo disponible en esta sesión, por lo que esta auditoría no sustituye una revisión visual con screenshots ni una evaluación completa de accesibilidad.

## Hallazgos corregidos

### 1. Conversión pública

- Los CTAs principales ahora llevan directamente a `/solicitar/` y `/trabaja/`.
- Las tarjetas de servicio conservan la intención del usuario mediante `?service=`.
- Se añadió una entrada clara para prestadores existentes: `/portal/`.

### 2. Solicitud del cliente

- El formulario se reorganizó en tres bloques: servicio, fecha/preferencias y contacto.
- El servicio elegido desde la portada se preselecciona.
- No se permiten fechas anteriores al día actual.
- Se aclara que la solicitud inicial no realiza cobro.
- La confirmación explica que precio, disponibilidad y prestador se validan antes del cierre.

### 3. Alta de prestadores

- Se eliminó el mensaje engañoso que implicaba carga inmediata de documentos.
- Cuando Storage no está disponible, la sección documental se oculta y la verificación queda explícitamente pendiente.
- Se mantienen visibles las dos modalidades: independiente 85% y Shinext Partner 80%.

### 4. Portal del prestador

- La navegación llama “Disponibilidad” a la sección que realmente controla disponibilidad.
- Los controles de disponibilidad se optimizaron para interacción táctil.
- El estado vacío de solicitudes sólo aparece cuando corresponde.
- Los prestadores independientes no ven controles de solicitud de insumos exclusivos de Partner.
- Las ofertas sin pago definido no pueden aceptarse.
- Los botones de oferta conservan correctamente el backend al responder.
- La navegación marca el tab actual mediante `aria-current`.

### 5. CRM móvil

- El menú lateral se cierra después de elegir un módulo.
- El botón de menú expone `aria-expanded`.
- Esto reduce pasos repetidos y evita que el menú cubra el contenido después de navegar.

## Riesgos pendientes

1. Verificación visual real en móvil de 320–430 px, tablet y escritorio.
2. Prueba de teclado, lector de pantalla, contraste y foco visible.
3. Recuperar y mostrar la disponibilidad previamente guardada al prestador.
4. Definir el motor de precios antes de habilitar aceptación automática de ofertas pre-matcheadas.
5. Añadir seguimiento del cliente por folio y estados de contratación.
6. Confirmar comportamiento de errores y latencia real de Workers en producción.

## Principio de navegación recomendado

Cliente: Inicio → Solicitar → Confirmación → Seguimiento.

Prestador nuevo: Inicio → Trabaja con Shinext → Revisión → Portal.

Prestador activo: Portal → Solicitudes / Disponibilidad / Ganancias / Insumos.

Operaciones: CRM → Solicitudes → Asignación/seguimiento.
