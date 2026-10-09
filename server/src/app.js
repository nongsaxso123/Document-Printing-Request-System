/**
 * ODPRS real backend entry point — Express + session store + Postgres/Prisma
 * + Google OAuth + role lookup, plus the Requester/Officer/Admin views.
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const passport = require("passport");

const auth = require("./auth");
const profile = require("./profile");
const agencies = require("./agencies");
const settings = require("./settings");
const prisma = require("./prisma");
const { ensureDefaults } = require("./defaults");
const { icon } = require("./icons");
const officerRoutes = require("./routes/officer");
const requesterRoutes = require("./routes/requester");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");
const kioskRoutes = require("./routes/kiosk");

const PORT = process.env.PORT || 3000;

for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "GOOGLE_CALLBACK_URL", "DATABASE_URL"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env — copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

if (process.env.ALLOW_LAMDUAN_FOR_TESTING === "true") {
  console.warn("⚠️  ALLOW_LAMDUAN_FOR_TESTING=true — @lamduan.mfu.ac.th (student) logins are temporarily accepted.");
}

auth.configure(passport);

const app = express();
app.disable("etag"); // dev/demo instance — always serve fresh content on reload, never a cached 304
// In production (docker-compose.prod.yml) every request arrives through
// Caddy, so without this req.ip would be Caddy's address for everyone (one
// shared kiosk rate-limit bucket) and req.secure would never be true behind
// HTTPS. Left off in dev, where the app is hit directly on :3000.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.locals.icon = icon; // every EJS view can call icon('name') — see src/icons.js
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new PgSession({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // "auto": Secure-flagged cookie whenever the request came in over HTTPS
  // (via Caddy + trust proxy above), plain cookie on http://localhost dev.
  cookie: { secure: "auto", httpOnly: true, sameSite: "lax" }
}));
app.use(passport.initialize());
app.use(passport.session());

// A session otherwise lives until the browser itself closes (no maxAge is
// set on the cookie — see the session() config above), which is fine for a
// normal office computer but not for a shared kiosk terminal that might
// just get left open for days. Matches a full work shift: an Officer
// signed in on the kiosk machine (see /kiosk) is automatically signed out
// after this long even if the browser never closes. loginAt is set once,
// in /auth/google/callback, right after a successful login.
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

app.use(function (req, res, next) {
  if (req.user && req.session.loginAt && Date.now() - req.session.loginAt > SESSION_MAX_AGE_MS) {
    return req.logout(function (err) {
      if (err) return next(err);
      next();
    });
  }
  next();
});

// req.user.name starts as the Google account's display name, captured once
// at login (see auth.js) and otherwise frozen in the session. Resolve it
// against the user's own saved profile name (src/profile.js) on every
// request so the header/avatar reflect a profile edit immediately, instead
// of only after the next login.
app.use(async function (req, res, next) {
  if (!req.user) return next();
  try {
    req.user.name = await profile.resolveDisplayName(req.user.email, req.user.name);
    next();
  } catch (err) {
    next(err);
  }
});

// Admin-toggleable "จัดการระบบ" maintenance mode — blocks the Requester
// role app-wide (every /requester/* page, the "/" redirect, and Requester
// hits to /api/*), while leaving Officer/Admin access untouched. Admin can
// also reach Requester pages for testing (see requireRole's comment in
// auth.js), so this checks the role on req.user directly rather than the
// route prefix, and Admin is unaffected either way.
app.use(async function (req, res, next) {
  if (!req.user || req.user.role !== "Requester" || req.path === "/logout") return next();
  try {
    const current = await settings.get();
    if (!settings.isMaintenanceActive(current)) return next();
    res.status(503).render("system-closed", {
      user: req.user,
      message: current.maintenanceMessage,
      messageEn: current.maintenanceMessageEn,
      endsAt: current.maintenanceEndsAt
    });
  } catch (err) {
    next(err);
  }
});

app.get("/", function (req, res) {
  if (req.user) {
    if (req.user.role === "Requester") return res.redirect("/requester/my-requests");
    return res.redirect("/officer/queue"); // Officer and Admin
  }

  res.render("login", {
    deniedDomain: req.query.error === "domain-not-allowed" ? auth.ALLOWED_EMAIL_DOMAIN : null
  });
});

// returnTo lets a page other than "/" send someone here and get them back
// afterward — currently only /kiosk uses this (an Officer signing in on
// the kiosk machine itself should land back on /kiosk, not get bounced to
// their normal /officer/queue). Restricted to a same-origin path: must
// start with a single "/" (not "//", which browsers treat as a
// protocol-relative URL to another host) so this can't become an open
// redirect.
app.get("/auth/google", function (req, res, next) {
  const returnTo = req.query.returnTo;
  req.session.returnTo = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get("/auth/google/callback",
  function (req, res, next) {
    passport.authenticate("google", function (err, user, info) {
      if (err) return next(err);
      if (!user) {
        const reason = (info && info.message) || "unknown";
        return res.redirect("/?error=" + encodeURIComponent(reason));
      }
      // keepSessionInfo: passport >=0.6 regenerates the session on login by
      // default (session-fixation hardening), which would silently wipe
      // req.session.returnTo set above before this callback ever reads it.
      req.logIn(user, { keepSessionInfo: true }, function (err) {
        if (err) return next(err);
        req.session.loginAt = Date.now(); // starts the SESSION_MAX_AGE_MS clock above
        const dest = req.session.returnTo || "/";
        delete req.session.returnTo;
        return res.redirect(dest);
      });
    })(req, res, next);
  }
);

app.get("/logout", function (req, res) {
  req.logout(function () {
    res.redirect("/");
  });
});

// "My Profile" — any logged-in user, any role (see src/profile.js), so it
// lives at the top level rather than under /requester, /officer, or /admin.
app.get("/profile", async function (req, res, next) {
  if (!req.user) return res.redirect("/");
  try {
    res.render("profile", { user: req.user, agencyCategories: await agencies.listActiveWithUnits() });
  } catch (err) { next(err); }
});

app.use("/officer", officerRoutes);
app.use("/requester", requesterRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);
app.use("/kiosk", kioskRoutes); // deliberately mounted with no login/role gate at all — see routes/kiosk.js

app.listen(PORT, function () {
  console.log(`ODPRS server (Postgres-backed) running at http://localhost:${PORT}`);
  // A brand-new (or emptied) database gets the default agencies, drop-off
  // place and settings it needs to take requests — see src/defaults.js.
  ensureDefaults(prisma)
    .then((filled) => { if (filled.length) console.log("Filled empty reference tables with defaults:", filled.join(", ")); })
    .catch((err) => console.error("[defaults] could not fill defaults:", err.message));
});
