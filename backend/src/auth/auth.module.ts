import { Module } from '@nestjs/common';
import { KeycloakTokenService } from './services/keycloak-token.service';
import { JwksController } from './controllers/jwks.controller';

@Module({
  controllers: [JwksController],
  providers: [KeycloakTokenService],
  exports: [KeycloakTokenService],
})
export class AuthModule {}
