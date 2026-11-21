import { generateKeyPairSync, sign } from 'node:crypto';
import { GoogleIdTokenVerifier } from '../src/modules/google';

// Un par de llaves propio hace de Google: firmamos tokens y servimos la llave pública como JWKS.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const NOW = 1_800_000_000;

function token(payload: Record<string, unknown>, kid = 'k1') {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${s}`;
}
const good = { iss: 'https://accounts.google.com', aud: 'mi-cliente', sub: '123', email: 'rosa@gmail.com', email_verified: true, exp: NOW + 600 };
const verifier = () => new GoogleIdTokenVerifier('mi-cliente', async () => ({ keys: [jwk as any] }));

describe('Verificador de Google', () => {
  it('acepta un token firmado por la llave de Google para nuestro cliente', async () => {
    await expect(verifier().verify(token(good), NOW)).resolves.toMatchObject({ sub: '123', email: 'rosa@gmail.com' });
  });

  it.each([
    ['otra audiencia', { ...good, aud: 'otro-cliente' }],
    ['otro emisor', { ...good, iss: 'https://evil.example' }],
    ['vencido', { ...good, exp: NOW - 1 }]
  ])('rechaza un token con %s', async (_name, payload) => {
    await expect(verifier().verify(token(payload), NOW)).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
  });

  it('rechaza una firma alterada y una llave desconocida', async () => {
    const t = token(good);
    const tampered = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(verifier().verify(tampered, NOW)).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
    await expect(verifier().verify(token(good, 'k9'), NOW)).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
  });

  it('rechaza un correo no verificado', async () => {
    await expect(verifier().verify(token({ ...good, email_verified: false }), NOW)).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_UNVERIFIED' });
  });
});
