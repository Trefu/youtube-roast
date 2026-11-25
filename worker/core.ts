import type { ChannelData, Intensity, Roast } from '../src/shared';

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parseChannel(input: unknown): { type: 'id' | 'handle' | 'username'; value: string } {
  if (typeof input !== 'string' || input.length > 200) throw new AppError(400, 'Pega un enlace de canal o un @usuario válido.');
  const text = input.trim();
  if (/^UC[\w-]{22}$/.test(text)) return { type: 'id', value: text };
  if (/^@[\p{L}\p{N}_.·-]{3,30}$/u.test(text)) return { type: 'handle', value: text };
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
  catch { throw new AppError(400, 'Ese enlace no parece un canal de YouTube.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) || url.username || url.password || url.port) {
    throw new AppError(400, 'Usa un enlace de youtube.com/@usuario o youtube.com/channel/UC…');
  }
  let parts: string[];
  try { parts = url.pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p)); }
  catch { throw new AppError(400, 'El enlace contiene caracteres inválidos.'); }
  if (/^@[\p{L}\p{N}_.·-]{3,30}$/u.test(parts[0] ?? '') && parts.length <= 2 && (!parts[1] || ['videos', 'shorts', 'streams', 'playlists', 'featured', 'about'].includes(parts[1]))) return { type: 'handle', value: parts[0] };
  if (parts[0] === 'channel' && /^UC[\w-]{22}$/.test(parts[1] ?? '') && parts.length === 2) return { type: 'id', value: parts[1] };
  if (parts[0] === 'user' && /^[\w-]{1,50}$/.test(parts[1] ?? '') && parts.length === 2) return { type: 'username', value: parts[1] };
  throw new AppError(400, 'Necesito un canal, no un video. Usa su enlace /@usuario. Los enlaces antiguos /c/ no están soportados.');
}

export function parseIntensity(value: unknown): Intensity {
  if (value === 'suave' || value === 'medio' || value === 'fuerte') return value;
  throw new AppError(400, 'Elige intensidad suave, media o fuerte.');
}

const themes = [
  { label: 'Tutoriales sin fin', pattern: /program|coding|rust|javascript|python|react|tutorial|curso|stack|developer|código|code/i, joke: 'Tu stack tiene más temporadas que una serie. El botón de «publicar proyecto» sigue esperando su cameo.', challenge: 'Termina y publica una función pequeña antes de abrir otro tutorial.' },
  { label: 'Productividad performática', pattern: /productiv|habit|rutina|routine|notion|procrast|organiza|morning|focus/i, joke: 'Has optimizado tanto tu rutina que ya no te queda tiempo para hacer lo que organizaste.', challenge: 'Haz una tarea de veinte minutos sin instalar una herramienta para planificarla.' },
  { label: 'El setup primero', pattern: /setup|teclado|keyboard|desk|monitor|pc gamer|unboxing|review|gpu|rtx/i, joke: 'Tu escritorio tiene especificaciones de la NASA y una misión principal: abrir otra pestaña.', challenge: 'Crea algo con el equipo que ya tienes. El teclado no necesita otra actualización.' },
  { label: 'Una partida más', pattern: /gaming|gameplay|minecraft|fortnite|elden|valorant|speedrun|videojuego|gamer/i, joke: 'Lo de «una partida más» ya parece un contrato de renovación automática.', challenge: 'Convierte una idea de ese juego en algo propio: un dibujo, un mapa o un mini prototipo.' },
  { label: 'Modo gurú', pattern: /crypto|bitcoin|trading|finanz|millon|million|dinero|negocio|stock|invest/i, joke: 'Tu lista de reproducción diversifica más que tu cartera: un gurú distinto por cada pestaña.', challenge: 'Contrasta una afirmación del próximo video con una fuente primaria.' },
  { label: 'Banda sonora vital', pattern: /music|música|lofi|playlist|song|album|álbum|mix|beats|canción/i, joke: 'Tienes banda sonora para cada estado de ánimo, incluso para elegir la siguiente banda sonora.', challenge: 'Escucha un disco completo sin saltar de canción ni mirar otra pantalla.' },
];

export function makeRoast(channel: ChannelData, intensity: Intensity): Roast {
  const evidence = channel.evidence;
  const matches = themes.flatMap(theme => {
    const item = evidence.find(e => theme.pattern.test(e.title));
    return item ? [{ ...theme, evidence: item.title }] : [];
  }).slice(0, 3);
  const signals = matches.map(({ label, joke, evidence }) => ({ label, joke, evidence }));
  if (!signals.length && evidence.length) signals.push({
    label: 'Curador profesional',
    joke: 'Tu canal tiene una línea editorial tan misteriosa que hasta el algoritmo pide contexto.',
    evidence: evidence[0].title,
  });
  const opening = {
    suave: 'Vamos con cariño: tu escaparate público tiene una personalidad bastante reconocible.',
    medio: 'Tu canal no necesitaba una auditoría, pero ya que dejaste la puerta abierta…',
    fuerte: 'Trajiste un enlace a tu canal como defensa y acabas de presentarlo como prueba en tu contra.',
  }[intensity];
  return {
    headline: matches[0] ? `Especialista en ${matches[0].label.toLowerCase()}` : evidence.length ? 'Mucho misterio, poca coartada' : 'Modo incógnito: casi impecable',
    text: evidence.length
      ? `${opening} ${signals.map(s => s.joke).join(' ')} Esto describe lo que publicas o expones, no lo que miras en privado.`
      : 'No hay suficiente contenido público para un roast con fundamento. Tu mejor estrategia defensiva ha sido no dejar pruebas. No voy a inventar lo que ves.',
    signals,
    challenge: matches[0]?.challenge ?? 'Comparte una playlist pública que te represente y vuelve a intentarlo.',
  };
}

export const demoChannel: ChannelData = {
  id: 'demo',
  title: 'El eterno «mañana empiezo»',
  description: 'Perfil ficticio para demostrar la experiencia. No corresponde a una cuenta real.',
  subscribers: null,
  videoCount: 3,
  evidence: [
    { kind: 'video', title: 'Aprende React en 24 horas (esta vez sí)', url: '' },
    { kind: 'playlist', title: 'Mi sistema de productividad definitivo, versión 17', url: '' },
    { kind: 'video', title: 'Setup tour: un teclado más y empiezo el proyecto', url: '' },
  ],
  warnings: ['Datos ficticios: esta demo no ha consultado YouTube.'],
};

export function validateAiRoast(value: unknown, channel: ChannelData): Roast | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const validText = (s: unknown, max: number): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  if (!validText(r.headline, 100) || !validText(r.text, 1600) || !validText(r.challenge, 300) || !Array.isArray(r.signals) || r.signals.length < 1 || r.signals.length > 3) return null;
  const titles = new Set(channel.evidence.map(e => e.title));
  for (const s of r.signals) {
    if (!s || typeof s !== 'object' || !validText(s.label, 100) || !validText(s.joke, 400) || !validText(s.evidence, 300) || !titles.has(s.evidence)) return null;
  }
  return r as unknown as Roast;
}
