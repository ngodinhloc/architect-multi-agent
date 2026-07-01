import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.contentType());
    res.end(await this.metricsService.getMetrics());
  }
}
