# Plugin Lab

A local multi-user plugin POC for Đức’s developer-portal assignment.

**Stack:** NestJS 11 API, React 19 + Vite 7 frontend, PostgreSQL + Prisma, official MCP TypeScript SDK, and OpenAI Responses API. There is no Next.js dependency.

## System documentation

The [Vietnamese system report draft](docs/system-documentation.vi.md) follows the supplied POC report format and covers requirements, architecture, data, workflows, test evidence, and remaining work. A [Word version](docs/Bao-cao-POC-Plugin-Lab.docx) is available for review and sharing.

## Run with Docker

Requires Node 24 for local tooling, or Docker with Compose for the complete stack.

```bash
cp .env.example .env
openssl rand -hex 32
```

Put the generated value in `CREDENTIAL_KEY` in `.env`. Set `OPENAI_API_KEY` for real agent conversations. Do not commit `.env`. Then:

```bash
docker compose up --build
```

Open http://localhost:3000. Startup applies migrations and seeds accounts. PostgreSQL data persists in the Compose volume. A reference MCP server runs separately at `http://reference:4100/mcp` inside Docker.

Seeded accounts share `DEMO_PASSWORD` (default `demo-password`):

| Account | Role |
| --- | --- |
| developer@demo.local | Publish plugins |
| alice@demo.local | Install and chat |
| bob@demo.local | Install and chat |

Changing `DEMO_PASSWORD` does not overwrite passwords for accounts already seeded.

## Local development

```bash
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run reference
```

In another terminal, run `npm run dev`. Open http://localhost:5173. Vite proxies `/api` to NestJS on port 3001. For local development, set `REFERENCE_MCP_URL=http://localhost:4100/mcp` in `.env` and enter that same endpoint when creating the plugin. The developer form defaults to the Docker endpoint; replace it for host development.

`npm run build` compiles NestJS into `dist/backend` and builds React into `dist/frontend`. `npm start` serves both on port 3001. `PORT` overrides the API port; update the Vite proxy if changing it during development.

If Docker reports that bridge/veth networking is unsupported, use an existing local PostgreSQL instance and set `DATABASE_URL` accordingly. This is a host Docker limitation rather than an application requirement.

## Five-minute demo

1. Sign in as the developer and open **Developer portal**.
2. Create “Customer Knowledge” with a description, bearer authentication, the reference MCP URL, and upload `reference/instructions.md`. Optionally upload a PNG, JPEG, or WebP logo.
3. Save the draft. Enter `alice-demo-token` as the temporary validation token. Validate to inspect the two tools, then publish.
4. Sign out and sign in as Alice. In the catalog, review the instructions and tools, then install using `alice-demo-token`.
5. Open **Agent chat** and ask “What is our refund policy?” Inspect the instruction-read and tool events. The response should cite `alice-refund` and say 14 days.
6. Sign in as Bob. He initially has no installation. Install the same plugin with `bob-demo-token`. His refund policy is 30 days, and Alice’s article IDs are inaccessible with Bob’s token.
7. Disable the plugin in **My plugins**, start a new conversation, and repeat the question. The agent has no plugin tools available. Uninstall removes its stored credential.
8. Try an invalid token or stop the reference server to demonstrate failure handling.

Disabling prevents future tool calls; messages already returned remain in conversation history. Use a new conversation when demonstrating that old knowledge is unavailable.

## Developer starter

Use [starters/mcp-plugin](starters/mcp-plugin/README.md) as a standalone starting point. It includes a bearer-authenticated MCP server, one example tool, Markdown instructions, registration fields, and independent build/test commands. The existing `reference/` folder remains the richer Customer Knowledge demo fixture.

## Developer plugin contract

A plugin consists of metadata, optional logo (2 MB maximum), plain UTF-8 Markdown (64 KB maximum), an MCP URL, and authentication mode (`none` or `bearer`). No uploaded code runs in the platform. Instructions are displayed as escaped text, so embedded HTML does not execute.

The endpoint must support MCP Streamable HTTP and expose 1–50 tools with JSON Schema input definitions compatible with Ajv and OpenAI function calling. Validation initializes MCP and follows paginated tool discovery. Publishing repeats validation and snapshots the draft into an immutable version. Existing installations stay pinned; reinstall to select a newer version.

Production-style endpoints require HTTPS and public DNS addresses. Private, loopback, link-local, and mapped private addresses are blocked, including at connection-time DNS lookup. Redirects are disabled. The exact `REFERENCE_MCP_URL` is an explicit local-development exception when `ALLOW_LOCAL_MCP=true`; turn that exception off outside the local POC.

Each installation owns its bearer token. Tokens are AES-256-GCM encrypted, excluded from API responses and prompts, and redacted from activity output. Losing or changing `CREDENTIAL_KEY` makes existing credentials unreadable; reinstall them with the new key.

Only the two reference-server tools are trusted as read-only by local server configuration. Other tools require explicit per-tool approval for the next chat turn. The checkbox authorizes any call to that named tool during that turn; it is not an argument-specific production approval workflow.

## API and source structure

- `backend/`: DDD-oriented NestJS modular monolith with identity, plugins, installations, and conversations contexts. Each contains domain, application, infrastructure, and HTTP layers. See [backend architecture](docs/backend-architecture.md).
- `frontend/`: React UI built by Vite.
- `backend/shared/`: technical ports, common domain errors, security/MCP infrastructure, and HTTP authentication/error handling.
- `prisma/`: schema, committed initial migration, seeded users.
- `reference/`: stateless MCP fixture with token-isolated articles.
- `starters/mcp-plugin/`: independent, copyable developer starter with its own package lock, instructions, and smoke test. See the [starter guide](starters/mcp-plugin/README.md).
- `tests/`: security tests, optional MCP tests, and full HTTP integration test with a mock model.

| API | Purpose |
| --- | --- |
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | Cookie session authentication |
| `GET/POST /api/developer/plugins` | List owned drafts / create draft |
| `PATCH /api/developer/plugins/:id` | Edit owned draft |
| `POST /api/developer/plugins/:id/validate` | Check connection and discover tools |
| `POST /api/developer/plugins/:id/publish` | Validate and publish immutable version |
| `GET /api/catalog` | Latest published version of each plugin |
| `GET/POST /api/installations` | List / install with version ID and token |
| `POST /api/installations/:id/verify` | Verify installed MCP connection and pinned schema |
| `PATCH/DELETE /api/installations/:id` | Toggle, reconnect, or uninstall |
| `GET/POST /api/conversations` | List / create owned chats |
| `POST /api/conversations/provider/verify` | Verify LLM provider connectivity and configured model |
| `GET /api/conversations/:id` | Messages and activity |
| `POST /api/conversations/:id/messages` | `{prompt, approved?: string[]}`; NDJSON activity, approval, text, and error events |

The model first calls `read_plugin_instructions(installationId)`. Only then does the runtime expose namespaced tools for that installation. Authorization is checked on each call, arguments are validated, and live tool schemas are checked against the pinned version. Limits are five enabled plugins, fifty tools, ten tool calls per turn, bounded remote responses, and fifteen seconds per MCP HTTP request. Model requests have a ninety-second deadline; an already running MCP operation may finish after that deadline. There are no automatic retries of remote tool execution.

## Verification

```bash
npm run check
npm test
npm run build
```

Domain, application, architecture, and security tests run by default. Network integration tests are opt-in:

```bash
INTEGRATION=true npm test
```

The integration test requires a migrated and seeded database (`DATABASE_URL`, or `.env`) and free ports 3099, 4100, and 4199. It starts NestJS, the reference MCP server, and a fake OpenAI server. It uses no paid API calls. Stop a separately running reference server first. Use a disposable database: the test adds plugin and chat fixtures.

To test only the MCP client against an already running reference server:

```bash
TEST_MCP_URL=http://localhost:4100/mcp npm test
```

## Playwright browser walkthrough

The [browser testing guide](docs/browser-testing.md) documents the reproducible Chromium walkthrough, screenshots/report, isolated database schema, and the defects found and fixed. Run `E2E_DATABASE_URL=... npm run test:browser` after installing Chromium with `npx playwright install chromium`. The model is stubbed; the backend, persistence, and MCP execution are real.

## POC boundaries

No OAuth, Composio, organization sharing, five-channel messaging, inbox, billing, public signup, password recovery, background health monitoring, or uploaded-code execution. No live OpenAI smoke test is possible without a real API key. The automated model test verifies orchestration, not model quality. An Orca browser smoke test verified the built UI, seeded login, and catalog rendering. A later Playwright walkthrough verified the core developer/user lifecycle, account switching, failed-send handling, and a 390px layout; see the browser testing guide for its scope.

Before public deployment, add login throttling, robust argument-specific tool approvals, conversation concurrency control, credential rotation, audit retention, production session settings (`COOKIE_SECURE=true` behind HTTPS), and publisher review. Published plugin information is shared with authenticated users; account data and credentials are isolated.

Dependency audit currently reports four high-severity findings in Prisma 6 CLI’s transitive `@prisma/config` dependency chain (`deepmerge-ts` and `effect`). Resolving them through Prisma 7 requires a separate adapter/configuration migration. Zod has been updated to the patched release. Treat this repository as a local POC until these gaps are addressed.
