// api/link.js — LinkCore v6 Short-link Edge Function
// Reads ic_short_links(code, target, hits, updated_at) from Supabase
// Returns 200 + meta-refresh + JSON-LD + crawl trust headers
// Increments hits + updated_at via PATCH (fire-and-forget)

export const config = { runtime: 'edge' };

const SB_URL     = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const BASE       = 'https://indexernow.vercel.app';
const SHORT_BASE = `${BASE}/link/`;
const SITEMAP    = `${BASE}/sitemap.xml`;
const FEED       = `${BASE}/feed.xml`;
const SB_H       = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

export default async function handler(req) {
  const url  = new URL(req.url);
  const code = url.searchParams.get('code') || url.pathname.split('/').filter(Boolean).pop();

  if (!code || code === 'link') return new Response('Not found', { status: 404 });

  // 1. Fetch target + current hits
  const t0  = Date.now();
  let target, currentHits;
  try {
    const res  = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target,hits&limit=1`,
      { headers: SB_H }
    );
    const rows  = res.ok ? await res.json() : [];
    target      = rows?.[0]?.target;
    currentHits = rows?.[0]?.hits ?? 0;
  } catch {
    return new Response('Upstream error', { status: 502 });
  }

  const dbDur = Date.now() - t0;
  if (!target) return new Response('Link not found', { status: 404 });

  // 2. Increment hits + updated_at (fire-and-forget — never blocks redirect)
  void fetch(
    `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}`,
    {
      method:  'PATCH',
      headers: { ...SB_H, Prefer: 'return=minimal' },
      body:    JSON.stringify({ hits: currentHits + 1 }),
      // updated_at auto-set by Supabase trigger on every PATCH
    }
  ).catch(() => {});

  // 3. Build response
  const shortUrl = `${SHORT_BASE}${code}`;
  const today    = new Date().toISOString().split('T')[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${x(target)}">
  <link rel="canonical" href="${x(shortUrl)}">
  <title>Redirecting…</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"Resource","datePublished":"${today}","dateModified":"${today}","url":"${shortUrl}"}
  </script>
</head>
<body><a href="${x(target)}">Redirecting…</a></body>
</html>`;

  // 4. Crawl trust headers
  const h = new Headers({
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'Server-Timing': `db;dur=${dbDur}, cache;dur=0, total;dur=${Date.now() - t0}`,
    'X-Robots-Tag':  'index, follow',
  });
  h.append('Link', `<${SITEMAP}>; rel=preconnect`);
  h.append('Link', `<${FEED}>; rel=prefetch`);

  return new Response(html, { status: 200, headers: h });
}

function x(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
