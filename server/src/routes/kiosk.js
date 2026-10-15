/**
 * Self-service Claim Code kiosk for a walk-in Requester — meant for a
 * dedicated on-premises machine, separate from whichever computer the
 * Officer runs the rest of /officer/* on. The Requester never logs in
 * here; instead, an Officer signs in with their own Google account on the
 * kiosk machine itself (same login every other page in this app uses —
 * GET /auth/google?returnTo=/kiosk from views/kiosk/claim-lookup.ejs's
 * sign-in prompt) and, while that session stays open on that browser, the
 * page works for whoever walks up to it and confirms a pickup as that
 * Officer — handedOverByOfficer* on the Request is set from req.user
 * directly, exactly as if they'd clicked the button themselves on
 * /officer/counter-handover.
 *
 * Earlier versions of this had a separate "register this device" cookie
 * allowlist and a "start/end duty" toggle instead of reusing login — both
 * were removed once we realized they were just duplicating what this
 * app's login session already provides for free (see conversation).
 *
 * The 6-digit Claim Code is still a secondary layer (a Requester needs the
 * right one to find their own request), but it is no longer the *only*
 * protection — without an Officer signed in on this exact browser, none of
 * this works regardless of the code, so a Requester's own phone/computer
 * can't be used to self-confirm a pickup they never showed up for.
 */

const express = require("express");
const requests = require("../requests");
const { requireRole } = require("../auth");
const { createLimiter } = require("../rateLimit");

const router = express.Router();
router.use(express.json());

// 20 Claim Code lookups per minute per IP — slows down guessing 6-digit
// codes without getting in the way of a real queue at the counter.
const claimLookupLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  onLimit: (req, res) => res.status(429).json({ error: "too-many-requests" })
});

function clean(value) {
  const s = value == null ? "" : String(value).trim();
  return s || null;
}

// The page itself is never role-gated (a Requester walking up must be able
// to load it) — it just renders a different state depending on who, if
// anyone, is currently signed in on this browser.
router.get("/", (req, res) => {
  const authorized = !!(req.user && (req.user.role === "Officer" || req.user.role === "Admin"));
  res.render("kiosk/claim-lookup", {
    authorized,
    loggedIn: !!req.user,
    officerName: authorized ? req.user.name : null,
    // Shown on the "wrong account" screen so whoever's stuck signed in on
    // this browser can tell at a glance which account needs signing out.
    loggedInEmail: !authorized && req.user ? req.user.email : null
  });
});

router.get("/lookup/:code", requireRole("Officer", "Admin"), claimLookupLimiter, async (req, res, next) => {
  try {
    const record = await requests.getByClaimCode(req.params.code);
    if (!record) return res.json(null);
    res.json({
      requesterName: record.requesterName,
      tel: record.tel,
      agencyUnit: record.agencyUnit,
      runNumber: record.runNumber,
      itemList: record.itemList,
      pickupLocation: record.pickupLocation,
      pickupAvailableFrom: record.pickupAvailableFrom
    });
  } catch (err) { next(err); }
});

router.post("/confirm/:code", requireRole("Officer", "Admin"), claimLookupLimiter, async (req, res, next) => {
  try {
    const record = await requests.getByClaimCode(req.params.code);
    if (!record) return res.status(404).json({ error: "not-found" });

    const receiverName = clean(req.body.receiverName);
    const receiverPosition = clean(req.body.receiverPosition);
    const receiverWorkplace = clean(req.body.receiverWorkplace);
    const receiverWorkPhone = clean(req.body.receiverWorkPhone);
    if (!receiverName || !receiverPosition || !receiverWorkplace || !receiverWorkPhone) {
      return res.status(400).json({ error: "missing-fields" });
    }

    const updated = await requests.handover(record.referenceNo, {
      receiverName, receiverPosition, receiverWorkplace, receiverWorkPhone,
      officerEmail: req.user.email,
      officerName: req.user.name
    });
    // handover() returns null if the request moved on (already completed,
    // e.g. a double submit, or somehow no longer READY_FOR_PICKUP) between
    // the lookup above and this confirm.
    if (!updated) return res.status(409).json({ error: "not-ready" });
    // referenceNo for the success popup — /lookup above doesn't expose it.
    res.json({ ok: true, referenceNo: record.referenceNo });
  } catch (err) { next(err); }
});

module.exports = router;
