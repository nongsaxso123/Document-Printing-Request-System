/**
 * Minimal Google SSO login test — proves the OAuth client works end-to-end,
 * and lets us inspect exactly what Google hands back before wiring this into
 * the real ODPRS backend (file.md Appendix C, step 4).
 *
 * Run: npm install && npm start, then open http://localhost:3000
 */

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const officerStore = require("./officer-store");

const PORT = process.env.PORT || 3000;
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "@mfu.ac.th").toLowerCase();
const ALLOW_LAMDUAN_FOR_TESTING = process.env.ALLOW_LAMDUAN_FOR_TESTING === "true";
const LAMDUAN_DOMAIN = "@lamduan.mfu.ac.th";

// No FR covers self-service creation of the first Admin (file.md FR-02 only
// covers Admin managing Officers) — the Admin role is bootstrapped from env,
// same idea as a seeded superuser.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function resolveRole(emailLower) {
  if (ADMIN_EMAILS.includes(emailLower)) return "Admin";
  if (officerStore.isOfficer(emailLower)) return "Officer";
  return "Requester";
}

for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "GOOGLE_CALLBACK_URL"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env — copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

if (ALLOW_LAMDUAN_FOR_TESTING) {
  console.warn("⚠️  ALLOW_LAMDUAN_FOR_TESTING=true — @lamduan.mfu.ac.th (student) logins are temporarily accepted. Set this back to false once you've inspected the profile data / have a real @mfu.ac.th account to test with.");
}

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  function (accessToken, refreshToken, profile, done) {
    const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || "";
    const emailLower = email.toLowerCase();

    const isRealAllowedDomain = emailLower.endsWith(ALLOWED_EMAIL_DOMAIN);
    const isTemporarilyAllowedLamduan = ALLOW_LAMDUAN_FOR_TESTING && emailLower.endsWith(LAMDUAN_DOMAIN);

    if (!isRealAllowedDomain && !isTemporarilyAllowedLamduan) {
      return done(null, false, { message: "domain-not-allowed" });
    }

    // Role lookup runs even for the temporary lamduan allowance so the
    // Admin/Officer/Requester logic itself can be tested before a real
    // @mfu.ac.th staff account is available (see file.md Appendix B).
    return done(null, {
      email: email,
      isRealAllowedDomain: isRealAllowedDomain,
      role: resolveRole(emailLower),
      raw: profile._json // the actual fields Google's userinfo endpoint returned
    });
  }
));

passport.serializeUser(function (user, done) { done(null, user); });
passport.deserializeUser(function (user, done) { done(null, user); });

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "Admin") return res.status(403).send("Forbidden — Admin role required.");
  next();
}

function renderAdminPanel() {
  const officers = officerStore.getOfficers();
  const rows = officers.length
    ? officers.map((o) => `
        <tr>
          <td>${o.name}</td><td>${o.email}</td><td>${o.assignedBy}</td><td>${o.assignedDate}</td>
          <td>
            <form method="post" action="/admin/officers/remove" style="margin:0;">
              <input type="hidden" name="email" value="${o.email}">
              <button type="submit">Revoke</button>
            </form>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="5">No Officer accounts yet.</td></tr>`;

  return `
    <h2>Manage Officer accounts (FR-02)</h2>
    <form method="post" action="/admin/officers/add">
      <input name="name" placeholder="Full name" required>
      <input name="email" placeholder="name.surname@mfu.ac.th" required>
      <button type="submit">Add Officer</button>
    </form>
    <table border="1" cellpadding="6" style="border-collapse:collapse; margin-top:10px;">
      <thead><tr><th>Name</th><th>Email</th><th>Assigned By</th><th>Assigned Date</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

app.get("/", function (req, res) {
  if (req.user) {
    const tempWarning = req.user.isRealAllowedDomain
      ? ""
      : `<p style="background:#fbf0dc; color:#b5790a; padding:10px 14px; border-radius:8px;">
           ⚠️ Logged in via the <strong>temporary</strong> @lamduan.mfu.ac.th allowance — this account
           would normally be <strong>rejected</strong> (students aren't Requesters, per BR-07).
           The role below is computed anyway so the Admin/Officer/Requester logic can be tested;
           remove <code>ALLOW_LAMDUAN_FOR_TESTING</code> once a real @mfu.ac.th account is available.
         </p>`;

    res.send(`
      <h1>Logged in</h1>
      ${tempWarning}
      <p><strong>Email:</strong> ${req.user.email}</p>
      <p><strong>Role:</strong> ${req.user.role}</p>
      ${req.user.role === "Admin" ? renderAdminPanel() : ""}
      <h2>Raw profile Google returned (profile._json)</h2>
      <pre style="background:#f7f4f0; padding:16px; border-radius:8px; overflow:auto;">${JSON.stringify(req.user.raw, null, 2)}</pre>
      <a href="/logout">Log out</a>
    `);
    return;
  }

  const deniedNotice = req.query.error === "domain-not-allowed"
    ? `<p style="color:#a63333;">Login failed: that account's email doesn't end in <code>${ALLOWED_EMAIL_DOMAIN}</code>.</p>`
    : "";

  res.send(`
    <h1>ODPRS — Google SSO test</h1>
    ${deniedNotice}
    <a href="/auth/google">Log in with Google</a>
  `);
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback",
  function (req, res, next) {
    passport.authenticate("google", function (err, user, info) {
      if (err) return next(err);
      if (!user) {
        const reason = (info && info.message) || "unknown";
        return res.redirect("/?error=" + encodeURIComponent(reason));
      }
      req.logIn(user, function (err) {
        if (err) return next(err);
        return res.redirect("/");
      });
    })(req, res, next);
  }
);

app.get("/logout", function (req, res) {
  req.logout(function () {
    res.redirect("/");
  });
});

app.post("/admin/officers/add", requireAdmin, function (req, res) {
  const { name, email } = req.body;
  if (name && email) officerStore.addOfficer(email, name, req.user.email);
  res.redirect("/");
});

app.post("/admin/officers/remove", requireAdmin, function (req, res) {
  if (req.body.email) officerStore.removeOfficer(req.body.email);
  res.redirect("/");
});

app.listen(PORT, function () {
  console.log(`ODPRS SSO test running at http://localhost:${PORT}`);
});
