import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
// Never use the application's DATABASE_URL or its model credentials for browser tests.
const base = process.env.E2E_DATABASE_URL;
if (!base) throw new Error('Set E2E_DATABASE_URL to a disposable PostgreSQL database; each run creates and drops its own schema.');
const schema = `playwright_${randomBytes(8).toString('hex')}`;
const url = new URL(base); url.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: url.toString(), CREDENTIAL_KEY: randomBytes(32).toString('hex'), OPENAI_API_KEY: 'playwright-mock-key', OPENAI_BASE_URL: 'http://127.0.0.1:43003/v1', OPENAI_MODEL: 'browser-mock', DEMO_PASSWORD: 'demo-password', COOKIE_SECURE: 'false', ALLOW_LOCAL_MCP: 'true', REFERENCE_MCP_URL: 'http://127.0.0.1:43002/mcp', REFERENCE_PORT: '43002', PORT: '43001' };
const children: ChildProcess[] = [];
const model = createServer(async (req, res) => {
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const installations = JSON.parse(body.instructions.split('Available installations: ')[1]);
    const installed = installations[0];
    const outputs = body.input.filter((item: any) => item.type === 'function_call_output');
    const call = (name: string, args: object, n: number) => ({ type: 'function_call', id: `fc${n}`, call_id: `call${n}`, name, arguments: JSON.stringify(args), status: 'completed' });
    const message = (text: string) => ({ type: 'message', id: 'answer', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] });
    let output;
    if (!installed) output = message('No plugin installed. Install a knowledge plugin to look up the policy.');
    else if (!outputs.length) output = call('read_plugin_instructions', { installationId: installed.installationId }, 1);
    else if (outputs.length === 1) output = call(body.tools.find((tool: any) => tool.description === 'Search customer knowledge articles').name, { query: 'refund' }, 2);
    else if (outputs.length === 2) {
      const articles = JSON.parse(JSON.parse(outputs[1].output).content[0].text);
      output = call(body.tools.find((tool: any) => tool.description === 'Fetch an article by ID').name, { articleId: articles[0].id }, 3);
    } else {
      const article = JSON.parse(JSON.parse(outputs[2].output).content[0].text);
      output = message(`${article.body} [${article.id}]`);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'response-browser', object: 'response', status: 'completed', output: [output] }));
  } catch { res.statusCode = 500; res.end(JSON.stringify({ error: { message: 'Mock response failed' } })); }
});
const db = new PrismaClient({ datasourceUrl: url.toString() });
let closing = false;
async function shutdown(code = 0) {
  if (closing) return; closing = true;
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise<void>(resolve => { child.once('exit', () => resolve()); setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000).unref(); })));
  model.closeAllConnections(); await new Promise<void>(resolve => model.close(() => resolve()));
  // Identifier is generated above, never taken from a request or an environment variable.
  try { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await db.$disconnect(); }
  process.exit(code);
}
process.on('SIGTERM', () => void shutdown()); process.on('SIGINT', () => void shutdown());
async function main() {
try {
  for (const args of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['--import', 'tsx', 'prisma/seed.ts']]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'pipe', timeout: 30000 });
    if (result.status !== 0) throw new Error('Browser database initialization failed. Check the disposable PostgreSQL connection.');
  }
  await new Promise<void>(resolve => model.listen(43003, '127.0.0.1', resolve));
  const reference = spawn(process.execPath, ['--import', 'tsx', 'reference/server.ts'], { env, stdio: 'inherit' }); children.push(reference);
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:43002/health')).ok) { ready = true; break; } } catch {} await delay(100); }
  if (!ready) throw new Error('Reference MCP did not start');
  children.push(spawn(process.execPath, ['dist/backend/main.js'], { env, stdio: 'inherit' }));
} catch (error) { console.error(error instanceof Error ? error.message : 'Browser fixture failed'); await shutdown(1); }

}
void main();
