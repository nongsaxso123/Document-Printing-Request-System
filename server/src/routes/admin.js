const express = require("express");
const auth = require("../auth");
const settings = require("../settings");
const manuals = require("../manuals");
const evaluationForm = require("../evaluationForm");

const router = express.Router();
router.use(auth.requireAdmin);

router.get("/officers", (req, res) => {
  res.render("admin/officers", { user: req.user, active: "admin", envAdmins: auth.officers.envAdmins() });
});

router.get("/settings", async (req, res, next) => {
  try {
    const current = await settings.get();
    res.render("admin/settings", { user: req.user, active: "systemSettings", settings: current });
  } catch (err) { next(err); }
});

router.get("/locations", (req, res) => {
  res.render("admin/locations", { user: req.user, active: "adminLocations" });
});

router.get("/audit-log", (req, res) => {
  res.render("admin/audit-log", { user: req.user, active: "adminAuditLog" });
});

router.get("/units", (req, res) => {
  res.render("admin/units", { user: req.user, active: "adminUnits" });
});

router.get("/evaluation-form", (req, res) => {
  res.render("admin/evaluation-form", { user: req.user, active: "adminEvaluationForm" });
});

// The real requester page (requester/evaluate.ejs) with the current form and
// a sample request, in preview mode: nothing is saved, the submit button
// only checks the answers the same way the real page does.
router.get("/evaluation-form/preview", async (req, res, next) => {
  try {
    const [sections, window] = await Promise.all([evaluationForm.listForm(), evaluationForm.getWindow()]);
    const deadline = evaluationForm.deadlineFor(new Date(), window.value, window.unit);
    res.render("requester/evaluate", {
      user: req.user, active: "adminEvaluationForm", preview: true,
      record: { referenceNo: "REQ-0000-000000", runNumber: "RN-0000-000000", itemList: "ตัวอย่างรายการเอกสาร / Sample document" },
      sections: sections.map(evaluationForm.sectionJSON),
      deadline: deadline ? deadline.toISOString() : null,
      values: {}, errors: {}, error: null
    });
  } catch (err) { next(err); }
});

// ---- User manuals (PDF) shown on the login page — see src/manuals.js ----
router.get("/manuals", async (req, res, next) => {
  try {
    res.render("admin/manuals", { user: req.user, active: "adminManuals", manuals: await manuals.listInfo(), maxMb: manuals.MAX_BYTES / 1024 / 1024 });
  } catch (err) { next(err); }
});

// Body is the raw PDF; the original file name comes in X-File-Name
// (URI-encoded, since header values can't carry Thai characters as-is).
router.post("/manuals/:audience/:lang", express.raw({ type: "application/pdf", limit: manuals.MAX_BYTES }), async (req, res, next) => {
  try {
    let fileName = "";
    try { fileName = decodeURIComponent(String(req.get("X-File-Name") || "")); } catch (e) { /* keep default name */ }
    const result = await manuals.save(req.params.audience, req.params.lang, { buffer: req.body, fileName, actorEmail: req.user.email });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete("/manuals/:audience/:lang", async (req, res, next) => {
  try {
    const result = await manuals.remove(req.params.audience, req.params.lang, { actorEmail: req.user.email });
    if (result.error) return res.status(result.error === "notFound" ? 404 : 400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// The old combined contact-info page was replaced by /admin/locations.
router.get("/contact-info", (req, res) => res.redirect("/admin/locations"));

module.exports = router;
