const express = require("express");
const { requireRole } = require("../auth");
const requests = require("../requests");
const pdf = require("../pdf");

const router = express.Router();
router.use(requireRole("Officer", "Admin"));

router.get("/queue", (req, res) => {
  res.render("officer/queue", { user: req.user, active: "queue" });
});

router.get("/request-detail", (req, res) => {
  res.render("officer/request-detail", { user: req.user, active: "queue", ref: req.query.ref || "" });
});

router.get("/printing-jobs", (req, res) => {
  res.render("officer/printing-jobs", { user: req.user, active: "printing" });
});

router.get("/counter-handover", (req, res) => {
  res.render("officer/counter-handover", { user: req.user, active: "handover" });
});

router.get("/history", (req, res) => {
  res.render("officer/history", { user: req.user, active: "history" });
});

router.get("/dashboard", (req, res) => {
  res.render("officer/dashboard", { user: req.user, active: "dashboard" });
});

router.get("/request-form-view", (req, res) => {
  res.render("officer/request-form-view", { user: req.user, active: "history", ref: req.query.ref || "" });
});

// FR-06 — real PDF of the same page above (print media), for re-download
// after RUN NUMBER/Claim Code have been assigned.
router.get("/request-form-view/pdf", async (req, res, next) => {
  try {
    const ref = req.query.ref || "";
    const record = await requests.getByRef(ref);
    if (!record) return res.status(404).send("Request not found.");

    const buffer = await pdf.renderPagePdf(`/officer/request-form-view?ref=${encodeURIComponent(ref)}`, req.headers.cookie);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${record.referenceNo}.pdf"`
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
