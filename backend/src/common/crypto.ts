import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** JWT HS256 mínimo: solo lo que la API necesita (firmar y verificar con expiración). */
export function signJwt(payload: Record<string, unknown>, secret: string, ttlS: number, nowS: number): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: nowS, exp: nowS + ttlS }));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyJwt<T = Record<string, unknown>>(token: string, secret: string, nowS: number): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof body.exp !== 'number' || body.exp < nowS) return null;
    return body as T;
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** URL de archivo firmada con expiración, para videos, paquetes y PDF. */
export function signPath(path: string, secret: string, expS: number): string {
  const sig = createHmac('sha256', secret).update(`${path}:${expS}`).digest('base64url');
  return `${path}?exp=${expS}&sig=${sig}`;
}
export function checkPathSig(path: string, exp: string | undefined, sig: string | undefined, secret: string, nowS: number): boolean {
  if (!exp || !sig || Number(exp) < nowS) return false;
  const expected = createHmac('sha256', secret).update(`${path}:${exp}`).digest();
  const given = Buffer.from(sig, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Código de verificación del certificado: PREFIJO-AÑO-XXXX-NN.
 * XXXX es aleatorio sin caracteres ambiguos; NN es un dígito de control para detectar errores al tipearlo.
 */
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function certificateCode(prefix: string, year: number): string {
  let mid = '';
  for (let i = 0; i < 4; i++) mid += ALPHA[randomInt(0, ALPHA.length)];
  const base = `${prefix}-${year}-${mid}`;
  let sum = 0;
  for (const ch of base) sum = (sum * 31 + ch.charCodeAt(0)) % 97;
  return `${base}-${String(sum).padStart(2, '0')}`;
}
export function isValidCertificateCode(code: string): boolean {
  const m = /^(.+)-(\d{2})$/.exec(code);
  if (!m) return false;
  let sum = 0;
  for (const ch of m[1]) sum = (sum * 31 + ch.charCodeAt(0)) % 97;
  return String(sum).padStart(2, '0') === m[2];
}
