import { CredentialVault, IdGenerator, ToolDefinition, ToolGateway } from '../../shared/application/ports';
import { DomainError } from '../../shared/domain/errors';
import { sameJson } from '../../shared/domain/json-equality';
import { PublishedPlugins } from '../../plugins/application/plugin.service';
import { Installation, assertCapacity } from '../domain/installation';
export interface InstallationRepository {
  list(userId: string): Promise<Installation[]>;
  find(id: string): Promise<Installation | null>;
  save(installation: Installation): Promise<void>;
  delete(id: string): Promise<void>;
  withUserLock<T>(userId: string, work: (repository: InstallationRepository) => Promise<T>): Promise<T>;
}
export interface InstalledCapability { id: string; name: string; description: string; tools: ToolDefinition[] }
/** The conversation context sees capabilities, never credentials or database rows. */
export interface InstalledPlugins {
  capabilities(userId: string): Promise<InstalledCapability[]>;
  instructions(userId: string, installationId: string): Promise<{ name: string; markdown: string }>;
  execute(userId: string, installationId: string, tool: ToolDefinition, args: unknown, approved: string[]): Promise<{ kind: 'result'; output: string } | { kind: 'approval'; tool: string; name: string }>;
  outputSanitizer(userId: string): Promise<(text: string) => string>;
}
export interface ToolApprovalPolicy { trusted(endpoint: string, toolName: string): boolean }
export interface OutputSanitizer { create(secrets: string[]): (text: string) => string }
export class InstallationService implements InstalledPlugins {
  constructor(private readonly repository: InstallationRepository, private readonly plugins: PublishedPlugins, private readonly gateway: ToolGateway, private readonly vault: CredentialVault, private readonly ids: IdGenerator, private readonly approvals: ToolApprovalPolicy, private readonly sanitizer: OutputSanitizer) {}
  private async owned(userId: string, id: string, repository = this.repository) {
    const installation = await repository.find(id);
    if (!installation) throw new DomainError('not_found', 'Not found');
    return installation.ownedBy(userId);
  }
  async list(userId: string) {
    return Promise.all((await this.repository.list(userId)).map(async i => ({ ...i.publicView(), version: await this.plugins.version(i.snapshot().versionId) })));
  }
  private async capacity(repository: InstallationRepository, userId: string, candidateTools: number, excludeId?: string) {
    const active = (await repository.list(userId)).filter(i => i.snapshot().enabled && i.snapshot().id !== excludeId);
    const counts = await Promise.all(active.map(async i => (await this.plugins.version(i.snapshot().versionId)).tools.length));
    assertCapacity(counts, candidateTools);
  }
  async install(userId: string, versionId: string, token: string) {
    const version = await this.plugins.version(versionId);
    const credential = version.auth === 'bearer' ? token : '';
    await this.gateway.discover(version.endpoint, credential);
    return this.repository.withUserLock(userId, async repository => {
      if ((await repository.list(userId)).some(i => i.snapshot().pluginId === version.pluginId)) throw new DomainError('conflict', 'Plugin already installed');
      await this.capacity(repository, userId, version.tools.length);
      const installation = Installation.install(this.ids.next(), userId, version.pluginId, versionId, this.vault.encrypt(credential));
      await repository.save(installation);
      return { id: installation.snapshot().id };
    });
  }
  async update(userId: string, id: string, patch: { token?: string; enabled?: boolean }) {
    const original = await this.owned(userId, id);
    const version = await this.plugins.version(original.snapshot().versionId);
    const token = version.auth === 'none' ? '' : patch.token;
    if (patch.token !== undefined) await this.gateway.discover(version.endpoint, token!);
    await this.repository.withUserLock(userId, async repository => {
      let installation = await this.owned(userId, id, repository);
      if (patch.token !== undefined) installation = installation.reconnect(this.vault.encrypt(token!));
      if (patch.enabled !== undefined) {
        if (patch.enabled) await this.capacity(repository, userId, version.tools.length, id);
        installation = installation.toggle(patch.enabled);
      }
      await repository.save(installation);
    });
    return { ok: true };
  }
  async uninstall(userId: string, id: string) {
    await this.repository.withUserLock(userId, async repository => { await this.owned(userId, id, repository); await repository.delete(id); });
    return { ok: true };
  }
  async verify(userId: string, id: string) {
    const original = await this.owned(userId, id);
    const version = await this.plugins.version(original.snapshot().versionId);
    const token = this.vault.decrypt(original.snapshot().credential);
    let discovered: ToolDefinition[];
    try {
      discovered = await this.gateway.discover(version.endpoint, token);
    } catch (error) {
      await this.repository.withUserLock(userId, async repository => {
        const current = await repository.find(id);
        if (current && current.snapshot().userId === userId) await repository.save(current.markStatus('disconnected'));
      });
      throw error;
    }
    const drifted = version.tools.some(pinned => {
      const live = discovered.find(t => t.name === pinned.name);
      return !live || !sameJson(live.inputSchema, pinned.inputSchema);
    });
    const status = drifted ? 'schema_drift' : 'connected';
    await this.repository.withUserLock(userId, async repository => {
      const current = await this.owned(userId, id, repository);
      await repository.save(current.markStatus(status));
    });
    if (drifted) throw new DomainError('invalid', 'Tool schema changed; reinstall an updated plugin');
    return { ok: true, status, tools: discovered.length };
  }
  async capabilities(userId: string): Promise<InstalledCapability[]> {
    return Promise.all((await this.repository.list(userId)).filter(i => i.snapshot().enabled).map(async i => {
      const version = await this.plugins.version(i.snapshot().versionId);
      return { id: i.snapshot().id, name: version.name, description: version.description, tools: version.tools };
    }));
  }
  async instructions(userId: string, id: string) {
    const installation = (await this.owned(userId, id)).requireEnabled();
    const version = await this.plugins.version(installation.snapshot().versionId);
    return { name: version.name, markdown: version.markdown };
  }
  async execute(userId: string, id: string, tool: ToolDefinition, args: unknown, approved: string[]) {
    const installation = (await this.owned(userId, id)).requireEnabled();
    const state = installation.snapshot();
    const version = await this.plugins.version(state.versionId);
    const pinned = version.tools.find(t => t.name === tool.name);
    if (!pinned || !this.gateway.validateArguments(pinned.inputSchema, args)) throw new DomainError('invalid', 'Invalid tool arguments');
    if (!this.approvals.trusted(version.endpoint, pinned.name) && !approved.includes(`${id}:${pinned.name}`)) {
      return { kind: 'approval' as const, tool: `${id}:${pinned.name}`, name: pinned.name };
    }
    const token = this.vault.decrypt(state.credential);
    const current = (await this.gateway.discover(version.endpoint, token)).find(t => t.name === pinned.name);
    if (!current || !sameJson(current.inputSchema, pinned.inputSchema)) throw new DomainError('invalid', 'Tool schema changed; reinstall an updated plugin');
    // Discovery is remote I/O: re-check revocation before the actual side effect.
    (await this.owned(userId, id)).requireEnabled();
    return { kind: 'result' as const, output: this.sanitizer.create([token])(JSON.stringify(await this.gateway.call(version.endpoint, token, pinned.name, args))) };
  }
  async outputSanitizer(userId: string) {
    return this.sanitizer.create((await this.repository.list(userId)).filter(i => i.snapshot().enabled).map(i => this.vault.decrypt(i.snapshot().credential)));
  }
}
