FROM node:20-bookworm-slim
# Debian-based, not Alpine: avoids a libssl.so.1.1/musl mismatch with
# Prisma's query engine binary that Alpine's newer OpenSSL 3 base hits.

# Business-day/business-hour math (server/src/businessDays.js) uses Date's
# local getDay()/getHours() — must match Thailand's civil calendar, not the
# container's default UTC, or day-of-week/hour checks drift near midnight.
ENV TZ=Asia/Bangkok

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# System Chromium (not Puppeteer's own bundled download — server/src/pdf.js
# uses puppeteer-core against this) — apt pulls in every shared library
# headless Chrome needs on Debian, which is far more reliable than chasing
# Puppeteer's own dependency list by hand on a slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends chromium \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "src/app.js"]
