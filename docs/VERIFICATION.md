# Verificación inicial

Fecha: 2026-11-25. Entorno: Windows, Node.js 24.12.0, npm 11.6.2.

## Evidencia local

- **53/53 pruebas** unitarias/contrato con Vitest; fuentes externas simuladas. Incluye recorrido HTTP live simulado y caché.
- Compilación TypeScript estricta y build Vite aprobados con `npm run check`.
- Auditoría npm sin vulnerabilidades tras actualizar Vitest a 5.1.2.
- Demo recorrida en navegador real contra Vite → proxy → Worker local.
- Se detectó y corrigió un fallo de origen en el proxy local sin relajar la validación de origen en producción.
- Resultado de demo etiquetado ficticio y reglas, con tres señales y foco accesible en la sección resultado.
- Vista de escritorio de 1296 px sin overflow horizontal.
- Vista móvil comprobada con un iframe del mismo origen a 390 × 844 px: sin elementos fuera del ancho del documento. No equivale a prueba en dispositivo físico.
- Demo móvil con resultado y foco correcto, sin overflow.
- Build servido directamente por Worker en `8787`: HTTP 200, cabeceras CSP, CSS y demo correctos; consola del navegador sin errores.

`preview-desktop.jpeg` recoge la demo ficticia, no una consulta real.

## YouTube real

El 2026-11-25 se verificó el backend con la clave añadida por el usuario a `.dev.vars` sin mostrar su valor. Health: `live:true, ai:false`. Una solicitud real de `@midudev` devolvió canal `midudev`, `source:youtube`, `engine:rules` y 20 evidencias. La ausencia de suscripciones accesibles apareció como advertencia. No se activó IA ni se publicó el proyecto.

## No verificado

- Casos reales de clave inválida, cuota agotada y canal sin contenido público.
- Inferencia Workers AI, moderación y cuotas remotas.
- Despliegue en cuenta Cloudflare y caché distribuida.
- Descarga/portapapeles en todos los navegadores.
- Lighthouse, lector de pantalla y dispositivo físico móvil.

Ver el registro actualizado y pendientes en `../PLAN.md`.
