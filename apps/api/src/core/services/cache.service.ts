import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');
    const redisOptions: any = redisUrl || 'redis://localhost:6379/0';
    if (redisUrl?.startsWith('rediss://')) {
      this.redis = new Redis(redisUrl, { tls: { rejectUnauthorized: false } });
    } else {
      this.redis = new Redis(redisOptions);
    }
    
    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
    
    this.redis.on('connect', () => {
      this.logger.log('Redis cache service connected');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL (seconds)
   */
  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
    }
  }

  /**
   * Delete specific cache key
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache key ${key}:`, error);
    }
  }

  /**
   * Invalidate multiple keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds = 3600
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        this.logger.debug(`Cache hit: ${key}`);
        return cached;
      }

      this.logger.debug(`Cache miss: ${key}, computing...`);
      const value = await computeFn();
      await this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      this.logger.error(`Failed in getOrSet for key ${key}:`, error);
      // Fallback to compute function on cache error
      return computeFn();
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.warn('All cache cleared');
    } catch (error) {
      this.logger.error('Failed to flush all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('stats');
      const dbSize = await this.redis.dbsize();
      return { info, dbSize };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return null;
    }
  }
}
