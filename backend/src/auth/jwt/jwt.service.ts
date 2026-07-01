import { Injectable, OnModuleInit } from '@nestjs/common';
import { importPKCS8, exportJWK, SignJWT, KeyLike } from 'jose';
import { createHash } from 'crypto';
import { AppLogger } from '../../common/logger/app-logger';

const JWT_EXPIRY_SECONDS = 300;

@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = new AppLogger();
  private readonly issuer = process.env.SERVICE_HOST ?? 'http://localhost:8000';
  private readonly audience = process.env.TICKET_SERVICE_URL ?? 'http://localhost:8003';
  private privateKey!: KeyLike;
  private kid!: string;
  private jwksPayload!: object;

  async onModuleInit(): Promise<void> {
    const pem = this.normalizePem(process.env.PRIVATE_KEY_PEM ?? '');
    if (!pem) throw new Error('PRIVATE_KEY_PEM is not set for backend service');
    this.privateKey = await importPKCS8(pem, 'RS256');
    const jwk = await exportJWK(this.privateKey);
    this.kid = createHash('sha256').update(Buffer.from(jwk.n!, 'base64url')).digest('hex').slice(0, 16);
    this.jwksPayload = {
      keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid: this.kid, n: jwk.n, e: jwk.e }],
    };
  }

  async sign(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + JWT_EXPIRY_SECONDS)
      .sign(this.privateKey);
    this.logger.log('JwtService.sign: JWT signed', { iss: this.issuer, aud: this.audience, kid: this.kid, exp: now + JWT_EXPIRY_SECONDS });
    return token;
  }

  getJwks(): object {
    return this.jwksPayload;
  }

  private normalizePem(raw: string): string {
    return raw
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }
}
