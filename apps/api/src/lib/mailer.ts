import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from './logger.js';

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  connectionTimeout: 5_000,
  greetingTimeout: 5_000,
  socketTimeout: 10_000,
  ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildLink(path: string, token: string): string {
  const url = new URL(path, env.WEB_ORIGIN);
  url.searchParams.set('token', token);
  return url.toString();
}

function emailShell(options: {
  preview: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  const { preview, heading, body, actionLabel, actionUrl, footer } = options;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f3;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1b1d21;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e4de;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#3355ff;">ChatSphere</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0;font-size:28px;line-height:1.15;letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;font-size:15px;line-height:1.65;color:#5f6470;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:999px;background:#3355ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;">${escapeHtml(actionLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;font-size:12px;line-height:1.6;color:#7b8090;">
                ${escapeHtml(footer)}
              </td>
            </tr>
          </table>
          <p style="max-width:520px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#8a8f9c;text-align:center;">
            If you did not request this email, you can safely ignore it.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const info = await transport.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  logger.info({ messageId: info.messageId }, 'Email accepted by SMTP transport');
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const url = buildLink('/verify-email', input.token);
  const safeName = escapeHtml(input.name.split(' ')[0] || 'there');

  await sendMail({
    to: input.to,
    subject: 'Verify your ChatSphere email',
    text: `Hi ${input.name.split(' ')[0] || 'there'},\n\nVerify your email address to finish setting up ChatSphere:\n${url}\n\nThis link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    html: emailShell({
      preview: 'Verify your email address to finish setting up ChatSphere.',
      heading: `Welcome, ${safeName}.`,
      body: `<p style="margin:0;">Confirm your email address to finish setting up your ChatSphere account and keep your conversations secure.</p>`,
      actionLabel: 'Verify email',
      actionUrl: url,
      footer: `This link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    }),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const url = buildLink('/reset-password', input.token);
  const safeName = escapeHtml(input.name.split(' ')[0] || 'there');

  await sendMail({
    to: input.to,
    subject: 'Reset your ChatSphere password',
    text: `Hi ${input.name.split(' ')[0] || 'there'},\n\nReset your ChatSphere password here:\n${url}\n\nThis link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore it.`,
    html: emailShell({
      preview: 'Reset your ChatSphere password.',
      heading: 'Reset your password.',
      body: `<p style="margin:0;">Hi ${safeName}, we received a request to reset your ChatSphere password. Choose a new password using the button below.</p>`,
      actionLabel: 'Reset password',
      actionUrl: url,
      footer: `This link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes.`,
    }),
  });
}
