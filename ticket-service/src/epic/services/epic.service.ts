import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Epic } from '../../database/entities/epic.entity';
import { CreateEpicDto } from '../dto/create-epic.dto';

@Injectable()
export class EpicService {
  private readonly logger = new Logger(EpicService.name);

  constructor(
    @InjectRepository(Epic)
    private readonly epicRepo: Repository<Epic>,
  ) {}

  async create(dto: CreateEpicDto): Promise<Epic> {
    this.logger.log('EpicService.create: Creating epic', { conversationId: null, id: dto.id });
    const epic = this.epicRepo.create({
      id: dto.id,
      name: dto.name,
      requirements: dto.requirements as unknown as Record<string, unknown>[],
      solution: dto.solution as unknown as Record<string, unknown>,
    });
    return this.epicRepo.save(epic);
  }

  async findOne(id: string): Promise<Epic> {
    const epic = await this.epicRepo.findOne({ where: { id } });
    if (!epic) throw new NotFoundException(`Epic ${id} not found`);
    return epic;
  }
}
