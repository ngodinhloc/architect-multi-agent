import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { EpicModule } from './epic/epic.module';
import { TicketModule } from './ticket/ticket.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [AuthModule, DatabaseModule, EpicModule, TicketModule, HealthModule, MetricsModule],
})
export class AppModule {}
