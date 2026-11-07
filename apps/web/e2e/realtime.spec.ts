import AxeBuilder from '@axe-core/playwright';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000';
const MAILPIT_URL = process.env.PLAYWRIGHT_MAILPIT_URL ?? 'http://localhost:8025';
const PASSWORD = 'CorrectHorse123';

interface TestUser {
  name: string;
  username: string;
  email: string;
}

interface MailpitMessageSummary {
  ID: string;
  To?: Array<{ Address: string }>;
}

async function verificationLink(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const listing = await request.get(`${MAILPIT_URL}/api/v1/messages?limit=100`);
    const { messages } = (await listing.json()) as { messages: MailpitMessageSummary[] };
    const message = messages.find((item) => item.To?.some((to) => to.Address === email));

    if (message) {
      const detail = await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const { Text } = (await detail.json()) as { Text: string };
      const link = /https?:\/\/[^\s]+/.exec(Text)?.[0];

      if (link) {
        return link;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Verification email for ${email} did not arrive.`);
}

async function registerAndVerify(request: APIRequestContext, user: TestUser) {
  const registration = await request.post(`${API_URL}/api/auth/register`, {
    data: {
      name: user.name,
      username: user.username,
      email: user.email,
      password: PASSWORD,
    },
  });

  expect(registration.status(), `register ${user.username}`).toBe(201);

  const link = await verificationLink(request, user.email);
  const token = new URL(link).searchParams.get('token');
  expect(token, 'verification token').toBeTruthy();

  const verification = await request.post(`${API_URL}/api/auth/verify-email`, {
    data: { token },
  });
  expect(verification.status(), `verify ${user.username}`).toBe(200);
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/chats/);
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

test('two users exchange a realtime message with receipts, actions, attachment, and notification', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);

  const suffix = `${Date.now()}`;
  const alice: TestUser = {
    name: `Avery ${suffix}`,
    username: `avery${suffix}`,
    email: `avery.${suffix}@example.com`,
  };
  const bob: TestUser = {
    name: `Blake ${suffix}`,
    username: `blake${suffix}`,
    email: `blake.${suffix}@example.com`,
  };

  await registerAndVerify(request, alice);
  await registerAndVerify(request, bob);

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  try {
    await signIn(alicePage, alice.email);
    await alicePage.getByRole('button', { name: 'New conversation' }).click();
    await alicePage.getByLabel('Search people').fill(bob.username);
    await alicePage.getByRole('button', { name: new RegExp(`@${bob.username}`) }).click();
    await expect(alicePage).toHaveURL(/\/chats\/[0-9a-f-]+/);
    const conversationUrl = alicePage.url();

    await signIn(bobPage, bob.email);
    await bobPage.goto(conversationUrl);
    await alicePage.getByRole('log').waitFor();
    await bobPage.getByRole('log').waitFor();

    await expect(alicePage.locator('main header').getByText(/Online/)).toBeVisible();
    // Allow the high-latency public tunnel time to finish both room joins.
    await bobPage.waitForTimeout(2_000);

    const message = `Hello Blake ${suffix}`;
    await alicePage.getByLabel(`Message ${bob.name}`).fill(message);
    await expect(bobPage.getByText(`${alice.name} is typing…`)).toBeVisible();
    await alicePage.getByRole('button', { name: 'Send message' }).click();
    await expect(bobPage.getByRole('log').getByText(message)).toBeVisible();

    const aliceRow = alicePage.locator('[data-message-id]').filter({ hasText: message }).last();
    await expect(aliceRow.getByText(/Read/)).toBeVisible();
    const messageId = await aliceRow.getAttribute('data-message-id');
    expect(messageId).toBeTruthy();
    const aliceMessageRow = alicePage.locator(`[data-message-id="${messageId}"]`);
    const bobMessageRow = bobPage.locator(`[data-message-id="${messageId}"]`);

    await bobMessageRow.getByRole('button', { name: 'Message actions' }).click();
    await bobMessageRow.getByRole('button', { name: 'React with 👍' }).click();
    await expect(alicePage.getByRole('button', { name: '👍 1' })).toBeVisible();

    await bobMessageRow.getByRole('button', { name: 'Message actions' }).click();
    await bobMessageRow.getByRole('button', { name: 'Reply' }).click();
    await expect(bobPage.getByText(`Replying to ${alice.name}`)).toBeVisible();
    const reply = `Reply from Blake ${suffix}`;
    await bobPage.getByLabel(`Message ${alice.name}`).fill(reply);
    await bobPage.getByRole('button', { name: 'Send message' }).click();
    await expect(alicePage.getByRole('log').getByText(reply)).toBeVisible();

    await aliceMessageRow.getByRole('button', { name: 'Message actions' }).click();
    await aliceMessageRow.getByRole('button', { name: 'Edit' }).click();
    await alicePage.getByLabel('Edit message').fill(`${message} edited`);
    await alicePage.getByRole('button', { name: 'Save' }).click();
    await expect(bobPage.getByRole('log').getByText(`${message} edited`)).toBeVisible();

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
      'base64',
    );
    await alicePage.locator('input[type=file]').setInputFiles({
      name: 'e2e-attachment.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await alicePage.getByText('e2e-attachment.png').waitFor();
    await alicePage.getByRole('button', { name: 'Send message' }).click();
    await expect(bobPage.getByRole('log').locator('img[alt="e2e-attachment.png"]')).toBeVisible();
    await expectNoSeriousA11yViolations(alicePage, 'conversation');

    const deleteMessage = `Delete me ${suffix}`;
    await alicePage.getByLabel(`Message ${bob.name}`).fill(deleteMessage);
    await alicePage.getByRole('button', { name: 'Send message' }).click();
    await expect(bobPage.getByRole('log').getByText(deleteMessage)).toBeVisible();
    const deleteRow = alicePage
      .locator('[data-message-id]')
      .filter({ hasText: deleteMessage })
      .last();
    await deleteRow.getByRole('button', { name: 'Message actions' }).click();
    alicePage.once('dialog', (dialog) => void dialog.accept());
    await deleteRow.getByRole('button', { name: 'Delete' }).click();
    await expect(bobPage.getByRole('log').getByText('Message deleted').first()).toBeVisible();

    await bobPage.goto('/chats');
    const ping = `Notification ${suffix}`;
    await alicePage.getByLabel(`Message ${bob.name}`).fill(ping);
    await alicePage.getByRole('button', { name: 'Send message' }).click();
    const bell = bobPage.getByRole('button', { name: /Notifications, \d+ unread/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(bobPage.getByRole('dialog').getByText(new RegExp(ping))).toBeVisible();
    await expectNoSeriousA11yViolations(bobPage, 'notification dialog');
    await bobPage
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(ping) })
      .click();
    await expect(bobPage).toHaveURL(new RegExp(`/chats/${conversationUrl.split('/').at(-1)}`));
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
