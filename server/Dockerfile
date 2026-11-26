FROM node:22-bookworm-slim AS base
# Debian-based, not Alpine: avoids a libssl.so.1.1/musl mismatch with
# Prisma's query engine binary that Alpine's newer OpenSSL 3 base hits.
# Node 22: puppeteer-core 25 needs Node >= 22.12.

# Business-day/business-hour math (server/src/businessDays.js) uses Date's
# local getDay()/getHours() — must match Thailand's civil calendar, not the
# container's default UTC, or day-of-week/hour checks drift near midnight.
ENV TZ=Asia/Bangkok

# System Chromium (not Puppeteer's own bundled download — server/src/pdf.js
# uses puppeteer-core against this) — apt pulls in every shared library
# headless Chrome needs on Debian, which is far more reliable than chasing
# Puppeteer's own dependency list by hand on a slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates chromium \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# ---- dev: used by docker-compose.yml (target: dev) --------------------------
# Full install incl. nodemon; the source is bind-mounted over /app at run time.
FROM base AS dev
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- production (default target, docker-compose.prod.yml) -------------------
# Exact versions from package-lock.json, no devDependencies, and the app runs
# as the unprivileged "node" user instead of root. The prisma CLI is a normal
# dependency because the container runs `prisma migrate deploy` on start.
FROM base AS prod
ENV NODE_ENV=production
# Chromium writes its profile/crash files under $HOME.
ENV HOME=/tmp
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
RUN npx prisma generate && chown -R node:node /app/node_modules
USER node
EXPOSE 3000
CMD ["node", "src/app.js"]
