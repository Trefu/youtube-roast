import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Analysis, Health, Intensity } from './shared';
import './styles.css';

function App() {
  const [channel, setChannel] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('medio');
  const [health, setHealth] = useState<Health | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(data => {
      const value = data as Health;
      if (typeof value.live === 'boolean' && typeof value.ai === 'boolean') setHealth(value);
    }).catch(() => {});
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  async function analyze(demo: boolean) {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setResult(null);
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, intensity, demo }),
        signal: controller.signal,
      });
      const data = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo analizar el canal.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError' ? 'La consulta tardó demasiado. Inténtalo más tarde.' : e instanceof Error ? e.message : 'No hay conexión con el servidor.');
    } finally { clearTimeout(timer); setBusy(false); }
  }

  function reportText(r: Analysis) {
    return `ROASTTUBE — ${r.channel.title}\n${r.source === 'demo' ? 'DEMO FICTICIA' : 'DATOS PÚBLICOS DE YOUTUBE'} · ${r.engine === 'ai' ? 'IA' : 'Motor de reglas'}\n\n${r.roast.headline}\n\n${r.roast.text}\n\n${r.roast.signals.map(s => `${s.label}: ${s.joke}\nEvidencia: ${s.evidence}`).join('\n\n')}\n\nTu misión: ${r.roast.challenge}\n\nHumor, no una evaluación psicológica. No se accede a tu historial privado.\n${r.channel.warnings.join('\n')}`;
  }
  async function copy() {
    if (!result) return;
    try { await navigator.clipboard.writeText(reportText(result)); setNotice('Roast copiado. Comparte con responsabilidad.'); }
    catch { setNotice('No se pudo copiar. Puedes descargar el informe.'); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([reportText(result)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'mi-roast.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="/" aria-label="RoastTube, inicio"><span className="brand-mark">▶</span> roast<span>tube</span><span className="beta">BETA</span></a>
        <a className="nav-link" href="#como-funciona">¿Cómo funciona? <span aria-hidden="true">↗</span></a>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="dot" /> DATOS PÚBLICOS. DAÑO EMOCIONAL FICTICIO.</div>
            <h1 id="hero-title">Tu algoritmo<br />tiene mucho<br />que <span className="highlight">explicar.<svg viewBox="0 0 400 20" aria-hidden="true"><path d="M4 12 Q160 -4 396 9 M30 18 Q240 7 370 16" /></svg></span></h1>
            <p className="intro">Pega tu canal de YouTube. Nosotros ponemos las evidencias y un poquito de mala leche.</p>
            <div className="hero-notes"><span>↗ Sin login</span><span>◇ Sin historial privado</span><span>€ Sin pagos</span></div>
          </div>
          <aside className="sample" aria-label="Ejemplo ficticio de roast">
            <div className="sample-top"><span className="tiny">EXPEDIENTE #0001</span><span className="pill">DEMO FICTICIA</span></div>
            <div className="avatar" aria-hidden="true">:')</div>
            <div className="sample-name">@mañana_empiezo</div>
            <h2>Senior en ver<br />tutoriales.</h2>
            <p>Tu stack principal es YouTube + «mañana empiezo». El deploy sigue en desarrollo personal.</p>
            <div className="sample-bottom"><span>PRUEBA APORTADA</span><span>«React en 24 horas»</span></div>
            <div className="sticker" aria-hidden="true">100%<br /><small>sin piedad*</small></div>
          </aside>
        </section>

        <section className="lab" aria-labelledby="lab-title">
          <div className="lab-heading"><h2 id="lab-title"><span>01 /</span> Presenta las pruebas</h2><span className={`status ${health?.live ? 'online' : ''}`}><span className="dot" />{health === null ? 'COMPROBANDO SERVIDOR' : health.live ? 'ANÁLISIS EN VIVO ACTIVO' : 'DEMO DISPONIBLE · LIVE SIN CONFIGURAR'}</span></div>
          <form onSubmit={e => { e.preventDefault(); void analyze(false); }}>
            <label htmlFor="channel">Enlace de tu canal o @usuario</label>
            <div className="input-row"><span className="input-icon" aria-hidden="true">↗</span><input id="channel" name="channel" autoComplete="off" placeholder="youtube.com/@tu_canal" maxLength={200} value={channel} onChange={e => setChannel(e.target.value)} required disabled={busy} aria-describedby="channel-help" /><button className="primary" type="submit" disabled={busy || !channel.trim()}>{busy ? 'Investigando…' : 'Roastear mi canal'} <span aria-hidden="true">↗</span></button></div>
            <p id="channel-help" className="help">Solo contenido público. No podemos ver lo que miras en privado. Si el canal no expone datos, te lo diremos.</p>
            <div className="form-bottom">
              <fieldset disabled={busy}><legend>Nivel de picante</legend><div className="levels">{(['suave', 'medio', 'fuerte'] as const).map((level, i) => <label className={`level ${intensity === level ? 'selected' : ''}`} key={level}><input type="radio" name="intensity" value={level} checked={intensity === level} onChange={() => setIntensity(level)} /><span>{['·', '✳', '✳✳'][i]} {level}</span></label>)}</div></fieldset>
              <button type="button" className="demo-button" disabled={busy} onClick={() => void analyze(true)}>Solo estoy mirando. Probar demo <span aria-hidden="true">→</span></button>
            </div>
          </form>
          {busy && <div className="loading" role="status"><span className="spinner" />Revisando las pruebas. Sin inventarnos tu historial…</div>}
          {error && <div className="error" role="alert">{error}</div>}
        </section>

        {result && <section className="result" ref={resultRef} tabIndex={-1} aria-labelledby="result-title">
          <div className="result-meta"><span className="eyebrow">02 / EL VEREDICTO</span><span className="pill">{result.source === 'demo' ? 'DATOS FICTICIOS' : 'DATOS REALES DE YOUTUBE'} · {result.engine === 'ai' ? 'IA' : 'REGLAS, NO IA'}</span></div>
          <p className="channel-name">{result.channel.title} <span>· {result.channel.videoCount} videos publicados{result.channel.subscribers !== null ? ` · ${new Intl.NumberFormat('es', { notation: 'compact' }).format(result.channel.subscribers)} suscriptores` : ''}</span></p>
          <h2 id="result-title">{result.roast.headline}</h2>
          <p className="verdict">{result.roast.text}</p>
          <div className="signals">{result.roast.signals.map((s, i) => <article key={i}><span className="signal-index">PRUEBA 0{i + 1}</span><h3>{s.label}</h3><p>{s.joke}</p><blockquote>«{s.evidence}»</blockquote></article>)}</div>
          <div className="challenge"><span aria-hidden="true">↗</span><div><strong>Tu arco de redención</strong><p>{result.roast.challenge}</p></div></div>
          <details><summary>Ver fuentes y límites del análisis ({result.channel.evidence.length} elementos)</summary><ul className="warnings">{result.channel.warnings.map(w => <li key={w}>{w}</li>)}</ul><ul className="sources">{result.channel.evidence.map((e, i) => <li key={i}><span>{({ video: 'Video', playlist: 'Playlist', subscription: 'Suscripción' })[e.kind]}</span>{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title} ↗</a> : e.title}</li>)}</ul></details>
          <div className="result-actions"><button onClick={() => void copy()}>Copiar roast ↗</button><button onClick={download}>Descargar .txt ↓</button><span>{result.cached ? 'Resultado en caché · ' : ''}{new Date(result.generatedAt).toLocaleString('es')}</span></div>
          <p role="status" className="help">{notice}</p>
        </section>}

        <section className="explainer" id="como-funciona" aria-labelledby="how-title">
          <div className="section-label">EL MÉTODO, SIN HUMO</div><h2 id="how-title">No somos adivinos.<br />Solo sabemos leer las pistas.</h2>
          <div className="steps"><article><span>01</span><h3>Tú traes el canal</h3><p>Un enlace público. Sin contraseñas, permisos invasivos ni acceso a tu cuenta.</p></article><article><span>02</span><h3>Miramos lo visible</h3><p>Títulos de videos, playlists y suscripciones accesibles. Una muestra, no tu vida entera.</p></article><article><span>03</span><h3>Humor con recibos</h3><p>Cada broma tiene una pista. Puedes revisar las fuentes y comprobar qué hemos usado.</p></article></div>
        </section>
        <section className="privacy"><span aria-hidden="true">◇</span><p><strong>Tu historial no está en venta. Ni a nuestro alcance.</strong><br />No leemos historial ni likes privados. Los análisis reales pueden quedar en caché una hora. Con IA se envían títulos públicos a Cloudflare. La protección guarda contadores y un identificador derivado de tu IP con sal diaria, con borrado programado al siguiente día UTC. Máximo 3 intentos por conexión al día, uno por minuto y 20 globales diarios, incluidos fallos y caché. Sin analítica. No pegues secretos.</p></section>
      </main>
      <footer><a className="brand" href="/">roast<span>tube</span></a><p>Hecho para echar unas risas, no para diagnosticarte.</p><span>*Con límites. Siempre.</span></footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
