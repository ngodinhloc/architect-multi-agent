import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';
import { Epic } from './entities/epic.entity';
import { Ticket } from './entities/ticket.entity';

const SCHEMA = 'tickets';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const client = new Client({
          connectionString: process.env.DATABASE_URL,
        });
        await client.connect();
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
        await client.end();

        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          schema: SCHEMA,
          entities: [Epic, Ticket],
          synchronize: true,
          logging: false,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
