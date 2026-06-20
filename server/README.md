# Newsphere data server (15-minute auto-updates)

This sets up a small always-on VPS that regenerates `news.json` every 15 minutes
and serves it at `https://data.newsphere.live/news.json`. The main site stays on
Cloudflare Pages and just fetches from there — so if the VPS ever goes down, the
site still loads (with the last-good data).

```
newsphere.live        → Cloudflare Pages (static site)
data.newsphere.live   → this VPS (cron pipeline + nginx serving news.json)
```

## 1. Get a VPS

Recommended: **Hetzner Cloud CX22** (2 vCPU / 4 GB / ~€4.5/mo) — 4 GB matters
because the pipeline loads PyTorch + two models. Pick **Ubuntu 24.04**.
(DigitalOcean / Vultr work too; avoid 1 GB plans — torch will OOM.)

Note the server's public IP.

## 2. DNS (Cloudflare)

In the Cloudflare dashboard for `newsphere.live` → DNS:
- Add an **A record**: name `data`, value = your VPS IP, **Proxied (orange cloud)**.
- SSL/TLS mode **Flexible** is fine (the file is public, no secrets). For
  CF↔origin encryption later, switch to **Full** and install a Cloudflare
  Origin Certificate on the VPS.

## 3. Give the VPS read access to the (private) repo

SSH into the box (`ssh root@YOUR_IP`), then create a **deploy key**:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Copy that public key → GitHub repo **Settings → Deploy keys → Add deploy key**
(read-only is enough). Then test: `ssh -T git@github.com` (accept the prompt).

> If you'd rather not use a deploy key, make the repo public and change
> `REPO_URL` in `setup.sh` to the `https://github.com/...` URL.

## 4. Run setup

```bash
curl -fsSL https://raw.githubusercontent.com/Sama939/Newsphere/main/server/setup.sh -o setup.sh
sudo bash setup.sh
```
(For a private repo the raw URL won't work without auth — instead `scp` the repo
up, or clone it first with the deploy key and run `sudo bash /opt/newsphere/server/setup.sh`.)

This installs everything, does a first pipeline run (downloads models — a few
minutes), and enables the 15-minute timer.

Verify:
```bash
systemctl list-timers newsphere-news.timer      # next run scheduled?
journalctl -u newsphere-news.service -n 50       # last run logs
curl -s localhost/news.json | head -c 200        # data present?
curl -s https://data.newsphere.live/news.json | head -c 200   # reachable via Cloudflare?
```

## 5. Point the site at the data server

In **Cloudflare Pages → your project → Settings → Environment variables**, add:
```
VITE_NEWS_URL = https://data.newsphere.live/news.json
```
Then **redeploy** (Deployments → Retry/redeploy). The front-end will now fetch
live data from the VPS. In local dev it still uses the bundled file.

## Operating it

- Change cadence: edit `OnUnitActiveSec` in `newsphere-news.timer`, then
  `sudo systemctl daemon-reload && sudo systemctl restart newsphere-news.timer`.
- Run once now: `sudo systemctl start newsphere-news.service`.
- Logs: `journalctl -u newsphere-news.service -f`.
- Update code: `cd /opt/newsphere && git pull` (the update script also pulls
  each run, so a push to `main` rolls out automatically within 15 min).

## Cost

~€4.5/month for the VPS. Everything else (Cloudflare Pages, DNS, proxy) is free.
