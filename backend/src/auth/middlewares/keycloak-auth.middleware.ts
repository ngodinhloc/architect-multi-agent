import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';
import { AppLogger } from '../../common/logger/services/app-logger';
import { AuthUser } from '../contracts/auth.interface'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/.well-known/jwks', '/metrics']);
const TOKEN_COOKIE_NAME = 'kc_token';

@Injectable()
export class KeycloakAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: AppLogger
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    if (PUBLIC_PATHS.has(path)) {
      return next();
    }

    const token = this.extractToken(req);
    if (!token) {
      this.logger.warn('KeycloakAuthMiddleware: Missing kc_token cookie', { path });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Kong already verified the signature — just decode to extract user claims
      req.user = this.buildUserFromToken(token);
      this.logger.log('KeycloakAuthMiddleware: user resolved', {
        username: req.user.username,
        path,
      });
      return next();
    } catch (err) {
      this.logger.warn('KeycloakAuthMiddleware: failed to decode token', {
        path,
        error: (err as Error).message,
      });
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  private buildUserFromToken(token: string): AuthUser {
    const payload = decodeJwt(token);
    return {
      username: (payload['preferred_username'] as string) ?? '',
      email: (payload['email'] as string) ?? '',
      name: (payload['name'] as string) ?? (payload['preferred_username'] as string) ?? '',
    };
  }

  private extractToken(req: Request): string | null {
    const cookieHeader = req.headers['cookie'] ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${TOKEN_COOKIE_NAME}=`));
    return cookie ? decodeURIComponent(cookie.slice(TOKEN_COOKIE_NAME.length + 1)) : null;
  }
}
