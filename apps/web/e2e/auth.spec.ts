import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

interface MailpitMessageSummary {
  ID: string;
  To?: Array<{ Address: string }>;
}

async function expectNoSeriousA11yViolations(page: Page, surface: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.flatMap((node) => node.target),
    }));

  expect(violations, `${surface} accessibility violations`).toEqual([]);
}

test('register, verify email, sign in, and sign out', async ({ page, request }) => {
  const suffix = Date.now();
  const email = `e2e.${suffix}@example.com`;
  const username = `e2e${suffix}`;
  const password = 'CorrectHorse123';

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'landing page');

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Sign in to ChatSphere/i })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'login page');

  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('E2E Tester');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByText('Check your inbox.')).toBeVisible();

  const listing = await request.get('http://localhost:8025/api/v1/messages?limit=100');
  expect(listing.ok()).toBeTruthy();
  const { messages } = (await listing.json()) as { messages: MailpitMessageSummary[] };
  const message = messages.find((item) => item.To?.some((to) => to.Address === email));

  expect(message, 'verification email should be delivered to Mailpit').toBeTruthy();

  const detail = await request.get(`http://localhost:8025/api/v1/message/${message?.ID}`);
  expect(detail.ok()).toBeTruthy();
  const { Text } = (await detail.json()) as { Text: string };
  const link = /https?:\/\/[^\s]+/.exec(Text)?.[0];

  expect(link, 'verification email should contain a link').toBeTruthy();

  await page.goto(link ?? '');
  await expect(page.getByText("You're verified.")).toBeVisible();
  await page.getByRole('link', { name: 'Continue to ChatSphere' }).click();

  await expect(page).toHaveURL(/\/chats/);
  await expect(page.getByRole('heading', { name: 'Pick a conversation.' })).toBeVisible();
  await expect(page.getByText('E2E Tester').first()).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'authenticated workspace');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/chats/);
  await expect(page.getByRole('heading', { name: 'Pick a conversation.' })).toBeVisible();
});
