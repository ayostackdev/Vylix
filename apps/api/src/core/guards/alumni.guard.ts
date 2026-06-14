import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AlumniReadOnlyGuard implements CanActivate {
  private readonly logger = new Logger(AlumniReadOnlyGuard.name);

  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!WRITE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const user = this.cls.get('user') as { id: string; status: string } | undefined;

    if (user?.status === 'ALUMNI') {
      this.logger.warn(`Alumni user ${user.id} attempted write operation: ${request.method} ${request.path}`);
      throw new ForbiddenException(
        'Your account is in alumni status. You can browse and view your existing data, but writing new content is not available.'
      );
    }

    return true;
  }
}
