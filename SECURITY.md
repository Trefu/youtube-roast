# Seguridad

## Informar un problema

No publiques claves, tokens, historiales de usuarios ni instrucciones que expongan datos en una issue pública. Usa la opción **Report a vulnerability** de GitHub si está habilitada; en caso contrario abre una issue sin datos sensibles para acordar un canal privado.

## Secretos

- `.dev.vars` y sus variantes reales, `.env*`, `.pem` y `.key` están ignorados por Git.
- `.dev.vars.example` es una plantilla, no una credencial.
- La clave de YouTube se usa únicamente desde el Worker. Nunca usar variables `VITE_*` para secretos.
- En producción configura la clave mediante `wrangler secret put YOUTUBE_API_KEY --env production`.
- Si una clave se expone, revócala y genera otra. Borrarla de la última versión del archivo no la elimina del historial.

## Límites conocidos

- El contador de peticiones en memoria no es una cuota global: puede reiniciarse y repetirse entre isolates.
- No activar live públicamente sin revisar cuotas y protección antiabuso.
- Workers AI está desactivado. La validación de JSON y evidencias no sustituye una evaluación de seguridad semántica.
- La aplicación procesa datos públicos; esto no elimina obligaciones de privacidad.
- El entorno de producción arranca con live e IA desactivados para evitar consultas involuntarias.

Las verificaciones automáticas no requieren secretos ni acceden a la API real de YouTube.
