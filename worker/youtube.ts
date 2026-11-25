import type { ChannelData, Evidence } from '../src/shared';
import { AppError, parseChannel } from './core';

type Row = {
  id?: string;
  snippet?: {
    title?: string; description?: string;
    resourceId?: { videoId?: string; channelId?: string };
  };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
interface YoutubeResponse { items?: Row[]; error?: { errors?: { reason?: string }[] } }

export async function fetchChannel(input: string, key: string, fetcher: typeof fetch = fetch): Promise<ChannelData> {
  const parsed = parseChannel(input);
  async function api(endpoint: string, params: Record<string, string>, optional = false): Promise<Row[]> {
    // Endpoint y host fijos: el enlace proporcionado nunca se visita directamente.
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, v));
    let response: Response;
    try { response = await fetcher(url, { signal: AbortSignal.timeout(8000) }); }
    catch { throw new AppError(504, 'YouTube no respondió a tiempo. Vuelve a intentarlo más tarde.'); }
    const data = await response.json() as YoutubeResponse;
    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new AppError(503, 'Se agotó la cuota de YouTube. No se harán consultas adicionales.');
      if (optional && (response.status === 403 || response.status === 404) && ['subscriptionForbidden', 'playlistNotFound', 'playlistItemsNotAccessible', 'forbidden'].includes(reason ?? '')) return [];
      throw new AppError(502, 'No se pudo consultar YouTube. Puede haber una restricción de acceso o un problema con la clave del servidor.');
    }
    return data.items ?? [];
  }
  const selector: Record<string, string> = parsed.type === 'id' ? { id: parsed.value } : parsed.type === 'handle' ? { forHandle: parsed.value } : { forUsername: parsed.value };
  const [channel] = await api('channels', { part: 'snippet,statistics,contentDetails', ...selector });
  if (!channel?.id) throw new AppError(404, 'No encontré ese canal. Comprueba el @usuario.');
  const id = channel.id;
  const warnings: string[] = [];
  const evidence: Evidence[] = [];
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  const [videos, playlists, subscriptions] = await Promise.all([
    uploads ? api('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '12' }, true) : Promise.resolve([]),
    api('playlists', { part: 'snippet', channelId: id, maxResults: '8' }, true),
    api('subscriptions', { part: 'snippet', channelId: id, maxResults: '12' }, true),
  ]);
  for (const v of videos) {
    const vid = v.snippet?.resourceId?.videoId;
    if (vid && /^[\w-]{11}$/.test(vid) && v.snippet?.title && !['Private video', 'Deleted video'].includes(v.snippet.title)) evidence.push({ kind: 'video', title: v.snippet.title.slice(0, 300), url: `https://www.youtube.com/watch?v=${vid}` });
  }
  for (const p of playlists) if (p.id && /^[\w-]+$/.test(p.id) && p.snippet?.title) evidence.push({ kind: 'playlist', title: p.snippet.title.slice(0, 300), url: `https://www.youtube.com/playlist?list=${p.id}` });
  for (const s of subscriptions) {
    const cid = s.snippet?.resourceId?.channelId;
    if (cid && /^UC[\w-]{22}$/.test(cid) && s.snippet?.title) evidence.push({ kind: 'subscription', title: s.snippet.title.slice(0, 300), url: `https://www.youtube.com/channel/${cid}` });
  }
  if (!subscriptions.length) warnings.push('No se encontraron suscripciones públicas accesibles. Pueden estar ocultas o no existir.');
  if (!evidence.length) warnings.push('El canal no expone suficiente contenido público. No se puede deducir su historial.');
  warnings.push('Muestra limitada: hasta 12 videos publicados, 8 títulos de playlists y 12 suscripciones. No se lee el contenido de las playlists ni el historial privado.');
  return {
    id,
    title: channel.snippet?.title?.slice(0, 150) ?? 'Canal de YouTube',
    description: channel.snippet?.description?.slice(0, 500) ?? '',
    subscribers: channel.statistics?.hiddenSubscriberCount || channel.statistics?.subscriberCount === undefined ? null : Number(channel.statistics.subscriberCount),
    videoCount: Number(channel.statistics?.videoCount ?? 0),
    evidence, warnings,
  };
}
