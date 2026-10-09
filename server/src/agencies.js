/**
 * Two-level agency directory (category -> unit) — admin-editable and
 * bilingual, replacing the hardcoded AGENCY_DATA/AGENCY_CATEGORY_EN objects
 * in public/assets/js/app.js. See views/admin/agencies.ejs for the admin
 * page and routes/api.js for its endpoints.
 *
 * Request.agencyCategory/agencyUnit and Profile.workplaceCategory/
 * workplaceUnit keep their plain-string columns as the historical record
 * (what was true at submission/save) and carry agencyCategoryId/
 * agencyUnitId (resp. workplaceCategoryId/workplaceUnitId) alongside as
 * live pointers — same id+snapshot shape src/locations.js uses, except the
 * "snapshot" here is the two existing flat strings rather than a JSON blob,
 * since those columns already predate this table.
 *
 * A unit's stored string keeps the legacy "<name_th> (<name_en>)"
 * concatenation (see resolveAgency) so old string-based matching/search
 * elsewhere in the app keeps working unchanged on both old and new rows —
 * but that concatenation is a write-time-only convention for that one
 * column; every other display (admin page, dropdowns) shows nameTh/nameEn
 * through pickLang() like any other bilingual field, never concatenated.
 */

const prisma = require("./prisma");
const audit = require("./audit");

function clean(value) {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

// Same fallback rule as locations.js's pickLang — an empty English name
// (shouldn't happen for new rows, both are required on save) shows the
// Thai one rather than a blank.
function pickLang(th, en, lang) {
  return lang === "en" ? (en || th || "") : (th || en || "");
}

function formatCategory(cat, lang) {
  return cat ? pickLang(cat.nameTh, cat.nameEn, lang) : "";
}

function formatUnit(unit, lang) {
  return unit ? pickLang(unit.nameTh, unit.nameEn, lang) : "";
}

function categorySnapshot(c) {
  return { id: c.id, nameTh: c.nameTh, nameEn: c.nameEn, allowsFreeText: c.allowsFreeText };
}

function unitSnapshot(u) {
  return { id: u.id, categoryId: u.categoryId, nameTh: u.nameTh, nameEn: u.nameEn };
}

function categoryAuditSnapshot(c) {
  return { nameTh: c.nameTh, nameEn: c.nameEn, allowsFreeText: c.allowsFreeText, isActive: c.isActive };
}

function unitAuditSnapshot(u) {
  return { categoryId: u.categoryId, nameTh: u.nameTh, nameEn: u.nameEn, isActive: u.isActive };
}

function categoryAdminJSON(c) {
  return {
    ...categorySnapshot(c),
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    updatedByAdminEmail: c.updatedByAdminEmail,
    updatedAt: c.updatedAt.toISOString(),
    // Only present when the row came from listAllCategoriesWithUnitCount().
    ...(c.unitCount !== undefined ? { unitCount: c.unitCount } : {})
  };
}

function unitAdminJSON(u) {
  return {
    ...unitSnapshot(u),
    sortOrder: u.sortOrder,
    isActive: u.isActive,
    updatedByAdminEmail: u.updatedByAdminEmail,
    updatedAt: u.updatedAt.toISOString()
  };
}

// ---------- reads ----------

async function listAllCategories() {
  return prisma.agencyCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

// For the admin page's list — how many units each category has, so it can
// offer "ดูหน่วยงาน (12)" without a separate request per row.
async function listAllCategoriesWithUnitCount() {
  const categories = await listAllCategories();
  const counts = await prisma.agencyUnit.groupBy({ by: ["categoryId"], _count: { _all: true } });
  const countByCategory = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return categories.map((c) => ({ ...c, unitCount: countByCategory.get(c.id) || 0 }));
}

async function listActiveCategories() {
  return prisma.agencyCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

async function getCategoryById(id) {
  const n = parseInt(id, 10);
  if (!n) return null;
  return prisma.agencyCategory.findUnique({ where: { id: n } });
}

async function listUnitsForCategory(categoryId) {
  return prisma.agencyUnit.findMany({ where: { categoryId: Number(categoryId) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

async function listActiveUnitsForCategory(categoryId) {
  return prisma.agencyUnit.findMany({
    where: { categoryId: Number(categoryId), isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  });
}

async function getUnitById(id) {
  const n = parseInt(id, 10);
  if (!n) return null;
  return prisma.agencyUnit.findUnique({ where: { id: n } });
}

// What new-request.ejs / profile.ejs fetch once to build the whole
// dependent category -> unit dropdown client-side, replacing the old
// static AGENCY_DATA object with one that follows admin edits.
async function listActiveWithUnits() {
  const categories = await listActiveCategories();
  const units = await prisma.agencyUnit.findMany({
    where: { isActive: true, categoryId: { in: categories.map((c) => c.id) } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  });
  return categories.map((c) => ({
    ...categorySnapshot(c),
    units: units.filter((u) => u.categoryId === c.id).map(unitSnapshot)
  }));
}

// ---------- category writes ----------

function readCategoryInput(input) {
  const nameTh = clean(input.nameTh);
  const nameEn = clean(input.nameEn);
  if (!nameTh || !nameEn) return { error: "name-required" };
  return { data: { nameTh, nameEn, allowsFreeText: !!input.allowsFreeText } };
}

async function createCategory(input, adminEmail) {
  const parsed = readCategoryInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const last = await tx.agencyCategory.aggregate({ _max: { sortOrder: true } });
    const created = await tx.agencyCategory.create({
      data: { ...parsed.data, sortOrder: (last._max.sortOrder || 0) + 1, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_category.create",
      entityType: "agency_category", entityId: created.id, entityLabel: created.nameTh,
      before: null, after: categoryAuditSnapshot(created)
    });
    return { category: created };
  });
}

async function updateCategory(id, input, adminEmail) {
  const parsed = readCategoryInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyCategory.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const updated = await tx.agencyCategory.update({
      where: { id: existing.id },
      data: { ...parsed.data, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_category.update",
      entityType: "agency_category", entityId: updated.id, entityLabel: updated.nameTh,
      before: categoryAuditSnapshot(existing), after: categoryAuditSnapshot(updated)
    });
    return { category: updated };
  });
}

async function setCategoryActive(id, isActive, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyCategory.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    if (!isActive && existing.isActive) {
      // Never archive the last category — the request/profile forms would
      // have nothing to offer at all.
      const stillActive = await tx.agencyCategory.count({ where: { isActive: true, id: { not: existing.id } } });
      if (stillActive === 0) return { error: "last-category" };

      // Never archive the last allowsFreeText category either — the admin
      // form no longer offers a way to flag a *new* category as free-text
      // (see views/admin/agencies.ejs), so once none are left, a Requester
      // whose workplace matches no fixed unit list has no way to submit at
      // all, and there'd be no UI path back to fix it.
      if (existing.allowsFreeText) {
        const stillFreeText = await tx.agencyCategory.count({
          where: { isActive: true, allowsFreeText: true, id: { not: existing.id } }
        });
        if (stillFreeText === 0) return { error: "last-freetext" };
      }
    }

    const updated = await tx.agencyCategory.update({
      where: { id: existing.id },
      data: { isActive: !!isActive, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: isActive ? "agency_category.restore" : "agency_category.archive",
      entityType: "agency_category", entityId: updated.id, entityLabel: updated.nameTh,
      before: { isActive: existing.isActive }, after: { isActive: updated.isActive }
    });
    return { category: updated };
  });
}

// Hard delete — only for a category no request/profile ever pointed at and
// that has no units left (delete or move those first; the FK is ON DELETE
// RESTRICT so an unnoticed one would fail as a raw DB error otherwise).
async function removeCategory(id, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyCategory.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const unitCount = await tx.agencyUnit.count({ where: { categoryId: existing.id } });
    if (unitCount > 0) return { error: "has-units", count: unitCount };

    const used = await tx.request.count({ where: { agencyCategoryId: existing.id } })
      + await tx.profile.count({ where: { workplaceCategoryId: existing.id } });
    if (used > 0) return { error: "in-use", count: used };

    if (existing.isActive) {
      const stillActive = await tx.agencyCategory.count({ where: { isActive: true, id: { not: existing.id } } });
      if (stillActive === 0) return { error: "last-category" };

      // Same reasoning as setCategoryActive's archive guard above.
      if (existing.allowsFreeText) {
        const stillFreeText = await tx.agencyCategory.count({
          where: { isActive: true, allowsFreeText: true, id: { not: existing.id } }
        });
        if (stillFreeText === 0) return { error: "last-freetext" };
      }
    }

    await tx.agencyCategory.delete({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_category.delete",
      entityType: "agency_category", entityId: existing.id, entityLabel: existing.nameTh,
      before: categoryAuditSnapshot(existing), after: null
    });
    return { ok: true };
  });
}

async function moveCategory(id, direction) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.agencyCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    const index = rows.findIndex((c) => c.id === Number(id));
    if (index === -1) return { error: "not-found" };

    const target = direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < rows.length) {
      [rows[index], rows[target]] = [rows[target], rows[index]];
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sortOrder !== i + 1) {
        await tx.agencyCategory.update({ where: { id: rows[i].id }, data: { sortOrder: i + 1 } });
      }
    }
    return { ok: true };
  });
}

// ---------- unit writes ----------

function readUnitInput(input) {
  const nameTh = clean(input.nameTh);
  const nameEn = clean(input.nameEn);
  const categoryId = parseInt(input.categoryId, 10);
  if (!nameTh || !nameEn) return { error: "name-required" };
  if (!categoryId) return { error: "category-required" };
  return { data: { nameTh, nameEn, categoryId } };
}

async function createUnit(input, adminEmail) {
  const parsed = readUnitInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const category = await tx.agencyCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) return { error: "category-invalid" };

    const last = await tx.agencyUnit.aggregate({ _max: { sortOrder: true }, where: { categoryId: parsed.data.categoryId } });
    const created = await tx.agencyUnit.create({
      data: { ...parsed.data, sortOrder: (last._max.sortOrder || 0) + 1, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_unit.create",
      entityType: "agency_unit", entityId: created.id, entityLabel: `${category.nameTh} / ${created.nameTh}`,
      before: null, after: unitAuditSnapshot(created)
    });
    return { unit: created };
  });
}

// Changing categoryId is how the admin page's "move to another category"
// works — no extra endpoint, just an edit that also touches this field.
async function updateUnit(id, input, adminEmail) {
  const parsed = readUnitInput(input);
  if (parsed.error) return parsed;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyUnit.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const category = await tx.agencyCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) return { error: "category-invalid" };

    const changedCategory = existing.categoryId !== parsed.data.categoryId;
    let sortOrder = existing.sortOrder;
    if (changedCategory) {
      const last = await tx.agencyUnit.aggregate({ _max: { sortOrder: true }, where: { categoryId: parsed.data.categoryId } });
      sortOrder = (last._max.sortOrder || 0) + 1;
    }

    const updated = await tx.agencyUnit.update({
      where: { id: existing.id },
      data: { ...parsed.data, sortOrder, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_unit.update",
      entityType: "agency_unit", entityId: updated.id, entityLabel: `${category.nameTh} / ${updated.nameTh}`,
      before: unitAuditSnapshot(existing), after: unitAuditSnapshot(updated)
    });
    return { unit: updated };
  });
}

async function setUnitActive(id, isActive, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyUnit.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const updated = await tx.agencyUnit.update({
      where: { id: existing.id },
      data: { isActive: !!isActive, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: isActive ? "agency_unit.restore" : "agency_unit.archive",
      entityType: "agency_unit", entityId: updated.id, entityLabel: updated.nameTh,
      before: { isActive: existing.isActive }, after: { isActive: updated.isActive }
    });
    return { unit: updated };
  });
}

async function removeUnit(id, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyUnit.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const used = await tx.request.count({ where: { agencyUnitId: existing.id } })
      + await tx.profile.count({ where: { workplaceUnitId: existing.id } });
    if (used > 0) return { error: "in-use", count: used };

    await tx.agencyUnit.delete({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "agency_unit.delete",
      entityType: "agency_unit", entityId: existing.id, entityLabel: existing.nameTh,
      before: unitAuditSnapshot(existing), after: null
    });
    return { ok: true };
  });
}

async function moveUnit(id, direction) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.agencyUnit.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };

    const rows = await tx.agencyUnit.findMany({
      where: { categoryId: existing.categoryId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
    });
    const index = rows.findIndex((u) => u.id === existing.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < rows.length) {
      [rows[index], rows[target]] = [rows[target], rows[index]];
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sortOrder !== i + 1) {
        await tx.agencyUnit.update({ where: { id: rows[i].id }, data: { sortOrder: i + 1 } });
      }
    }
    return { ok: true };
  });
}

// ---------- submission-time resolution ----------

// Core of what requests.js create()/update() and profile.js upsert() call
// to turn a category id + (unit id or free-typed text) into what gets
// stored, in neutral field names — resolveAgency/resolveWorkplace below map
// those onto Request's/Profile's own column names. Never trusts the
// client's dropdown/allowsFreeText branch alone: re-validates the category
// is active, and either that free text was actually typed (allowsFreeText)
// or the unit id names an active unit that really belongs to it.
//
// `optional: true` (Profile only — a profile can have no workplace saved at
// all) skips all of that and returns nulls when no categoryId was sent,
// rather than treating a blank workplace as an error.
async function resolveAgencySelection({ categoryId, unitId, unitText, optional }) {
  if (optional && !categoryId) {
    return { categoryName: null, categoryId: null, unitName: null, unitId: null };
  }

  const category = await getCategoryById(categoryId);
  if (!category || !category.isActive) return { error: "agency-category-invalid" };

  if (category.allowsFreeText) {
    const text = clean(unitText);
    if (!text) return { error: "agency-unit-required" };
    return { categoryName: category.nameTh, categoryId: category.id, unitName: text, unitId: null };
  }

  const unit = await getUnitById(unitId);
  if (!unit || !unit.isActive || unit.categoryId !== category.id) return { error: "agency-unit-invalid" };
  // "<name_th> (<name_en>)" is the legacy concatenation AGENCY_DATA already
  // used, kept so string-based matching/search elsewhere in the app keeps
  // working unchanged on both old and new rows (see the module comment).
  return { categoryName: category.nameTh, categoryId: category.id, unitName: `${unit.nameTh} (${unit.nameEn})`, unitId: unit.id };
}

// Request.agencyCategory/agencyUnit(+Id).
async function resolveAgency(args) {
  const r = await resolveAgencySelection(args);
  if (r.error) return r;
  return { fields: { agencyCategory: r.categoryName, agencyCategoryId: r.categoryId, agencyUnit: r.unitName, agencyUnitId: r.unitId } };
}

// Profile.workplaceCategory/workplaceUnit(+Id) — optional, unlike Request's.
async function resolveWorkplace(args) {
  const r = await resolveAgencySelection({ ...args, optional: true });
  if (r.error) return r;
  return { fields: { workplaceCategory: r.categoryName, workplaceCategoryId: r.categoryId, workplaceUnit: r.unitName, workplaceUnitId: r.unitId } };
}

module.exports = {
  listAllCategories, listAllCategoriesWithUnitCount, listActiveCategories, getCategoryById,
  listUnitsForCategory, listActiveUnitsForCategory, getUnitById, listActiveWithUnits,
  createCategory, updateCategory, setCategoryActive, removeCategory, moveCategory,
  createUnit, updateUnit, setUnitActive, removeUnit, moveUnit,
  resolveAgency, resolveWorkplace,
  formatCategory, formatUnit, pickLang,
  categoryAdminJSON, unitAdminJSON
};
