/**
 * Minimal JSON-backed stand-in for the "Officer Account" table (file.md
 * Appendix A). Real persistence via Postgres/Prisma comes in Roadmap step 2 —
 * this just lets the role-lookup logic be tested end-to-end today.
 */

const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "officers.json");

function load() {
  if (!fs.existsSync(STORE_PATH)) return [];
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function save(officers) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(officers, null, 2));
}

function getOfficers() {
  return load();
}

function isOfficer(emailLower) {
  return load().some((o) => o.email.toLowerCase() === emailLower);
}

function addOfficer(email, name, assignedBy) {
  const officers = load();
  const emailLower = email.toLowerCase();
  if (officers.some((o) => o.email.toLowerCase() === emailLower)) {
    return false; // already exists
  }
  officers.push({
    email: email,
    name: name,
    assignedBy: assignedBy,
    assignedDate: new Date().toISOString().slice(0, 10)
  });
  save(officers);
  return true;
}

function removeOfficer(email) {
  const emailLower = email.toLowerCase();
  const officers = load();
  const next = officers.filter((o) => o.email.toLowerCase() !== emailLower);
  save(next);
  return next.length !== officers.length;
}

module.exports = { getOfficers, isOfficer, addOfficer, removeOfficer };
