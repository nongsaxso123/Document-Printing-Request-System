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
const audit = require("./audit");
const profile = require("./profile");
const unitDirectory = require("./units");
const settings = require("./settings");
const prisma = require("./prisma");
const { ensureDefaults } = require("./defaults");
const { icon } = require("./icons");
const officerRoutes = require("./routes/officer");
const requesterRoutes = require("./routes/requester");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");
const kioskRoutes = require("./routes/kiosk");
const { createLimiter } = require("./rateLimit");
const manuals = require("./manuals");

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
app.disable("x-powered-by"); // don't advertise "Express" in every response header
app.disable("etag"); // dev/demo instance — always serve fresh content on reload, never a cached 304
// In production every request passes two proxies: the MFU reverse proxy
// (HTTPS) and then Caddy. Without this, req.ip would be a proxy's address
// for everyone (one shared rate-limit bucket) and req.secure would never be
// true. 2 = trust Caddy plus the hop before it. That is safe even if someone
// bypasses the MFU proxy: Caddy only keeps X-Forwarded-For from
// TRUSTED_PROXIES and overwrites it for everyone else. Left off in dev,
// where the app is hit directly on :3000.
// TRUST_PROXY_HOPS = how many proxies sit in front of the app. Set it to 1
// if Caddy is removed and the MFU proxy forwards straight to the app;
// leaving 2 there would let a user fake their IP via X-Forwarded-For.
if (process.env.NODE_ENV === "production") {
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "2", 10);
  if (!Number.isInteger(hops) || hops < 1) {
    console.error("TRUST_PROXY_HOPS must be a whole number of 1 or more (got " + JSON.stringify(process.env.TRUST_PROXY_HOPS) + ").");
    process.exit(1);
  }
  app.set("trust proxy", hops);
}
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.locals.icon = icon; // every EJS view can call icon('name') — see src/icons.js
// JSON for embedding inside <script> via <%- safeJson(x) %>. Plain
// JSON.stringify would let stored text like "</script><script>..." break out
// of the script tag (stored XSS), so <, >, & and the JS line separators are
// written as \u escapes — still the same value once the browser parses it.
app.locals.safeJson = function safeJson(value) {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
};
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));

// CSRF guard. sameSite=lax already stops other websites from sending our
// cookie on a POST, but browsers treat every *.mfu.ac.th site as the "same
// site", so a hacked page elsewhere on the university domain could still
// make a signed-in user's browser change things here. Every state-changing
// request (and /logout, which is a plain link) must come from one of our
// own pages:
// - Sec-Fetch-Site is set by the browser itself and can't be faked by a
//   page: "same-origin" = our page, "none" = typed/bookmarked by the user.
// - Older browsers without it: fall back to the Origin header, compared to
//   the public address taken from GOOGLE_CALLBACK_URL (not the Host header,
//   which a reverse proxy may rewrite).
// - Neither header (curl, scripts): allowed. CSRF needs a victim's browser,
//   and every browser sends at least one of them.
const PUBLIC_ORIGIN = new URL(process.env.GOOGLE_CALLBACK_URL).origin;
app.use(function (req, res, next) {
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path === "/logout";
  if (!changesState) return next();
  const site = req.get("Sec-Fetch-Site");
  const origin = req.get("Origin");
  let ok;
  if (site) ok = site === "same-origin" || (site === "none" && req.method === "GET");
  else if (origin) ok = origin === PUBLIC_ORIGIN || origin === req.protocol + "://" + req.get("host");
  else ok = true;
  if (ok) return next();
  console.warn("[csrf] blocked", req.method, req.path, "site=" + (site || "-"), "origin=" + (origin || "-"));
  audit.recordForbidden(req, "csrf");
  res.status(403).type("text/plain; charset=utf-8").send(
    "คำขอนี้ไม่ได้มาจากหน้าเว็บของระบบ จึงถูกปฏิเสธ กรุณากลับไปที่หน้าระบบแล้วลองใหม่\n" +
    "This request did not come from this site's own pages, so it was refused. Please go back to the site and try again."
  );
});

// Lifetime of a sign-in. The cookie gets the same maxAge (so the browser
// drops it too) and the server-side check below ends the session at this
// age even if the browser keeps sending the cookie.
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE = "connect.sid";

app.use(session({
  name: SESSION_COOKIE,
  store: new PgSession({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // "auto": Secure-flagged cookie whenever the request came in over HTTPS
  // (MFU proxy says so via X-Forwarded-Proto, passed on by Caddy + trust
  // proxy above), plain cookie on http://localhost dev.
  cookie: { secure: "auto", httpOnly: true, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS }
}));
app.use(passport.initialize());
app.use(passport.session());
// Every audit-log row written while handling this request records the
// visitor's IP (see src/audit.js). Placed after the session store so its
// pg callbacks can't drop the context before the route handlers run.
app.use(function (req, res, next) {
  audit.context.run({ ip: req.ip || null }, next);
});
// Signed-in pages must never come back from the browser cache: otherwise
// pressing Back after logout shows the old page (with someone's data) as if
// still logged in. no-store also keeps them out of the back/forward cache,
// so Back re-asks the server, which then sends a logged-out user to login.
app.use(function (req, res, next) {
  if (req.user) res.set("Cache-Control", "no-store");
  next();
});
// Read by the sidebar so its open/closed section memory resets on each login.
app.use(function (req, res, next) {
  res.locals.navScope = req.session && req.session.loginAt ? String(req.session.loginAt) : "";
  next();
});

// Any sign-in ends after this long, counted from login (loginAt below), even
// if the browser stays open. Matches a full work shift: an Officer signed in
// on the kiosk machine (see /kiosk) is signed out after this long.
// loginAt is set once, in /auth/google/callback, right after login.
app.use(function (req, res, next) {
  if (req.user && req.session.loginAt && Date.now() - req.session.loginAt > SESSION_MAX_AGE_MS) {
    return req.logout(function (err) {
      if (err) return next(err);
      next();
    });
  }
  next();
});

// A sign-in made on the kiosk machine (/auth/google?returnTo=/kiosk) only
// opens /kiosk. Whoever walks up to that public screen could otherwise open
// a new tab on /officer/* or /admin/* with the officer's session. Pages go
// back to /kiosk; API calls get 403. /logout stays open so the officer can
// sign out, and /auth/* is closed too: a fresh Google sign-in from here
// would otherwise hand out a full session without signing out first.
function kioskAllows(p) {
  return p === "/kiosk" || p.startsWith("/kiosk/") || p === "/logout";
}
app.use(function (req, res, next) {
  if (!req.user || !req.session.kioskOnly || kioskAllows(req.path)) return next();
  audit.recordForbidden(req, "kiosk-only");
  if (req.method === "GET" && !req.path.startsWith("/api/")) return res.redirect("/kiosk");
  res.status(403).type("text/plain; charset=utf-8").send(
    "เครื่องนี้ใช้ได้เฉพาะหน้ารับเอกสาร (Kiosk)\nThis sign-in can only use the pickup kiosk."
  );
});

// The role is looked up again on every request (one primary-key query)
// instead of trusting the copy frozen into the session at login, so an
// Officer removed or an Admin role revoked at /admin/officers loses access
// on their very next click, not whenever they next sign in.
app.use(async function (req, res, next) {
  if (!req.user) return next();
  try {
    req.user.role = await auth.resolveRole(req.user.email);
    next();
  } catch (err) {
    next(err);
  }
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

// Manual links at the bottom of the sidebar (partials/sidebar.ejs): which
// uploaded manuals this user's role may open. Page loads only — API calls
// and file downloads don't render the sidebar.
app.use(async function (req, res, next) {
  if (!req.user || req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/manual/")) return next();
  try {
    res.locals.sidebarManuals = await manuals.sidebarAudiences(req.user.role);
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

app.get("/", async function (req, res, next) {
  if (req.user) {
    if (req.user.role === "Requester") return res.redirect("/requester/my-requests");
    if (req.user.role === "Admin") return res.redirect("/admin/officers");
    return res.redirect("/officer/queue");
  }

  try {
    // Never cached: after signing in, pressing Back to this page must ask
    // the server again (which sends a signed-in user to their own home page)
    // instead of showing the old login page from the browser's cache.
    res.set("Cache-Control", "no-store");
    res.render("login", {
      deniedDomain: req.query.error === "domain-not-allowed" ? auth.ALLOWED_EMAIL_DOMAIN : null,
      // The "user manual" link only shows once the admin has uploaded one.
      hasRequesterManual: (await manuals.listInfo()).some((m) => m.id.startsWith("requester-")),
      // Registrar Division contact, editable at /admin/settings.
      contact: await settings.get()
    });
  } catch (err) { next(err); }
});

// PDPA privacy notice. Public on purpose: people must be able to read what
// is collected before they sign in. Contact details come from /admin/settings.
app.get("/privacy", async function (req, res, next) {
  try {
    res.render("privacy", { contact: await settings.get() });
  } catch (err) { next(err); }
});

// The requester manual is public on purpose — linked from the login page,
// before anyone signs in. Officer/admin manuals need a signed-in user with
// that role (manuals.canView). Falls back to the other language when the
// requested one isn't uploaded.
app.get("/manual/:audience/:lang", async function (req, res, next) {
  try {
    if (!manuals.canView(req.params.audience, null)) {
      if (!req.user) return res.redirect("/");
      if (!manuals.canView(req.params.audience, req.user.role)) {
        audit.recordForbidden(req, "role");
        return res.status(403).send("Forbidden: insufficient role.");
      }
    }
    const file = await manuals.getForDownload(req.params.audience, req.params.lang);
    if (!file) return res.status(404).send("Not found");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      // inline: open in the browser's PDF viewer; filename*: keeps Thai names intact on save
      "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(file.fileName),
      "Cache-Control": "no-cache"
    });
    res.end(Buffer.from(file.data));
  } catch (err) { next(err); }
});

// returnTo lets a page other than "/" send someone here and get them back
// afterward — currently only /kiosk uses this (an Officer signing in on
// the kiosk machine itself should land back on /kiosk, not get bounced to
// their normal /officer/queue). Restricted to a same-origin path: must
// start with a single "/" (not "//", which browsers treat as a
// protocol-relative URL to another host) so this can't become an open
// redirect.
// Login is Google's job (no password ever reaches this app, so there is
// nothing to brute-force here), but each attempt still costs a session row
// and a round trip to Google. Per IP, and loose on purpose: a whole lab
// behind one campus NAT address may sign in at the start of a class.
const loginLimiter = createLimiter({ windowMs: 5 * 60 * 1000, max: 60, name: "login" });

app.get("/auth/google", loginLimiter, function (req, res, next) {
  const returnTo = req.query.returnTo;
  req.session.returnTo = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get("/auth/google/callback", loginLimiter,
  function (req, res, next) {
    passport.authenticate("google", function (err, user, info) {
      if (err) return next(err);
      if (!user) {
        const reason = (info && info.message) || "unknown";
        // A refused sign-in (e.g. an account outside the allowed domain)
        // is logged too: repeated attempts are exactly what s.26 logs are for.
        audit.record({
          actorEmail: (info && info.email) || "unknown", action: "auth.loginFailed",
          entityType: "auth", entityLabel: reason
        });
        return res.redirect("/?error=" + encodeURIComponent(reason));
      }
      // keepSessionInfo: passport >=0.6 regenerates the session on login by
      // default (session-fixation hardening), which would silently wipe
      // req.session.returnTo set above before this callback ever reads it.
      req.logIn(user, { keepSessionInfo: true }, function (err) {
        if (err) return next(err);
        req.session.loginAt = Date.now(); // starts the SESSION_MAX_AGE_MS clock above
        const kiosk = req.session.returnTo === "/kiosk";
        if (kiosk) req.session.kioskOnly = true; // see kioskAllows() above
        else delete req.session.kioskOnly;
        audit.record({ actorEmail: user.email, action: "auth.login", entityType: "auth", entityLabel: kiosk ? user.role + " kiosk" : user.role });
        const dest = req.session.returnTo || "/";
        delete req.session.returnTo;
        return res.redirect(dest);
      });
    })(req, res, next);
  }
);

// Ends the sign-in completely: passport's logout, then the session row is
// deleted from the "session" table and the cookie is cleared, so an old
// cookie can't be replayed. POST is what the sign-out buttons use; GET stays
// for old links and bookmarks (the CSRF guard above covers both).
function logout(req, res, next) {
  if (req.user) audit.record({ actorEmail: req.user.email, action: "auth.logout", entityType: "auth", entityLabel: req.user.role });
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(function (err2) {
      if (err2) return next(err2);
      res.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
      res.redirect("/");
    });
  });
}
app.get("/logout", logout);
app.post("/logout", logout);

// "My Profile" — any logged-in user, any role (see src/profile.js), so it
// lives at the top level rather than under /requester, /officer, or /admin.
app.get("/profile", async function (req, res, next) {
  if (!req.user) return res.redirect("/");
  try {
    res.render("profile", { user: req.user, unitTypes: await unitDirectory.listActiveWithUnits() });
  } catch (err) { next(err); }
});

app.use("/officer", officerRoutes);
app.use("/requester", requesterRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);
app.use("/kiosk", kioskRoutes); // deliberately mounted with no login/role gate at all — see routes/kiosk.js

// Last stop for any error passed to next(err). The details go to the server
// log only; the visitor gets a short message with no stack trace, file
// paths or SQL. err.status is kept for expected cases (400 bad JSON, 413 too
// large, 503 PDF generator busy); everything else is a 500.
app.use(function (err, req, res, next) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error("[error]", req.method, req.originalUrl, err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  const busy = status === 503;
  const th = busy ? "ระบบกำลังทำงานหนัก กรุณาลองใหม่อีกครั้งในอีกสักครู่" : status >= 500 ? "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" : "คำขอไม่ถูกต้อง";
  const en = busy ? "The system is busy. Please try again in a moment." : status >= 500 ? "Something went wrong. Please try again." : "Bad request.";
  if (req.path.startsWith("/api/") || req.xhr || (req.get("Accept") || "").includes("application/json")) {
    return res.status(status).json({ error: busy ? "busy" : status >= 500 ? "server-error" : "bad-request" });
  }
  res.status(status).type("text/plain; charset=utf-8").send(th + "\n" + en);
});

app.listen(PORT, function () {
  console.log(`ODPRS server (Postgres-backed) running at http://localhost:${PORT}`);
  // A brand-new (or emptied) database gets the default units, drop-off
  // place and settings it needs to take requests — see src/defaults.js.
  ensureDefaults(prisma)
    .then((filled) => { if (filled.length) console.log("Filled empty reference tables with defaults:", filled.join(", ")); })
    .catch((err) => console.error("[defaults] could not fill defaults:", err.message));
});
