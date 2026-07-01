import { Module } from '@nestjs/common';
import { KeycloakTokenService } from './keycloak/keycloak-token.service';

@Module({
  providers: [KeycloakTokenService],
  exports: [KeycloakTokenService],
})
export class AuthModule {}
