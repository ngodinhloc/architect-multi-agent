import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, JWK } from 'jose';
import { AppLogger } from '../../common/logger/app-logger';

const JWKS_TTL_MS = 300_000;
const SKIP_PATHS = new Set(['/api/health']);

interface JwksCache {
  keys: JWK[];
  fetchedAt: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new AppLogger();
  private readonly whitelistedHosts: string[];
  private readonly audience: string;
  private readonly jwksCache = new Map<string, JwksCache>();

  constructor() {
    this.whitelistedHosts = (process.env.WHITELISTED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    this.audience = process.env.SERVICE_HOST ?? 'http://localhost:8003';
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

    let issuer: string;
    let kid: string;
    try {
      const payload = decodeJwt(token);
      const header = decodeProtectedHeader(token);
      issuer = payload.iss as string;
      kid = header.kid as string;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!this.whitelistedHosts.includes(issuer)) {
      this.logger.warn('JwtGuard.canActivate: Issuer not whitelisted', { issuer });
      throw new ForbiddenException('Issuer not authorized');
    }

    const keys = await this.fetchJwks(issuer);
    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) {
      throw new UnauthorizedException('No matching public key found');
    }

    try {
      const publicKey = await importJWK(jwk, 'RS256');
      await jwtVerify(token, publicKey, { audience: this.audience });
    } catch (err) {
      throw new UnauthorizedException(`Token invalid: ${(err as Error).message}`);
    }

    this.logger.log('JwtGuard.canActivate: JWT validated', { issuer, kid, path: request.path });
    return true;
  }

  private async fetchJwks(issuer: string): Promise<JWK[]> {
    const cached = this.jwksCache.get(issuer);
    if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
      return cached.keys;
    }
    const response = await fetch(`${issuer}/api/.well-known/jwks`);
    if (!response.ok) {
      this.logger.error('JwtGuard.fetchJwks: Failed to fetch JWKS', { issuer, status: response.status });
      throw new UnauthorizedException('Could not retrieve public key');
    }
    const body = (await response.json()) as { keys: JWK[] };
    this.jwksCache.set(issuer, { keys: body.keys, fetchedAt: Date.now() });
    return body.keys;
  }
}
