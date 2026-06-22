import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorLog = `
=== ${new Date().toISOString()} ===
URL: ${request.method} ${request.url}
Status: ${status}
Exception: ${exception instanceof Error ? exception.constructor.name : typeof exception}
Message: ${exception instanceof Error ? exception.message : String(exception)}
Stack: ${exception instanceof Error ? exception.stack : 'N/A'}
Body: ${JSON.stringify(request.body)}
Headers: ${JSON.stringify({
  authorization: request.headers.authorization ? 'Bearer ***' : undefined,
  'content-type': request.headers['content-type'],
})}
`;

    try {
      fs.appendFileSync(path.join(require('os').tmpdir(), 'all-exceptions.log'), errorLog);
    } catch {}
    
    this.logger.error(errorLog);

    const responseBody =
      typeof message === 'string'
        ? { statusCode: status, message }
        : (message as object);

    response.status(status).json(responseBody);
  }
}
