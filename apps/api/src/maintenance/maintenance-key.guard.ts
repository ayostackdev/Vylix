import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MaintenanceKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Support both the new `MAINTENANCE_API_KEY` name and the existing
    // `MAINTENANCE_A` environment variable (backwards-compatibility).
    const expectedKey =
      this.configService.get<string>('MAINTENANCE_API_KEY') || this.configService.get<string>('MAINTENANCE_A');

    if (!expectedKey) {
      throw new UnauthorizedException('Maintenance API key is not configured (set MAINTENANCE_API_KEY or MAINTENANCE_A).');
    }

    const request = context.switchToHttp().getRequest<Request & { headers: Record<string, string | undefined> }>();
    const providedKey = request.headers['x-maintenance-key'] || this.extractBearerToken(request.headers.authorization);

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid maintenance API key.');
    }

    return true;
  }

  private extractBearerToken(authorizationHeader?: string) {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return undefined;
    }

    return authorizationHeader.slice('Bearer '.length).trim();
  }
}