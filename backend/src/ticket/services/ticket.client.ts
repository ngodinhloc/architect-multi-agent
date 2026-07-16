import { Injectable } from '@nestjs/common';
import { KeycloakTokenService } from '../../auth/services/keycloak-token.service';

const TICKET_SERVICE_URL =
  process.env.TICKET_SERVICE_URL ?? 'http://localhost:8003';

@Injectable()
export class TicketClient {
  constructor(private readonly keycloakService: KeycloakTokenService) {}

  async get(path: string) {
    const token = await this.keycloakService.getToken();
    const url = `${TICKET_SERVICE_URL}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) throw new Error(`${url} not found`);
    if (!res.ok) throw new Error('Ticket service error');

    return res.json();
  }
}
