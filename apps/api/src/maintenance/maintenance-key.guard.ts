import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MaintenanceKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.configService.get<string>('MAINTENANCE_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Maintenance API key is not configured.');
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