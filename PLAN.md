# Plan y traspaso — RoastTube

## Estado de la implementación

Proyecto creado el **2026-11-25** en `D:\Users\Trefu\Documents\Repos\youtube-roast`.

### Implementado

- [x] React + TypeScript + Vite, interfaz española responsive.
- [x] Formulario de canal, tres intensidades, carga y errores.
- [x] Demo ficticia explícita con evidencias de ejemplo.
- [x] API real con YouTube Data API; clave solo en servidor.
- [x] Aceptar handles, URLs `/@handle`, IDs `/channel/UC…` y `/user/…`.
- [x] Muestra acotada de videos publicados, títulos de playlists y suscripciones accesibles.
- [x] Canal vacío: responder información insuficiente, sin inventar historial.
- [x] Motor por reglas, fuentes consultables y descarga/copia en texto.
- [x] Integración opcional Workers AI con validación estructural y fallback, desactivada.
- [x] Validación de cuerpo, origen, URLs, timeout upstream y caché de una hora.
- [x] Límite básico de peticiones por isolate y configuración conservadora.
- [x] Configuración de despliegue como un único Cloudflare Worker con assets.
- [x] `AGENTS.md`, documentación y pruebas sin servicios externos.

### Registro de verificación

- Instalación: primer intento detectó incompatibilidad de peer dependency entre Wrangler actual y Workers Types v4; se actualizó el requisito a Workers Types v5 sin usar `--force`.
- Dependencias: actualizado Vitest a 5.1.2 para resolver avisos de seguridad; instalación y auditoría sin vulnerabilidades. `package-lock.json` generado.
- Pruebas automatizadas: **53/53 aprobadas**, 3 archivos. Incluye flujo live con upstream simulado y caché; no consume cuota externa.
- Compilación TypeScript / Vite: **aprobada** mediante `npm run check`. Build: JS 232.86 kB / 73.21 kB gzip, CSS 12.41 kB / 3.54 kB gzip (no son métricas de rendimiento de usuario).
- Prueba HTTP local: **aprobada**; health 200, demo 200, fuente demo, motor reglas, 3 señales. Assets servidos por Worker con CSP.
- Revisión en navegador: **aprobada para demo** a 1296 px y viewport móvil emulado en iframe de 390 × 844 px, sin overflow horizontal; resultado obtiene foco.
- Build servido directamente por Worker en 8787: demo funcional, CSS cargado y consola sin errores.
- Incidencia resuelta: el proxy de Vite originaba un 403. Se traduce Origin exclusivamente en el proxy local; producción mantiene validación estricta.
- Evidencia: `docs/VERIFICATION.md` y `docs/preview-desktop.jpeg`. Copia/descarga y accesibilidad completa siguen pendientes de revisión manual.
- YouTube real: **verificada el 2026-11-25** con la clave configurada por el usuario en `.dev.vars`, sin exponerla. `/api/health` devuelve `live:true, ai:false`. Análisis de `@midudev` correcto: `source:youtube`, `engine:rules`, canal `midudev` y 20 evidencias públicas. Suscripciones no accesibles notificadas. Quedan por probar cuota agotada, clave inválida y canal sin contenido público.
- Workers AI real: **no ejecutado; desactivado por defecto**.
- Despliegue: **no realizado; requiere cuenta y autorización del usuario**.

### Preparación de GitHub — 2026-11-25

- Repositorio público creado por petición del usuario: https://github.com/Trefu/youtube-roast.
- Git inicializado en rama `main`; sin importar historial ajeno.
- Secretos y variantes `.dev.vars.*` excluidos; solo se publica la plantilla sin credenciales.
- Configurados Node 24 (`.nvmrc`), engines, lockfile, EditorConfig y finales de línea uniformes.
- CI sin secretos: `npm ci`, 53 pruebas, TypeScript, build y dry-run del Worker; no despliega la web.
- Actions fijadas a SHA; Dependabot mensual sin auto-merge.
- Producción separada en `env.production`, con live e IA desactivados. Desarrollo conserva live habilitado con la clave local del usuario.
- `npm run deploy:dry`: **aprobado**; Workers empaqueta correctamente assets y backend sin publicar ni cargar la clave local en producción.
- Auditoría de dependencias: **0 vulnerabilidades** al preparar esta subida.
- Se añade `SECURITY.md`; quedan pendientes los bloqueantes de lanzamiento de la sección Prioridad 0.

## Siguiente paso para el usuario

1. Ejecutar `npm run dev` y abrir `http://127.0.0.1:5173`.
2. Pulsar **Probar demo** y revisar presentación, evidencias y exportación.
3. Clave de YouTube ya configurada por el usuario en `.dev.vars`; no mostrarla ni enviarla al chat.
4. `ENABLE_LIVE=true` ya activado; IA sigue desactivada.
5. Canal público `@midudev` probado correctamente. Probar ahora el canal deseado y una cuenta con poca información.
6. Revisar los bloqueantes siguientes antes de publicar con modo live.

## Prioridad 0 — Antes de exponer live a tráfico abierto

- [ ] **Cuotas globales:** configurar cuotas de proveedor y/o un control de presupuesto consistente entre isolates. El contador en memoria NO es global; no garantiza que solo se hagan 20 análisis/día.
- [ ] Decidir protección antiabuso: binding de rate limit si está disponible en el plan, Turnstile u otro mecanismo. No introducir un servicio con coste obligatorio.
- [ ] Revisar precios/condiciones actuales de Workers, YouTube Data API y, solo si se activa, Workers AI. No contratar planes pagos.
- [ ] Ejecutar consulta real con clave válida y comprobar restricciones de API, número de llamadas, errores de cuota y canal sin datos.
- [ ] Revisar políticas de YouTube API, atribución y presentación del contenido de Google. Incorporar avisos/páginas necesarios antes de lanzamiento público.
- [ ] Publicar aviso de privacidad que identifique responsable, proveedores, caché y tratamiento técnico. No afirmar “cero datos personales”: canal e IP pueden serlo.

## Prioridad 1 — Mejoras de producto

- [ ] Mejorar variedad del motor de reglas. Actualmente las intensidades cambian la apertura, no todos los chistes.
- [ ] Si se quiere IA real: activar binding solo con consentimiento, evaluar español, latencia, moderación, prompt injection y consumo gratuito real. La validación JSON no garantiza seguridad semántica.
- [ ] Agrupar contenido por temática con recuentos verificables, en lugar de solo el primer título coincidente.
- [ ] Leer elementos de 1–2 playlists públicas como opción acotada. Hoy se analizan títulos, no contenido.
- [ ] Exportación de tarjeta PNG. Por ahora solo texto; no presentarlo como imagen compartible.
- [ ] Añadir borrado/invalidación de caché y probar sensibilidad a cambios de fuente.
- [ ] Distinguir en UI fallo parcial, datos privados y ausencia real de suscripciones cuando el API lo permita.
- [ ] Avisar si una caída del servicio de IA provoca fallback a reglas, además de su etiqueta actual.
- [ ] Evitar consultas duplicadas simultáneas y normalizar mejor alias/handles en la caché.

## Prioridad 2 — Calidad y portfolio

- [ ] Suite E2E de Playwright en repo (actualmente hay pruebas unitarias/contrato, no E2E persistentes).
- [ ] Pruebas en entorno Workers para caché y headers de producción.
- [ ] Lighthouse/accesibilidad con teclado y lector de pantalla; comprobar contraste y foco.
- [ ] Autoalojar fuentes o usar solo las del sistema para eliminar Google Fonts.
- [x] CI de GitHub Actions configurada: pruebas, build y dry-run sin secretos ni despliegue; permisos mínimos, concurrencia y timeout de 10 minutos. Actions fijadas a SHA.
- [x] Auditoría inicial y actualización con pruebas, sin `npm audit fix --force`. Repetir antes de publicar.
- [ ] Capturas finales desktop/móvil y video de 60–90 s.
- [ ] README con URL pública y métricas medidas. No inventar rendimiento ni usuarios.

## Prueba manual de aceptación

| Caso | Esperado |
|---|---|
| Demo sin clave | Resultado visible, etiqueta ficticia, motor reglas |
| Live sin clave/interruptor apagado | Error claro; nunca datos falsos |
| Canal público válido | Nombre y fuentes reales; enlaces de evidencia correctos |
| Canal sin material | Información insuficiente; no inventar gustos |
| URL de video, dominio falso, `/c/` | Error de entrada comprensible |
| Clave inválida / cuota agotada | Error sin filtrar secretos |
| YouTube tarda >8 s | Timeout manejado |
| Solicitud tarda >30 s | UI desbloqueada y error de timeout |
| IA apagada/fallida | Motor reglas identificado |
| Título con instrucciones o HTML | Texto escapado; no ejecución ni obediencia |
| Copiar/descargar | Informe con fuente, motor y advertencias |
| 390 px / 1440 px | Sin scroll horizontal; botones utilizables |
| Teclado | Labels, radios, foco de resultado y errores accesibles |
| Caché real | TTL 1 h; etiqueta cached; no IP/clave en resultado |

## Para retomar en otro chat

Puedes pedir:

> Abre `D:\Users\Trefu\Documents\Repos\youtube-roast`, lee `AGENTS.md` y `PLAN.md`, ejecuta `npm run check` y analiza el resultado terminado. Distingue lo verificado localmente de YouTube/IA/despliegue pendientes. No actives servicios de pago ni publiques sin preguntarme.
