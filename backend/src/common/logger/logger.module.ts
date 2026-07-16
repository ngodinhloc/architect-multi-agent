import { Global, Module } from '@nestjs/common';
import { AppLogger } from './services/app-logger';

@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
