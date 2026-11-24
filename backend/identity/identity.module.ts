import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../shared/infrastructure/infrastructure.module';
import { Database } from '../shared/infrastructure/prisma';
import { SystemClock } from '../shared/infrastructure/adapters';
import { BcryptPasswords, SessionIds } from './infrastructure/authentication';
import { IdentityService } from './application/identity.service';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository';
import { IdentityController } from './http/identity.controller';
@Module({
  imports: [InfrastructureModule], controllers: [IdentityController],
  providers: [{ provide: IdentityService, inject: [Database, SystemClock], useFactory: (db: Database, clock: SystemClock) => new IdentityService(new PrismaIdentityRepository(db), new BcryptPasswords(), new SessionIds(), clock) }],
  exports: [IdentityService],
})
export class IdentityModule {}
