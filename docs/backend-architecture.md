# Backend architecture

The backend is a DDD-oriented modular monolith. Each bounded context has domain objects, application use cases/ports, infrastructure adapters, HTTP adapters, and a NestJS composition module. It uses one PostgreSQL database; it does not introduce microservices, event sourcing, CQRS infrastructure, or an event bus for the POC.

## Context ownership

| Context | Domain responsibility | Persistence it owns |
| --- | --- | --- |
| Identity | Actor roles, session validity | User, Session |
| Plugins | Draft invariants, publisher ownership, immutable publication snapshots | Plugin, PluginVersion |
| Installations | User ownership, pinned version, enable/reconnect transitions, installation capacity | Installation |
| Conversations | Conversation ownership, prompt validity, turn limits | Conversation, Message, ExecutionEvent |

`shared/domain` contains domain errors. `shared/application` contains technical boundary interfaces for IDs, time, encryption, and tool transport. `shared/infrastructure` implements those interfaces and owns the connection pool and outbound network policy. Context-specific password and tool-approval policies stay in their respective infrastructure directories.

## Dependency direction

```text
HTTP controller → application use case → domain object/policy
                         ↓ interface
                  infrastructure adapter

NestJS context module wires concrete adapters to use cases.
```

Domain code imports only domain code. Application code imports domain objects and application contracts; it does not import NestJS, Prisma, Express, MCP/OpenAI SDKs, or environment variables. HTTP controllers validate request shapes and transport-specific assets, obtain the authenticated actor, and invoke a use case. They do not access persistence or SDKs.

The application classes are plain TypeScript. NestJS registers them with factory providers in the context modules, which serve as composition roots. Interfaces are injected through constructors rather than resolved from service locators.

## Cross-context contracts

- Identity's authenticated `Actor` reaches HTTP adapters through the global session guard.
- Plugins exports the `PublishedPlugins` application contract. Installations uses it to resolve immutable versions; it never queries PluginVersion through Prisma.
- Installations exports `InstalledPlugins`: list capabilities, load instructions, execute tools, and sanitize output. Conversations cannot see installation credentials or invoke MCP directly.
- Conversations depends on a `LanguageModel` session port. The OpenAI adapter owns provider request formatting, reasoning/transcript continuation, and the SDK client.

Use the exported application contracts when adding another integration. Do not import another context's repository adapter into a use case.

## Invariants and transactions

`Plugin` validates metadata and instruction byte limits, checks ownership, and produces a detached version snapshot. Publication atomically inserts that version and marks the plugin published. Later draft edits never update previous versions or reset the published flag. A publication uses the draft snapshot that was validated, even if the developer edits the draft while remote validation is in progress.

`Installation` owns the encrypted credential, pinned version, and enabled status. Its public view omits the credential. The application evaluates the domain capacity policy under a PostgreSQL advisory lock scoped to the user. Installation creation, enable/disable, credential replacement, and uninstall share this lock. This prevents concurrent installations from bypassing the five-plugin/fifty-tool limit. Published-version reads can happen outside the transaction because versions are immutable.

Every instruction read and execution rechecks installation ownership and enabled state. Tool execution verifies the pinned schema against discovery, checks approval, and checks revocation again after discovery before the remote call. Database authorization cannot revoke a remote request already in flight; there is no distributed transaction with an MCP service.

`Conversation` protects ownership and validates prompts. `TurnBudget` bounds calls and elapsed time. The use case persists messages and activity through its repository. The model and MCP adapters handle remote calls, and the HTTP adapter serializes activity as NDJSON. Concurrent turns on the same conversation remain a documented POC limitation.

## Compatibility

Existing URL paths, success response shapes, login cookies, and NDJSON events remain compatible with the React client. Controllers now explicitly enforce HTTP verbs; accidental methods no longer trigger operations. Duplicate installs return 409. Invalid metadata and instruction sizes return 400, unauthenticated requests 401, non-developer publication requests 403, and inaccessible owned resources 404.

The Prisma schema and migration history are unchanged. Existing IDs remain valid. New domain entity IDs are 32-character cryptographic hex strings; session IDs remain 64-character hex strings. Consumers must treat IDs as opaque strings.

## Tests and extension points

- `tests/domain.test.ts`: publication isolation, UTF-8 limits, ownership, capacity, session expiry, and turn budgets without a database or framework.
- `tests/application.test.ts`: fake repositories/gateways verify approval, credentials, schema drift, and revocation during remote discovery.
- `tests/architecture.test.ts`: checks inward import boundaries and forbids persistence/provider imports from HTTP adapters.
- `tests/api.test.ts`: regression flow through real NestJS, PostgreSQL, MCP, and a mock OpenAI server.
- `starters/mcp-plugin/tests/`: standalone plugin SDK contract test.

Adding a new use case starts in the owning context's application layer. Put business rules into the domain, define any new external port, implement it in infrastructure, wire it in the NestJS module, and expose a narrow controller route. Keep provider-specific data inside adapters.
