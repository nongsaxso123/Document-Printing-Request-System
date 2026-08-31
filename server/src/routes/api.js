const express = require("express");
const requests = require("../requests");
const auth = require("../auth");
const { requireRole } = auth;

const router = express.Router();
router.use(express.json());

// Requester's own requests — any logged-in user, scoped to their own email.
router.get("/my-requests", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "not-logged-in" });
    res.json(await requests.listByRequester(req.user.email));
  } catch (err) { next(err); }
});

// Powers the dismissible reminder banner on requester/my-requests.ejs —
// the actual submission gate lives server-side in routes/requester.js
// (requireNoPendingEvaluation), this is just for the soft nudge.
router.get("/my-pending-evaluation", async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json(null);
    res.json(await requests.getPendingEvaluation(req.user.email));
  } catch (err) { next(err); }
});

router.use(requireRole("Officer", "Admin"));

router.get("/requests", async (req, res, next) => {
  try {
    res.json(await requests.list());
  } catch (err) { next(err); }
});

router.get("/dashboard-summary", async (req, res, next) => {
  try {
    res.json(await requests.dashboardSummary({
      year: req.query.year,
      documentType: req.query.documentType,
      paperSource: req.query.paperSource
    }));
  } catch (err) { next(err); }
});

router.get("/requests/awaiting", async (req, res, next) => {
  try {
    res.json(await requests.listAwaiting());
  } catch (err) { next(err); }
});

router.get("/requests/printing", async (req, res, next) => {
  try {
    res.json(await requests.listPrinting());
  } catch (err) { next(err); }
});

router.get("/requests/years", async (req, res, next) => {
  try {
    res.json(await requests.listAvailableYears());
  } catch (err) { next(err); }
});

router.get("/requests/history", async (req, res, next) => {
  try {
    res.json(await requests.searchHistory({
      status: req.query.status,
      agencyCategory: req.query.agencyCategory,
      year: req.query.year,
      month: req.query.month,
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize
    }));
  } catch (err) { next(err); }
});

router.get("/requests/by-claim/:code", async (req, res, next) => {
  try {
    const record = await requests.getByClaimCode(req.params.code);
    res.json(record);
  } catch (err) { next(err); }
});

router.get("/requests/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record) return res.status(404).json(null);
    res.json(record);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/approve", async (req, res, next) => {
  try {
    const updated = await requests.approve(req.params.ref, {
      confirmedDate: req.body.confirmedDate,
      officerEmail: req.user.email,
      officerName: req.user.name
    });
    if (!updated) return res.status(409).json({ error: "not-awaiting" });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/reject", async (req, res, next) => {
  try {
    const updated = await requests.reject(req.params.ref, {
      reason: req.body.reason,
      officerEmail: req.user.email,
      officerName: req.user.name
    });
    if (!updated) return res.status(409).json({ error: "not-awaiting" });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/ready", async (req, res, next) => {
  try {
    const updated = await requests.markReady(req.params.ref);
    if (!updated) return res.status(409).json({ error: "not-printing" });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/requests/:ref/handover", async (req, res, next) => {
  try {
    const updated = await requests.handover(req.params.ref, {
      receiverName: req.body.receiverName,
      receiverPosition: req.body.receiverPosition,
      receiverWorkplace: req.body.receiverWorkplace,
      receiverWorkPhone: req.body.receiverWorkPhone,
      officerEmail: req.user.email,
      officerName: req.user.name
    });
    if (!updated) return res.status(409).json({ error: "not-ready" });
    res.json(updated);
  } catch (err) { next(err); }
});

// FR-02 — Admin-only Officer account management.
function officerToJSON(o) {
  return {
    name: o.name,
    email: o.email,
    assignedBy: o.assignedBy,
    assignedDate: o.assignedDate.toISOString().slice(0, 10)
  };
}

router.get("/admin/officers", auth.requireAdmin, async (req, res, next) => {
  try {
    const officers = await auth.officers.list();
    res.json(officers.map(officerToJSON));
  } catch (err) { next(err); }
});

router.post("/admin/officers", auth.requireAdmin, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name-and-email-required" });
    const officer = await auth.officers.add(email, name, req.user.email);
    res.json(officerToJSON(officer));
  } catch (err) { next(err); }
});

router.post("/admin/officers/:email/remove", auth.requireAdmin, async (req, res, next) => {
  try {
    await auth.officers.remove(req.params.email);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
