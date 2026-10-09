#!/usr/bin/env bash
# Start / update ODPRS on the server (see deploy/DEPLOY_UBUNTU.md).
#   bash deploy/deploy.sh          — first start, or after `git pull` to update
#   bash deploy/deploy.sh logs     — follow the app's log (Ctrl+C to stop watching)
#   bash deploy/deploy.sh status   — show whether the 3 parts are running
#   bash deploy/deploy.sh stop     — stop the system (data is kept)
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file server/.env)
ENV_FILE=server/.env

case "${1:-up}" in
  logs)   exec "${COMPOSE[@]}" logs -f --tail=100 app ;;
  status) exec "${COMPOSE[@]}" ps ;;
  stop)   exec "${COMPOSE[@]}" down ;;
  up)     ;;
  *)      echo "ใช้ได้: deploy.sh [up|logs|status|stop]"; exit 1 ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ยังไม่มี $ENV_FILE — คัดลอกจากตัวอย่างก่อน:"
  echo "   cp server/.env.example server/.env && nano server/.env"
  exit 1
fi

# Catch the mistakes that would otherwise only show up as a broken login or
# an open test door, before anything starts.
val() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true; }
problems=()
for key in DOMAIN POSTGRES_PASSWORD GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET SESSION_SECRET GOOGLE_CALLBACK_URL ADMIN_EMAILS; do
  [ -n "$(val "$key")" ] || problems+=("$key ยังว่าง")
done
case "$(val GOOGLE_CLIENT_ID)" in your-client-id*) problems+=("GOOGLE_CLIENT_ID ยังเป็นค่าตัวอย่าง") ;; esac
case "$(val SESSION_SECRET)" in any-long-random*) problems+=("SESSION_SECRET ยังเป็นค่าตัวอย่าง") ;; esac
case "$(val ADMIN_EMAILS)" in name.surname@*) problems+=("ADMIN_EMAILS ยังเป็นค่าตัวอย่าง") ;; esac
[ "$(val GOOGLE_CALLBACK_URL)" = "https://$(val DOMAIN)/auth/google/callback" ] \
  || problems+=("GOOGLE_CALLBACK_URL ต้องเป็น https://$(val DOMAIN)/auth/google/callback")
[ "$(val ALLOW_LAMDUAN_FOR_TESTING)" != "true" ] || problems+=("ALLOW_LAMDUAN_FOR_TESTING ต้องเป็น false (นักศึกษาจะเข้าได้)")
[ -z "$(val TEST_ALLOWED_EMAILS)" ] || problems+=("TEST_ALLOWED_EMAILS ต้องว่าง (อีเมลทดสอบจะเข้าได้)")

if [ ${#problems[@]} -gt 0 ]; then
  echo "❌ แก้ server/.env ก่อน (nano server/.env):"
  printf '   - %s\n' "${problems[@]}"
  exit 1
fi

echo "==> สร้างและเปิดระบบ (ครั้งแรกใช้เวลาประมาณ 5–10 นาที)"
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null

echo "==> รอระบบพร้อม"
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" logs app 2>/dev/null | grep -q "server (Postgres-backed) running"; then
    echo
    echo "✅ ระบบเปิดแล้ว: https://$(val DOMAIN)"
    exit 0
  fi
  sleep 3
done
echo "⚠️ ระบบยังไม่ขึ้นภายใน 3 นาที ดูสาเหตุด้วย:  bash deploy/deploy.sh logs"
exit 1
