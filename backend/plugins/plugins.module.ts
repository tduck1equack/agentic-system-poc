import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../shared/infrastructure/infrastructure.module';
import { Database } from '../shared/infrastructure/prisma';
import { McpToolGateway, RandomIds, SystemClock } from '../shared/infrastructure/adapters';
import { PluginService } from './application/plugin.service';
import { PrismaPluginRepository } from './infrastructure/prisma-plugin.repository';
import { PluginController } from './http/plugin.controller';
@Module({
  imports: [InfrastructureModule], controllers: [PluginController],
  providers: [{ provide: PluginService, inject: [Database, McpToolGateway, RandomIds, SystemClock], useFactory: (db: Database, gateway: McpToolGateway, ids: RandomIds, clock: SystemClock) => new PluginService(new PrismaPluginRepository(db), gateway, ids, clock) }],
  exports: [PluginService],
})
export class PluginsModule {}
