import { Module, Global } from '@nestjs/common';
import { TenantConnectionService } from './tenant-connection.service';

@Global()
@Module({
  providers: [TenantConnectionService],
  exports: [TenantConnectionService],
})
export class TenantConnectionModule {}
