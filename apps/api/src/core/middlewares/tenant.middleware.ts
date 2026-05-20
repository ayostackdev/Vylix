import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const departmentId = (req.headers['x-department-id'] as string | undefined) ?? req.body?.departmentId;
    const collegeId = (req.headers['x-college-id'] as string | undefined) ?? req.body?.collegeId;

    if (departmentId) {
      this.cls.set('departmentId', departmentId);
    }

    if (collegeId) {
      this.cls.set('collegeId', collegeId);
    }

    next();
  }
}
