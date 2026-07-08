import { Controller, Get, Injectable } from '@nestjs/common';
import { JwkKey } from '../contracts/auth.interface';
import { JwksService } from '../services/jwks.service';

@Injectable()
@Controller('api/.well-known')
export class JwksController {
  constructor(private jwksService: JwksService) {
  }

  @Get('jwks')
  jwks() {
    return this.jwksService.buildJwks();
  }
}
