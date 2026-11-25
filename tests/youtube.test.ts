import { describe, expect, it, vi } from 'vitest';
import { fetchChannel } from '../worker/youtube';

const channelId = 'UC1234567890123456789012';
function fakeApi(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split('/').at(-1)!;
    const payload = {
      channels: { items: [{ id: channelId, snippet: { title: 'Canal de prueba', description: 'Descripción' }, statistics: { videoCount: '10', subscriberCount: '25' }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] },
      playlistItems: { items: [
        { snippet: { title: 'Curso de React', resourceId: { videoId: 'abcdefghijk' } } },
        { snippet: { title: 'Private video', resourceId: { videoId: '12345678901' } } },
      ] },
      playlists: { items: [{ id: 'PL123', snippet: { title: 'Productividad' } }] },
      subscriptions: { items: [{ snippet: { title: 'Canal amigo', resourceId: { channelId } } }] },
      ...overrides,
    }[endpoint];
    return Response.json(payload);
  });
}

describe('YouTube Data API', () => {
  it('consulta exclusivamente Google, recoge datos reales y acota a 4 peticiones', async () => {
    const api = fakeApi();
    const result = await fetchChannel('@ejemplo', 'test-secret', api as typeof fetch);
    expect(api).toHaveBeenCalledTimes(4);
    for (const [url] of api.mock.calls) expect(new URL(String(url)).hostname).toBe('www.googleapis.com');
    expect(result.title).toBe('Canal de prueba');
    expect(result.subscribers).toBe(25);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence[0].url).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });
  it('no interpreta ausencia de suscripciones como gustos privados', async () => {
    const result = await fetchChannel('@ejemplo', 'key', fakeApi({ subscriptions: { items: [] } }) as typeof fetch);
    expect(result.warnings.join(' ')).toContain('Pueden estar ocultas');
  });
  it('informa canal inexistente', async () => {
    await expect(fetchChannel('@ejemplo', 'key', fakeApi({ channels: { items: [] } }) as typeof fetch)).rejects.toMatchObject({ status: 404 });
  });
  it('no oculta errores de cuota', async () => {
    const api = vi.fn(async () => Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 }));
    await expect(fetchChannel('@ejemplo', 'key', api as typeof fetch)).rejects.toMatchObject({ status: 503 });
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('maneja timeouts sin exponer la clave', async () => {
    const api = vi.fn(async () => { throw new Error('fetch failed'); });
    await expect(fetchChannel('@ejemplo', 'secret', api as typeof fetch)).rejects.toMatchObject({ status: 504 });
  });
});
