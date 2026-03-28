// api/link.js — Vercel Edge Function
// Deploy to: /api/link.js  (handles /link/[code] via vercel.json rewrite)
// vercel.json: { "rewrites": [{ "source": "/link/:code", "destination": "/api/link" }] }

export const config = { runtime: 'edge' };

const SB_URL = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const SHORT_BASE = 'https://indexernow.vercel.app/link/';
const SITEMAP_URL = 'https://indexernow.vercel.app/sitemap.xml';
const FEED_URL   = 'https://indexernow.vercel.app/feed.xml';

export default async function handler(req) {
  const url  = new URL(req.url);
  const code = url.pathname.split('/').pop();

  if (!code) return new Response('Not found', { status: 404 });

  // ── Fetch target from Supabase ──────────────────────────
  const t0 = Date.now();
  const res = await fetch(
    `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows   = res.ok ? await res.json() : [];
  const target = rows?.[0]?.target;
  const dbDur  = Date.now() - t0;

  if (!target) {
    return new Response('Link not found', { status: 404 });
  }

  // ── Increment hit counter (fire-and-forget) ─────────────
  fetch(
    `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ hits: rows[0]?.hits + 1 || 1 })
    }
  ).catch(() => {});

  const shortUrl  = `${SHORT_BASE}${code}`;
  const todayISO  = new Date().toISOString().split('T')[0];

  // ── Build headers (crawl trust signals) ─────────────────
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'Server-Timing': `db;dur=${dbDur}, cache;dur=0, total;dur=${dbDur}`,
    'X-Robots-Tag': 'index, follow',
  });
  headers.append('Link', `<${SITEMAP_URL}>; rel=preconnect`);
  headers.append('Link', `<${FEED_URL}>; rel=prefetch`);

  // ── Build HTML with JSON-LD (200 so Googlebot renders it) 
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${target}">
  <link rel="canonical" href="${shortUrl}">
  <title>Redirecting…</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Resource",
    "datePublished": "${todayISO}",
    "dateModified": "${todayISO}",
    "url": "${shortUrl}"
  }
  </script>
</head>
<body>
  <a href="${target}">Redirecting…</a>
</body>
</html>`;

  return new Response(html, { status: 200, headers });
}
