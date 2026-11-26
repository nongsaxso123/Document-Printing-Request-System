/**
 * Starts the REAL app (src/app.js) with Google's OAuth strategy swapped for a
 * stand-in, so tests can run the real /auth/google -> /auth/google/callback
 * code (session regeneration, returnTo, kiosk flag) without Google.
 * /auth/google redirects straight to the callback; the callback signs in as
 * process.env.FAKE_GOOGLE_EMAIL. Test use only: never loaded by the app.
 *
 *   PORT=3005 FAKE_GOOGLE_EMAIL=someone@mfu.ac.th node test/e2e/fakeGoogleApp.js
 */
const path = require("node:path");
const passport = require("passport");

function FakeGoogle(options, verify) {
  passport.Strategy.call(this);
  this.name = "google";
  this._verify = verify;
}
require("node:util").inherits(FakeGoogle, passport.Strategy);
FakeGoogle.prototype.authenticate = function (req) {
  if (!req.path.endsWith("/callback")) return this.redirect("/auth/google/callback");
  const email = process.env.FAKE_GOOGLE_EMAIL;
  const profile = { displayName: "Fake " + email, emails: [{ value: email }], photos: [], _json: { email, email_verified: true } };
  this._verify("token", "refresh", profile, (err, user, info) => {
    if (err) return this.error(err);
    if (!user) return this.fail(info);
    this.success(user, info);
  });
};

const modPath = require.resolve("passport-google-oauth20");
require.cache[modPath] = { id: modPath, filename: modPath, loaded: true, exports: { Strategy: FakeGoogle } };
require(path.join(__dirname, "..", "..", "src", "app.js"));
