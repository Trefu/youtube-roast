import type { Analysis, ChannelData, Intensity } from '../src/shared';
import { AppError, demoChannel, makeRoast, parseChannel, parseIntensity, validateAiRoast } from './core';
import { fetchChannel } from './youtube';
import { reserveBudget } from './budget';
import { roastMessages } from './prompt';
export { AnalysisBudget } from './budget';

interface Env {
  ASSETS: Fetcher;
  YOUTUBE_API_KEY?: string;
  ENABLE_LIVE?: string;
  ENABLE_AI?: string;
  AI_MODEL?: string;
  DAILY_LIVE_LIMIT?: string;
  REQUIRE_ABUSE_GUARD?: string;
  ANALYSIS_BUDGET?: DurableObjectNamespace;
  AI?: { run(model: string, input: unknown): Promise<{
    response?: unknown;
    choices?: { message?: { content?: string } }[];
  }> };
}
// Defensa básica por isolate, NO un límite global de facturación.
// Mantener cuotas externas en los proveedores; ver PLAN.md antes de abrir tráfico.
const hits = new Map<string, { count: number; until: number }>();
let daily = { day: '', count: 0 };
function throttle(request: Request, env: Env) {
  const now = Date.now();
  for (const [key, v] of hits) if (v.until <= now) hits.delete(key);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const current = hits.get(ip) ?? { count: 0, until: now + 60_000 };
  if (current.count >= 5 || hits.size >= 5000) throw new AppError(429, 'Demasiados análisis. Espera un minuto.');
  current.count++;
  hits.set(ip, current);
  const day = new Date(now).toISOString().slice(0, 10);
  if (daily.day !== day) daily = { day, count: 0 };
  const configured = Number(env.DAILY_LIVE_LIMIT ?? 20);
  const limit = Number.isFinite(configured) ? Math.min(100, Math.max(0, configured)) : 20;
  if (daily.count >= limit) throw new AppError(429, 'Se alcanzó el límite de análisis de esta instancia. Prueba la demo.');
  daily.count++;
}
function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  });
}
const enabled = (env: Env) => env.ENABLE_LIVE === 'true' && !!env.YOUTUBE_API_KEY;

export async function generate(channel: ChannelData, intensity: Intensity, env: Env) {
  const fallback = { roast: makeRoast(channel, intensity), engine: 'rules' as const };
  if (env.ENABLE_AI !== 'true' || !env.AI || !channel.evidence.length) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      env.AI.run(env.AI_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        max_tokens: 900,
        temperature: 0.85,
        response_format: {
          type: 'json_schema',
          json_schema: {
            type: 'object',
            additionalProperties: false,
            required: ['headline', 'text', 'signals', 'challenge'],
            properties: {
              headline: { type: 'string', minLength: 1, maxLength: 100 },
              text: { type: 'string', minLength: 1, maxLength: 600 },
              challenge: { type: 'string', minLength: 1, maxLength: 300 },
              signals: {
                type: 'array', minItems: 1, maxItems: Math.min(3, new Set(channel.evidence.map(e => e.title)).size),
                items: {
                  type: 'object', additionalProperties: false,
                  required: ['label', 'joke', 'evidence'],
                  properties: {
                    label: { type: 'string', minLength: 1, maxLength: 100 },
                    joke: { type: 'string', minLength: 1, maxLength: 200 },
                    evidence: { type: 'string', enum: [...new Set(channel.evidence.map(e => e.title))] },
                  },
                },
              },
            },
          },
        },
        messages: roastMessages(channel, intensity),
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('AI timeout')), 15_000); }),
    ]);
    // Workers AI puede devolver JSON ya parseado o el formato chat-completions.
    const raw = response.response ?? response.choices?.[0]?.message?.content;
    const roast = validateAiRoast(typeof raw === 'string' ? JSON.parse(raw) : raw, channel);
    return roast ? { roast, engine: 'ai' as const } : fallback;
  } catch { return fallback; }
  finally { clearTimeout(timer); }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ live: enabled(env), ai: env.ENABLE_AI === 'true' && !!env.AI });
    if (url.pathname !== '/api/analyze') return json({ error: 'Ruta no encontrada.' }, 404);
    if (request.method !== 'POST') return json({ error: 'Usa POST para analizar.' }, 405);
    try {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new AppError(403, 'Origen no permitido.');
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new AppError(415, 'Envía JSON.');
      // Leer de forma acotada también si el cliente no envía Content-Length.
      const reader = request.body?.getReader();
      if (!reader) throw new AppError(400, 'Falta el cuerpo de la solicitud.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); throw new AppError(413, 'Solicitud demasiado grande.'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        body = parsed as Record<string, unknown>;
      } catch { throw new AppError(400, 'JSON inválido.'); }
      const intensity = parseIntensity(body.intensity ?? 'medio');
      if (body.demo === true) {
        const result: Analysis = { channel: demoChannel, roast: makeRoast(demoChannel, intensity), source: 'demo', engine: 'rules', intensity, generatedAt: new Date().toISOString() };
        return json(result);
      }
      const parsed = parseChannel(body.channel);
      if (!enabled(env)) throw new AppError(503, 'El análisis en vivo todavía no está configurado. Puedes probar la demo ficticia.');
      if (env.REQUIRE_ABUSE_GUARD === 'true') await reserveBudget(request, env.ANALYSIS_BUDGET);
      else throttle(request, env);
      const cache = (caches as unknown as { default?: Cache }).default;
      const cacheKey = new Request(`${url.origin}/_analysis-cache/v5/${encodeURIComponent(`${parsed.type}:${parsed.value}`)}/${intensity}/${env.ENABLE_AI === 'true' ? encodeURIComponent(env.AI_MODEL ?? 'ai') : 'rules'}`);
      const cached = await cache?.match(cacheKey);
      if (cached) return json({ ...await cached.json() as Analysis, cached: true });
      const channel = await fetchChannel(body.channel as string, env.YOUTUBE_API_KEY!);
      const generated = await generate(channel, intensity, env);
      if (env.ENABLE_AI === 'true' && generated.engine === 'rules' && channel.evidence.length) {
        channel.warnings.push('IA no disponible o respuesta no válida: este resultado usa el motor de reglas, no IA.');
      }
      const result: Analysis = { channel, ...generated, source: 'youtube', intensity, generatedAt: new Date().toISOString() };
      // No fijar durante una hora un fallback provocado por una caída temporal de IA.
      if (cache && !(env.ENABLE_AI === 'true' && generated.engine === 'rules' && channel.evidence.length)) {
        ctx.waitUntil(cache.put(cacheKey, Response.json(result, { headers: { 'Cache-Control': 'public, max-age=3600' } })));
      }
      return json(result);
    } catch (error) {
      if (error instanceof AppError) return json({ error: error.message }, error.status);
      // No registrar URLs de upstream: contienen la clave.
      return json({ error: 'No se pudo completar el análisis. Inténtalo más tarde.' }, 500);
    }
  },
};
