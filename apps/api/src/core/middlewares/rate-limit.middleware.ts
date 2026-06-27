import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private rateLimiter: RateLimiterRedis | null = null;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        const redisOptions: any = redisUrl.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {};
        const redis = new Redis(redisUrl, redisOptions);
        this.rateLimiter = new RateLimiterRedis({
          storeClient: redis,
          points: 1000, // 1000 requests
          duration: 60, // per 60 seconds
          blockDuration: 5 // block for 5 seconds if exceeded
        });
        this.logger.log('Rate limiting middleware initialized');
      } catch (error) {
        this.logger.error('Failed to initialize rate limiter:', error);
      }
    } else {
      this.logger.warn('REDIS_URL not set, rate limiting disabled');
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (!this.rateLimiter) {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return next();
    }

    try {
      await this.rateLimiter.consume(userId);
      next();
    } catch (error) {
      const retryAfter = Math.ceil((error as any).msBeforeNext / 1000) || 60;
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        retryAfter
      });
    }
  }
}
