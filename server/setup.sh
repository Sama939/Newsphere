#!/usr/bin/env bash
# One-time provisioning for a fresh Ubuntu 22.04/24.04 VPS, run as root.
# Installs the toolchain, clones the repo, sets up the Python venv, nginx, and
# the systemd timer that regenerates news.json every 15 minutes.
#
#   curl -fsSL https://raw.githubusercontent.com/Sama939/Newsphere/main/server/setup.sh -o setup.sh
#   # (or scp it up) then:  sudo bash setup.sh
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:Sama939/Newsphere.git}"  # needs a deploy key for a PRIVATE repo (see README)
REPO=/opt/newsphere

echo "== installing system packages =="
apt-get update
apt-get install -y git curl unzip nginx python3 python3-venv python3-pip ca-certificates

echo "== installing Node 20 =="
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "== cloning repo =="
if [ ! -d "$REPO/.git" ]; then
  git clone "$REPO_URL" "$REPO"
fi
cd "$REPO"

echo "== python venv + ML deps (CPU torch) =="
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install transformers sentencepiece
pip install torch --index-url https://download.pytorch.org/whl/cpu
deactivate

echo "== node deps =="
npm ci || npm install

echo "== web root =="
install -d /var/www/newsphere-data

echo "== nginx =="
cp server/newsphere-data.nginx.conf /etc/nginx/sites-available/newsphere-data.conf
ln -sf /etc/nginx/sites-available/newsphere-data.conf /etc/nginx/sites-enabled/newsphere-data.conf
nginx -t && systemctl reload nginx

echo "== systemd timer =="
chmod +x server/update-news.sh
cp server/newsphere-news.service /etc/systemd/system/
cp server/newsphere-news.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now newsphere-news.timer

echo "== first run (downloads models, may take several minutes) =="
./server/update-news.sh || echo "first run failed — check: journalctl -u newsphere-news.service"

echo
echo "Done. Verify with:"
echo "  systemctl list-timers newsphere-news.timer"
echo "  curl -s localhost/news.json | head -c 200"
