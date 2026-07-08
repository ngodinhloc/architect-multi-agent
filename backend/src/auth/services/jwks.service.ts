import { createHash, createPrivateKey, createPublicKey } from 'crypto';
import { JwkKey } from '../contracts/auth.interface';

export class JwksService {
    buildJwks(): { keys: JwkKey[] } {
        let cachedJwks: { keys: JwkKey[] } | null = null;
        if (cachedJwks) return cachedJwks;
        
        const pem = (process.env.PRIVATE_KEY_PEM ?? '').replace(/\\n/g, '\n');
        const privKey = createPrivateKey(pem);
        const pubKey = createPublicKey(privKey);
        const jwk = pubKey.export({ format: 'jwk' }) as { n: string; e: string };
        const der = pubKey.export({ type: 'spki', format: 'der' }) as Buffer;
        const kid = createHash('sha256').update(der).digest('hex').slice(0, 16);
        
        cachedJwks = {
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
        return cachedJwks;
    }
}