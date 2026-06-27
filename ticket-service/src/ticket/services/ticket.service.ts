import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../database/entities/ticket.entity';
import { CreateTicketDto } from '../dto/create-ticket.dto';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async create(dto: CreateTicketDto): Promise<Ticket> {
    this.logger.log('TicketService.create: Creating ticket', { conversationId: null, id: dto.id, epicId: dto.epicId });
    const ticket = this.ticketRepo.create({
      id: dto.id,
      epicId: dto.epicId,
      name: dto.name,
      requirements: dto.requirements as unknown as Record<string, unknown>[],
      acceptance_criteria: dto.acceptance_criteria as unknown as Record<string, unknown>[],
    });
    return this.ticketRepo.save(ticket);
  }

  async findByEpic(epicId: string): Promise<Ticket[]> {
    return this.ticketRepo.find({ where: { epicId }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }
}
