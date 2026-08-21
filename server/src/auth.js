/**
 * Google OAuth 2.0 login + Admin/Officer/Requester role resolution.
 * Ported from prototype/server/server.js once the login+role logic had been
 * proven working there (file.md Appendix C step 4, moved up to run against
 * real Postgres via Prisma instead of the throwaway officer-store.json).
 */

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("./prisma");

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

// No FR covers self-service creation of the first Admin (file.md FR-02 only
// covers Admin managing Officers) — the Admin role is bootstrapped from env,
// same idea as a seeded superuser.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function resolveRole(emailLower) {
  if (ADMIN_EMAILS.includes(emailLower)) return "Admin";
  const officer = await prisma.officer.findUnique({ where: { email: emailLower } });
  if (officer) return "Officer";
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
        const isTemporarilyAllowedLamduan = ALLOW_LAMDUAN_FOR_TESTING && emailLower.endsWith(LAMDUAN_DOMAIN);
        const isTemporarilyAllowedTestEmail = TEST_ALLOWED_EMAILS.includes(emailLower);

        if (!isRealAllowedDomain && !isTemporarilyAllowedLamduan && !isTemporarilyAllowedTestEmail) {
          return done(null, false, { message: "domain-not-allowed" });
        }

        // Role lookup runs even for the temporary lamduan allowance so the
        // Admin/Officer/Requester logic itself can be tested before a real
        // @mfu.ac.th staff account is available (see file.md Appendix B).
        const role = await resolveRole(emailLower);

        const picture = (profile.photos && profile.photos[0] && profile.photos[0].value) || null;

        return done(null, {
          email: email,
          name: profile.displayName || email,
          picture: picture,
          isRealAllowedDomain: isRealAllowedDomain,
          role: role,
          raw: profile._json
        });
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser(function (user, done) { done(null, user); });
  passport.deserializeUser(function (user, done) { done(null, user); });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "Admin") return res.status(403).send("Forbidden — Admin role required.");
  next();
}

// Admin can reach Officer-only pages too — not stated in file.md, but a
// reasonable default (Admin is the highest-trust role) and needed to test
// the Officer flow with only one real test account available so far.
function requireRole(...allowed) {
  return function (req, res, next) {
    if (!req.user || !allowed.includes(req.user.role)) return res.status(403).send("Forbidden — insufficient role.");
    next();
  };
}

const officers = {
  list: () => prisma.officer.findMany({ orderBy: { assignedDate: "desc" } }),
  add: (email, name, assignedBy) =>
    prisma.officer.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), name, assignedBy },
      update: {} // no-op if already an Officer
    }),
  remove: (email) => prisma.officer.delete({ where: { email: email.toLowerCase() } }).catch(() => null)
};

module.exports = { configure, requireAdmin, requireRole, resolveRole, officers, ALLOWED_EMAIL_DOMAIN };
