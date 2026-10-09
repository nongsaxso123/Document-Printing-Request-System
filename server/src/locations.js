/**
 * Drop-off / pickup places (Location table) — admin-editable and bilingual.
 * See views/admin/locations.ejs for the admin page and routes/api.js for its
 * endpoints. A place that requests have used is archived, not deleted, so
 * those requests keep resolving to a name; only never-used ones can be
 * deleted (see remove()).
 */

const prisma = require("./prisma");
const audit = require("./audit");

const PURPOSES = {
  dropoff: { accepts: "acceptsDropoff", isDefault: "isDefaultDropoff" },
  pickup: { accepts: "acceptsPickup", isDefault: "isDefaultPickup" }
};

function clean(value) {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

// Language fallback for display: a row with an empty English name (only
// possible for rows migrated from the old Thai-only settings) shows the
// Thai one rather than a blank.
function pickLang(th, en, lang) {
  return lang === "en" ? (en || th || "") : (th || en || "");
}

// Name followed by building/floor/room — same joining rule as
// formatLocation() in public/assets/js/app.js (no shared source: no build
// step here, so the two are kept in sync by hand).
function formatText(loc, lang) {
  if (!loc) return "";
  const name = pickLang(loc.nameTh, loc.nameEn, lang);
  const detail = pickLang(loc.detailTh, loc.detailEn, lang);
  if (!detail) return name;
  return lang === "en" ? `${name}, ${detail}` : `${name} ${detail}`;
}

// What a Requester-facing page (or a request's stored snapshot) needs —
// deliberately without admin-only fields like flags and sort order.
function snapshotOf(l) {
  return {
    id: l.id,
    nameTh: l.nameTh,
    nameEn: l.nameEn,
    detailTh: l.detailTh,
    detailEn: l.detailEn,
    hoursTh: l.hoursTh,
    hoursEn: l.hoursEn,
    // Structured hours ride along so a client-side deadline/slot preview
    // (formatDropoffParts, printing-jobs.ejs's pickup slot picker) can use
    // this place's real hours too — see hourWindowOf() below for the
    // server-side equivalent.
    hoursFromDay: l.hoursFromDay,
    hoursToDay: l.hoursToDay,
    hoursOpenTime: l.hoursOpenTime,
    hoursCloseTime: l.hoursCloseTime,
    phone: l.phone,
    mapUrl: l.mapUrl
  };
}

// Decimal-hour open/close window for deadline/pickup-window math (e.g.
// 16:30 -> 16.5), so callers can compare directly against
// date.getHours() + date.getMinutes() / 60 the way businessDays.js already
// does. Null when this place's hours aren't in the structured shape (hand-
// typed legacy text, or no hours configured) — callers fall back to the
// site-wide default window in that case.
function hourWindowOf(l) {
  if (!l || l.hoursOpenTime == null || l.hoursCloseTime == null) return null;
  const toDecimal = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h + m / 60;
  };
  return { fromDay: l.hoursFromDay, toDay: l.hoursToDay, start: toDecimal(l.hoursOpenTime), end: toDecimal(l.hoursCloseTime) };
}

// What the audit log stores per change — the fields an admin can actually
// edit, not the raw row (sortOrder/updatedAt/updatedByAdminEmail already
// live on the audit row itself or aren't meaningful to diff).
function auditSnapshot(l) {
  return {
    nameTh: l.nameTh, nameEn: l.nameEn,
    detailTh: l.detailTh, detailEn: l.detailEn,
    hoursTh: l.hoursTh, hoursEn: l.hoursEn,
    phone: l.phone, mapUrl: l.mapUrl,
    acceptsDropoff: l.acceptsDropoff, acceptsPickup: l.acceptsPickup,
    isDefaultDropoff: l.isDefaultDropoff, isDefaultPickup: l.isDefaultPickup,
    isActive: l.isActive
  };
}

function toAdminJSON(l) {
  return {
    ...snapshotOf(l),
    acceptsDropoff: l.acceptsDropoff,
    acceptsPickup: l.acceptsPickup,
    isDefaultDropoff: l.isDefaultDropoff,
    isDefaultPickup: l.isDefaultPickup,
    sortOrder: l.sortOrder,
    isActive: l.isActive,
    updatedByAdminEmail: l.updatedByAdminEmail,
    updatedAt: l.updatedAt.toISOString()
  };
}

async function listAll() {
  return prisma.location.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

async function listActive(purpose) {
  const { accepts } = PURPOSES[purpose];
  return prisma.location.findMany({
    where: { isActive: true, [accepts]: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  });
}

async function getById(id) {
  const n = parseInt(id, 10);
  if (!n) return null;
  return prisma.location.findUnique({ where: { id: n } });
}

// The pre-selected place for a purpose: the flagged default, else the first
// active one that accepts it, else nothing (no place configured at all).
async function getDefault(purpose) {
  const options = await listActive(purpose);
  return options.find((l) => l[PURPOSES[purpose].isDefault]) || options[0] || null;
}

// Keeps "exactly one default per purpose, and it's an active place that
// accepts that purpose" true after any write. `preferred` maps a purpose to
// the row the admin just explicitly flagged as its default (wins over an
// existing default), e.g. { dropoff: 3 }.
async function normalizeDefaults(tx, preferred = {}) {
  for (const purpose of Object.keys(PURPOSES)) {
    const { accepts, isDefault } = PURPOSES[purpose];
    const eligible = await tx.location.findMany({
      where: { isActive: true, [accepts]: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
    });
    const chosen = eligible.find((l) => preferred[purpose] != null && l.id === preferred[purpose])
      || eligible.find((l) => l[isDefault])
      || eligible[0]
      || null;

    await tx.location.updateMany({
      where: chosen ? { id: { not: chosen.id }, [isDefault]: true } : { [isDefault]: true },
      data: { [isDefault]: false }
    });
    if (chosen && !chosen[isDefault]) {
      await tx.location.update({ where: { id: chosen.id }, data: { [isDefault]: true } });
    }
  }
}

// Opening hours are picked from lists (days + open/close time) rather than
// typed, and the Thai/English display strings are generated from them so
// they always read the same way. The admin page parses these strings back
// into the pickers when editing (views/admin/locations.ejs — keep the two in
// sync by hand).
const DAY_NAMES = {
  th: ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// { from, to } are 1 (Mon) .. 7 (Sun). Returns { th, en }, { error }, or
// { keep: true } when the admin left everything blank on a row whose existing
// hours were typed by hand and can't be shown in the pickers.
function buildHours(input) {
  const from = parseInt(input.hoursFromDay, 10);
  const to = parseInt(input.hoursToDay, 10);
  const open = clean(input.hoursOpen);
  const close = clean(input.hoursClose);

  const anySet = from || to || open || close;
  if (!anySet) return input.hoursKeep ? { keep: true } : { th: null, en: null, fromDay: null, toDay: null, open: null, close: null };

  if (!(from >= 1 && from <= 7) || !(to >= 1 && to <= 7) || !open || !close) return { error: "hours-incomplete" };
  if (!TIME_RE.test(open) || !TIME_RE.test(close) || close <= open || to < from) return { error: "hours-invalid" };

  const days = (lang) => (from === to ? DAY_NAMES[lang][from - 1] : `${DAY_NAMES[lang][from - 1]}-${DAY_NAMES[lang][to - 1]}`);
  return {
    th: `${days("th")} ${open}-${close} น.`,
    en: `${days("en")} ${open}-${close}`,
    fromDay: from, toDay: to, open, close
  };
}

function readInput(input) {
  const nameTh = clean(input.nameTh);
  const nameEn = clean(input.nameEn);
  const acceptsDropoff = !!input.acceptsDropoff;
  const acceptsPickup = !!input.acceptsPickup;

  // Both languages are required on save — the fallback in pickLang() is a
  // safety net for migrated rows, not something new rows should rely on.
  if (!nameTh || !nameEn) return { error: "name-required" };
  if (!acceptsDropoff && !acceptsPickup) return { error: "purpose-required" };

  const hours = buildHours(input);
  if (hours.error) return { error: hours.error };

  return {
    data: {
      nameTh,
      nameEn,
      detailTh: clean(input.detailTh),
      detailEn: clean(input.detailEn),
      ...(hours.keep ? {} : {
        hoursTh: hours.th, hoursEn: hours.en,
        hoursFromDay: hours.fromDay, hoursToDay: hours.toDay,
        hoursOpenTime: hours.open, hoursCloseTime: hours.close
      }),
      phone: clean(input.phone),
      mapUrl: clean(input.mapUrl),
      acceptsDropoff,
      acceptsPickup
    },
    wantsDefaultDropoff: !!input.isDefaultDropoff,
    wantsDefaultPickup: !!input.isDefaultPickup
  };
}

function preferredDefaults(parsed, id) {
  return {
    dropoff: parsed.wantsDefaultDropoff && parsed.data.acceptsDropoff ? id : null,
    pickup: parsed.wantsDefaultPickup && parsed.data.acceptsPickup ? id : null
  };
}

async function create(input, adminEmail) {
  const parsed = readInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const last = await tx.location.aggregate({ _max: { sortOrder: true } });
    const created = await tx.location.create({
      data: {
        ...parsed.data,
        sortOrder: ((last._max.sortOrder) || 0) + 1,
        isDefaultDropoff: parsed.wantsDefaultDropoff && parsed.data.acceptsDropoff,
        isDefaultPickup: parsed.wantsDefaultPickup && parsed.data.acceptsPickup,
        updatedByAdminEmail: adminEmail
      }
    });
    await normalizeDefaults(tx, preferredDefaults(parsed, created.id));
    const final = await tx.location.findUnique({ where: { id: created.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "location.create",
      entityType: "location", entityId: final.id, entityLabel: final.nameTh,
      before: null, after: auditSnapshot(final)
    });
    return { location: final };
  });
}

async function update(id, input, adminEmail) {
  const parsed = readInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.location.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    await tx.location.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        // A flag the admin turned off, or one for a purpose the place no
        // longer accepts, is cleared here; normalizeDefaults() then hands the
        // default to another place if that leaves the purpose without one.
        isDefaultDropoff: parsed.wantsDefaultDropoff && parsed.data.acceptsDropoff,
        isDefaultPickup: parsed.wantsDefaultPickup && parsed.data.acceptsPickup,
        updatedByAdminEmail: adminEmail
      }
    });
    await normalizeDefaults(tx, preferredDefaults(parsed, existing.id));
    const final = await tx.location.findUnique({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "location.update",
      entityType: "location", entityId: final.id, entityLabel: final.nameTh,
      before: auditSnapshot(existing), after: auditSnapshot(final)
    });
    return { location: final };
  });
}

async function setActive(id, isActive, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.location.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    if (!isActive) {
      // Never archive the last place people can hand documents to — the
      // request form would have nowhere to send them.
      const stillActive = await tx.location.count({
        where: { isActive: true, acceptsDropoff: true, id: { not: existing.id } }
      });
      const stillActivePickup = await tx.location.count({
        where: { isActive: true, acceptsPickup: true, id: { not: existing.id } }
      });
      if (existing.acceptsDropoff && existing.isActive && stillActive === 0) return { error: "last-dropoff" };
      if (existing.acceptsPickup && existing.isActive && stillActivePickup === 0) return { error: "last-pickup" };
    }

    await tx.location.update({
      where: { id: existing.id },
      data: {
        isActive: !!isActive,
        ...(isActive ? {} : { isDefaultDropoff: false, isDefaultPickup: false }),
        updatedByAdminEmail: adminEmail
      }
    });
    await normalizeDefaults(tx);
    const final = await tx.location.findUnique({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: isActive ? "location.restore" : "location.archive",
      entityType: "location", entityId: final.id, entityLabel: final.nameTh,
      before: { isActive: existing.isActive }, after: { isActive: final.isActive }
    });
    return { location: final };
  });
}

// Hard delete — only for a place no request ever pointed at (typos, test
// entries). Anything that has been used must be archived instead so requests
// keep a name to show. Same "never leave zero places" guard as archiving.
async function remove(id, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.location.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const used = await tx.request.count({
      where: { OR: [{ dropoffLocationId: existing.id }, { pickupLocationId: existing.id }] }
    });
    if (used > 0) return { error: "in-use", count: used };

    if (existing.isActive) {
      if (existing.acceptsDropoff && (await tx.location.count({ where: { isActive: true, acceptsDropoff: true, id: { not: existing.id } } })) === 0) return { error: "last-dropoff" };
      if (existing.acceptsPickup && (await tx.location.count({ where: { isActive: true, acceptsPickup: true, id: { not: existing.id } } })) === 0) return { error: "last-pickup" };
    }

    await tx.location.delete({ where: { id: existing.id } });
    await normalizeDefaults(tx);
    await audit.write(tx, {
      actorEmail: adminEmail, action: "location.delete",
      entityType: "location", entityId: existing.id, entityLabel: existing.nameTh,
      before: auditSnapshot(existing), after: null
    });
    return { ok: true };
  });
}

// Swap with the neighbour in the current order. Renumbers 1..n first so
// rows that ended up with equal sortOrder still move predictably.
// Not audit-logged — reordering isn't the kind of change the audit log is
// for (nothing about a place's own data changes).
async function move(id, direction) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.location.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    const index = rows.findIndex((l) => l.id === Number(id));
    if (index === -1) return { error: "not-found" };

    const target = direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < rows.length) {
      [rows[index], rows[target]] = [rows[target], rows[index]];
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sortOrder !== i + 1) {
        await tx.location.update({ where: { id: rows[i].id }, data: { sortOrder: i + 1 } });
      }
    }
    return { ok: true };
  });
}

module.exports = {
  listAll, listActive, getById, getDefault,
  create, update, setActive, remove, move,
  formatText, pickLang, snapshotOf, toAdminJSON, hourWindowOf
};
