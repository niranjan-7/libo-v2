import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'Library Platform Multi-Tenant API',
      version: '2.0.0',
      status: 'online',
      webApp: 'http://localhost:5173',
      endpoints: {
        health: '/api/v1/health',
        directory: '/api/v1/libraries/directory',
        auth: '/api/v1/auth',
      },
    };
  }
}
