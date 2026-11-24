import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../shared/infrastructure/infrastructure.module';
import { Database } from '../shared/infrastructure/prisma';
import { EncryptedCredentials, McpToolGateway, RandomIds } from '../shared/infrastructure/adapters';
import { ReferenceToolApproval, SecretRedaction } from './infrastructure/execution-policy';
import { PluginsModule } from '../plugins/plugins.module';
import { PluginService } from '../plugins/application/plugin.service';
import { InstallationService } from './application/installation.service';
import { PrismaInstallationRepository } from './infrastructure/prisma-installation.repository';
import { InstallationController } from './http/installation.controller';
@Module({
  imports: [InfrastructureModule, PluginsModule], controllers: [InstallationController],
  providers: [ReferenceToolApproval, SecretRedaction, { provide: InstallationService, inject: [Database, PluginService, McpToolGateway, EncryptedCredentials, RandomIds, ReferenceToolApproval, SecretRedaction], useFactory: (db: Database, plugins: PluginService, gateway: McpToolGateway, vault: EncryptedCredentials, ids: RandomIds, approvals: ReferenceToolApproval, sanitizer: SecretRedaction) => new InstallationService(new PrismaInstallationRepository(db), plugins, gateway, vault, ids, approvals, sanitizer) }],
  exports: [InstallationService],
})
export class InstallationsModule {}
