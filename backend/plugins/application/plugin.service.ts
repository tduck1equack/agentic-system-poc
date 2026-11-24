import { Actor, requireDeveloper } from '../../identity/domain/actor';
import { Clock, IdGenerator, ToolGateway } from '../../shared/application/ports';
import { DomainError } from '../../shared/domain/errors';
import { Plugin, PluginFields, VersionState } from '../domain/plugin';
export interface PluginRepository {
  ownedBy(ownerId: string): Promise<Plugin[]>;
  find(id: string): Promise<Plugin | null>;
  save(plugin: Plugin): Promise<void>;
  publish(version: VersionState): Promise<void>;
  catalog(): Promise<VersionState[]>;
  version(id: string): Promise<VersionState | null>;
}
/** Public application contract for other contexts; consumers never access plugin persistence. */
export interface PublishedPlugins { version(id: string): Promise<VersionState> }
export class PluginService implements PublishedPlugins {
  constructor(private readonly repository: PluginRepository, private readonly gateway: ToolGateway, private readonly ids: IdGenerator, private readonly clock: Clock) {}
  async list(actor: Actor) { requireDeveloper(actor); return (await this.repository.ownedBy(actor.id)).map(p => p.snapshot()); }
  catalog() { return this.repository.catalog(); }
  async version(id: string) {
    const version = await this.repository.version(id);
    if (!version) throw new DomainError('not_found', 'Published version not found');
    return version;
  }
  async create(actor: Actor, fields: PluginFields) {
    requireDeveloper(actor);
    const plugin = Plugin.create(this.ids.next(), actor.id, fields);
    await this.repository.save(plugin);
    return plugin.snapshot();
  }
  private async owned(actor: Actor, id: string) {
    requireDeveloper(actor);
    const plugin = await this.repository.find(id);
    if (!plugin) throw new DomainError('not_found', 'Not found');
    return plugin.ownedBy(actor.id);
  }
  async edit(actor: Actor, id: string, fields: PluginFields) {
    const plugin = (await this.owned(actor, id)).revise(fields);
    await this.repository.save(plugin);
    return plugin.snapshot();
  }
  private async tools(plugin: Plugin, token: string) {
    const state = plugin.snapshot();
    const tools = await this.gateway.discover(state.endpoint, state.auth === 'bearer' ? token : '');
    for (const tool of tools) this.gateway.validateSchema(tool.inputSchema);
    return tools;
  }
  async validate(actor: Actor, id: string, token: string) { return { tools: await this.tools(await this.owned(actor, id), token) }; }
  async publish(actor: Actor, id: string, token: string) {
    const plugin = await this.owned(actor, id);
    const version = plugin.publish(this.ids.next(), await this.tools(plugin, token), this.clock.now());
    await this.repository.publish(version);
    return version;
  }
}
