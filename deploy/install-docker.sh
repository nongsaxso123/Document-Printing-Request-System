#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server for ODPRS (see deploy/DEPLOY_UBUNTU.md).
# Run once:   sudo bash deploy/install-docker.sh
# Safe to re-run — every step skips itself if already done.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "กรุณารันด้วย sudo:  sudo bash deploy/install-docker.sh"
  exit 1
fi

echo "==> 1/4 อัปเดตรายการโปรแกรม"
apt-get update -y
apt-get install -y ca-certificates curl git

echo "==> 2/4 เพิ่ม swap 2GB (กันแรมไม่พอตอน build / สร้าง PDF)"
if swapon --show | grep -q .; then
  echo "    มี swap อยู่แล้ว ข้าม"
else
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 3/4 ติดตั้ง Docker"
if command -v docker >/dev/null 2>&1; then
  echo "    มี Docker อยู่แล้ว ข้าม"
else
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
# Let the normal login user run docker without sudo (takes effect after re-login).
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  usermod -aG docker "$SUDO_USER"
fi

echo "==> 4/4 เปิดไฟร์วอลล์ให้ SSH + เว็บ (22, 80, 443)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo
echo "เสร็จแล้ว ✅  ออกจากระบบแล้วเข้าใหม่ 1 ครั้ง (พิมพ์ exit แล้ว ssh เข้ามาใหม่)"
echo "จากนั้นทำขั้นตอนถัดไปในคู่มือ: ตั้งค่า server/.env แล้วรัน  bash deploy/deploy.sh"
