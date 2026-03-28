// ══════════════════════════════════════════════════════════
// api/link.js  —  LinkCore v6 · Short-link Edge Function
// ══════════════════════════════════════════════════════════
// HOW IT WORKS:
//   GET /link/abc12  →  reads ic_short_links where code=abc12
//                   →  returns 200 HTML with:
//                        • meta-refresh to the target URL
//                        • JSON-LD Article schema (freshness signal)
//                        • Server-Timing + Link response headers
//                   →  fire-and-forget hit counter increment
//
// WHY 200 + meta-refresh instead of 301?
//   Googlebot only reads <script type="application/ld+json"> if it
//   actually renders the page.  A bare 301 skips rendering entirely,
//   so the JSON-LD never gets read and the freshness signal is lost.
// ══════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

// ── Your credentials (already match LinkCore dashboard) ────
const SB_URL     = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const SHORT_BASE  = 'https://indexernow.vercel.app/link/';
const SITEMAP_URL = 'https://indexernow.vercel.app/sitemap.xml';
const FEED_URL    = 'https://indexernow.vercel.app/feed.xml';

const SB_HEADERS = {
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type':  'application/json',
};

export default async function handler(req) {
  const url  = new URL(req.url);

  // ── Extract code from path  /link/abc12  ───────────────
  // vercel.json rewrite passes ?code=abc12 OR it's the last path segment
  const code = url.searchParams.get('code') || url.pathname.split('/').filter(Boolean).pop();

  if (!code || code === 'link') {
    return new Response('Not found', { status: 404 });
  }

  // ── 1. Fetch target from Supabase ───────────────────────
  const t0  = Date.now();
  let target, currentHits;

  try {
    const res  = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target,hits&limit=1`,
      { headers: SB_HEADERS }
    );
    const rows  = res.ok ? await res.json() : [];
    target       = rows?.[0]?.target;
    currentHits  = rows?.[0]?.hits ?? 0;
  } catch (e) {
    return new Response('Upstream error', { status: 502 });
  }

  const dbDur = Date.now() - t0;

  if (!target) {
    return new Response(
      `<!DOCTYPE html><html><head><title>Not Found</title></head><body><p>Short link not found.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // ── 2. Increment hit counter  (fire-and-forget) ────────
  // Uses waitUntil so the increment doesn't block the response
  const incrementHit = fetch(
    `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}`,
    {
      method:  'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ hits: currentHits + 1 }),
    }
  ).catch(() => {/* silent fail — never block the redirect */});

  // Edge runtime doesn't have context.waitUntil directly in standalone mode,
  // so we just fire and don't await — the response goes out immediately.
  void incrementHit;

  // ── 3. Build response ───────────────────────────────────
  const shortUrl  = `${SHORT_BASE}${code}`;
  const todayISO  = new Date().toISOString().split('T')[0];

  // JSON-LD structured data — Article schema with today's datePublished
  // This is what pulls the URL into Google's freshness crawl pipeline.
  const jsonLD = JSON.stringify({
    '@context':      'https://schema.org',
    '@type':         'Article',
    'headline':      'Resource',
    'datePublished': todayISO,
    'dateModified':  todayISO,
    'url':           shortUrl,
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${escHtml(target)}">
  <link rel="canonical" href="${escHtml(shortUrl)}">
  <title>Redirecting…</title>
  <script type="application/ld+json">
${jsonLD}
  </script>
</head>
<body>
  <a href="${escHtml(target)}">Click here if not redirected automatically</a>
</body>
</html>`;

  // ── 4. Headers (crawl trust signals) ───────────────────
  const headers = new Headers({
    'Content-Type':  'text/html; charset=utf-8',
    // Google assigns more crawl budget to fast, cache-warm domains
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    // Real timing — Googlebot uses this to assess server health
    'Server-Timing': `db;dur=${dbDur}, cache;dur=0, total;dur=${dbDur}`,
    // Tell crawlers where your sitemap + feed live
    'X-Robots-Tag':  'index, follow',
  });

  // Two Link headers — use append() because Headers() dedupes same-name keys
  headers.append('Link', `<${SITEMAP_URL}>; rel=preconnect`);
  headers.append('Link', `<${FEED_URL}>; rel=prefetch`);

  return new Response(html, { status: 200, headers });
}

// ── HTML entity escape (prevents header/HTML injection) ───
function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}
