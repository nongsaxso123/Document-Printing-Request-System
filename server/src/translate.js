/**
 * Best-effort Thai -> English translation for the maintenance-mode message
 * (see settings.js). Uses Google Translate's free, unofficial web endpoint
 * (translate.googleapis.com/translate_a/single) — no API key/account
 * needed, but also no SLA: it's the same endpoint the Google Translate
 * website itself calls, not a supported public API, so it can change
 * shape, rate-limit, or disappear without notice. Chosen deliberately over
 * the paid Cloud Translation API for this student project (no budget/SMTP
 * account either — see email.js for the same reasoning).
 *
 * Fetched through a real headless Chromium (same puppeteer-core + system
 * `chromium` package pdf.js already uses) rather than Node's own
 * fetch/https client — confirmed by testing that Google's abuse detection
 * throttles Node's TLS client on this network with a consistent 429 (even
 * with a browser-style User-Agent header), while a request made from
 * inside a real Chromium page succeeds every time. So this isn't a style
 * choice: Node's own HTTP client does not reliably work for this endpoint
 * here, a genuine browser does.
 */

const puppeteer = require("puppeteer-core");

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const PORT = process.env.PORT || 3000;

async function translateToEnglish(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    // Navigating the page directly to the translate JSON URL makes Chrome
    // treat the response as a file download (net::ERR_ABORTED) instead of
    // a page load — load a same-origin page first, then fetch() from
    // inside that page's own context instead.
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });

    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=" + encodeURIComponent(trimmed);
    const result = await page.evaluate(async (u) => {
      const res = await fetch(u);
      return { ok: res.ok, text: await res.text() };
    }, url);

    if (!result.ok) return null;

    // Response shape: [[[translatedChunk, originalChunk, ...], ...], ...] —
    // long input gets split into multiple sentence chunks, each translated
    // separately and joined back together here.
    const data = JSON.parse(result.text);
    const chunks = (data && data[0]) || [];
    const translated = chunks.map((chunk) => chunk[0]).join("");
    return translated || null;
  } catch (err) {
    console.error("translateToEnglish failed (falling back to Thai only):", err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { translateToEnglish };
