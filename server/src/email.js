/**
 * Outbound email (FR-07 — status-change emails to the Requester — plus the
 * Officer-facing "new request submitted" alert, which isn't in file.md but
 * follows the same mechanism). No SMTP provider was configured when this
 * was built, so sendMail() degrades to a console log instead of throwing
 * when SMTP_HOST is unset — the rest of the app (in-app notifications
 * included) works the same either way. Fill in SMTP_* in .env once a real
 * mail account/relay is available; nothing else needs to change.
 *
 * Retries: the university relay (enoti.mfu.ac.th) sometimes refuses or
 * drops a connection and accepts the next one seconds later (seen
 * 2026-11-13: the "ready for pickup" email was lost that way while the
 * emails before and after it went through). A failed send caused by the
 * network or a temporary (4xx) SMTP reply is therefore retried in the
 * background a few times; a permanent error (bad address, 5xx) is not.
 * Retries live in memory, so a server restart drops any still pending.
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
    // Give up on a dead connection quickly; the retry below tries again.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return transporter;
}

// Wait before attempt 2, 3, 4 (after the first try fails).
const RETRY_DELAYS_MS = [20 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];
const TRANSIENT_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "ESOCKET", "ECONNECTION", "EDNS", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);

// Network trouble or a temporary 4xx reply: worth trying again later.
function isTransient(err) {
  if (!err) return false;
  if (TRANSIENT_CODES.has(err.code)) return true;
  if (err.responseCode && err.responseCode >= 400 && err.responseCode < 500) return true;
  return /timeout|timed out|connection closed/i.test(err.message || "");
}

async function attempt(t, message, to, n) {
  try {
    await t.sendMail(message);
    if (n > 1) console.log(`[email] Sent to ${to} on attempt ${n}: "${message.subject}"`);
    return { sent: true };
  } catch (err) {
    const retryIn = isTransient(err) ? RETRY_DELAYS_MS[n - 1] : undefined;
    console.error(`[email] Attempt ${n} failed for ${to}: ${err.message}` + (retryIn ? ` (retrying in ${Math.round(retryIn / 1000)}s)` : " (giving up)"));
    if (retryIn) {
      // In the background: the action that triggered the email (approve,
      // mark ready, ...) has already finished and must not wait for this.
      setTimeout(() => { attempt(t, message, to, n + 1); }, retryIn).unref();
      return { sent: false, reason: "retrying", error: err.message };
    }
    return { sent: false, reason: "send-error", error: err.message };
  }
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email] SMTP not configured — would send to ${to}: "${subject}"`);
    return { sent: false, reason: "smtp-not-configured" };
  }
  // A bad SMTP config or a down mail server never fails the request that
  // triggered the notification; the in-app notification exists either way.
  const message = { from: process.env.MAIL_FROM || "ODPRS <no-reply@example.com>", to, subject, html, text };
  return attempt(t, message, to, 1);
}

module.exports = { sendMail };
