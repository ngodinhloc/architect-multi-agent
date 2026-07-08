import { Module } from '@nestjs/common';
import { KeycloakTokenService } from './services/keycloak-token.service';
import { JwksController } from './controllers/jwks.controller';
import { JwksService } from './services/jwks.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  controllers: [JwksController],
  providers: [KeycloakTokenService, JwksService],
  exports: [KeycloakTokenService, JwksService],
  imports: [LoggerModule],
})
export class AuthModule {}
