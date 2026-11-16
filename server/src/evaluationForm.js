/**
 * Admin-editable satisfaction form (/admin/evaluation-form): sections holding
 * ordered questions of four types, plus how long after pickup a Requester
 * may still evaluate. Answers live in EvaluationAnswer with the question
 * text copied in, so editing or deleting a question never rewrites history.
 * Every change is written to the audit log (entityType "evaluation_form").
 *
 * Requester side (render, validate, save) and the officer report use
 * listForm() / validateAnswers() from here; see src/requests.js.

 */

const crypto = require("crypto");
const prisma = require("./prisma");
const audit = require("./audit");

const TYPES = ["rating", "single", "multi", "text"];
const UNITS = ["minute", "hour", "day", "week", "month"];
const TEXT_MAX = 2000;
const ENTITY = "evaluation_form";

function clean(value) {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

// ------------------------------------------------------------ reading
async function listForm() {
  return prisma.evaluationSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } }
  });
}

async function questionCount() {
  return prisma.evaluationQuestion.count();
}

function sectionJSON(s) {
  return {
    id: s.id, titleTh: s.titleTh, titleEn: s.titleEn, sortOrder: s.sortOrder,
    questions: (s.questions || []).map(questionJSON)
  };
}

function questionJSON(q) {
  return {
    id: q.id, sectionId: q.sectionId, type: q.type, textTh: q.textTh, textEn: q.textEn,
    required: q.required, options: Array.isArray(q.options) ? q.options : [], sortOrder: q.sortOrder
  };
}

// ------------------------------------------------------------ time window
// Deadline for evaluating a request picked up at `completedAt`, or null when
// there is no limit. Months are calendar months.
function deadlineFor(completedAt, value, unit) {
  if (value == null || !completedAt) return null;
  const d = new Date(completedAt);
  const n = Number(value);
  switch (unit) {
    case "minute": return new Date(d.getTime() + n * 60 * 1000);
    case "hour": return new Date(d.getTime() + n * 60 * 60 * 1000);
    case "week": return new Date(d.getTime() + n * 7 * 24 * 60 * 60 * 1000);
    case "month": { const m = new Date(d); m.setMonth(m.getMonth() + n); return m; }
    default: return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
  }
}

// Earliest pickup time that is still inside the window as of `now` (the
// same rule as deadlineFor, run backwards) — for database filters.
function oldestOpenCompletion(value, unit, now = new Date()) {
  if (value == null) return null;
  const n = Number(value);
  switch (unit) {
    case "minute": return new Date(now.getTime() - n * 60 * 1000);
    case "hour": return new Date(now.getTime() - n * 60 * 60 * 1000);
    case "week": return new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
    case "month": { const m = new Date(now); m.setMonth(m.getMonth() - n); return m; }
    default: return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  }
}

async function getWindow() {
  const row = await prisma.systemSetting.findUnique({
    where: { id: 1 }, select: { evaluationWindowValue: true, evaluationWindowUnit: true }
  });
  // No settings row yet behaves like the column defaults.
  return row
    ? { value: row.evaluationWindowValue, unit: row.evaluationWindowUnit }
    : { value: 30, unit: "day" };
}

async function setWindow(input, adminEmail) {
  const unlimited = !!input.unlimited;
  const value = unlimited ? null : parseInt(input.value, 10);
  const unit = String(input.unit || "day");
  if (!UNITS.includes(unit)) return { error: "window-invalid" };
  if (!unlimited && !(Number.isInteger(value) && value >= 1 && value <= 100000)) return { error: "window-invalid" };

  const before = await getWindow();
  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { id: 1 },
      create: { id: 1, evaluationWindowValue: value, evaluationWindowUnit: unit, updatedByAdminEmail: adminEmail },
      update: { evaluationWindowValue: value, evaluationWindowUnit: unit, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.window", entityType: ENTITY,
      entityLabel: "window", before, after: { value, unit }
    });
  });
  return { window: { value, unit } };
}

// ------------------------------------------------------------ sections
function readSection(input) {
  const titleTh = clean(input.titleTh);
  const titleEn = clean(input.titleEn);
  if (!titleTh || !titleEn) return { error: "title-required" };
  return { data: { titleTh, titleEn } };
}

async function createSection(input, adminEmail) {
  const parsed = readSection(input);
  if (parsed.error) return parsed;
  return prisma.$transaction(async (tx) => {
    const max = await tx.evaluationSection.aggregate({ _max: { sortOrder: true } });
    const section = await tx.evaluationSection.create({
      data: { ...parsed.data, sortOrder: (max._max.sortOrder || 0) + 1, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.section_create", entityType: ENTITY,
      entityId: section.id, entityLabel: section.titleTh, after: parsed.data
    });
    return { section };
  });
}

async function updateSection(id, input, adminEmail) {
  const parsed = readSection(input);
  if (parsed.error) return parsed;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.evaluationSection.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };
    const section = await tx.evaluationSection.update({
      where: { id: existing.id }, data: { ...parsed.data, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.section_update", entityType: ENTITY,
      entityId: section.id, entityLabel: section.titleTh,
      before: { titleTh: existing.titleTh, titleEn: existing.titleEn }, after: parsed.data
    });
    return { section };
  });
}

// Deleting a section deletes its questions too; past answers stay (their
// question link becomes null, the copied text keeps them readable).
async function deleteSection(id, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.evaluationSection.findUnique({ where: { id: Number(id) }, include: { questions: true } });
    if (!existing) return { error: "not-found" };
    await tx.evaluationSection.delete({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.section_delete", entityType: ENTITY,
      entityId: existing.id, entityLabel: existing.titleTh,
      before: { titleTh: existing.titleTh, titleEn: existing.titleEn, questions: existing.questions.length }
    });
    return { ok: true };
  });
}

// Swap with the neighbour; renumbers 1..n first so equal sortOrders still move.
async function moveIn(tx, model, where, id, direction) {
  const rows = await tx[model].findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return false;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target >= 0 && target < rows.length) [rows[index], rows[target]] = [rows[target], rows[index]];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sortOrder !== i + 1) await tx[model].update({ where: { id: rows[i].id }, data: { sortOrder: i + 1 } });
  }
  return true;
}

async function moveSection(id, direction) {
  return prisma.$transaction(async (tx) => {
    const ok = await moveIn(tx, "evaluationSection", {}, Number(id), direction);
    return ok ? { ok: true } : { error: "not-found" };
  });
}

// ------------------------------------------------------------ questions
function newKey() {
  return crypto.randomBytes(5).toString("hex");
}

// Options keep their key when edited (so past answers stay counted under
// them); new ones get a fresh key. Blank rows are dropped.
function readOptions(raw, previous) {
  const prevKeys = new Set((previous || []).map((o) => o.key));
  const list = Array.isArray(raw) ? raw : [];
  const options = [];
  for (const o of list) {
    const th = clean(o && o.th);
    const en = clean(o && o.en);
    if (!th && !en) continue;
    if (!th || !en) return { error: "option-incomplete" };
    const key = o.key && prevKeys.has(String(o.key)) ? String(o.key) : newKey();
    options.push({ key, th, en });
  }
  return { options };
}

function readQuestion(input, previousOptions) {
  const type = String(input.type || "");
  if (!TYPES.includes(type)) return { error: "type-invalid" };
  const textTh = clean(input.textTh);
  const textEn = clean(input.textEn);
  if (!textTh || !textEn) return { error: "text-required" };
  let options = [];
  if (type === "single" || type === "multi") {
    const parsed = readOptions(input.options, previousOptions);
    if (parsed.error) return parsed;
    if (parsed.options.length < 2) return { error: "options-too-few" };
    options = parsed.options;
  }
  return { data: { type, textTh, textEn, required: !!input.required, options } };
}

function questionAudit(q) {
  return { type: q.type, textTh: q.textTh, textEn: q.textEn, required: q.required, options: q.options };
}

async function createQuestion(input, adminEmail) {
  const parsed = readQuestion(input, []);
  if (parsed.error) return parsed;
  return prisma.$transaction(async (tx) => {
    const section = await tx.evaluationSection.findUnique({ where: { id: Number(input.sectionId) } });
    if (!section) return { error: "section-invalid" };
    const max = await tx.evaluationQuestion.aggregate({ where: { sectionId: section.id }, _max: { sortOrder: true } });
    const question = await tx.evaluationQuestion.create({
      data: { ...parsed.data, sectionId: section.id, sortOrder: (max._max.sortOrder || 0) + 1, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.question_create", entityType: ENTITY,
      entityId: question.id, entityLabel: question.textTh, after: questionAudit(question)
    });
    return { question };
  });
}

async function updateQuestion(id, input, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.evaluationQuestion.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };
    const parsed = readQuestion(input, Array.isArray(existing.options) ? existing.options : []);
    if (parsed.error) return parsed;
    let sectionId = existing.sectionId;
    let sortOrder = existing.sortOrder;
    if (input.sectionId != null && Number(input.sectionId) !== existing.sectionId) {
      const section = await tx.evaluationSection.findUnique({ where: { id: Number(input.sectionId) } });
      if (!section) return { error: "section-invalid" };
      const max = await tx.evaluationQuestion.aggregate({ where: { sectionId: section.id }, _max: { sortOrder: true } });
      sectionId = section.id;
      sortOrder = (max._max.sortOrder || 0) + 1;
    }
    const question = await tx.evaluationQuestion.update({
      where: { id: existing.id },
      data: { ...parsed.data, sectionId, sortOrder, updatedByAdminEmail: adminEmail }
    });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.question_update", entityType: ENTITY,
      entityId: question.id, entityLabel: question.textTh,
      before: questionAudit(existing), after: questionAudit(question)
    });
    return { question };
  });
}

async function deleteQuestion(id, adminEmail) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.evaluationQuestion.findUnique({ where: { id: Number(id) } });
    if (!existing) return { error: "not-found" };
    await tx.evaluationQuestion.delete({ where: { id: existing.id } });
    await audit.write(tx, {
      actorEmail: adminEmail, action: "evaluation_form.question_delete", entityType: ENTITY,
      entityId: existing.id, entityLabel: existing.textTh, before: questionAudit(existing)
    });
    return { ok: true };
  });
}

async function moveQuestion(id, direction) {
  return prisma.$transaction(async (tx) => {
    const q = await tx.evaluationQuestion.findUnique({ where: { id: Number(id) } });
    if (!q) return { error: "not-found" };
    await moveIn(tx, "evaluationQuestion", { sectionId: q.sectionId }, q.id, direction);
    return { ok: true };
  });
}

// ------------------------------------------------------------ answering
// Checks a submitted form body (field names q_<id>) against the current
// form. Returns { answers, averageRating, comment } ready to save, or
// { errors: { [questionId]: "required" | "invalid" } }.
function validateAnswers(sections, body) {
  const errors = {};
  const answers = [];
  const ratings = [];
  const texts = [];
  const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter(Boolean);

  for (const s of sections) {
    for (const q of s.questions) {
      const raw = body["q_" + q.id];
      const base = {
        questionId: q.id, questionType: q.type,
        questionTextTh: q.textTh, questionTextEn: q.textEn,
        sectionTitleTh: s.titleTh, sectionTitleEn: s.titleEn
      };
      const options = Array.isArray(q.options) ? q.options : [];

      if (q.type === "rating") {
        const v = asList(raw)[0];
        if (!v) { if (q.required) errors[q.id] = "required"; continue; }
        const n = parseInt(v, 10);
        if (!(Number.isInteger(n) && n >= 1 && n <= 5)) { errors[q.id] = "invalid"; continue; }
        ratings.push(n);
        answers.push({ ...base, rating: n });
      } else if (q.type === "single" || q.type === "multi") {
        const keys = asList(raw);
        if (!keys.length) { if (q.required) errors[q.id] = "required"; continue; }
        if (q.type === "single" && keys.length > 1) { errors[q.id] = "invalid"; continue; }
        const chosen = keys.map((k) => options.find((o) => o.key === k));
        if (chosen.some((o) => !o)) { errors[q.id] = "invalid"; continue; }
        answers.push({ ...base, choices: chosen.map((o) => ({ key: o.key, th: o.th, en: o.en })) });
      } else {
        const text = clean(asList(raw)[0]);
        if (!text) { if (q.required) errors[q.id] = "required"; continue; }
        if (text.length > TEXT_MAX) { errors[q.id] = "invalid"; continue; }
        texts.push(text);
        answers.push({ ...base, text });
      }
    }
  }

  if (Object.keys(errors).length) return { errors };
  return {
    answers,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    comment: texts.length ? texts.join("\n\n") : null
  };
}

module.exports = {
  TYPES, UNITS, TEXT_MAX,
  listForm, questionCount, sectionJSON, questionJSON,
  deadlineFor, oldestOpenCompletion, getWindow, setWindow,
  createSection, updateSection, deleteSection, moveSection,
  createQuestion, updateQuestion, deleteQuestion, moveQuestion,
  validateAnswers
};
