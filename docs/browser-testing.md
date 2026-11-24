# Playwright browser walkthrough

The Chromium suite drives the production React build through the real NestJS API and reference MCP server. Model selection and answer generation use a deterministic OpenAI-compatible stub. The stub derives answers from actual tool results; it cannot substitute a successful policy answer when the MCP call fails.

## Run

```bash
npm ci
npx playwright install chromium
E2E_DATABASE_URL=postgresql://plugin:plugin@localhost:5438/pluginlab npm run test:browser
npm run test:browser:report
```

For a visible walkthrough with 700 ms between browser actions and three-second pauses at screenshot checkpoints:

```bash
PW_WATCH=1 E2E_DATABASE_URL=postgresql://plugin:plugin@localhost:5438/pluginlab npm run test:browser
```

Chromium opens on the desktop display. Each test gets a fresh browser context; the browser closes when the suite finishes.

Use a disposable PostgreSQL database. The runner requires `E2E_DATABASE_URL` explicitly and creates a randomly named `playwright_*` schema, applies migrations, and seeds demo accounts. It drops only that generated schema when the test services shut down. It does not use the application's `DATABASE_URL` or real model credentials. A forcibly terminated process may require manual cleanup of its generated schema.

The database account needs permission to create and drop schemas. Ports 43001 (API/UI), 43002 (reference MCP), and 43003 (mock model) must be available. The runner uses generated encryption keys, fixed demo credentials, and a test-only model key. The reference server accepts `REFERENCE_PORT` for this isolated launch; its normal default remains 4100.

`npm run test:browser` builds the application first. To rerun unchanged builds, use `E2E_DATABASE_URL=... npx playwright test`.

## Scenarios

| Scenario | Checks |
| --- | --- |
| Developer and user lifecycle | Login, Markdown/logo upload, draft save, invalid/valid MCP credentials, discovery, publication, review and install, Alice/Bob isolation, actual search/retrieval results, activity, persisted conversation reload, invalid/valid reconnect, disable, enable, uninstall |
| Account switching | Signing out removes the previous developer's unsaved draft, token, and workspace before another user signs in |
| Mobile layout | Login, catalog, and chat at 390 × 844; no horizontal overflow; composer and Send remain reachable |
| Failure handling | Wrong-password error; simulated connection failure preserves the typed chat question for manual retry |

The suite fails on uncaught browser exceptions and HTTP responses with status 500 or greater. Expected validation/authentication failures are asserted within their scenarios. It saves screenshots at major checkpoints, with traces and video retained on failure.

## Findings from the 24 November 2026 run

The first complete walkthrough found three application defects, all corrected and covered by regression checks:

1. **Stale account state:** signing out from Developer portal left its selected screen, unsaved draft, and temporary token in React state. Logout now clears account-specific state, ignores stale refresh results, and the developer view checks the current role. Backend authorization was already enforced; the defect was client-side data visibility.
2. **False schema drift:** JSON string comparison treated PostgreSQL JSONB key reordering as a changed MCP input schema. Comparison now ignores object member order while preserving array order and actual value/structure differences. This unblocks tool execution without accepting genuine schema changes.
3. **Lost chat draft:** the composer reset before the request completed. It now retains its value after transport or streamed execution errors and clears after successful completion.

The earlier API test used a hard-coded model answer that could mask a failed tool call. That mock now reads the actual tool output, and the test requires a tool activity event without an error event.

Final browser result: **4 scenarios passed**, Chromium, desktop 1440 × 1000 and mobile viewport 390 × 844. Desktop chat and mobile screenshots were also visually reviewed. Type checking and the production build passed.

## Artifacts and limits

- `playwright-report/index.html`: generated HTML report with steps and screenshot attachments.
- `test-results/`: screenshots and any retained failure traces/videos.
- `playwright.config.ts`: browser, viewport, timeouts, and service lifecycle.
- `tests/browser/server.ts`: isolated test environment and deterministic model.
- `tests/browser/walkthrough.spec.ts`: browser actions and assertions.

Generated artifacts are ignored by Git and replaced on the next run. Do not run this fixture against a shared production database. This walkthrough does not establish live OpenAI quality, cross-browser compatibility, real mobile-device behavior, argument-specific approval UX, load capacity, or production readiness.
