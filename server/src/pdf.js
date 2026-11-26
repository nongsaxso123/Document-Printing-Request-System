/**
 * FR-06 — Request Form PDF generation.
 *
 * Rather than duplicating the printable markup in a separate template, this
 * launches a headless Chromium (via puppeteer-core against the system
 * `chromium` package — see Dockerfile) and navigates it to the *real*,
 * already-built printable page (requester/request-submitted or
 * officer/request-form-view), forwarding the caller's session cookie so
 * that page's own fetch()+render() logic populates real data exactly like
 * it does in a normal browser. emulateMediaType("print") then applies the
 * same @media print CSS a browser's own print dialog would use — so the
 * PDF always matches what "Print Request Form" produces, with zero risk of
 * the two drifting apart over time.
 *
 * Resource limits (the app container has 1 GB of RAM and each Chromium
 * takes ~150-250 MB):
 * - pdfLimiter: 10 PDFs per minute per account (429 above that).
 * - At most PDF_CONCURRENCY Chromiums at once (default 2); further jobs
 *   wait in line. If PDF_MAX_WAITING jobs are already waiting, the caller
 *   gets 503 "busy" instead of piling up more.
 * - Every step has a 20 s timeout, so a stuck page can't hold a slot forever.
 */

const puppeteer = require("puppeteer-core");
const { createLimiter } = require("./rateLimit");

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const PORT = process.env.PORT || 3000;
const ORIGIN = `http://localhost:${PORT}`;
const TIMEOUT_MS = 20000;
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.PDF_CONCURRENCY || "2", 10) || 2);
const MAX_WAITING = 10;

// Shared by the requester and officer PDF routes, so one account gets one
// budget across both.
const pdfLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  key: (req) => req.user && req.user.email,
  name: "pdf"
});

// Tiny semaphore: run() waits for a free slot, then runs the job.
let running = 0;
const waiting = [];

function acquire() {
  if (running < CONCURRENCY) {
    running++;
    return Promise.resolve();
  }
  if (waiting.length >= MAX_WAITING) {
    const err = new Error("PDF generator busy");
    err.status = 503;
    return Promise.reject(err);
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next(); // hand the slot straight to the next job
  else running--;
}

// Only the session cookie goes to the headless browser, never the user's
// other cookies.
function sessionCookieValue(cookieHeader) {
  for (const part of String(cookieHeader || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === "connect.sid") return part.slice(i + 1).trim();
  }
  return null;
}

async function renderOnce(path, cookieHeader) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: TIMEOUT_MS
  });

  try {
    const sid = sessionCookieValue(cookieHeader);
    if (sid) {
      // Scoped to localhost: the cookie can only ever go back to this app.
      await browser.setCookie({ name: "connect.sid", value: sid, domain: "localhost", path: "/", httpOnly: true });
    }
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);
    // The PDF only needs our own pages, scripts, styles and fonts (Sarabun
    // is self-hosted). Anything else (Google Fonts, avatars) is dropped.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith(ORIGIN + "/") || url.startsWith("data:")) req.continue();
      else req.abort();
    });
    const navResponse = await page.goto(ORIGIN + path, { waitUntil: "networkidle0", timeout: TIMEOUT_MS });
    if (!navResponse || !navResponse.ok()) {
      throw new Error(`PDF source page ${path} returned ${navResponse ? navResponse.status() : "no response"}`);
    }
    await page.emulateMediaType("print");
    const pdfData = await page.pdf({
      format: "A4",
      printBackground: true,
      timeout: TIMEOUT_MS,
      // 0: the 15mm border is body padding in the @media print CSS (see
      // style.css), which also keeps the browser's own header/footer off.
      margin: { top: "0", bottom: "0", left: "0", right: "0" }
    });
    // page.pdf() returns a Uint8Array, not a true Node Buffer — Express's
    // res.send() only recognizes Buffer.isBuffer() as binary and otherwise
    // JSON-serializes it (as {"0":37,"1":80,...}), silently producing a
    // corrupt "PDF" many times the real size. Wrap explicitly.
    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}

async function renderPagePdf(path, cookieHeader) {
  await acquire();
  try {
    return await renderOnce(path, cookieHeader);
  } finally {
    release();
  }
}

module.exports = { renderPagePdf, pdfLimiter };
