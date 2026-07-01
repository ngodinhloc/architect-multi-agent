import { Controller, Get } from '@nestjs/common';
import { createPrivateKey, createPublicKey, createHash } from 'crypto';

interface JwkKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

let _cachedJwks: { keys: JwkKey[] } | null = null;

function buildJwks(): { keys: JwkKey[] } {
  if (_cachedJwks) return _cachedJwks;

  const pem = (process.env.PRIVATE_KEY_PEM ?? '').replace(/\\n/g, '\n');
  const privKey = createPrivateKey(pem);
  const pubKey = createPublicKey(privKey);
  const jwk = pubKey.export({ format: 'jwk' }) as { n: string; e: string };
  const der = pubKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const kid = createHash('sha256').update(der).digest('hex').slice(0, 16);

  _cachedJwks = {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
  return _cachedJwks;
}

@Controller('api/.well-known')
export class JwksController {
  @Get('jwks')
  jwks() {
    return buildJwks();
  }
}
