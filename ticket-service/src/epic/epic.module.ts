import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epic } from '../database/entities/epic.entity';
import { EpicController } from './controllers/epic.controller';
import { EpicService } from './services/epic.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Epic]), MetricsModule],
  controllers: [EpicController],
  providers: [EpicService],
})
export class EpicModule {}
