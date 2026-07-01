import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { decodeProtectedHeader, importJWK, jwtVerify, JWK } from 'jose';
import { AppLogger } from '../../common/logger/app-logger';

const JWKS_TTL_MS = 300_000;
const SKIP_PATHS = new Set(['/api/health']);

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new AppLogger();
  private readonly issuer: string;
  private readonly jwksUrl: string;
  private jwksCache: JWK[] | null = null;
  private jwksFetchedAt = 0;

  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://keycloak:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'architect';
    this.issuer = `${keycloakUrl}/realms/${realm}`;
    this.jwksUrl = `${this.issuer}/protocol/openid-connect/certs`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (SKIP_PATHS.has(request.path)) {
      return true;
    }

    const authHeader = request.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = authHeader.slice(7);

    let kid: string;
    try {
      const header = decodeProtectedHeader(token);
      kid = header.kid as string;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const keys = await this.fetchJwks();
    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) {
      throw new UnauthorizedException('No matching public key found');
    }

    let payload: Record<string, unknown>;
    try {
      const publicKey = await importJWK(jwk, 'RS256');
      const result = await jwtVerify(token, publicKey, { issuer: this.issuer });
      payload = result.payload as Record<string, unknown>;
    } catch (err) {
      this.logger.warn('JwtGuard.canActivate: JWT validation failed', {
        kid,
        path: request.path,
        error: (err as Error).message,
      });
      throw new UnauthorizedException(`Token invalid: ${(err as Error).message}`);
    }

    this.logger.log('JwtGuard.canActivate: JWT validated', {
      client_id: payload['azp'] ?? payload['sub'],
      kid,
      path: request.path,
      exp: payload['exp'],
    });
    return true;
  }

  private async fetchJwks(): Promise<JWK[]> {
    if (this.jwksCache && Date.now() - this.jwksFetchedAt < JWKS_TTL_MS) {
      return this.jwksCache;
    }
    const response = await fetch(this.jwksUrl);
    if (!response.ok) {
      this.logger.error('JwtGuard.fetchJwks: Failed to fetch JWKS from Keycloak', {
        status: response.status,
      });
      throw new UnauthorizedException('Could not retrieve public keys');
    }
    const body = (await response.json()) as { keys: JWK[] };
    this.jwksCache = body.keys;
    this.jwksFetchedAt = Date.now();
    return this.jwksCache;
  }
}
