import { Module } from '@nestjs/common';
import { Database } from './prisma';
import { EncryptedCredentials, McpToolGateway, RandomIds, SystemClock } from './adapters';
const adapters = [Database, EncryptedCredentials, McpToolGateway, RandomIds, SystemClock];
@Module({ providers: adapters, exports: adapters })
export class InfrastructureModule {}
