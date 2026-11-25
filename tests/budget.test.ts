import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisBudget, reserveBudget } from '../worker/budget';

function storageMock() {
  const values = new Map<string, unknown>();
  let pending = Promise.resolve();
  const storage = {
    get: vi.fn(async (key: string) => structuredClone(values.get(key))),
    put: vi.fn(async (key: string, value: unknown) => { values.set(key, structuredClone(value)); }),
    delete: vi.fn(async (key: string) => values.delete(key)),
    setAlarm: vi.fn(async () => {}),
    transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
      const next = pending.then(() => callback(storage));
      pending = next.then(() => {}, () => {});
      return next;
    },
  };
  return { storage, state: { storage } as unknown as DurableObjectState };
}
const reserve = (budget: AnalysisBudget, ip = '192.0.2.1') => budget.fetch(new Request('https://budget/reserve', {
  method: 'POST', headers: { 'X-Client-IP': ip },
}));

describe('presupuesto global persistente', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-25T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('no supera el máximo global ni con solicitudes concurrentes de diferentes IP', async () => {
    const { state } = storageMock();
    const budget = new AnalysisBudget(state, { DAILY_LIVE_LIMIT: '20' });
    const responses = await Promise.all(Array.from({ length: 30 }, (_, i) => reserve(budget, `192.0.2.${i}`)));
    expect(responses.filter(r => r.status === 204)).toHaveLength(20);
    expect(responses.filter(r => r.status === 429)).toHaveLength(10);
  });
  it('persiste tras recrear la instancia y no guarda la IP en claro', async () => {
    const { state, storage } = storageMock();
    expect((await reserve(new AnalysisBudget(state, { DAILY_LIVE_LIMIT: '1' }))).status).toBe(204);
    expect(JSON.stringify(await storage.get('budget'))).not.toContain('192.0.2.1');
    expect((await reserve(new AnalysisBudget(state, { DAILY_LIVE_LIMIT: '1' }), '192.0.2.2')).status).toBe(429);
  });
  it('permite uno por minuto y tres diarios por IP', async () => {
    const { state } = storageMock();
    const budget = new AnalysisBudget(state, {});
    expect((await reserve(budget)).status).toBe(204);
    expect((await reserve(budget)).status).toBe(429);
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(60_000);
      expect((await reserve(budget)).status).toBe(204);
    }
    vi.advanceTimersByTime(60_000);
    expect((await reserve(budget)).status).toBe(429);
  });
  it('reinicia al cambiar de día UTC y programa la eliminación de identificadores', async () => {
    const { state, storage } = storageMock();
    const budget = new AnalysisBudget(state, { DAILY_LIVE_LIMIT: '1' });
    await reserve(budget);
    expect(storage.setAlarm).toHaveBeenCalledWith(Date.parse('2026-11-26T00:00:00Z'));
    vi.setSystemTime(new Date('2026-11-26T00:00:01Z'));
    await budget.alarm();
    expect(await storage.get('budget')).toBeUndefined();
    expect((await reserve(budget)).status).toBe(204);
    await budget.alarm();
    expect((await reserve(budget, '192.0.2.2')).status).toBe(429);
  });
  it('la IP permitida supera el límite personal ya alcanzado sin resetear presupuesto', async () => {
    const { state, storage } = storageMock();
    const normal = new AnalysisBudget(state, {});
    for (let i = 0; i < 3; i++) {
      expect((await reserve(normal)).status).toBe(204);
      vi.advanceTimersByTime(60_000);
    }
    expect((await reserve(normal)).status).toBe(429);
    const owner = new AnalysisBudget(state, { OWNER_IP: '192.0.2.1' });
    for (let i = 0; i < 4; i++) expect((await reserve(owner)).status).toBe(204);
    expect(await storage.get('budget')).toMatchObject({ count: 7 });
    // Retirar el secreto no borra el bloqueo personal anterior.
    expect((await reserve(normal)).status).toBe(429);
  });
  it('la excepción mantiene el máximo global incluso con concurrencia', async () => {
    const { state } = storageMock();
    const owner = new AnalysisBudget(state, { OWNER_IP: '192.0.2.1', DAILY_LIVE_LIMIT: '20' });
    const responses = await Promise.all(Array.from({ length: 25 }, () => reserve(owner)));
    expect(responses.filter(r => r.status === 204)).toHaveLength(20);
    expect(responses.filter(r => r.status === 429)).toHaveLength(5);
  });
  it('exige coincidencia exacta de IP y no permite a otros visitantes saltar la espera', async () => {
    const { state } = storageMock();
    const budget = new AnalysisBudget(state, { OWNER_IP: '192.0.2.10' });
    expect((await reserve(budget, '192.0.2.1')).status).toBe(204);
    expect((await reserve(budget, '192.0.2.1')).status).toBe(429);
    expect((await reserve(budget, '192.0.2.10')).status).toBe(204);
    expect((await reserve(budget, '192.0.2.10')).status).toBe(204);
  });
  it('permite IPv4 e IPv6 explícitas sin ampliar la excepción al resto de la red', async () => {
    const { state } = storageMock();
    const budget = new AnalysisBudget(state, { OWNER_IP: '192.0.2.1, 2001:db8::1 ' });
    for (const ip of ['192.0.2.1', '2001:db8::1']) {
      expect((await reserve(budget, ip)).status).toBe(204);
      expect((await reserve(budget, ip)).status).toBe(204);
    }
    expect((await reserve(budget, '2001:db8::2')).status).toBe(204);
    expect((await reserve(budget, '2001:db8::2')).status).toBe(429);
  });
  it.each(['0', '-2'])('permite apagar el presupuesto con límite %s', async limit => {
    const { state } = storageMock();
    expect((await reserve(new AnalysisBudget(state, { DAILY_LIVE_LIMIT: limit }))).status).toBe(429);
  });
  it('rechaza llamadas internas sin IP', async () => {
    const { state } = storageMock();
    expect((await new AnalysisBudget(state, {}).fetch(new Request('https://budget'))).status).toBe(400);
  });
  it('falla cerrado si falta binding o IP', async () => {
    await expect(reserveBudget(new Request('https://roast'))).rejects.toMatchObject({ status: 503 });
    await expect(reserveBudget(new Request('https://roast'), {} as DurableObjectNamespace)).rejects.toMatchObject({ status: 503 });
  });
  it('falla cerrado si el servicio de presupuesto falla', async () => {
    const namespace = { idFromName: () => 'one', get: () => ({ fetch: async () => { throw new Error(); } }) } as unknown as DurableObjectNamespace;
    await expect(reserveBudget(new Request('https://roast', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), namespace)).rejects.toMatchObject({ status: 503 });
  });
});
