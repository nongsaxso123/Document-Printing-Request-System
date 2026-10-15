/**
 * User manuals (PDF) the admin uploads at /admin/manuals and anyone can open
 * from the login page — see the UserManual model. One file per audience and
 * language; uploading again replaces it.
 */

const prisma = require("./prisma");
const audit = require("./audit");

const AUDIENCES = ["requester"];
const LANGS = ["th", "en"];
const MAX_BYTES = 30 * 1024 * 1024;

function manualId(audience, lang) {
  if (!AUDIENCES.includes(audience) || !LANGS.includes(lang)) return null;
  return audience + "-" + lang;
}

// Real PDFs start with "%PDF-". Checked so nothing else (an HTML page, say)
// can be uploaded and then served from this site under a .pdf name.
function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

// Everything except the file bytes — for the admin page and the login link.
async function listInfo() {
  return prisma.userManual.findMany({
    select: { id: true, fileName: true, size: true, uploadedAt: true, uploadedBy: true },
    orderBy: { id: "asc" }
  });
}

// The requested language, else the other one, so the login link always
// opens something as long as at least one file was uploaded.
async function getForDownload(audience, lang) {
  const wanted = manualId(audience, lang);
  if (!wanted) return null;
  const order = [lang].concat(LANGS.filter((l) => l !== lang)).map((l) => manualId(audience, l));
  for (const id of order) {
    const row = await prisma.userManual.findUnique({ where: { id } });
    if (row) return row;
  }
  return null;
}

async function save(audience, lang, { buffer, fileName, actorEmail }) {
  const id = manualId(audience, lang);
  if (!id) return { error: "invalid" };
  if (!isPdf(buffer)) return { error: "notPdf" };
  if (buffer.length > MAX_BYTES) return { error: "tooLarge" };
  const name = (fileName || "").replace(/[\r\n"]/g, "").trim().slice(0, 150) || id + ".pdf";
  const fields = { fileName: name, mimeType: "application/pdf", size: buffer.length, data: buffer, uploadedAt: new Date(), uploadedBy: actorEmail };
  await prisma.userManual.upsert({ where: { id }, create: Object.assign({ id }, fields), update: fields });
  await audit.write(null, {
    actorEmail, action: "manualUpload", entityType: "system", entityLabel: name,
    after: { size: buffer.length }
  });
  return { ok: true };
}

async function remove(audience, lang, { actorEmail }) {
  const id = manualId(audience, lang);
  if (!id) return { error: "invalid" };
  const existing = await prisma.userManual.findUnique({ where: { id }, select: { fileName: true } });
  if (!existing) return { error: "notFound" };
  await prisma.userManual.delete({ where: { id } });
  await audit.write(null, { actorEmail, action: "manualDelete", entityType: "system", entityLabel: existing.fileName });
  return { ok: true };
}

module.exports = { AUDIENCES, LANGS, MAX_BYTES, manualId, listInfo, getForDownload, save, remove };
