import type { Plugin as Row, PluginVersion as VersionRow, Prisma } from '@prisma/client';
import { Database } from '../../shared/infrastructure/prisma';
import { PluginRepository } from '../application/plugin.service';
import { Plugin, VersionState } from '../domain/plugin';
function toPlugin(row: Row) { return Plugin.restore({ ...row, auth: row.auth as 'none' | 'bearer' }); }
function toVersion(row: VersionRow): VersionState { return { ...row, auth: row.auth as 'none' | 'bearer', tools: row.tools as unknown as VersionState['tools'] }; }
export class PrismaPluginRepository implements PluginRepository {
  constructor(private readonly db: Database) {}
  async ownedBy(ownerId: string) { return (await this.db.plugin.findMany({ where: { ownerId } })).map(toPlugin); }
  async find(id: string) { const row = await this.db.plugin.findUnique({ where: { id } }); return row ? toPlugin(row) : null; }
  async save(plugin: Plugin) {
    const { id, published, ...fields } = plugin.snapshot();
    // Editing a stale draft must never reset the publication flag.
    await this.db.plugin.upsert({ where: { id }, create: { id, published, ...fields }, update: fields });
  }
  async publish(version: VersionState) {
    await this.db.$transaction(async tx => {
      await tx.pluginVersion.create({ data: { ...version, tools: version.tools as unknown as Prisma.InputJsonValue } });
      await tx.plugin.update({ where: { id: version.pluginId }, data: { published: true } });
    });
  }
  async catalog() {
    const plugins = await this.db.plugin.findMany({ where: { published: true }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    return plugins.flatMap(p => p.versions.map(toVersion));
  }
  async version(id: string) { const row = await this.db.pluginVersion.findUnique({ where: { id } }); return row ? toVersion(row) : null; }
}
