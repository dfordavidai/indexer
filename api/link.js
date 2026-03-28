// api/link.js — LinkCore v7 Short-link Redirect
// Node.js 18 runtime (fetch built-in, no import needed)
// Reads ic_short_links(code, target, hits) from Supabase
// Returns meta-refresh HTML + JSON-LD schema + crawl trust headers
// Increments hits fire-and-forget

const SB_URL     = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const BASE       = 'https://indexernow.vercel.app';
const SHORT_BASE = `${BASE}/link/`;
const SITEMAP    = `${BASE}/sitemap.xml`;
const FEED       = `${BASE}/feed.xml`;
const SB_H       = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

export default async function handler(req, res) {
  const u    = new URL(req.url, `https://${req.headers.host}`);
  const code = req.query?.code || u.searchParams.get('code') || u.pathname.split('/').filter(Boolean).pop();

  if (!code || code === 'link') {
    res.status(404).send('Not found');
    return;
  }

  const t0 = Date.now();
  let target, currentHits;

  try {
    const sbRes = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target,hits&limit=1`,
      { headers: SB_H }
    );
    const rows  = sbRes.ok ? await sbRes.json() : [];
    target      = rows?.[0]?.target;
    currentHits = rows?.[0]?.hits ?? 0;
  } catch (e) {
    res.status(502).send('Upstream error');
    return;
  }

  if (!target) {
    res.status(404).send('Link not found');
    return;
  }

  const dbDur = Date.now() - t0;

  // Increment hits fire-and-forget
  fetch(
    `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}`,
    {
      method:  'PATCH',
      headers: { ...SB_H, Prefer: 'return=minimal' },
      body:    JSON.stringify({ hits: currentHits + 1 }),
    }
  ).catch(() => {});

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

  res.setHeader('Content-Type',  'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.setHeader('Server-Timing', `db;dur=${dbDur}, total;dur=${Date.now() - t0}`);
  res.setHeader('X-Robots-Tag',  'index, follow');
  res.setHeader('Link',          `<${SITEMAP}>; rel=preconnect`);
  res.append('Link',             `<${FEED}>; rel=prefetch`);
  res.status(200).send(html);
}

function x(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
