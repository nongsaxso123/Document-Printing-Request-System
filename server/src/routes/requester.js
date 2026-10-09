const express = require("express");
const requests = require("../requests");
const profile = require("../profile");
const locations = require("../locations");
const agencies = require("../agencies");
const { requireRole } = require("../auth");
const pdf = require("../pdf");

const router = express.Router();
router.use(requireRole("Requester", "Admin"));
router.use(express.urlencoded({ extended: false }));

// Blocks new-request submission while a completed request of theirs still
// lacks its post-completion satisfaction evaluation — the Requester can
// still freely browse my-requests/status/history, only filing a *new*
// request is gated, per the agreed scope.
async function requireNoPendingEvaluation(req, res, next) {
  try {
    const pending = await requests.getPendingEvaluation(req.user.email);
    if (pending) return res.redirect("/requester/evaluate/" + encodeURIComponent(pending.referenceNo) + "?result=evaluationRequired");
    next();
  } catch (err) { next(err); }
}

// Pre-fill the requester's own name/phone/agency from their saved Profile
// (see profile.js) — falls back to the Google account name when no profile
// name is set yet, same as before Profile existed.
// Active places where original documents can be dropped off, plus which one
// the form should start on (an explicit choice, else the admin's default).
async function dropoffLocationOptions(selectedId) {
  const options = await locations.listActive("dropoff");
  const wanted = parseInt(selectedId, 10);
  const initial = options.find((l) => l.id === wanted)
    || options.find((l) => l.isDefaultDropoff)
    || options[0];
  return {
    dropoffLocations: options.map(locations.snapshotOf),
    selectedDropoffLocationId: initial ? initial.id : null
  };
}

// The agency category the profile has saved, plus whichever of unit-id /
// free-typed-text applies — skipping the unit entirely if it's since been
// archived (the plan's "profile autofill must skip archived units": a
// category select with no matching unit selected is fine, silently
// prefilling an unavailable option would not be).
function agencyDefaultsFromProfile(userProfile, agencyCategories) {
  if (!userProfile || !userProfile.workplaceCategoryId) {
    return { defaultAgencyCategoryId: null, defaultAgencyUnitId: null, defaultAgencyUnitText: "" };
  }
  const category = agencyCategories.find((c) => c.id === userProfile.workplaceCategoryId);
  if (!category) return { defaultAgencyCategoryId: null, defaultAgencyUnitId: null, defaultAgencyUnitText: "" };

  if (category.allowsFreeText) {
    return { defaultAgencyCategoryId: category.id, defaultAgencyUnitId: null, defaultAgencyUnitText: userProfile.workplaceUnit || "" };
  }
  const unit = category.units.find((u) => u.id === userProfile.workplaceUnitId);
  return { defaultAgencyCategoryId: category.id, defaultAgencyUnitId: unit ? unit.id : null, defaultAgencyUnitText: "" };
}

async function newRequestDefaults(req) {
  const userProfile = await profile.get(req.user.email);
  const agencyCategories = await agencies.listActiveWithUnits();
  return {
    ...(await dropoffLocationOptions(req.body && req.body.dropoffLocationId)),
    defaultRequesterName: profile.displayName(userProfile, req.user.name),
    defaultTel: (userProfile && userProfile.phone) || "",
    agencyCategories,
    ...agencyDefaultsFromProfile(userProfile, agencyCategories)
  };
}

router.get("/new-request", requireNoPendingEvaluation, async (req, res, next) => {
  try {
    res.render("requester/new-request", {
      user: req.user,
      active: "newRequest",
      ...(await newRequestDefaults(req))
    });
  } catch (err) { next(err); }
});

// Maps the request form's POST body to requests.create()/update() input.
function requestInputFromBody(req) {
  const paperSize = req.body.paperSize === "อื่นๆ" ? req.body.paperSizeOther : req.body.paperSize;
  return {
    requesterEmail: req.user.email,
    requesterName: req.body.requesterName || req.user.name,
    requesterTel: req.body.tel,
    agencyCategoryId: req.body.agencyCategoryId,
    agencyUnitId: req.body.agencyUnitId,
    agencyUnitText: req.body.agencyUnitText,
    dropoffLocationId: req.body.dropoffLocationId,
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
  };
}

router.post("/new-request", requireNoPendingEvaluation, async (req, res, next) => {
  try {
    const result = await requests.create(requestInputFromBody(req));

    if (result.error) {
      return res.status(400).render("requester/new-request", {
        user: req.user,
        active: "newRequest",
        error: result.error,
        ...(await newRequestDefaults(req))
      });
    }

    res.redirect("/requester/request-submitted/" + encodeURIComponent(result.referenceNo) + "?result=submitted");
  } catch (err) {
    next(err);
  }
});

// Edit a request that hasn't been approved/rejected/cancelled yet — reuses
// the new-request form, pre-filled. Anything no longer editable (or not the
// caller's) just goes back to the request's own page.
async function renderEditForm(req, res, prefill, extra) {
  const dropoffOptions = await dropoffLocationOptions(req.body && req.body.dropoffLocationId || prefill.dropoffLocationId);
  const agencyCategories = await agencies.listActiveWithUnits();
  // prefill's category/unit ids are null on a request that predates the
  // agency tables (or whose stored string didn't match one at backfill) —
  // falls back to no default selected, same as a profile with no saved
  // workplace (see agencyDefaultsFromProfile above).
  const category = prefill.agencyCategoryId ? agencyCategories.find((c) => c.id === prefill.agencyCategoryId) : null;
  res.status(extra && extra.error ? 400 : 200).render("requester/new-request", {
    ...dropoffOptions,
    user: req.user,
    active: "myRequests",
    editing: prefill,
    defaultRequesterName: prefill.requesterName,
    defaultTel: prefill.requesterTel,
    agencyCategories,
    defaultAgencyCategoryId: category ? category.id : null,
    defaultAgencyUnitId: category && !category.allowsFreeText ? prefill.agencyUnitId : null,
    defaultAgencyUnitText: category && category.allowsFreeText ? prefill.agencyUnit : "",
    ...extra
  });
}

router.get("/request-submitted/:ref/edit", async (req, res, next) => {
  try {
    const prefill = await requests.getEditPrefill(req.params.ref, req.user.email);
    if (!prefill) return res.redirect("/requester/request-submitted/" + encodeURIComponent(req.params.ref));
    await renderEditForm(req, res, prefill);
  } catch (err) { next(err); }
});

router.post("/request-submitted/:ref/edit", async (req, res, next) => {
  try {
    const submittedUrl = "/requester/request-submitted/" + encodeURIComponent(req.params.ref);
    const result = await requests.update(req.params.ref, requestInputFromBody(req));

    if (result.error === "not-editable") return res.redirect(submittedUrl + "?result=notEditable");
    if (result.error) {
      const prefill = await requests.getEditPrefill(req.params.ref, req.user.email);
      if (!prefill) return res.redirect(submittedUrl);
      return renderEditForm(req, res, prefill, { error: result.error });
    }
    res.redirect(submittedUrl + "?result=edited");
  } catch (err) { next(err); }
});

router.get("/request-submitted/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || (record.requesterEmail !== req.user.email && req.user.role !== "Admin")) {
      return res.status(404).send("Request not found.");
    }
    // Where to bring the original document (and who to call) — the place
    // chosen on the form, or the current default for requests that predate
    // the Location table. See src/locations.js / admin/locations.ejs.
    const fallback = record.dropoffLocation ? null : await locations.getDefault("dropoff");
    res.render("requester/request-submitted", {
      user: req.user,
      active: "myRequests",
      record,
      dropoffLocation: record.dropoffLocation || (fallback ? locations.snapshotOf(fallback) : null)
    });
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

router.get("/evaluate/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || record.requesterEmail !== req.user.email || record.statusCode !== "completed") {
      return res.status(404).send("Request not found.");
    }
    const existingEvaluation = await requests.getEvaluation(req.params.ref);
    if (existingEvaluation) return res.redirect("/requester/my-requests");

    res.render("requester/evaluate", { user: req.user, active: "myRequests", record, error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/evaluate/:ref", async (req, res, next) => {
  try {
    const result = await requests.submitEvaluation(req.params.ref, {
      requesterEmail: req.user.email,
      ratings: {
        ratingStaffService: req.body.ratingStaffService,
        ratingSystemEase: req.body.ratingSystemEase,
        ratingSpeed: req.body.ratingSpeed,
        ratingPrintQuality: req.body.ratingPrintQuality,
        ratingOverall: req.body.ratingOverall
      },
      comment: req.body.comment
    });

    if (result.error) {
      const record = await requests.getByRef(req.params.ref);
      if (!record || record.requesterEmail !== req.user.email) return res.status(404).send("Request not found.");
      return res.status(400).render("requester/evaluate", { user: req.user, active: "myRequests", record, error: result.error });
    }

    // Clear the whole backlog before returning to normal browsing, one at a time.
    const nextPending = await requests.getPendingEvaluation(req.user.email);
    res.redirect((nextPending ? "/requester/evaluate/" + encodeURIComponent(nextPending.referenceNo) : "/requester/my-requests") + "?result=evaluated");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
