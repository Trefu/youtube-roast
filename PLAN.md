# Plan y traspaso — RoastTube

## Estado de la implementación

### Roasts más específicos y directos — 2026-11-25

- Usuario pide humor menos genérico y más personal. Se dirige al creador y su personaje editorial público, nunca a vida privada, salud, atributos sensibles ni supuestos hábitos de consumo.
- Nuevo `worker/prompt.ts`: tono por intensidad en instrucciones de sistema, técnica de remate con ejemplos ficticios, golpes anclados a promesas/títulos y prohibición explícita de inferir que quien enseña está aprendiendo. Tipos de evidencia separados: una suscripción no acredita autoría.
- IA conserva datos no confiables separados, JSON Schema y fallback etiquetado. Validación rechaza tarjetas con evidencia o chiste repetidos; número máximo de señales ajustado al material disponible. 900 tokens de salida como máximo; misma cantidad de llamadas y timeout.
- Reglas: seis temas con tres versiones de cada golpe, cita acotada del título y sin reutilizar la misma fuente para temas distintos. No atribuye publicaciones de suscripciones al canal.
- Caché pasa a v5 para no servir roasts antiguos. No se modifican secretos, límites ni excepción IPv4/IPv6.
- Baseline: 72 pruebas/build aprobados; trabajo local existente preservado. `npm run check` tras cambios: 81 pruebas y build aprobados.
- Evaluación remota acotada a 4 inferencias con títulos FICTICIOS, sin Google ni canales reales (3 intensidades y una muestra adicional tras ajustar instrucciones). Todas devuelven `engine:ai` y JSON válido. Se observaron generalizaciones y recursos retóricos pese a instrucciones; se reforzaron ejemplos y límites. No afirmar que la estructura garantiza buen humor o moderación: requiere feedback del usuario y evaluación semántica más amplia. Son diagnósticos separados del presupuesto de la web, sin resetearlo.
- Desplegado en producción, versión `75b1d988-bfe3-46bb-857c-3982a71f9515`; 81 pruebas/build aprobados, `git diff --check` correcto y health remoto `live:true, ai:true`. Pendiente evaluación del usuario con su canal. Sin commit ni push.

### Excepción personal por IP — 2026-11-25

- Corrección IPv6: el usuario aporta Cloudflare trace y confirma que su navegador sale por IPv6, no por la IPv4 inicialmente indicada. `OWNER_IP` admite ahora varias direcciones exactas separadas por comas para conservar ambas; sin excepciones por subred. Prueba añadida para IPv4+IPv6 y rechazo de otra dirección en la misma red. Baseline: 71 pruebas aprobadas. Secreto actualizado y despliegue completado con 72 pruebas y build aprobados; versión `0b09bae4-cf7f-46b3-94f7-4cfe495ad3e0`. Pendiente confirmación positiva del usuario desde su navegador, cuya salida de red es distinta de la del agente.

- Usuario autoriza una IP concreta para eliminar su bloqueo personal. Se mantiene el límite global de 20 intentos diarios y todos los contadores existentes, sin resetearlos.
- `OWNER_IP` opcional en secretos de producción; coincidencia exacta con IP verificada por Cloudflare, no con campos enviados por el cliente. Se omiten solo el límite de 3/día y la espera de un minuto para esa IP.
- La excepción no es autenticación: afecta a quienes compartan la IP y debe actualizarse si cambia. La IP no se incluye en código, documentación, frontend ni logs.
- Estado inicial: 68 pruebas y build aprobados; cambios locales previos de esta sesión preservados.
- Añadidas pruebas de excepción tras bloqueo, no reinicio del contador, límite global concurrente y coincidencia exacta. `npm run check` y `npm run deploy` aprobados: 71 pruebas, TypeScript y Vite.
- Secreto `OWNER_IP` configurado y despliegue completado, versión `82db2379-a48e-4556-9270-a3e2bc1f3bd3`. Sin cambios de planes, resets de contador, commits ni push.
- Comprobación remota desde la conexión del agente sigue devolviendo 429; comprobado por Cloudflare trace que su IP de salida NO coincide con la IP autorizada por el usuario. Esto confirma que la excepción no abre acceso a esa otra conexión, pero la prueba positiva desde la IP permitida requiere al usuario. No se falsifican cabeceras para simularla.

### Activación pública y protección — 2026-11-25

- Usuario solicita protección antiabuso y activar YouTube real con IA en la web publicada.
- Estado inicial: `git status --short` limpio; `npm run check` aprobado, 53 pruebas.
- Añadido `AnalysisBudget`: contador persistente en un único Durable Object SQLite, 20 reservas globales/día UTC, 3 por IP/día y una/minuto; transacción atómica y fallo cerrado antes de caché/Google/IA. Fallos y caché también consumen reserva. Máximo 80 llamadas list y 20 solicitudes de IA por día UTC a través de este flujo; no es un límite global de facturación de cuenta.
- Solo contadores e identificadores de IP con sal diaria; alarma elimina estado antiguo. No se guardan canales ni IP en claro. Esta persistencia técnica sustituye el antiguo contador por isolate en producción; no es una base de datos de perfiles.
- Producción configura binding SQLite y Workers AI, live/IA activados; desarrollo no cambia. Aviso visible y README actualizados; fallback a reglas ahora incluye advertencia explícita.
- `npm run deploy:dry`: aprobado con 66 pruebas, TypeScript, Vite y empaquetado de bindings.
- Cloudflare autenticado. Consulta de suscripciones no devuelve suscripciones de pago; no se cambia ningún plan. Documentación oficial consultada: Durable Objects SQLite y Workers AI disponibles en Free; el exceso de cuotas gratuitas falla.
- Secreto YouTube subido a producción desde `.dev.vars` sin mostrarlo, por autorización del usuario para activar live.
- Publicación inicial y comprobación HTTP: health 200 con live/IA configurados; YouTube real `@midudev` devuelve 20 evidencias, fuente `youtube`; segunda petición inmediata devuelve 429. Se consumieron 3 reservas de producción desde esta conexión, sin resetear contadores.
- Incidencia encontrada: modelo anterior rechazado por el binding con código 5028 (retirado), aunque REST lo redirigía y respondía. Cambiado a `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, vigente y compatible con JSON Mode.
- Añadido esquema JSON requerido, manejo de JSON objeto/texto y formato chat-completions; se mantiene validación propia de evidencias y límites. Fallback no se cachea para evitar fijar una caída temporal durante una hora.
- IA real verificada en diagnóstico local aislado con binding remoto de Cloudflare y títulos ficticios explícitos: `engine:ai`, español, 3 evidencias exactas y challenge; no se presenta como un análisis YouTube real. Diagnóstico eliminado y servidor detenido. Las llamadas diagnósticas a proveedores no pasan por el presupuesto de la web.
- Pruebas finales: 68 aprobadas, TypeScript/Vite correctos. Pendiente confirmar en la web pública un resultado `engine:ai` después del despliegue final: esta conexión ya agotó sus 3 reservas diarias. No se elude el límite para probarlo.
- Despliegue final completado en `https://youtube-roast.trefu-roast.workers.dev`, versión `76b801c0-6b3f-4e21-9a64-0cb4d51ad234`. Health remoto 200 `live:true, ai:true`; comprobación posterior confirma 429 persistente tras redespliegue. `git diff --check` correcto. Cambios locales sin commit ni push.
- Los registros históricos de abajo describen el estado anterior. Siguen pendientes evaluación amplia de moderación/prompt injection, políticas YouTube y aviso legal completo con responsable; el aviso visible de tratamiento técnico no sustituye esa revisión.

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
- Primera subida confirmada en `main` (commit inicial `c06b59d`); GitHub Actions inició las comprobaciones. El resultado remoto de CI se consulta en la pestaña Actions; no confundir inicio con aprobación.
- Git inicializado en rama `main`; sin importar historial ajeno.
- Secretos y variantes `.dev.vars.*` excluidos; solo se publica la plantilla sin credenciales.
- Configurados Node 24 (`.nvmrc`), engines, lockfile, EditorConfig y finales de línea uniformes.
- CI sin secretos: `npm ci`, 53 pruebas, TypeScript, build y dry-run del Worker; no despliega la web.
- Actions fijadas a SHA; Dependabot mensual sin auto-merge.
- Producción separada en `env.production`, con live e IA desactivados. Desarrollo conserva live habilitado con la clave local del usuario.
- `npm run deploy:dry`: **aprobado**; Workers empaqueta correctamente assets y backend sin publicar ni cargar la clave local en producción.
- Auditoría de dependencias: **0 vulnerabilidades** al preparar esta subida.
- Se añade `SECURITY.md`; quedan pendientes los bloqueantes de lanzamiento de la sección Prioridad 0.
- Activados avisos de vulnerabilidades y reporte privado de seguridad en GitHub.
- Código subido a GitHub; **la web aún no está desplegada en internet**.

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

- [x] Primera mejora de variedad del motor de reglas: las intensidades cambian todos los golpes temáticos y se cita el título correspondiente. La calidad humorística sigue abierta a evaluación.
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
