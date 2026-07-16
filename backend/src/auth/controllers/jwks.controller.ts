import { Controller, Get, Injectable } from '@nestjs/common';
import { JwksService } from '../services/jwks.service';

@Injectable()
@Controller('api/.well-known')
export class JwksController {
  constructor(private jwksService: JwksService) {}

  @Get('jwks')
  jwks() {
    return this.jwksService.buildJwks();
  }
}
