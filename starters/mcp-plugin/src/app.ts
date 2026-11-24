import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
/** Replace the token lookup and fixture data with your own service integration. */
export function createPluginApp(tokens: Readonly<Record<string, string>>) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  app.post('/mcp', async (req, res) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const workspace = token && Object.hasOwn(tokens, token) ? tokens[token] : undefined;
    if (!workspace) { res.status(401).json({ error: 'Invalid bearer token' }); return; }
    // A fresh server/transport per request avoids sharing authenticated state.
    const server = new McpServer({ name: 'my-mcp-plugin', version: '0.1.0' });
    server.registerTool('get_project_status', {
      description: 'Get a project status in the authenticated workspace',
      inputSchema: { projectId: z.string().min(1).max(100) },
      annotations: { readOnlyHint: true },
    }, async ({ projectId }) => ({
      content: [{ type: 'text', text: JSON.stringify({ projectId, workspace, status: 'on-track', source: 'starter-fixture' }) }],
    }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ error: 'Plugin request failed' }); else res.end(); }
  });
  app.all('/mcp', (_req, res) => { res.status(405).set('Allow', 'POST').json({ error: 'Stateless MCP endpoint accepts POST' }); });
  return app;
}
