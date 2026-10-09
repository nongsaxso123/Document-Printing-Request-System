-- Replaced by reusing the app's existing Google-login session directly for
-- /kiosk (an Officer signs in on the kiosk machine itself; req.user IS the
-- responsible person) — the separate "register this device" allowlist and
-- "start/end duty" toggle this app briefly had are no longer needed.
DROP TABLE "kiosk_devices";
DROP TABLE "kiosk_duty_sessions";
