# ODPRS — Online Document Printing Request System

ODPRS is a web app that lets staff send printing and copying requests to the registrar's office online. It used to be a paper form you filled in and handed over in person. Now you submit the request on the web, can see where it's at, and once the documents are ready you pick them up at the counter with a claim code.

Sign-in is through Google, restricted to the organization's own email domain, and every page can be switched between Thai and English.

## What's in it

Requesters can submit a request, choose where to drop off the originals and where to collect the finished copies, edit a request until the originals have been handed in, and download the request form as a PDF. They get notified in the app and by email whenever the status changes.

Officers get a queue of requests to approve or reject, a printing jobs page, a handover page, history, and a dashboard that sums up paper usage for reporting. A kiosk page can be left open at the counter so people collecting documents can type in their claim code themselves.

Admins manage officers, departments and pickup/drop-off locations from inside the app, can schedule a maintenance window in advance and see an audit log of who did what.

## Built with

Node.js 22 and Express, with EJS for the pages. Data lives in PostgreSQL through Prisma. Login uses Google OAuth via Passport, PDFs are rendered with Puppeteer, and email goes out through Nodemailer. Everything runs in Docker Compose, with Caddy in front handling HTTPS.

The app itself is in `server/`:

- `src/` is the server code, starting from `app.js`. Each user group has its routes in `src/routes/`.
- `views/` holds the pages.
- `public/assets/` has the CSS, JavaScript, fonts and images. Thai/English translations are in `js/app.js`.
- `prisma/` has the database schema and migrations.

The files for running it on a real server are `deploy/`, `docker-compose.prod.yml` and `Caddyfile.prod`.

## Running it locally

You'll need Docker Desktop and Git.

```
git clone https://github.com/nongsaxso123/Document-Printing-Request-System.git
cd Document-Printing-Request-System
cp server/.env.example server/.env
```

Open `server/.env` and fill in at least `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` and `ADMIN_EMAILS` (put your own email there to get in as an admin). You can create the OAuth client in Google Cloud Console with `http://localhost:3000/auth/google/callback` as the redirect URI. Set `ALLOWED_EMAIL_DOMAIN` to the domain you sign in with, or add a personal Gmail address to `TEST_ALLOWED_EMAILS` for testing.

Then start everything and create the tables:

```
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

Go to http://localhost:3000. While developing, the server restarts by itself whenever you change something in `server/src`.

To change the database structure, edit `server/prisma/schema.prisma` and run `docker compose exec app npx prisma migrate dev --name <name>`.

## Tests

Run these in `server/`:

```
npm test                    # unit tests, no database needed
npm audit --omit=dev        # should report 0 vulnerabilities

# integration tests: needs a throwaway PostgreSQL (see the top of the test file)
TEST_DATABASE_URL=postgresql://odprs:it@localhost:55433/odprs npm run test:integration

# security end-to-end tests against the running dev stack
E2E_BASE_URL=http://localhost:3000 E2E_DATABASE_URL=postgresql://odprs:odprs@localhost:5434/odprs npm run test:e2e
```

The e2e file `test/e2e/security.e2e.test.js` explains the optional CSP check, which uses Caddy with `Caddyfile.prod` and a local Chrome.

## Putting it on a server

It targets Ubuntu with Docker, and a machine with 2GB of RAM is enough.

1. Install Docker: `sudo bash deploy/install-docker.sh`
2. Put the production settings file at `server/.env`. It is handed over separately and is never in Git. `server/.env.example` lists every key.
3. Start or update: `bash deploy/deploy.sh`. It checks the settings first, builds the app, applies database migrations and starts it. `bash deploy/deploy.sh logs` follows the log.

Caddy listens on plain HTTP port 80 behind the university reverse proxy, which handles HTTPS for the domain. Put the proxy's IP address in `TRUSTED_PROXIES` so the app sees each visitor's real IP. If Caddy is removed and the proxy forwards straight to the app on port 3000, set `TRUST_PROXY_HOPS=1` and move the security headers from `Caddyfile.prod` to the proxy.

## About the data

Everything is stored in the database. PDFs aren't kept; they're generated again each time someone downloads one. University IT backs up the database daily; the app has no backup or restore page of its own.

`server/.env` contains secrets and should never be committed to Git.
