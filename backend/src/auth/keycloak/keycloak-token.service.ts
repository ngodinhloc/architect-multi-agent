import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../common/logger/app-logger';

const REFRESH_BUFFER_SECONDS = 30;

@Injectable()
export class KeycloakTokenService implements OnModuleInit {
  private readonly logger = new AppLogger();
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'architect';
    this.tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    this.clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'backend';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET ?? '';
  }

  async onModuleInit(): Promise<void> {
    await this.getToken();
  }

  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.expiresAt - REFRESH_BUFFER_SECONDS) {
      return this.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const resp = await fetch(this.tokenUrl, { method: 'POST', body });
    if (!resp.ok) {
      throw new Error(`Keycloak token request failed: ${resp.status}`);
    }
    const data = (await resp.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.expiresAt = now + data.expires_in;
    this.logger.log('KeycloakTokenService.getToken: Token acquired', { clientId: this.clientId, expiresIn: data.expires_in });
    return this.accessToken;
  }
}
