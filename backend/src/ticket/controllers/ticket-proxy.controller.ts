import { Controller, Get, Param, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { KeycloakTokenService } from '../../auth/keycloak/keycloak-token.service';

const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL ?? 'http://localhost:8003';

@Controller('api')
export class TicketProxyController {
  constructor(private readonly keycloakTokenService: KeycloakTokenService) {}

  @Get('epic/:id')
  async getEpic(@Param('id') id: string) {
    return this.proxyGet(`${TICKET_SERVICE_URL}/api/epic/${id}`, `Epic ${id} not found`);
  }

  @Get('epic/:epicId/tickets')
  async getEpicTickets(@Param('epicId') epicId: string) {
    return this.proxyGet(`${TICKET_SERVICE_URL}/api/epic/${epicId}/tickets`);
  }

  @Get('ticket/:id')
  async getTicket(@Param('id') id: string) {
    return this.proxyGet(`${TICKET_SERVICE_URL}/api/ticket/${id}`, `Ticket ${id} not found`);
  }

  private async proxyGet(url: string, notFoundMsg?: string) {
    const token = await this.keycloakTokenService.getToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) throw new NotFoundException(notFoundMsg ?? 'Not found');
    if (!res.ok) throw new InternalServerErrorException('Ticket service error');
    return res.json();
  }
}
