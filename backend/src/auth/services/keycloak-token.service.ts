import { Injectable } from '@nestjs/common';
import { SignJWT, importPKCS8 } from 'jose';
import { createPrivateKey, createPublicKey, createHash, KeyObject } from 'crypto';
import { AppLogger } from '../../common/logger/app-logger';

const REFRESH_BUFFER_SECONDS = 30;
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

@Injectable()
export class KeycloakTokenService {
  private readonly logger = new AppLogger();
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly privateKeyPem: string;
  private readonly kid: string;
  private privateKey: CryptoKey | null = null;
  private accessToken: string | null = null;
  private expiresAt = 0;
  private inflightRequest: Promise<string> | null = null;

  constructor() {
    const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM ?? 'architect';
    this.tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    this.clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'backend';
    this.privateKeyPem = (process.env.PRIVATE_KEY_PEM ?? '').replace(/\\n/g, '\n');
    this.kid = this.computeKid();
  }

  private computeKid(): string {
    if (!this.privateKeyPem) return '';
    const privKey: KeyObject = createPrivateKey(this.privateKeyPem);
    const pubKey: KeyObject = createPublicKey(privKey);
    const der = pubKey.export({ type: 'spki', format: 'der' }) as Buffer;
    return createHash('sha256').update(der).digest('hex').slice(0, 16);
  }

  private async ensureKey(): Promise<void> {
    if (!this.privateKey) {
      this.privateKey = await importPKCS8(this.privateKeyPem, 'RS256');
    }
  }

  private async buildAssertion(): Promise<string> {
    await this.ensureKey();
    return new SignJWT()
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuer(this.clientId)
      .setSubject(this.clientId)
      .setAudience(this.tokenUrl)
      .setIssuedAt()
      .setExpirationTime('30m')
      .setJti(crypto.randomUUID())
      .sign(this.privateKey);
  }

  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.expiresAt - REFRESH_BUFFER_SECONDS) {
      this.logger.debug('KeycloakTokenService.getToken: Serving cached token', { clientId: this.clientId, ttlSeconds: this.expiresAt - now });
      return this.accessToken;
    }
    // Coalesce concurrent callers into one in-flight request
    if (!this.inflightRequest) {
      this.inflightRequest = this.fetchNewToken().finally(() => {
        this.inflightRequest = null;
      });
    }
    return this.inflightRequest;
  }

  private async fetchNewToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await this.buildAssertion();
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: assertion,
    });
    const resp = await fetch(this.tokenUrl, { method: 'POST', body });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Keycloak token request failed: ${resp.status} ${errBody}`);
    }
    const data = (await resp.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.expiresAt = now + data.expires_in;
    this.logger.log('KeycloakTokenService.getToken: Token acquired', { clientId: this.clientId, expiresIn: data.expires_in, tokenUrl: this.tokenUrl });
    return this.accessToken;
  }
}
