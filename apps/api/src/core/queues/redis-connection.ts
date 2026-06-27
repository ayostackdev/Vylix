import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export function createRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const redisUrl = configService.get<string>('REDIS_URL');

  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }

  return {
    host: configService.get<string>('REDIS_HOST') ?? '127.0.0.1',
    port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
    username: configService.get<string>('REDIS_USERNAME') ?? undefined,
    password: configService.get<string>('REDIS_PASSWORD') ?? undefined,
    db: Number(configService.get<string>('REDIS_DB') ?? 0),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}