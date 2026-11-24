import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Plugin, PluginFields } from '../backend/plugins/domain/plugin';
import { Installation, assertCapacity } from '../backend/installations/domain/installation';
import { Conversation, TurnBudget } from '../backend/conversations/domain/conversation';
import { sessionIsActive } from '../backend/identity/domain/actor';
const fields: PluginFields = { name: 'Knowledge', description: 'Customer knowledge', logo: '', markdown: '# Instructions', endpoint: 'https://example.test/mcp', auth: 'bearer' };
test('publication snapshots remain independent of later edits and caller mutations', () => {
  const plugin = Plugin.create('plugin', 'owner', fields);
  const tools = [{ name: 'search', inputSchema: { type: 'object' } }];
  const version = plugin.publish('v1', tools, new Date(0));
  tools[0].name = 'mutated';
  const revised = plugin.revise({ ...fields, markdown: '# New instructions' });
  assert.equal(version.markdown, '# Instructions');
  assert.equal(version.tools[0].name, 'search');
  assert.equal(revised.snapshot().markdown, '# New instructions');
  const copy = plugin.snapshot(); copy.markdown = 'tampered';
  assert.equal(plugin.snapshot().markdown, '# Instructions');
  assert.throws(() => plugin.ownedBy('other'));
  assert.throws(() => plugin.publish('v2', [], new Date()));
  assert.throws(() => plugin.publish('v2', [tools[0], tools[0]], new Date()));
});
test('plugin instructions are bounded by UTF-8 bytes, not character count', () => {
  assert.throws(() => Plugin.create('p', 'u', { ...fields, markdown: '界'.repeat(22000) }));
  assert.throws(() => Plugin.create('p', 'u', { ...fields, name: '  ' }));
  assert.throws(() => Plugin.create('p', 'u', { ...fields, endpoint: 'file:///etc/passwd' }));
});
test('installation owns credentials and enforces revocation and aggregate capacity', () => {
  const installed = Installation.install('i', 'alice', 'p', 'v', 'ciphertext');
  assert.throws(() => installed.ownedBy('bob'));
  assert.ok(!('credential' in installed.publicView()));
  assert.throws(() => installed.toggle(false).requireEnabled());
  assert.equal(installed.reconnect('new').snapshot().credential, 'new');
  assert.equal(installed.snapshot().credential, 'ciphertext');
  assertCapacity([10, 10, 10, 10], 10);
  assert.throws(() => assertCapacity([10, 10, 10, 10], 11));
  assert.throws(() => assertCapacity([1, 1, 1, 1, 1], 1));
});
test('conversation ownership and turn budgets are independent of transport and provider', () => {
  const c = new Conversation({ id: 'c', userId: 'alice', createdAt: new Date(0) });
  assert.throws(() => c.ownedBy('bob'));
  assert.throws(() => c.acceptPrompt('  '));
  const budget = new TurnBudget(100);
  for (let i = 0; i < 10; i++) budget.useTool(50);
  assert.throws(() => budget.useTool(50));
  assert.throws(() => new TurnBudget(100).assertTime(100));
  assert.equal(sessionIsActive({ id: 's', userId: 'a', expires: new Date(100) }, new Date(100)), false);
});

test('schema equality ignores JSONB object key order but preserves structural changes', async () => {
  const { sameJson } = await import('../backend/shared/domain/json-equality');
  const original = { type: 'object', properties: { query: { type: 'string', minLength: 1 } }, required: ['query'] };
  const fromJsonb = { required: ['query'], properties: { query: { minLength: 1, type: 'string' } }, type: 'object' };
  assert.equal(sameJson(original, fromJsonb), true);
  assert.equal(sameJson(original, { ...fromJsonb, required: [] }), false);
  assert.equal(sameJson(original, { ...fromJsonb, properties: { query: { type: 'number' } } }), false);
  assert.equal(sameJson({ enum: ['a', 'b'] }, { enum: ['b', 'a'] }), false);
});
