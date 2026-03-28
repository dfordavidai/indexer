// api/link.js
// Short-link redirect — Vercel Edge Function
// Reads ?code= OR /link/[code] from the URL, looks up target in Supabase,
// fires a 301 redirect with full SEO headers + Article schema injection.
//
// Environment variables needed (set in Vercel dashboard):
//   SUPABASE_URL  — e.g. https://xxxx.supabase.co
//   SUPABASE_KEY  — your anon/public key

export const config = { runtime: 'edge' };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

// The IndexNow key — must match the filename in /api/indexnow-key.js
const INDEXNOW_KEY = 'indexcore';

export default async function handler(req) {
  const url = new URL(req.url);

  // Extract code from path: /link/abcde  OR  /link?code=abcde
  let code = url.searchParams.get('code');
  if (!code) {
    // Pull from path segment after /link/
    const parts = url.pathname.split('/');
    code = parts[parts.length - 1];
  }

  if (!code || code.length < 3) {
    return new Response('Not found', { status: 404 });
  }

  // ── Fetch target from Supabase ──────────────────────────────
  let target = null;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target&limit=1`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
        },
        // Keep-alive for Vercel edge warm reads
        cf: { cacheEverything: false },
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) {
        target = rows[0].target;
      }
    }
  } catch (err) {
    console.error('Supabase fetch error:', err);
  }

  if (!target) {
    return new Response('Link not found', { status: 404 });
  }

  // ── Increment hit counter (fire-and-forget) ─────────────────
  // We don't await this — it runs in background so redirect is instant
  incrementHit(code).catch(() => {});

  // ── Build redirect response with SEO headers ────────────────
  const now       = new Date().toISOString();
  const shortUrl  = `${url.origin}/link/${code}`;

  // Article schema — tells Google this is a fresh, dated resource
  // This puts the URL in Google's freshness crawl queue
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Resource',
    datePublished: now.split('T')[0],
    dateModified: now.split('T')[0],
    url: shortUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': shortUrl,
    },
  });

  // HTML page with instant meta-refresh + schema + canonical
  // This is served to crawlers before the JS redirect fires
  // Google sees the schema, follows the canonical, indexes both
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${escHtml(target)}">
  <link rel="canonical" href="${escHtml(target)}">
  <title>Redirecting…</title>
  <script type="application/ld+json">${schema}</script>
  <meta name="robots" content="follow">
</head>
<body>
  <p>Redirecting to <a href="${escHtml(target)}">${escHtml(target)}</a>…</p>
  <script>window.location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Tell Google the canonical destination
      'Link': `<${target}>; rel="canonical"`,
      // No caching — each visit must be a real hit
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      // Crawl trust signals (same as a real news publisher)
      'Server-Timing': 'db;dur=4, cache;dur=1, total;dur=12',
      // CORS open so IndexNow validators can check the key file
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Increment hit counter in Supabase ───────────────────────────
async function incrementHit(code) {
  // Use Supabase RPC to atomically increment — avoids race conditions
  await fetch(`${SB_URL}/rest/v1/rpc/increment_hit`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ link_code: code }),
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
