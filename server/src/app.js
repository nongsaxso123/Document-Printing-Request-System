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
const officerRoutes = require("./routes/officer");
const requesterRoutes = require("./routes/requester");
const adminRoutes = require("./routes/admin");
const apiRoutes = require("./routes/api");

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
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new PgSession({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.get("/", function (req, res) {
  if (req.user) {
    if (req.user.role === "Requester") return res.redirect("/requester/my-requests");
    return res.redirect("/officer/queue"); // Officer and Admin
  }

  res.render("login", {
    deniedDomain: req.query.error === "domain-not-allowed" ? auth.ALLOWED_EMAIL_DOMAIN : null
  });
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

app.use("/officer", officerRoutes);
app.use("/requester", requesterRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);

app.listen(PORT, function () {
  console.log(`ODPRS server (Postgres-backed) running at http://localhost:${PORT}`);
});
