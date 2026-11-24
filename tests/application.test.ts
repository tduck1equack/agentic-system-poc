import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InstallationService, InstallationRepository } from '../backend/installations/application/installation.service';
import { Installation } from '../backend/installations/domain/installation';
import { ToolGateway } from '../backend/shared/application/ports';
import { VersionState } from '../backend/plugins/domain/plugin';
class MemoryInstallations implements InstallationRepository {
  rows = new Map<string, Installation>();
  async list(userId: string) { return [...this.rows.values()].filter(i => i.snapshot().userId === userId); }
  async find(id: string) { return this.rows.get(id) ?? null; }
  async save(i: Installation) { this.rows.set(i.snapshot().id, i); }
  async delete(id: string) { this.rows.delete(id); }
  async withUserLock<T>(_user: string, work: (repository: InstallationRepository) => Promise<T>): Promise<T> { return work(this); }
}
const tool = { name: 'lookup', inputSchema: { type: 'object' } };
const version: VersionState = { id: 'v1', pluginId: 'p', name: 'Knowledge', description: 'docs', markdown: '# Read first', logo: '', endpoint: 'https://example.test/mcp', auth: 'bearer', tools: [tool], createdAt: new Date(0) };
function fixture(trusted = false) {
  const repository = new MemoryInstallations();
  let calls = 0;
  const gateway: ToolGateway = {
    discover: async () => [tool], validateSchema() {},
    validateArguments: (schema, value): value is Record<string, unknown> => typeof value === 'object' && value !== null,
    call: async (_endpoint, token) => { calls++; return { tokenUsed: token }; },
  };
  const service = new InstallationService(repository, { version: async () => version }, gateway, { encrypt: s => `enc:${s}`, decrypt: s => s.slice(4) }, { next: () => 'i' }, { trusted: () => trusted }, { create: secrets => text => secrets.reduce((value, secret) => value.replaceAll(secret, '[redacted]'), text) });
  return { repository, gateway, service, calls: () => calls };
}
test('application requires approval, protects ownership, and uses only installed credentials', async () => {
  const f = fixture();
  await f.service.install('alice', 'v1', 'alice-token');
  await assert.rejects(f.service.instructions('bob', 'i'));
  assert.deepEqual(await f.service.execute('alice', 'i', tool, {}, []), { kind: 'approval', tool: 'i:lookup', name: 'lookup' });
  assert.equal(f.calls(), 0);
  const result = await f.service.execute('alice', 'i', tool, {}, ['i:lookup']);
  assert.equal(result.kind, 'result');
  assert.ok(!JSON.stringify(result).includes('alice-token'));
  assert.equal(f.calls(), 1);
  assert.ok(!JSON.stringify(await f.service.list('alice')).includes('alice-token'));
  assert.equal((await f.service.outputSanitizer('alice'))('alice-token'), '[redacted]');
  await f.service.update('alice', 'i', { enabled: false });
  await assert.rejects(f.service.execute('alice', 'i', tool, {}, ['i:lookup']));
  await assert.rejects(f.service.uninstall('bob', 'i'));
  await f.service.uninstall('alice', 'i');
  await assert.rejects(f.service.instructions('alice', 'i'));
});
test('schema drift and revocation during discovery prevent external execution', async () => {
  const f = fixture(true);
  await f.service.install('alice', 'v1', 'token');
  f.gateway.discover = async () => [{ ...tool, inputSchema: { type: 'string' } }];
  await assert.rejects(f.service.execute('alice', 'i', tool, {}, []));
  f.gateway.discover = async () => { const i = await f.repository.find('i'); await f.repository.save(i!.toggle(false)); return [tool]; };
  await assert.rejects(f.service.execute('alice', 'i', tool, {}, []));
  assert.equal(f.calls(), 0);
});

test('MCP execution accepts a schema whose object keys were reordered by storage', async () => {
  const f = fixture(true);
  const original = { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] };
  const stored = { required: ['query'], properties: { query: { type: 'string' } }, type: 'object' };
  const saved = version.tools;
  version.tools = [{ ...tool, inputSchema: stored }];
  try {
    f.gateway.discover = async () => [{ ...tool, inputSchema: original }];
    await f.service.install('alice', 'v1', 'alice-token');
    const result = await f.service.execute('alice', 'i', { ...tool, inputSchema: stored }, { query: 'refund' }, []);
    assert.equal(result.kind, 'result');
    assert.equal(f.calls(), 1);
  } finally { version.tools = saved; }
});

test('installation verification updates connection status for healthy, drifted, and unreachable providers', async () => {
  const f = fixture(true);
  await f.service.install('alice', 'v1', 'alice-token');
  await assert.rejects(f.service.verify('bob', 'i'));
  const verified = await f.service.verify('alice', 'i');
  assert.deepEqual(verified, { ok: true, status: 'connected', tools: 1 });
  assert.equal((await f.service.list('alice'))[0].status, 'connected');

  f.gateway.discover = async () => [{ ...tool, inputSchema: { type: 'string' } }];
  await assert.rejects(f.service.verify('alice', 'i'), /Tool schema changed/);
  assert.equal((await f.service.list('alice'))[0].status, 'schema_drift');

  f.gateway.discover = async () => { throw new Error('Connection refused'); };
  await assert.rejects(f.service.verify('alice', 'i'), /Connection refused/);
  assert.equal((await f.service.list('alice'))[0].status, 'disconnected');

  f.gateway.discover = async () => [tool];
  await f.service.verify('alice', 'i');
  assert.equal((await f.service.list('alice'))[0].status, 'connected');
});
