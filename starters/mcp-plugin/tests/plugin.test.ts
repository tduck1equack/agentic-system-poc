import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createPluginApp } from '../src/app.js';
test('starter authenticates users, discovers tools, isolates workspace data, and rejects invalid inputs', async () => {
  const server = createPluginApp({ 'alice-test': 'alice', 'bob-test': 'bob' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
  async function clientFor(token: string) {
    const client = new Client({ name: 'starter-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    return client;
  }
  const clients: Client[] = [];
  try {
    const unauthenticated = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unauthenticated.status, 401);
    for (const workspace of ['alice', 'bob']) {
      const client = await clientFor(`${workspace}-test`); clients.push(client);
      const listed = await client.listTools(); assert.equal(listed.tools[0].name, 'get_project_status');
      const result = await client.callTool({ name: 'get_project_status', arguments: { projectId: 'project-1' } });
      assert.match(JSON.stringify(result), new RegExp(workspace));
      assert.ok(!JSON.stringify(result).includes(`${workspace}-test`));
      const invalid = await client.callTool({ name: 'get_project_status', arguments: { projectId: '' } });
      assert.equal(invalid.isError, true);
    }
  } finally { await Promise.all(clients.map(c => c.close())); await new Promise<void>(resolve => server.close(() => resolve())); }
});
