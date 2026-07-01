import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { TicketModule } from './ticket/ticket.module';
import { AuthModule } from './auth/auth.module';
import { KeycloakAuthMiddleware } from './auth/middlewares/keycloak-auth.middleware';

@Module({
  imports: [DatabaseModule, RedisModule, RabbitMQModule, ChatModule, HealthModule, TicketModule, AuthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(KeycloakAuthMiddleware).forRoutes('*');
  }
}
