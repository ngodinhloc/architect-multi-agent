import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from 'src/common/logger/services/app-logger';

export const CHAT_TTL_SECONDS = 7200;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(
    private readonly logger: AppLogger,
  ) {
  }

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (err) => this.logger.error('RedisService.onModuleInit: Redis error', { conversationId: null, error: String(err) }));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds = CHAT_TTL_SECONDS): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
