import { Controller, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'Vylix API',
      timestamp: new Date().toISOString()
    };
  }

  @Public()
  @Get('live')
  getLive() {
    return { status: 'alive' };
  }

  @Public()
  @Get('ready')
  getReady() {
    return { status: 'ready' };
  }
}
