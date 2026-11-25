import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker';
import type { Analysis } from '../src/shared';

const env = { ASSETS: { fetch: vi.fn() } as unknown as Fetcher };
const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://roast.example/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

describe('contrato HTTP', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('informa modo demo sin clave', async () => {
    const response = await worker.fetch(new Request('https://roast.example/api/health'), env, ctx);
    expect(await response.json()).toEqual({ live: false, ai: false });
  });
  it('la demo es explícita y no necesita servicios externos', async () => {
    const response = await worker.fetch(request({ demo: true, intensity: 'medio' }), env, ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: 'demo', engine: 'rules', channel: { id: 'demo' } });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('nunca sustituye silenciosamente un canal real por datos de ejemplo', async () => {
    const response = await worker.fetch(request({ channel: '@ejemplo' }), env, ctx);
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
  });
  it('el interruptor live es obligatorio incluso con clave', async () => {
    const response = await worker.fetch(request({ channel: '@ejemplo' }), { ...env, YOUTUBE_API_KEY: 'secret' }, ctx);
    expect(response.status).toBe(503);
  });
  it('rechaza origen ajeno', async () => {
    const response = await worker.fetch(request({ demo: true }, { Origin: 'https://evil.test' }), env, ctx);
    expect(response.status).toBe(403);
  });
  it('acepta origen propio', async () => {
    const response = await worker.fetch(request({ demo: true }, { Origin: 'https://roast.example' }), env, ctx);
    expect(response.status).toBe(200);
  });
  it('limita el cuerpo sin depender de Content-Length', async () => {
    const response = await worker.fetch(request({ channel: 'x'.repeat(3000) }), env, ctx);
    expect(response.status).toBe(413);
  });
  it('rechaza JSON nulo', async () => {
    const response = await worker.fetch(request(null), env, ctx);
    expect(response.status).toBe(400);
  });
  it('rechaza JSON malformado', async () => {
    const response = await worker.fetch(new Request('https://roast.example/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }), env, ctx);
    expect(response.status).toBe(400);
  });
  it('rechaza tipo incorrecto', async () => {
    const response = await worker.fetch(request({}, { 'Content-Type': 'text/plain' }), env, ctx);
    expect(response.status).toBe(415);
  });
  it('no devuelve el SPA para rutas API desconocidas', async () => {
    const response = await worker.fetch(new Request('https://roast.example/api/nope'), env, ctx);
    expect(response.status).toBe(404);
  });
  it('rechaza GET sobre analyze', async () => {
    const response = await worker.fetch(new Request('https://roast.example/api/analyze'), env, ctx);
    expect(response.status).toBe(405);
  });
  it('el flujo live configurado entrega fuentes YouTube y motor real sin IA', async () => {
    const id = 'UC1234567890123456789012';
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      const endpoint = new URL(String(input)).pathname.split('/').at(-1);
      return Response.json(endpoint === 'channels'
        ? { items: [{ id, snippet: { title: 'Canal público' }, statistics: { videoCount: '1' }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] }
        : endpoint === 'playlistItems' ? { items: [{ snippet: { title: 'Curso React', resourceId: { videoId: 'abcdefghijk' } } }] }
        : { items: [] });
    });
    const put = vi.fn(async () => {});
    vi.stubGlobal('fetch', upstream);
    vi.stubGlobal('caches', { default: { match: async () => undefined, put } });
    const response = await worker.fetch(request({ channel: '@ejemplo' }), { ...env, YOUTUBE_API_KEY: 'test-secret', ENABLE_LIVE: 'true' }, ctx);
    const data = await response.json() as Analysis;
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ source: 'youtube', engine: 'rules', channel: { title: 'Canal público' } });
    expect(JSON.stringify(data)).not.toContain('test-secret');
    expect(upstream).toHaveBeenCalledTimes(4);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it('sirve un resultado cacheado sin consumir llamadas a Google', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    vi.stubGlobal('caches', { default: { match: async () => Response.json({ source: 'youtube', engine: 'rules' }) } });
    const response = await worker.fetch(request({ channel: '@ejemplo' }), { ...env, YOUTUBE_API_KEY: 'test-secret', ENABLE_LIVE: 'true' }, ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cached: true });
    expect(upstream).not.toHaveBeenCalled();
  });
  it('bloquea live sin protección antes de consultar Google o caché', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await worker.fetch(request({ channel: '@ejemplo' }), {
      ...env, ENABLE_LIVE: 'true', YOUTUBE_API_KEY: 'secret', REQUIRE_ABUSE_GUARD: 'true',
    }, ctx);
    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('un presupuesto agotado devuelve 429 y no llama a YouTube ni IA', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const run = vi.fn();
    const ANALYSIS_BUDGET = {
      idFromName: vi.fn(() => 'singleton'),
      get: () => ({ fetch: async () => Response.json({ error: 'Límite global diario alcanzado.' }, { status: 429 }) }),
    } as unknown as DurableObjectNamespace;
    const response = await worker.fetch(request({ channel: '@ejemplo' }, { 'CF-Connecting-IP': '192.0.2.1' }), {
      ...env, ENABLE_LIVE: 'true', YOUTUBE_API_KEY: 'secret', REQUIRE_ABUSE_GUARD: 'true',
      ENABLE_AI: 'true', AI: { run }, ANALYSIS_BUDGET,
    }, ctx);
    expect(response.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(ANALYSIS_BUDGET.idFromName).toHaveBeenCalledWith('global-analysis-budget-v1');
  });
  it.each(['text', 'object', 'choices', 'invalid'])('identifica IA o fallback explícito (formato=%s)', async format => {
    const put = vi.fn(async () => {});
    vi.stubGlobal('caches', { default: { match: async () => undefined, put } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const endpoint = new URL(String(input)).pathname.split('/').at(-1);
      return Response.json(endpoint === 'channels'
        ? { items: [{ id: 'UC1234567890123456789012', snippet: { title: 'Canal público' } }] }
        : endpoint === 'playlists' ? { items: [{ id: 'PL123', snippet: { title: 'Curso React' } }] } : { items: [] });
    }));
    const roast = {
      headline: 'Mucho React', text: 'Tu canal compila tutoriales.', challenge: 'Publica algo.',
      signals: [{ label: 'Tutoriales', joke: 'Otro curso más.', evidence: 'Curso React' }],
    };
    const valid = format !== 'invalid';
    const run = vi.fn(async () => format === 'choices'
      ? { choices: [{ message: { content: JSON.stringify(roast) } }] }
      : { response: format === 'object' ? roast : valid ? JSON.stringify(roast) : 'JSON inválido' });
    const ANALYSIS_BUDGET = {
      idFromName: () => 'singleton', get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
    } as unknown as DurableObjectNamespace;
    const response = await worker.fetch(request({ channel: '@ejemplo' }, { 'CF-Connecting-IP': '192.0.2.1' }), {
      ...env, ENABLE_LIVE: 'true', YOUTUBE_API_KEY: 'secret', ENABLE_AI: 'true', AI: { run },
      REQUIRE_ABUSE_GUARD: 'true', ANALYSIS_BUDGET,
    }, ctx);
    expect(response.status).toBe(200);
    const data = await response.json() as Analysis;
    expect(data).toMatchObject({ source: 'youtube', engine: valid ? 'ai' : 'rules' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      response_format: expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({ required: ['headline', 'text', 'signals', 'challenge'] }),
      }),
    }));
    expect(put).toHaveBeenCalledTimes(valid ? 1 : 0);
    expect(JSON.stringify(run.mock.calls)).not.toContain('secret');
    if (!valid) expect(data.channel.warnings.join(' ')).toContain('IA no disponible');
  });
});
