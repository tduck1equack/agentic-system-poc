import 'dotenv/config';
import { createPluginApp } from './app.js';
const tokens: unknown = JSON.parse(process.env.PLUGIN_TOKENS ?? '{}');
if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens) || !Object.entries(tokens).length || Object.entries(tokens).some(([token, workspace]) => !token.trim() || typeof workspace !== 'string' || !workspace.trim())) {
  throw new Error('Configure PLUGIN_TOKENS as a JSON object mapping nonempty tokens to workspace IDs');
}
const port = Number(process.env.PORT ?? 4200);
const server = createPluginApp(tokens as Record<string, string>).listen(port, '0.0.0.0', () => console.log(`MCP starter listening on port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
