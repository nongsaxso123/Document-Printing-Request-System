# ODPRS — Online Document Printing Request System

ODPRS is a web app that lets staff send printing and copying requests to the registrar's office online. It used to be a paper form you filled in and handed over in person. Now you submit the request on the web, can see where it's at, and once the documents are ready you pick them up at the counter with a claim code.

Sign-in is through Google, restricted to the organization's own email domain, and every page can be switched between Thai and English.

## What's in it

Requesters can submit a request, choose where to drop off the originals and where to collect the finished copies, edit a request until the originals have been handed in, and download the request form as a PDF. They get notified in the app and by email whenever the status changes.

Officers get a queue of requests to approve or reject, a printing jobs page, a handover page, history, and a dashboard that sums up paper usage for reporting. A kiosk page can be left open at the counter so people collecting documents can type in their claim code themselves.

Admins manage officers, departments and pickup/drop-off locations from inside the app, can schedule a maintenance window in advance, see an audit log of who did what, and back up or restore all data on their own.

## Built with

Node.js 20 and Express, with EJS for the pages. Data lives in PostgreSQL through Prisma. Login uses Google OAuth via Passport, PDFs are rendered with Puppeteer, and email goes out through Nodemailer. Everything runs in Docker Compose, with Caddy in front handling HTTPS.

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

For sample data to look at on the dashboard, run `docker compose exec app node scripts/generate-demo-data.js`. Be careful: it deletes every existing request first.

To change the database structure, edit `server/prisma/schema.prisma` and run `docker compose exec app npx prisma migrate dev --name <name>`. If you add a new table, also add it to `MODEL_ORDER` in `server/src/backup.js`, otherwise backups will refuse to run.

## Putting it on a server

It targets Ubuntu with Docker, and a machine with 2GB of RAM is enough. Install Docker with `sudo bash deploy/install-docker.sh`, fill in `server/.env` (domain name, database password, Google OAuth credentials), then run `bash deploy/deploy.sh`. Caddy gets the HTTPS certificate for you.

## About the data

Everything is stored in the database. PDFs aren't kept; they're generated again each time someone downloads one. Admins can back up and restore from the backup page. Backup files sit on the same server as the app, so it's a good idea to download a copy somewhere else every so often.

`server/.env` contains secrets. It isn't part of the backups and should never be committed to Git.
