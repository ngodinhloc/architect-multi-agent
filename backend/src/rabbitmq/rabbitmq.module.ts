import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './services/rabbitmq.service';
import { MetricsModule } from '../metrics/metrics.module';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
