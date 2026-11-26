const express = require("express");
const requests = require("../requests");
const evaluationForm = require("../evaluationForm");
const profile = require("../profile");
const locations = require("../locations");
const unitDirectory = require("../units");
const { requireRole } = require("../auth");
const audit = require("../audit");
const pdf = require("../pdf");
const { createLimiter } = require("../rateLimit");

const router = express.Router();
router.use(requireRole("Requester", "Admin"));
router.use(express.urlencoded({ extended: false }));

// Counted per account (not per IP) so several people behind one campus
// NAT/VPN address never share a bucket. Generous enough for a real busy
// day, but stops a script or a stuck double-submit from flooding the queue.
const byAccount = (req) => req.user && req.user.email;
const submitLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 15, key: byAccount, name: "submit" });
const editLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 30, key: byAccount, name: "edit" });

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

// Pre-fill the requester's own name/phone/unit from their saved Profile
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

// The unit type the profile has saved, plus whichever of unit-id /
// free-typed-text applies — skipping the unit entirely if it's since been
// archived (the plan's "profile autofill must skip archived units": a
// category select with no matching unit selected is fine, silently
// prefilling an unavailable option would not be).
function unitDefaultsFromProfile(userProfile, unitTypes) {
  if (!userProfile || !userProfile.workplaceCategoryId) {
    return { defaultUnitTypeId: null, defaultUnitId: null, defaultUnitText: "" };
  }
  const category = unitTypes.find((c) => c.id === userProfile.workplaceCategoryId);
  if (!category) return { defaultUnitTypeId: null, defaultUnitId: null, defaultUnitText: "" };

  if (category.allowsFreeText) {
    return { defaultUnitTypeId: category.id, defaultUnitId: null, defaultUnitText: userProfile.workplaceUnit || "" };
  }
  const unit = category.units.find((u) => u.id === userProfile.workplaceUnitId);
  return { defaultUnitTypeId: category.id, defaultUnitId: unit ? unit.id : null, defaultUnitText: "" };
}

async function newRequestDefaults(req) {
  const userProfile = await profile.get(req.user.email);
  const unitTypes = await unitDirectory.listActiveWithUnits();
  return {
    ...(await dropoffLocationOptions(req.body && req.body.dropoffLocationId)),
    defaultRequesterName: profile.displayName(userProfile, req.user.name),
    defaultTel: (userProfile && userProfile.phone) || "",
    unitTypes,
    ...unitDefaultsFromProfile(userProfile, unitTypes)
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
    unitTypeId: req.body.unitTypeId,
    unitId: req.body.unitId,
    unitText: req.body.unitText,
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

router.post("/new-request", submitLimiter, requireNoPendingEvaluation, async (req, res, next) => {
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

    await audit.recordRequest(req.user.email, "submit", result.referenceNo);
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
  const unitTypes = await unitDirectory.listActiveWithUnits();
  // prefill's category/unit ids are null on a request that predates the
  // unit tables (or whose stored string didn't match one at backfill) —
  // falls back to no default selected, same as a profile with no saved
  // workplace (see unitDefaultsFromProfile above).
  const category = prefill.unitTypeId ? unitTypes.find((c) => c.id === prefill.unitTypeId) : null;
  res.status(extra && extra.error ? 400 : 200).render("requester/new-request", {
    ...dropoffOptions,
    user: req.user,
    active: "myRequests",
    editing: prefill,
    defaultRequesterName: prefill.requesterName,
    defaultTel: prefill.requesterTel,
    unitTypes,
    defaultUnitTypeId: category ? category.id : null,
    defaultUnitId: category && !category.allowsFreeText ? prefill.unitId : null,
    defaultUnitText: category && category.allowsFreeText ? prefill.unit : "",
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

router.post("/request-submitted/:ref/edit", editLimiter, async (req, res, next) => {
  try {
    const submittedUrl = "/requester/request-submitted/" + encodeURIComponent(req.params.ref);
    const result = await requests.update(req.params.ref, requestInputFromBody(req));

    if (result.error === "not-editable") return res.redirect(submittedUrl + "?result=notEditable");
    if (result.error) {
      const prefill = await requests.getEditPrefill(req.params.ref, req.user.email);
      if (!prefill) return res.redirect(submittedUrl);
      return renderEditForm(req, res, prefill, { error: result.error });
    }
    await audit.recordRequest(req.user.email, "edit", req.params.ref);
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
router.get("/request-submitted/:ref/pdf", pdf.pdfLimiter, async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || (record.requesterEmail !== req.user.email && req.user.role !== "Admin")) {
      return res.status(404).send("Request not found.");
    }
    const buffer = await pdf.renderPagePdf(`/requester/request-submitted/${encodeURIComponent(req.params.ref)}`, req.headers.cookie);
    res.set({
      "Content-Type": "application/pdf",
      // ?inline=1 opens it in the browser instead (the iPhone "Print" button, see printRequestForm in app.js)
      "Content-Disposition": `${req.query.inline ? "inline" : "attachment"}; filename="${record.referenceNo}.pdf"`
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get("/my-requests", (req, res) => {
  res.render("requester/my-requests", { user: req.user, active: "myRequests" });
});

// The form shown is whatever the admin has set up (src/evaluationForm.js).
async function renderEvaluate(res, req, record, extra) {
  const [sections, status] = await Promise.all([
    evaluationForm.listForm(),
    requests.evaluationState(record.referenceNo, req.user.email)
  ]);
  res.render("requester/evaluate", Object.assign({
    user: req.user, active: "myRequests", record,
    sections: sections.map(evaluationForm.sectionJSON),
    deadline: status.deadline ? status.deadline.toISOString() : null,
    values: {}, errors: {}, error: null
  }, extra));
}

router.get("/evaluate/:ref", async (req, res, next) => {
  try {
    const record = await requests.getByRef(req.params.ref);
    if (!record || record.requesterEmail !== req.user.email || record.statusCode !== "completed") {
      return res.status(404).send("Request not found.");
    }
    const status = await requests.evaluationState(req.params.ref, req.user.email);
    if (status.state === "expired") return res.redirect("/requester/my-requests?result=evaluationExpired");
    if (status.state !== "open") return res.redirect("/requester/my-requests");
    await renderEvaluate(res, req, record);
  } catch (err) {
    next(err);
  }
});

router.post("/evaluate/:ref", async (req, res, next) => {
  try {
    const result = await requests.submitEvaluation(req.params.ref, { requesterEmail: req.user.email, body: req.body });

    if (result.error === "expired") return res.redirect("/requester/my-requests?result=evaluationExpired");
    if (result.error === "already-evaluated") return res.redirect("/requester/my-requests");
    if (result.error) {
      const record = await requests.getByRef(req.params.ref);
      if (!record || record.requesterEmail !== req.user.email) return res.status(404).send("Request not found.");
      res.status(400);
      return renderEvaluate(res, req, record, { values: req.body, errors: result.errors || {}, error: result.error });
    }

    // Clear the whole backlog before returning to normal browsing, one at a time.
    const nextPending = await requests.getPendingEvaluation(req.user.email);
    res.redirect((nextPending ? "/requester/evaluate/" + encodeURIComponent(nextPending.referenceNo) : "/requester/my-requests") + "?result=evaluated");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
