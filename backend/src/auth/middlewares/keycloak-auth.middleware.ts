import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { decodeProtectedHeader, importJWK, jwtVerify, JWK } from 'jose';
import { AppLogger } from '../../common/logger/app-logger';

const JWKS_TTL_MS = 300_000;
const SKIP_PATHS = new Set(['/api/health', '/api/.well-known/jwks']);

export interface AuthUser {
  username: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

@Injectable()
export class KeycloakAuthMiddleware implements NestMiddleware {
  private readonly logger = new AppLogger();
  private readonly issuer: string;
  private readonly jwksUrl: string;
  private jwksCache: JWK[] | null = null;
  private jwksFetchedAt = 0;

  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://keycloak:8080';
    const keycloakPublicUrl = process.env.KEYCLOAK_PUBLIC_URL ?? keycloakUrl;
    const realm = process.env.KEYCLOAK_REALM ?? 'architect';
    this.issuer = `${keycloakPublicUrl}/realms/${realm}`;
    this.jwksUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    if (SKIP_PATHS.has(path)) {
      return next();
    }

    const token = this.extractToken(req);
    if (!token) {
      this.logger.warn('KeycloakAuthMiddleware: Missing kc_token cookie', { path });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const keys = await this.fetchJwks();
      const header = decodeProtectedHeader(token);
      const kid = header.kid;
      const jwk = keys.find((k) => k.kid === kid);
      if (!jwk) {
        this.logger.warn('KeycloakAuthMiddleware: No matching public key', { path, kid });
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const publicKey = await importJWK(jwk, 'RS256');
      const { payload } = await jwtVerify(token, publicKey, { issuer: this.issuer });

      req.user = {
        username: (payload['preferred_username'] as string) ?? '',
        email: (payload['email'] as string) ?? '',
        name: (payload['name'] as string) ?? (payload['preferred_username'] as string) ?? '',
      };
      this.logger.log('KeycloakAuthMiddleware: JWT validated', {
        username: req.user.username,
        kid,
        path,
        exp: payload['exp'],
      });
      return next();
    } catch (err) {
      this.logger.warn('KeycloakAuthMiddleware: JWT validation failed', {
        path,
        error: (err as Error).message,
      });
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  private extractToken(req: Request): string | null {
    const cookieHeader = req.headers['cookie'] ?? '';
    const match = /(?:^|;\s*)kc_token=([^;]+)/.exec(cookieHeader);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private async fetchJwks(): Promise<JWK[]> {
    if (this.jwksCache && Date.now() - this.jwksFetchedAt < JWKS_TTL_MS) {
      return this.jwksCache;
    }
    const response = await fetch(this.jwksUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }
    const body = (await response.json()) as { keys: JWK[] };
    this.jwksCache = body.keys;
    this.jwksFetchedAt = Date.now();
    this.logger.log('KeycloakAuthMiddleware: JWKS refreshed', { url: this.jwksUrl, keyCount: this.jwksCache.length });
    return this.jwksCache;
  }
}
