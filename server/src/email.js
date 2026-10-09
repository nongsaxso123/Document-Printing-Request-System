/**
 * Outbound email (FR-07 — status-change emails to the Requester — plus the
 * Officer-facing "new request submitted" alert, which isn't in file.md but
 * follows the same mechanism). No SMTP provider was configured when this
 * was built, so sendMail() degrades to a console log instead of throwing
 * when SMTP_HOST is unset — the rest of the app (in-app notifications
 * included) works the same either way. Fill in SMTP_* in .env once a real
 * mail account/relay is available; nothing else needs to change.
 */

const nodemailer = require("nodemailer");

let transporter = null;
let transporterAttempted = false;

function getTransporter() {
  if (transporterAttempted) return transporter;
  transporterAttempted = true;

  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email] SMTP not configured — would send to ${to}: "${subject}"`);
    return { sent: false, reason: "smtp-not-configured" };
  }

  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || "ODPRS <no-reply@example.com>",
      to,
      subject,
      html,
      text
    });
    return { sent: true };
  } catch (err) {
    // A bad SMTP config or a down mail server should never fail the request
    // that triggered the notification (e.g. approving a request) — the
    // in-app notification still gets created regardless of email delivery.
    console.error(`[email] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: "send-error", error: err.message };
  }
}

module.exports = { sendMail };
