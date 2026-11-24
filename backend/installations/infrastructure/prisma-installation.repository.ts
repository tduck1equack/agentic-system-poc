import type { Prisma } from '@prisma/client';
import { Database } from '../../shared/infrastructure/prisma';
import { InstallationRepository } from '../application/installation.service';
import { Installation } from '../domain/installation';
export class PrismaInstallationRepository implements InstallationRepository {
  constructor(private readonly db: Database, private readonly transaction?: Prisma.TransactionClient) {}
  private get client() { return this.transaction ?? this.db; }
  async list(userId: string) { return (await this.client.installation.findMany({ where: { userId } })).map(Installation.restore); }
  async find(id: string) { const row = await this.client.installation.findUnique({ where: { id } }); return row ? Installation.restore(row) : null; }
  async save(installation: Installation) {
    const data = installation.snapshot();
    await this.client.installation.upsert({ where: { id: data.id }, create: data, update: { credential: data.credential, enabled: data.enabled, status: data.status } });
  }
  async delete(id: string) { await this.client.installation.delete({ where: { id } }); }
  withUserLock<T>(userId: string, work: (repository: InstallationRepository) => Promise<T>): Promise<T> {
    if (this.transaction) return work(this);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      return work(new PrismaInstallationRepository(this.db, tx));
    });
  }
}
