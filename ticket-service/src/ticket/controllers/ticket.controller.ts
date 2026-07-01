import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { TicketService } from '../services/ticket.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { MetricsService } from '../../metrics/metrics.service';

@Controller('api')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('ticket')
  create(@Body() dto: CreateTicketDto) {
    this.metricsService.requests.inc({ endpoint: 'ticket' });
    return this.ticketService.create(dto);
  }

  @Get('epic/:epicId/tickets')
  findByEpic(@Param('epicId', ParseUUIDPipe) epicId: string) {
    this.metricsService.requests.inc({ endpoint: 'ticket' });
    return this.ticketService.findByEpic(epicId);
  }

  @Get('ticket/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    this.metricsService.requests.inc({ endpoint: 'ticket' });
    return this.ticketService.findOne(id);
  }
}
