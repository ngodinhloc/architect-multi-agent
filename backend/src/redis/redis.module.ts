import { Module, Global } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
  imports: [LoggerModule],
})
export class RedisModule {}
