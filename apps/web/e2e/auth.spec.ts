import { expect, test } from '@playwright/test';

interface MailpitMessageSummary {
  ID: string;
  To?: Array<{ Address: string }>;
}

test('register, verify email, sign in, and sign out', async ({ page, request }) => {
  const suffix = Date.now();
  const email = `e2e.${suffix}@example.com`;
  const username = `e2e${suffix}`;
  const password = 'CorrectHorse123';

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

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/chats/);
  await expect(page.getByRole('heading', { name: 'Pick a conversation.' })).toBeVisible();
});
