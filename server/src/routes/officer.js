const express = require("express");
const { requireRole } = require("../auth");
const requests = require("../requests");
const pdf = require("../pdf");

const router = express.Router();
router.use(requireRole("Officer", "Admin"));

router.get("/queue", (req, res) => {
  res.render("officer/queue", { user: req.user, active: "queue" });
});

// Officers reach this page from three different lists (queue/printing-jobs/
// history), each linking here with ?from=<origin> — the sidebar highlight,
// breadcrumb, and "back to ..." link all need to point back to wherever the
// officer actually came from, not always the queue (that was the bug: every
// visit looked like it came from the queue, with no way back to printing-jobs
// or history except several browser-back presses).
const REQUEST_DETAIL_ORIGINS = {
  queue: {
    active: "queue",
    backHref: "/officer/queue",
    backLabelKey: "detail.backToQueue",
    backLabelFallback: "กลับไปที่คิว",
    crumbKey: "crumb.requestDetail.queue",
    crumbFallback: "คิวรอเอกสารต้นฉบับ / <strong>รายละเอียดคำขอ</strong>"
  },
  printing: {
    active: "printing",
    backHref: "/officer/printing-jobs",
    backLabelKey: "detail.backToPrinting",
    backLabelFallback: "กลับไปที่งานที่กำลังปริ้น",
    crumbKey: "crumb.requestDetail.printing",
    crumbFallback: "งานที่กำลังปริ้น / <strong>รายละเอียดคำขอ</strong>"
  },
  history: {
    active: "history",
    backHref: "/officer/history",
    backLabelKey: "detail.backToHistory",
    backLabelFallback: "กลับไปที่ประวัติคำขอทั้งหมด",
    crumbKey: "crumb.requestDetail.history",
    crumbFallback: "ประวัติคำขอทั้งหมด / <strong>รายละเอียดคำขอ</strong>"
  }
};

router.get("/request-detail", (req, res) => {
  const origin = REQUEST_DETAIL_ORIGINS[req.query.from] || REQUEST_DETAIL_ORIGINS.queue;
  res.render("officer/request-detail", {
    user: req.user,
    active: origin.active,
    ref: req.query.ref || "",
    backHref: origin.backHref,
    backLabelKey: origin.backLabelKey,
    backLabelFallback: origin.backLabelFallback,
    crumbKey: origin.crumbKey,
    crumbFallback: origin.crumbFallback
  });
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

router.get("/evaluations", (req, res) => {
  res.render("officer/evaluations", { user: req.user, active: "evaluations" });
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
