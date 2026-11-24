import { DomainError, requireValue } from '../../shared/domain/errors';
export interface PluginFields { name: string; description: string; logo: string; markdown: string; endpoint: string; auth: 'none' | 'bearer' }
export interface Tool { name: string; description?: string; inputSchema: Record<string, unknown> }
export interface PluginState extends PluginFields { id: string; ownerId: string; published: boolean }
export interface VersionState extends PluginFields { id: string; pluginId: string; tools: Tool[]; createdAt: Date }
export class Plugin {
  private constructor(private readonly state: PluginState) {}
  static create(id: string, ownerId: string, fields: PluginFields) {
    Plugin.validate(fields);
    return new Plugin({ ...structuredClone(fields), id, ownerId, published: false });
  }
  static restore(state: PluginState) { return new Plugin(structuredClone(state)); }
  private static validate(fields: PluginFields) {
    requireValue(fields.name.trim().length > 0 && fields.name.length <= 100, 'Plugin name must contain 1–100 characters');
    requireValue(fields.description.trim().length > 0 && fields.description.length <= 1000, 'Description must contain 1–1000 characters');
    requireValue(fields.markdown.trim().length > 0 && new TextEncoder().encode(fields.markdown).length <= 65536, 'Instructions must contain 1–65536 UTF-8 bytes');
    requireValue(['none', 'bearer'].includes(fields.auth), 'Unsupported authentication mode');
    let url: URL;
    try { url = new URL(fields.endpoint); } catch { throw new DomainError('invalid', 'Invalid MCP endpoint'); }
    requireValue(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash, 'Invalid MCP endpoint');
  }
  ownedBy(actorId: string) {
    if (this.state.ownerId !== actorId) throw new DomainError('not_found', 'Not found');
    return this;
  }
  revise(fields: PluginFields) {
    Plugin.validate(fields);
    return Plugin.restore({ ...this.state, ...structuredClone(fields) });
  }
  publish(versionId: string, tools: Tool[], now: Date): VersionState {
    requireValue(tools.length > 0 && tools.length <= 50, 'Plugin must expose 1–50 tools');
    requireValue(new Set(tools.map(t => t.name)).size === tools.length, 'Tool names must be unique');
    const { id, ownerId: _, published: __, ...fields } = this.state;
    return structuredClone({ ...fields, id: versionId, pluginId: id, tools, createdAt: now });
  }
  snapshot(): PluginState { return structuredClone(this.state); }
}
