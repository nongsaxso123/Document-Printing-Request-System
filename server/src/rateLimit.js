/**
 * Small in-memory fixed-window rate limiter, shared by every route that
 * needs one (kiosk claim lookup, login, request submission). Each limiter
 * counts hits per key (client IP by default) and answers 429 once a key
 * goes over `max` within `windowMs`; the count resets when the window ends.
 *
 * In-memory is enough for this app: it runs as a single Node process (see
 * docker-compose.prod.yml), so every request sees the same counters. A
 * restart clears them, which only ever makes the limit more lenient.
 * req.ip is the real client address in production because app.js sets
 * "trust proxy" behind Caddy.
 */

function createLimiter({ windowMs, max, key, onLimit }) {
  const hits = new Map(); // key -> { count, windowStart }

  // Drop finished windows now and then so the map can't grow forever.
  setInterval(function () {
    const now = Date.now();
    for (const [k, entry] of hits) {
      if (now - entry.windowStart >= windowMs) hits.delete(k);
    }
  }, windowMs).unref();

  return function rateLimit(req, res, next) {
    const k = (key ? key(req) : null) || req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || now - entry.windowStart >= windowMs) {
      hits.set(k, { count: 1, windowStart: now });
      return next();
    }
    entry.count += 1;
    if (entry.count <= max) return next();

    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    res.set("Retry-After", String(retryAfterSec));
    if (onLimit) return onLimit(req, res, retryAfterSec);
    res.status(429).type("text/plain; charset=utf-8").send(
      "ส่งคำขอถี่เกินไป กรุณารอประมาณ " + retryAfterSec + " วินาทีแล้วลองใหม่\n" +
      "Too many requests. Please wait about " + retryAfterSec + " seconds and try again."
    );
  };
}

module.exports = { createLimiter };
