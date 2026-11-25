import { AppError } from './core';

interface Budget {
  day: string;
  count: number;
  salt: string;
  clients: Record<string, { count: number; last: number }>;
}

// Un único objeto por entorno. Solo persiste contadores, nunca canales ni IP en claro.
export class AnalysisBudget {
  constructor(private state: DurableObjectState, private env: { DAILY_LIVE_LIMIT?: string; OWNER_IP?: string }) {}

  async fetch(request: Request): Promise<Response> {
    const ip = request.headers.get('X-Client-IP');
    if (request.method !== 'POST' || !ip) return new Response(null, { status: 400 });
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    return this.state.storage.transaction(async storage => {
      let budget = await storage.get<Budget>('budget');
      if (!budget || budget.day !== day) {
        budget = { day, count: 0, salt: crypto.randomUUID(), clients: {} };
      }
      const configured = Number(this.env.DAILY_LIVE_LIMIT ?? 20);
      const limit = Number.isFinite(configured) ? Math.min(20, Math.max(0, Math.floor(configured))) : 20;
      if (budget.count >= limit) return Response.json({ error: 'Límite global diario alcanzado. Puedes probar la demo.' }, { status: 429 });
      // Excepción personal explícita: nunca exime del presupuesto global.
      // La IP procede de CF-Connecting-IP a través del Worker, no del cuerpo.
      const owner = this.env.OWNER_IP?.split(',').some(allowed => allowed.trim() === ip) ?? false;
      if (!owner) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${budget.salt}:${ip}`));
        const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        const client = budget.clients[key];
        if (client && (client.count >= 3 || now - client.last < 60_000)) {
          return Response.json({ error: 'Máximo 3 análisis diarios por conexión y uno por minuto. Puedes probar la demo.' }, { status: 429 });
        }
        budget.clients[key] = { count: (client?.count ?? 0) + 1, last: now };
      }
      budget.count++;
      await storage.put('budget', budget);
      await storage.setAlarm(Date.parse(`${day}T00:00:00Z`) + 86_400_000);
      return new Response(null, { status: 204 });
    });
  }

  async alarm(): Promise<void> {
    await this.state.storage.transaction(async storage => {
      const budget = await storage.get<Budget>('budget');
      // Una alarma retrasada nunca borra el presupuesto del nuevo día.
      if (budget && budget.day !== new Date().toISOString().slice(0, 10)) await storage.delete('budget');
    });
  }
}

export async function reserveBudget(request: Request, namespace?: DurableObjectNamespace): Promise<void> {
  if (!namespace) throw new AppError(503, 'La protección de análisis no está configurada. Prueba la demo.');
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new AppError(503, 'No se pudo verificar la conexión. Prueba la demo.');
  try {
    const response = await namespace.get(namespace.idFromName('global-analysis-budget-v1')).fetch('https://budget/reserve', {
      method: 'POST', headers: { 'X-Client-IP': ip },
    });
    if (response.status === 429) {
      const data = await response.json() as { error: string };
      throw new AppError(429, data.error);
    }
    if (response.status !== 204) throw new Error('Budget unavailable');
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Fallo cerrado: jamás llamar a Google/IA si no se pudo reservar presupuesto.
    throw new AppError(503, 'Protección temporalmente no disponible. Puedes probar la demo.');
  }
}
