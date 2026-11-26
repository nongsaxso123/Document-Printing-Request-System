/**
 * Google OAuth 2.0 login + Admin/Officer/Requester role resolution.
 * Ported from prototype/server/server.js once the login+role logic had been
 * proven working there (file.md Appendix C step 4, moved up to run against
 * real Postgres via Prisma instead of the throwaway officer-store.json).
 */

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("./prisma");
const audit = require("./audit");

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "@mfu.ac.th").toLowerCase();
const ALLOW_LAMDUAN_FOR_TESTING = process.env.ALLOW_LAMDUAN_FOR_TESTING === "true";
const LAMDUAN_DOMAIN = "@lamduan.mfu.ac.th";

// TEMPORARY, exact-email allowlist for testing with a personal Google
// account (switching Google accounts in-browser to test each role was too
// unreliable to develop against) — same idea as ALLOW_LAMDUAN_FOR_TESTING,
// but per-email rather than per-domain since we can't allowlist all of gmail.com.
const TEST_ALLOWED_EMAILS = (process.env.TEST_ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Same rule as sign-in: the allowed domain, plus the temporary testing
// allowances when they are switched on. Also used to check emails an admin
// types in at /admin/officers, so nobody outside the domain gets a role.
function isAllowedEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return false;
  return e.endsWith(ALLOWED_EMAIL_DOMAIN) ||
    (ALLOW_LAMDUAN_FOR_TESTING && e.endsWith(LAMDUAN_DOMAIN)) ||
    TEST_ALLOWED_EMAILS.includes(e);
}

// No FR covers self-service creation of the first Admin (file.md FR-02 only
// covers Admin managing Officers) — the Admin role is bootstrapped from env,
// same idea as a seeded superuser.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Admin comes from either ADMIN_EMAILS (server .env — the fallback that can
// never be locked out from inside the app) or an Officer row with isAdmin,
// granted at /admin/officers. app.js re-runs this on every request, so a
// granted/revoked role takes effect immediately, not at the next login.
async function resolveRole(email) {
  const emailLower = String(email || "").toLowerCase();
  if (ADMIN_EMAILS.includes(emailLower)) return "Admin";
  const officer = await prisma.officer.findUnique({ where: { email: emailLower } });
  if (officer) return officer.isAdmin ? "Admin" : "Officer";
  return "Requester";
}

function configure(passport) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || "";
        const emailLower = email.toLowerCase();

        const isRealAllowedDomain = emailLower.endsWith(ALLOWED_EMAIL_DOMAIN);

        // Google marks whether it has verified the address. An unverified
        // address could belong to someone else, so it is refused.
        if (profile._json && profile._json.email_verified === false) {
          return done(null, false, { message: "email-not-verified", email: emailLower || undefined });
        }

        if (!isAllowedEmail(emailLower)) {
          return done(null, false, { message: "domain-not-allowed", email: emailLower || undefined });
        }

        // Role lookup runs even for the temporary lamduan allowance so the
        // Admin/Officer/Requester logic itself can be tested before a real
        // @mfu.ac.th staff account is available (see file.md Appendix B).
        const role = await resolveRole(emailLower);

        const picture = (profile.photos && profile.photos[0] && profile.photos[0].value) || null;

        // Only what the app uses goes into the session (not Google's whole
        // profile).
        return done(null, {
          email: email,
          name: profile.displayName || email,
          picture: picture,
          isRealAllowedDomain: isRealAllowedDomain,
          role: role
        });
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser(function (user, done) { done(null, user); });
  passport.deserializeUser(function (user, done) { done(null, user); });
}

// Not signed in (logged out, session expired) → back to the login page.
// Signed in but the wrong role → 403, that's a real permission problem.
function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/");
  if (req.user.role !== "Admin") {
    audit.recordForbidden(req, "role");
    return res.status(403).send("Forbidden: Admin role required.");
  }
  next();
}

// Admin can reach Officer-only pages too — not stated in file.md, but a
// reasonable default (Admin is the highest-trust role) and needed to test
// the Officer flow with only one real test account available so far.
function requireRole(...allowed) {
  return function (req, res, next) {
    if (!req.user) return res.redirect("/");
    if (!allowed.includes(req.user.role)) {
      audit.recordForbidden(req, "role");
      return res.status(403).send("Forbidden: insufficient role.");
    }
    next();
  };
}

// Officer accounts, plus the in-app Admin role on top of them. Every change
// is written to the audit log (entityType "officer") inside the same
// transaction. Guard rails: an admin can't change or remove their own
// account (no accidental self-lockout), and the last admin can't be
// demoted/removed unless ADMIN_EMAILS still provides one.
const officerLabel = (o) => o.name + " <" + o.email + ">";

async function adminCountAfter(tx, excludeEmail) {
  const dbAdmins = await tx.officer.count({ where: { isAdmin: true, email: { not: excludeEmail } } });
  return dbAdmins + ADMIN_EMAILS.filter((e) => e !== excludeEmail).length;
}

const officers = {
  list: () => prisma.officer.findMany({ orderBy: { assignedDate: "desc" } }),
  envAdmins: () => ADMIN_EMAILS.slice(),

  async add(email, name, assignedBy, { isAdmin = false } = {}) {
    const emailLower = email.toLowerCase();
    return prisma.$transaction(async (tx) => {
      const existing = await tx.officer.findUnique({ where: { email: emailLower } });
      if (existing) return { error: "duplicate" };
      const created = await tx.officer.create({
        data: { email: emailLower, name, assignedBy, isAdmin: !!isAdmin, ...(isAdmin ? { adminGrantedBy: assignedBy, adminGrantedAt: new Date() } : {}) }
      });
      await audit.write(tx, {
        actorEmail: assignedBy, action: "officer.add", entityType: "officer", entityLabel: officerLabel(created),
        before: null, after: { name: created.name, email: created.email, isAdmin: created.isAdmin }
      });
      return { officer: created };
    });
  },

  async setAdmin(email, isAdmin, actorEmail) {
    const emailLower = email.toLowerCase();
    if (emailLower === String(actorEmail).toLowerCase()) return { error: "self" };
    return prisma.$transaction(async (tx) => {
      const existing = await tx.officer.findUnique({ where: { email: emailLower } });
      if (!existing) return { error: "not-found" };
      if (existing.isAdmin === !!isAdmin) return { officer: existing };
      if (!isAdmin && (await adminCountAfter(tx, emailLower)) === 0) return { error: "last-admin" };
      const updated = await tx.officer.update({
        where: { email: emailLower },
        data: isAdmin
          ? { isAdmin: true, adminGrantedBy: actorEmail, adminGrantedAt: new Date() }
          : { isAdmin: false, adminGrantedBy: null, adminGrantedAt: null }
      });
      await audit.write(tx, {
        actorEmail, action: isAdmin ? "officer.grantAdmin" : "officer.revokeAdmin", entityType: "officer",
        entityLabel: officerLabel(updated), before: { isAdmin: existing.isAdmin }, after: { isAdmin: updated.isAdmin }
      });
      return { officer: updated };
    });
  },

  async remove(email, actorEmail) {
    const emailLower = email.toLowerCase();
    if (emailLower === String(actorEmail).toLowerCase()) return { error: "self" };
    return prisma.$transaction(async (tx) => {
      const existing = await tx.officer.findUnique({ where: { email: emailLower } });
      if (!existing) return { error: "not-found" };
      if (existing.isAdmin && (await adminCountAfter(tx, emailLower)) === 0) return { error: "last-admin" };
      await tx.officer.delete({ where: { email: emailLower } });
      await audit.write(tx, {
        actorEmail, action: "officer.remove", entityType: "officer", entityLabel: officerLabel(existing),
        before: { name: existing.name, email: existing.email, isAdmin: existing.isAdmin }, after: null
      });
      return { ok: true };
    });
  }
};

module.exports = { configure, requireAdmin, requireRole, resolveRole, isAllowedEmail, officers, ALLOWED_EMAIL_DOMAIN };
