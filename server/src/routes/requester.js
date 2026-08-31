const express = require("express");
const requests = require("../requests");
const { requireRole } = require("../auth");
const pdf = require("../pdf");

const router = express.Router();
router.use(requireRole("Requester", "Admin"));
router.use(express.urlencoded({ extended: false }));

router.get("/new-request", (req, res) => {
  res.render("requester/new-request", { user: req.user, active: "newRequest" });
});

router.post("/new-request", async (req, res, next) => {
  try {
    const paperSize = req.body.paperSize === "อื่นๆ" ? req.body.paperSizeOther : req.body.paperSize;

    const result = await requests.create({
      requesterEmail: req.user.email,
      requesterName: req.body.requesterName || req.user.name,
      requesterTel: req.body.tel,
      agencyCategory: req.body.agencyCategory,
      agencyUnit: req.body.agencyUnit,
      paperSize,
      colorMode: req.body.colorMode,
      printSide: req.body.printSide,
      finishingMethods: req.body.finishingMethods,
      documentType: req.body.documentType,
      paperSource: req.body.paperSource,
      copyLabelEnabled: req.body.copyLabelEnabled,
      copyLabelMode: req.body.copyLabelMode,
      copyLabelManual: req.body.copyLabelManual,
      itemList: req.body.itemList,
      originalPages: req.body.originalPages,
      numberOfCopies: req.body.copies,
      appointmentDateProposed: req.body.completionDate
    });

    if (result.error) {
      return res.status(400).render("requester/new-request", {
        user: req.user,
        active: "newRequest",
        error: result.error
      });
    }

    res.redirect("/requester/request-submitted/" + encodeURIComponent(result.referenceNo));
  } catch (err) {
    next(err);
  }
});

router.get("/request-submitted/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || (record.requesterEmail !== req.user.email && req.user.role !== "Admin")) {
      return res.status(404).send("Request not found.");
    }
    res.render("requester/request-submitted", { user: req.user, active: "myRequests", record });
  } catch (err) {
    next(err);
  }
});

// FR-06 — same authorization as the page above; renders that exact page
// (print media) to a real PDF rather than relying on the browser's own
// print dialog.
router.get("/request-submitted/:ref/pdf", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || (record.requesterEmail !== req.user.email && req.user.role !== "Admin")) {
      return res.status(404).send("Request not found.");
    }
    const buffer = await pdf.renderPagePdf(`/requester/request-submitted/${encodeURIComponent(req.params.ref)}`, req.headers.cookie);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${record.referenceNo}.pdf"`
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get("/my-requests", (req, res) => {
  res.render("requester/my-requests", { user: req.user, active: "myRequests" });
});

module.exports = router;
