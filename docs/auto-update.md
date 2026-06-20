# Free auto-update (GitHub Actions → Cloudflare R2)

Keeps `news.json` fresh roughly every 15 minutes — the fastest GDELT itself
updates — at **zero cost and with no server to maintain**.

## How it works

```
GitHub Actions (every ~15 min, free on a public repo)
   → run the pipeline → upload news.json to Cloudflare R2
Cloudflare R2 (free tier)  →  served at data.newsphere.live
The site (Cloudflare Pages) fetches from data.newsphere.live
```

Data updates never touch the Pages build, so we stay under the Pages free build
quota and can refresh as often as the data actually changes.

## Why the repo should be public

Public repos get **unlimited free Actions minutes**. Private repos only get
2000 min/month — every-15-min runs (~3 min each) would blow past that. If you
want to stay private, change the cron in `.github/workflows/news.yml` to hourly
(`0 * * * *`) so it fits the free private quota.

## Setup

### 1. Create the R2 bucket
Cloudflare dashboard → **R2** → Create bucket → name it e.g. `newsphere-data`.

### 2. Make it public on your domain
Bucket → **Settings → Custom Domains → Connect Domain** → `data.newsphere.live`
(Cloudflare adds the DNS + CDN + HTTPS automatically).

### 3. Allow the site to read it cross-origin (CORS)
Bucket → **Settings → CORS Policy** → add:
```json
[
  {
    "AllowedOrigins": ["https://newsphere.live", "https://*.pages.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. Create an R2 API token
R2 → **Manage R2 API Tokens** → Create → permission **Object Read & Write**,
scoped to this bucket. Copy the **Access Key ID**, **Secret Access Key**, and
your account's **S3 endpoint** (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).

### 5. Add GitHub repo secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `R2_ACCESS_KEY_ID` | the Access Key ID |
| `R2_SECRET_ACCESS_KEY` | the Secret Access Key |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `newsphere-data` |

### 6. Point the site at R2
Cloudflare **Pages → your project → Settings → Environment variables**:
```
VITE_NEWS_URL = https://data.newsphere.live/news.json
```
Then redeploy the Pages project.

### 7. Test
Repo → **Actions → Update news markers → Run workflow**. When it finishes:
```
curl -s https://data.newsphere.live/news.json | head -c 200
```
After that the cron keeps it updated automatically.

## Realistic freshness

GDELT publishes every 15 min, the cron targets 15 min, but **GitHub may delay
scheduled runs** during busy periods (sometimes 5–30 min late) and the pipeline
takes a couple of minutes. So expect data roughly **15–40 minutes old** — the
practical floor for a free setup. (A dedicated VPS, see `server/`, tightens this
to ~15–18 min but costs ~€4.5/mo.)
