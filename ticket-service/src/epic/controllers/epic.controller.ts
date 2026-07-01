import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { EpicService } from '../services/epic.service';
import { CreateEpicDto } from '../dto/create-epic.dto';
import { MetricsService } from '../../metrics/metrics.service';

@Controller('api/epic')
export class EpicController {
  constructor(
    private readonly epicService: EpicService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post()
  create(@Body() dto: CreateEpicDto) {
    this.metricsService.requests.inc({ endpoint: 'epic' });
    return this.epicService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    this.metricsService.requests.inc({ endpoint: 'epic' });
    return this.epicService.findOne(id);
  }
}
