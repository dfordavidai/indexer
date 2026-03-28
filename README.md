# LinkCore Multi-Site Deployment Guide

Deploy this folder to as many Vercel domains as you want.
Every domain uses the **same Supabase project** — so all your links
work across all domains automatically.

---

## Files in This Folder

```
indexer-site/
├── vercel.json          — Routing rules + crawl headers
├── package.json         — Minimal project file
├── supabase-setup.sql   — Run ONCE in Supabase SQL editor
└── api/
    ├── link.js          — Short-link redirect (the core function)
    ├── sitemap.js       — Live XML sitemap from Supabase
    ├── feed.js          — RSS feed (triggers PubSubHubbub)
    ├── robots.js        — robots.txt (max crawl aggressiveness)
    └── indexnow-key.js  — IndexNow domain verification file
```

---

## Step 1 — Run the Supabase SQL (ONE TIME ONLY)

1. Go to **supabase.com** → your project → **SQL Editor**
2. Paste the contents of `supabase-setup.sql`
3. Click **Run**

This creates all tables and the `increment_hit` function.
You only do this once — all your Vercel domains share the same Supabase.

---

## Step 2 — Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
# Install Vercel CLI if you don't have it
npm install -g vercel

# Go into this folder
cd indexer-site

# Deploy (first time — follow the prompts)
vercel

# It will ask:
#   Set up and deploy? → Y
#   Which scope? → your account
#   Link to existing project? → N (create new)
#   Project name? → indexernow2  (or whatever you want)
#   In which directory is your code? → ./  (just press Enter)
#   Override settings? → N
```

### Option B — Vercel Dashboard (no CLI needed)

1. Go to **vercel.com** → **Add New Project**
2. Click **"Import Git Repository"** — OR — drag this folder in
3. If using Git: push this folder to a GitHub repo first, then import it
4. Framework Preset: **Other**
5. Root Directory: leave blank (or `./`)
6. Click **Deploy**

---

## Step 3 — Add Environment Variables

After deploying, go to:
**Vercel Dashboard → your project → Settings → Environment Variables**

Add these two variables:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://rbqfmhyuzdizaexbfcem.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full anon key) |

> Both values are already in your LinkCore HTML file — search for
> `SB_URL` and `SB_KEY` at the top of the `<script>` block to copy them.

After adding variables → **Redeploy** (Settings → Deployments → Redeploy).

---

## Step 4 — Add a Custom Domain (Optional but Recommended)

In Vercel Dashboard → your project → **Settings → Domains**:

- Add your domain: e.g. `indexernow2.com` or `links2.yourdomain.com`
- Follow Vercel's DNS instructions (add a CNAME or A record)
- Vercel auto-provisions SSL

Without a custom domain your site is at `projectname.vercel.app` — that works fine too.

---

## Step 5 — Verify It Works

Open your browser and test these URLs (replace `yourdomain.vercel.app`):

| URL | Expected result |
|---|---|
| `yourdomain.vercel.app/robots.txt` | Shows robots.txt with Googlebot rules |
| `yourdomain.vercel.app/sitemap.xml` | Shows XML sitemap with your links |
| `yourdomain.vercel.app/feed.xml` | Shows RSS feed |
| `yourdomain.vercel.app/indexcore.txt` | Shows: `indexcore` |
| `yourdomain.vercel.app/link/[any code]` | Redirects to your backlink |

---

## Step 6 — Add to Google Search Console

1. Go to **search.google.com/search-console**
2. Click **Add Property**
3. Choose **URL prefix** → enter `https://yourdomain.vercel.app/`
4. Verify ownership — easiest method: **HTML tag** (Vercel lets you add meta tags via `_document.js` or just use the DNS method if you have a custom domain)
5. After verified → go to **Sitemaps** → submit `https://yourdomain.vercel.app/sitemap.xml`

---

## Step 7 — Create a Google Service Account for This Domain

Each GSC property needs its own Service Account to let LinkCore call the API.

1. Go to **console.cloud.google.com**
2. Select your project (or create one)
3. **APIs & Services → Enable APIs**:
   - Search Console API → Enable
   - Web Search Indexing API → Enable
4. **IAM & Admin → Service Accounts → Create Service Account**
   - Name: `indexernow2-sa` (any name)
   - Click through → Done
5. Click the service account → **Keys → Add Key → JSON**
   - Download the JSON file — this is what you paste into LinkCore
6. Back in **Google Search Console**:
   - Go to your new property → **Settings → Users and permissions**
   - Add the service account email (looks like `name@project.iam.gserviceaccount.com`)
   - Set permission: **Owner**

---

## Step 8 — Add the Site in LinkCore

Open your LinkCore HTML file → sidebar → **Multi-Site**:

1. **Site URL**: `https://yourdomain.vercel.app/` (must match GSC property exactly, with trailing slash)
2. **Label**: anything — e.g. `Site 2`
3. **Service Account JSON**: paste the full JSON from the downloaded file
4. Click **+ Add Site**
5. Click **🔍 Test** to verify the GSC connection works

---

## Repeat for More Sites

To add a 3rd, 4th, 5th domain — just deploy this same folder again with a new project name in Vercel. Same environment variables. Same Supabase. New GSC property. New SA key. Add it in LinkCore Multi-Site tab.

**3 sites × 5 SA keys = 3,000 URL inspections + 3,000 Indexing API calls per day.**

---

## How Links Are Assigned to Sites

When you click **+ Add Links** in LinkCore:
- A domain picker appears listing all your sites
- You choose which site hosts those short links
- The short link is generated on that domain: `yourdomain.vercel.app/link/abcde`
- When you blast → GSC inspects `yourdomain.vercel.app/link/abcde` using **that site's SA key and GSC property** — no cross-domain mismatch errors

---

## Troubleshooting

**Redirect not working**
- Check Environment Variables are set in Vercel and you redeployed after adding them
- Test: `yourdomain.vercel.app/link/testcode` — should return 404 (not a 500 error)

**GSC Test fails in LinkCore**
- Make sure the SA email is added as **Owner** (not just User) in GSC
- Make sure Search Console API and Web Search Indexing API are both enabled
- Double-check the Site URL in LinkCore has a trailing slash and matches GSC exactly

**Sitemap empty**
- The Supabase SQL hasn't been run yet, or no links exist yet
- Test the Supabase URL directly: `your-sb-url/rest/v1/ic_short_links?select=code&limit=5`

**Hit counter not incrementing**
- The `increment_hit` SQL function wasn't created — re-run `supabase-setup.sql`
