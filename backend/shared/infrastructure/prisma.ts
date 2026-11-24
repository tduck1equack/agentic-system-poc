import { PrismaClient } from '@prisma/client';
/** One managed connection pool; domain/application layers never import this. */
export class Database extends PrismaClient {
  async onModuleDestroy() { await this.$disconnect(); }
}
