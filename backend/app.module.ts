import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'node:path';
import { IdentityModule } from './identity/identity.module';
import { PluginsModule } from './plugins/plugins.module';
import { InstallationsModule } from './installations/installations.module';
import { ConversationsModule } from './conversations/conversations.module';
import { SessionGuard } from './shared/http/auth';
import { ApiErrorFilter } from './shared/http/error.filter';
@Module({
  imports: [IdentityModule, PluginsModule, InstallationsModule, ConversationsModule, ServeStaticModule.forRoot({ rootPath: resolve(process.cwd(), 'dist/frontend'), exclude: ['/api/{*path}'] })],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
