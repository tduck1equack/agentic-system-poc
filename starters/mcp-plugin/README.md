# MCP plugin starter

Copy this directory to build a standalone MCP plugin for Plugin Lab. It runs independently of the platform and includes:

- A TypeScript MCP server using Streamable HTTP and stateless JSON responses.
- Bearer-token authentication with separate workspace identities.
- One read-only example tool: `get_project_status(projectId)`.
- Agent instructions, sample registration fields, a build, and an SDK-based smoke test.

The example tool returns fixture data. Replace it with calls to your real service.

## Run independently

Requires Node 24.

```bash
cp -R starters/mcp-plugin /path/to/my-plugin
cd /path/to/my-plugin
npm ci
cp .env.example .env
npm run dev
```

Choose your own token values in `PLUGIN_TOKENS` before connecting. Its JSON keys are bearer tokens; values are workspace IDs. This environment-based lookup is for local development; replace it with your service's credential store for deployment. Never put real tokens in instructions or tool descriptions.

The endpoint is `http://localhost:4200/mcp`. Health check: `http://localhost:4200/health`.

```bash
npm run build
npm start
npm test
```

The smoke test starts its own server on an ephemeral localhost port. It checks authentication, discovery, workspace isolation, and invalid arguments without a database or model API key.

## Register in Plugin Lab

1. Start the platform with `ALLOW_LOCAL_MCP=true` and `REFERENCE_MCP_URL=http://localhost:4200/mcp`. Restart the API after changing these environment variables. This replaces the one local endpoint exception used by the Customer Knowledge demo.
2. Sign in as `developer@demo.local` and open Developer portal.
3. Enter the fields in `plugin.example.json`, select bearer authentication, and upload `instructions.md`. `plugin.example.json` is a copy/paste reference, **not an automatically imported manifest**.
4. Save the draft. Enter one of your configured token keys as the temporary test token, validate, and publish.
5. Sign in as Alice or Bob, review the plugin, and install it using a token mapped to that user's workspace.
6. Ask the agent: “What is the status of project demo-1?”
7. The agent reads the instructions first. Check the tool approval box and send “Continue” when prompted. The platform does not automatically trust a third-party tool's read-only annotation.

These localhost instructions assume the platform API also runs directly on your host. Inside Docker, `localhost` points at the API container: deploy the starter on the same Docker network and use its service URL, or use a reachable HTTPS endpoint. The registered URL and local exception must match exactly. Outside local development, expose the MCP endpoint through HTTPS and disable `ALLOW_LOCAL_MCP`.

## Customize

- Rename the package and the MCP server identity in `src/app.ts`.
- Replace `get_project_status` with your tool names, descriptions, Zod argument schemas, and handlers.
- Resolve credentials to a workspace before invoking handlers. Derive tenant identity from the authenticated token, never from model-supplied parameters.
- Filter every downstream query by that authenticated workspace. Do not keep user credentials in shared mutable globals.
- Return JSON/text results; use `isError: true` for tool failures. Do not expose tokens in results or errors.
- Update `instructions.md` with when to use the plugin, required information, call order, citation format, and failure behavior.
- Add tests for your service's permission boundaries and failures.

Publication snapshots the instructions and tool schemas. Publish a new version after schema or instruction changes; users reinstall to select it. Platform v1 supports up to fifty tools, none/bearer authentication, and Streamable HTTP. OAuth, arbitrary code uploads, resource discovery, and prompt discovery are outside this POC.

See `reference/` in the platform repository for a more complete two-tool knowledge-base example with different fixture articles for Alice and Bob.
