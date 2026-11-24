import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
const endpoint = 'http://127.0.0.1:43002/mcp';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page), 'No uncaught browser errors or server failures').toEqual([]); });
async function login(page: Page, user: string, navigate = true) {
  if (navigate) await page.goto('/');
  await page.getByRole('combobox', { name: 'Email', exact: true }).selectOption(`${user}@demo.local`);
  await page.getByLabel('Password', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
  // Presentation pause only; assertions above still provide test synchronization.
  if (process.env.PW_WATCH === '1') await page.waitForTimeout(3000);
}
async function publish(page: Page, name: string) {
  await page.getByRole('button', { name: 'Developer portal', exact: true }).click();
  await page.getByLabel('Plugin name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Customer knowledge with per-user refund policies.');
  await page.getByLabel('MCP endpoint', { exact: true }).fill(endpoint);
  await page.getByLabel('Upload instructions.md').setInputFiles({ name: 'instructions.md', mimeType: 'text/markdown', buffer: readFileSync('reference/instructions.md') });
  await page.getByLabel('Logo (PNG, JPEG, WebP; up to 2 MB)').setInputFiles('docs/assets/plugin-lab-architecture.png');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Draft saved.');
  await page.getByLabel('Temporary test token').fill('wrong-token');
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Operation failed');
  await page.getByLabel('Temporary test token').fill('alice-demo-token');
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Connection successful.');
  await expect(page.locator('summary', { hasText: 'search_articles' })).toBeVisible();
  await expect(page.locator('summary', { hasText: 'get_article' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Plugin published to catalog.');
}
async function install(page: Page, name: string, token: string) {
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  await page.locator('article', { has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: 'Review plugin' }).click();
  await expect(page.locator('.review pre').first()).toContainText('# Customer Knowledge');
  await page.getByLabel('Personal bearer token').fill(token);
  await page.getByRole('button', { name: 'Install plugin' }).click();
  await expect(page.getByRole('status')).toHaveText('Plugin installed and connected.');
}
async function ask(page: Page, prompt: string) {
  await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
  await page.getByPlaceholder('Ask your agent…').fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
}

test('developer publication, user isolation, agent activity, reconnect, disable and uninstall', async ({ page }, info) => {
  const name = 'Walkthrough Knowledge';
  await test.step('Publish a plugin through the developer portal', async () => {
    await login(page, 'developer'); await publish(page, name);
    await screenshot(page, info, '01-developer-publication');
  });
  await test.step('Install as Alice and read her 14-day policy', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click(); await login(page, 'alice');
    await expect(page.getByRole('button', { name: 'Developer portal' })).toHaveCount(0);
    await install(page, name, 'alice-demo-token');
    await ask(page, 'What is our refund policy?');
    await expect(page.locator('.message.assistant').last()).toContainText('14 days');
    await expect(page.locator('.message.assistant').last()).toContainText('[alice-refund]');
    await expect(page.locator('.activity summary').filter({ hasText: /^instructions$/ })).toHaveCount(1);
    await expect(page.locator('.activity summary').filter({ hasText: /^tool$/ })).toHaveCount(2);
    await page.locator('.activity summary').first().click();
    await expect(page.locator('.activity')).toContainText('# Customer Knowledge');
    await screenshot(page, info, '02-alice-chat');
  });
  await test.step('Reload saved conversation and reconnect credentials', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
    await page.getByRole('button', { name: 'Verify model', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Model provider connected (browser-mock).');
    const id = await page.getByLabel('Conversation', { exact: true }).locator('option').nth(1).getAttribute('value');
    await page.getByLabel('Conversation', { exact: true }).selectOption(id!);
    await expect(page.locator('.message.assistant').last()).toContainText('14 days');
    await page.getByRole('button', { name: 'My plugins', exact: true }).click();
    const card = page.locator('article', { has: page.getByRole('heading', { name, exact: true }) });
    await expect(card.getByText('Connected', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Verify connection', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Connection verified.');
    await card.getByLabel('Reconnect with a new token').fill('wrong-token'); await card.getByRole('button', { name: 'Reconnect', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Operation failed');
    await card.getByLabel('Reconnect with a new token').fill('alice-demo-token'); await card.getByRole('button', { name: 'Reconnect', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Credentials updated.');
  });
  await test.step('Bob has separate installs and gets a 30-day policy', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click(); await login(page, 'bob');
    await ask(page, 'What is our refund policy?');
    await expect(page.locator('.message.assistant').last()).toContainText('No plugin installed');
    await install(page, name, 'bob-demo-token');
    await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
    await page.getByRole('button', { name: 'New conversation' }).click();
    await ask(page, 'What is our refund policy?');
    await expect(page.locator('.message.assistant').last()).toContainText('30 days');
    await expect(page.locator('.message.assistant').last()).toContainText('[bob-refund]');
    await expect(page.locator('.messages')).not.toContainText('alice-refund');
    await screenshot(page, info, '03-bob-chat');
  });
  await test.step('Disable blocks tools; enable and uninstall work', async () => {
    await page.getByRole('button', { name: 'My plugins', exact: true }).click();
    const card = page.locator('article', { has: page.getByRole('heading', { name, exact: true }) });
    await card.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(card.getByText('Disabled', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
    await page.getByRole('button', { name: 'New conversation' }).click();
    await ask(page, 'What is our refund policy?');
    await expect(page.locator('.message.assistant').last()).toContainText('No plugin installed');
    await expect(page.locator('.activity details')).toHaveCount(0);
    await page.getByRole('button', { name: 'My plugins', exact: true }).click();
    await card.getByRole('button', { name: 'Enable', exact: true }).click();
    await expect(card.getByText('Enabled', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Uninstall', exact: true }).click();
    await expect(card).toHaveCount(0);
    await screenshot(page, info, '04-uninstalled');
  });
});

test('sign-out clears developer workspace before another account signs in', async ({ page }, info) => {
  await login(page, 'developer');
  await page.getByRole('button', { name: 'Developer portal', exact: true }).click();
  await page.getByLabel('Plugin name', { exact: true }).fill('Private unsaved draft');
  await page.getByLabel('Temporary test token').fill('private-unsaved-token');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, 'alice', false);
  await screenshot(page, info, 'account-switch');
  await expect(page.getByRole('heading', { name: 'Catalog', exact: true })).toBeVisible();
  await expect(page.getByLabel('Temporary test token')).toHaveCount(0);
  await expect(page.getByLabel('Plugin name', { exact: true })).toHaveCount(0);
});

test('mobile login, catalog, and chat fit a 390px viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await screenshot(page, info, 'mobile-login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport();
  await login(page, 'alice');
  await screenshot(page, info, 'mobile-catalog');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
  await screenshot(page, info, 'mobile-chat');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const composer = page.getByPlaceholder('Ask your agent…');
  await composer.scrollIntoViewIfNeeded();
  await expect(composer).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
});

test('failed login and failed send show errors without losing the typed question', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid login');
  await login(page, 'alice');
  await page.getByRole('button', { name: 'Agent chat', exact: true }).click();
  await page.route('**/api/conversations/*/messages', route => route.abort('connectionfailed'));
  const prompt = 'Keep this question if the network fails';
  await page.getByPlaceholder('Ask your agent…').fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await screenshot(page, info, 'failed-send');
  await expect(page.getByPlaceholder('Ask your agent…')).toHaveValue(prompt);
});
