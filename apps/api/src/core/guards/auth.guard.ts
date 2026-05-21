import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';

/**
 * JWT Payload interface for Supabase tokens
 */
interface JwtPayload {
  sub: string; // User ID
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface LinkedEmailRecord {
  id: string;
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
}

@Injectable()
export class DepartmentGuard implements CanActivate {
  private readonly logger = new Logger(DepartmentGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userDeptId = this.cls.get<string>('departmentId');

    const paramsCourseId = request.params?.courseId;
    const bodyCourseId = (request.body as { courseId?: string } | undefined)?.courseId;
    const targetCourseId = (paramsCourseId ?? bodyCourseId) as string | undefined;

    if (!userDeptId) {
      this.logger.warn('Access attempt without established tenant context.');
      throw new ForbiddenException('Tenant context not established. Please re-authenticate.');
    }

    if (!targetCourseId) {
      return true;
    }

    const targetCourse = await this.prisma.course.findUnique({
      where: { id: targetCourseId },
      select: { departmentId: true, isGeneral: true }
    });

    if (!targetCourse) {
      throw new ForbiddenException('The requested course record does not exist.');
    }

    if (targetCourse.isGeneral) {
      return true;
    }

    if (targetCourse.departmentId !== userDeptId) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to access this course.'
      );
    }

    return true;
  }
}

/**
 * Auth Guard that validates Supabase JWT and supports multiple emails per user.
 * Extracts user ID from JWT and fetches full user context including all linked emails.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Extract JWT token from Authorization header
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Parse JWT payload (in production, validate JWT signature)
      const payload = this.parseJwtPayload(token);
      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Fetch user from database with all linked emails
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          emails: true,
          college: true,
          department: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const linkedEmails = (user.emails ?? []) as LinkedEmailRecord[];

      // Verify that the email in the token is one of the user's linked emails
      const tokenEmail = payload.email;
      if (tokenEmail) {
        const hasEmail = linkedEmails.some((emailRecord: LinkedEmailRecord) => emailRecord.email === tokenEmail);
        if (!hasEmail) {
          this.logger.warn(
            `Token email ${tokenEmail} not linked to user ${user.id}`
          );
          throw new UnauthorizedException('Token email not associated with user account');
        }
      }

      // Store user context in ClsService for use in other services/guards
      this.cls.set('userId', user.id);
      this.cls.set('user', user);
      this.cls.set('emails', linkedEmails);
      this.cls.set('departmentId', user.departmentId);
      this.cls.set('collegeId', user.collegeId);

      (request as any)['user'] = {
        id: user.id,
        emails: linkedEmails.map((emailRecord: LinkedEmailRecord) => ({
          email: emailRecord.email,
          isPrimary: emailRecord.isPrimary,
          isVerified: emailRecord.isVerified,
        })),
        primaryEmail: linkedEmails.find((emailRecord: LinkedEmailRecord) => emailRecord.isPrimary)?.email,
      };

      return true;
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer') return null;

    return token;
  }

  private parseJwtPayload(token: string): JwtPayload | null {
    try {
      // Base64 decode the payload (JWT format: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );
      return payload as JwtPayload;
    } catch (error) {
      this.logger.error('Failed to parse JWT:', error);
      return null;
    }
  }
}
