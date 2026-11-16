import { ApiError } from './errors';

/**
 * Límite de intentos en memoria por clave (celular + empresa).
 * Suficiente para una sola instancia; con varias instancias va a Redis.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}

  check(key: string, nowMs: number, message: string) {
    const recent = (this.hits.get(key) || []).filter((t) => nowMs - t < this.windowMs);
    this.hits.set(key, recent);
    if (recent.length >= this.max) {
      const retryAt = new Date(recent[0] + this.windowMs);
      throw new ApiError(429, 'TOO_MANY_ATTEMPTS', message, { retry_at: retryAt.toISOString() });
    }
  }
  hit(key: string, nowMs: number) {
    const list = this.hits.get(key) || [];
    list.push(nowMs);
    this.hits.set(key, list);
  }
  reset(key: string) { this.hits.delete(key); }
}
