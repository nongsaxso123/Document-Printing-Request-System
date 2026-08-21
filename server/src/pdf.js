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
 */

const puppeteer = require("puppeteer-core");

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const PORT = process.env.PORT || 3000;

async function renderPagePdf(path, cookieHeader) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }
    const navResponse = await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });
    if (!navResponse || !navResponse.ok()) {
      throw new Error(`PDF source page ${path} returned ${navResponse ? navResponse.status() : "no response"}`);
    }
    await page.emulateMediaType("print");
    const pdfData = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" }
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

module.exports = { renderPagePdf };
