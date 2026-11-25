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
  { label: 'Tutoriales sin fin', pattern: /program|coding|rust|javascript|python|react|tutorial|curso|stack|developer|código|code/i,
    jokes: {
      suave: 'Tu canal le ha puesto temario hasta al botón de empezar.',
      medio: 'Vendes el primer paso con tanta ceremonia que el segundo debería cobrar derechos de imagen.',
      fuerte: 'Has convertido un botón de «siguiente» en una línea editorial. Tu gran villano no es el código: es llegar al último capítulo.',
    }, challenge: 'Publica una entrega cuyo título no parezca la matrícula de otro curso.' },
  { label: 'Productividad performática', pattern: /productiv|habit|rutina|routine|notion|procrast|organiza|morning|focus/i,
    jokes: {
      suave: 'Hasta tu contenido sobre simplificar necesita un índice.',
      medio: 'Le has montado un departamento de comunicación a una lista de tareas.',
      fuerte: 'Lo tuyo es ponerle un tráiler de Netflix a una casilla por marcar. La tarea dura cinco minutos; su campaña de lanzamiento, tres temporadas.',
    }, challenge: 'Presenta una idea de productividad sin venderla como una nueva constitución.' },
  { label: 'El setup primero', pattern: /setup|teclado|keyboard|desk|monitor|pc gamer|unboxing|review|gpu|rtx/i,
    jokes: {
      suave: 'Tu escritorio ya tiene más presentación que una candidatura olímpica.',
      medio: 'En tu canal, el periférico tiene arco narrativo y el proyecto sale como extra.',
      fuerte: 'Has encontrado la forma de convertir una mesa en una saga. Al teclado solo le falta un representante para negociar el próximo unboxing.',
    }, challenge: 'Haz protagonista a lo que produces con el equipo, no a la caja en la que vino.' },
  { label: 'Una partida más', pattern: /gaming|gameplay|minecraft|fortnite|elden|valorant|speedrun|videojuego|gamer/i,
    jokes: {
      suave: 'Tu botón de nueva partida también sirve de calendario editorial.',
      medio: 'El videojuego pone el mundo, las reglas y los giros de guion; tú has tenido el detalle de ponerle título.',
      fuerte: 'Tu línea editorial viene tan preinstalada que el juego debería aparecer como director del canal.',
    }, challenge: 'Titula la próxima partida sin hacer que parezca el fin de la civilización.' },
  { label: 'Modo gurú', pattern: /crypto|bitcoin|trading|finanz|millon|million|dinero|negocio|stock|invest/i,
    jokes: {
      suave: 'A tus títulos financieros solo les falta sonar al abrir la bolsa.',
      medio: 'Tu canal empaqueta el dinero con tanta épica que leer el título ya parece una ronda de inversión.',
      fuerte: 'Le pones a una cifra el suspense de un secuestro. Hasta la calculadora pediría salir de tu departamento de marketing.',
    }, challenge: 'Publica un título financiero que informe antes de intentar desmayar al lector.' },
  { label: 'Banda sonora vital', pattern: /music|música|lofi|playlist|song|album|álbum|mix|beats|canción/i,
    jokes: {
      suave: 'En tu catálogo hasta el silencio acabaría teniendo una edición extendida.',
      medio: 'Has convertido elegir música en construirle un vestidor al botón de reproducir.',
      fuerte: 'Tu catálogo le ha puesto banda sonora al acto de buscar otra banda sonora. Un ascensor con plan de expansión.',
    }, challenge: 'Presenta una selección sin prometer que va a reorganizar la existencia de quien la escuche.' },
];

export function makeRoast(channel: ChannelData, intensity: Intensity): Roast {
  const evidence = channel.evidence;
  const used = new Set<string>();
  const matches = themes.flatMap(theme => {
    // Un título no constituye tres pruebas distintas. No inferir gustos por suscripciones.
    const item = evidence.find(e => e.kind !== 'subscription' && !used.has(e.title) && theme.pattern.test(e.title));
    if (item) used.add(item.title);
    return item ? [{ ...theme, evidence: item.title }] : [];
  }).slice(0, 3);
  const signals = matches.map(({ label, jokes, evidence }) => ({
    label,
    joke: `«${evidence.length > 80 ? `${evidence.slice(0, 77)}…` : evidence}»: ${jokes[intensity]}`,
    evidence,
  }));
  if (!signals.length && evidence.length) signals.push({
    label: 'Curador profesional',
    joke: 'Tu canal tiene una línea editorial tan misteriosa que hasta el algoritmo pide contexto.',
    evidence: evidence[0].title,
  });
  const opening = {
    suave: 'Tu escaparate público se ha ganado un comentario.',
    medio: 'Has traído tu propio material de acusación.',
    fuerte: 'No hacía falta buscarte las cosquillas: las has puesto en los títulos.',
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
  const usedEvidence = new Set<string>();
  const usedJokes = new Set<string>();
  for (const s of r.signals) {
    if (!s || typeof s !== 'object' || !validText(s.label, 100) || !validText(s.joke, 400) || !validText(s.evidence, 300) || !titles.has(s.evidence)) return null;
    if (usedEvidence.has(s.evidence) || usedJokes.has(s.joke.trim())) return null;
    usedEvidence.add(s.evidence);
    usedJokes.add(s.joke.trim());
  }
  return r as unknown as Roast;
}
