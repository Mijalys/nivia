import { createPublicKey, JsonWebKey, verify as verifySig } from 'node:crypto';
import { ApiError } from '../common/errors';

export interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
}

/** Verifica el ID token que entrega el botón "Continuar con Google" en la app. */
export interface GoogleVerifier {
  verify(idToken: string, nowS: number): Promise<GoogleClaims>;
}

type Jwks = { keys: (JsonWebKey & { kid: string })[] };
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/**
 * Verificación real: firma RS256 con las llaves públicas de Google (cacheadas 1 hora),
 * emisor de Google, audiencia = nuestro Client ID, vigencia y correo verificado.
 */
export class GoogleIdTokenVerifier implements GoogleVerifier {
  private cache: { at: number; jwks: Jwks } | null = null;

  constructor(private clientId: string, private fetchJwks: () => Promise<Jwks> = async () => {
    const r = await fetch(JWKS_URL);
    if (!r.ok) throw new Error(`Google JWKS ${r.status}`);
    return (await r.json()) as Jwks;
  }) {}

  private async keys(nowS: number): Promise<Jwks> {
    if (!this.cache || nowS - this.cache.at > 3600) this.cache = { at: nowS, jwks: await this.fetchJwks() };
    return this.cache.jwks;
  }

  async verify(idToken: string, nowS: number): Promise<GoogleClaims> {
    const invalid = () => new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'No pudimos confirmar tu cuenta de Google. Vuelve a intentar.');
    const parts = idToken.split('.');
    if (parts.length !== 3) throw invalid();
    let header: { alg: string; kid: string }; let payload: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch { throw invalid(); }
    if (header.alg !== 'RS256') throw invalid();
    let jwk = (await this.keys(nowS)).keys.find((k) => k.kid === header.kid);
    if (!jwk) { this.cache = null; jwk = (await this.keys(nowS)).keys.find((k) => k.kid === header.kid); }
    if (!jwk) throw invalid();
    const ok = verifySig('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!ok) throw invalid();
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss as string)) throw invalid();
    if (payload.aud !== this.clientId) throw invalid();
    if (typeof payload.exp !== 'number' || payload.exp < nowS) throw invalid();
    if (payload.email_verified !== true || typeof payload.email !== 'string') {
      throw new ApiError(401, 'GOOGLE_EMAIL_UNVERIFIED', 'Tu cuenta de Google no tiene un correo verificado.');
    }
    return payload as unknown as GoogleClaims;
  }
}

/** Sin GOOGLE_CLIENT_ID: el ingreso con Google está apagado. */
export class DisabledGoogleVerifier implements GoogleVerifier {
  async verify(): Promise<GoogleClaims> {
    throw new ApiError(404, 'GOOGLE_DISABLED', 'El ingreso con Google no está activado.');
  }
}
