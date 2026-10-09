/**
 * Self-service "My Profile" info — available to every role
 * (Requester/Officer/Admin), one row per email. See views/profile.ejs.
 *
 * Distinct from Officer (role assignment) and from a Request's own
 * per-submission requesterName/receiverName fields: this is the user's own
 * standing identity info, auto-filled wherever the app previously only had
 * the bare Google account display name — the Requester's own name/phone on
 * new-request.ejs (routes/requester.js), and the Officer name recorded on
 * approve/reject/handover (routes/api.js, via resolveDisplayName below).
 */

const prisma = require("./prisma");
const agencies = require("./agencies");

async function get(email) {
  return prisma.profile.findUnique({ where: { email: email.toLowerCase() } });
}

// workplace* comes from src/agencies.js's resolveWorkplace() (categoryId +
// unitId-or-free-typed-text) — optional, so leaving it blank clears any
// previously-saved workplace rather than erroring. Returns { error } only
// for a genuinely invalid selection (an id that no longer exists/is
// archived, or free text missing where required), never for "nothing set".
async function upsert(email, { prefix, name, phone, agencyCategoryId, agencyUnitId, agencyUnitText, position }) {
  const workplace = await agencies.resolveWorkplace({ categoryId: agencyCategoryId, unitId: agencyUnitId, unitText: agencyUnitText });
  if (workplace.error) return workplace;

  const data = {
    prefix: prefix ? String(prefix).trim() : null,
    name: name ? String(name).trim() : null,
    phone: phone ? String(phone).trim() : null,
    ...workplace.fields,
    position: position ? String(position).trim() : null
  };
  const row = await prisma.profile.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), ...data },
    update: data
  });
  return { profile: row };
}

// Prefix is always picked from a fixed Thai-text list in profile.ejs
// (see PREFIX_OPTIONS there) regardless of the app's TH/EN UI toggle — that
// toggle only swaps the *label* shown in the dropdown, not the stored
// value. But profile.name is free text, and people fill it in either
// script (e.g. "Sorrawit Thanakhwang" vs "สรวิศ ธนาขวัญ") — pairing a Thai
// prefix with a Latin name read oddly ("นาย Sorrawit Thanakhwang"), so this
// maps to the matching-script prefix based on the name actually typed.
const PREFIX_EN = {
  "นาย": "Mr.", "นาง": "Mrs.", "นางสาว": "Ms.",
  "ดร.": "Dr.", "ผศ.": "Asst. Prof.", "ผศ.ดร.": "Asst. Prof. Dr.",
  "รศ.": "Assoc. Prof.", "รศ.ดร.": "Assoc. Prof. Dr.",
  "ศ.": "Prof.", "ศ.ดร.": "Prof. Dr."
};
const THAI_CHAR = /[฀-๿]/;

function matchPrefixScript(prefix, name) {
  if (!prefix) return prefix;
  const nameIsThai = THAI_CHAR.test(name);
  if (nameIsThai) return prefix; // stored prefix values are already Thai
  return PREFIX_EN[prefix] || prefix; // no mapping (e.g. custom "other" text) — leave as typed
}

// "นายสมชาย ใจดี" (Thai convention: no space after the title — the space
// falls between first name and surname instead) vs "Mr. Somchai Jaidee"
// (English convention: always a space after the title). Falls back to the
// Google account's own display name when no profile name is saved yet, so
// every caller gets a sensible name either way.
function displayName(profile, fallbackName) {
  if (profile && profile.name) {
    const prefix = matchPrefixScript(profile.prefix, profile.name);
    if (!prefix) return profile.name;
    const separator = THAI_CHAR.test(profile.name) ? "" : " ";
    return `${prefix}${separator}${profile.name}`;
  }
  return fallbackName;
}

async function resolveDisplayName(email, fallbackName) {
  const profile = await get(email);
  return displayName(profile, fallbackName);
}

module.exports = { get, upsert, displayName, resolveDisplayName };
