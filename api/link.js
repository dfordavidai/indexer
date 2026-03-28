// api/link.js
// Short-link redirect — Vercel Edge Function

export const config = { runtime: 'edge' };

const SB_URL = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';

const INDEXNOW_KEY = 'indexcore';

export default async function handler(req) {
  const url = new URL(req.url);

  let code = url.searchParams.get('code');
  if (!code) {
    const parts = url.pathname.split('/');
    code = parts[parts.length - 1];
  }

  if (!code || code.length < 3) {
    return new Response('Not found', { status: 404 });
  }

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

  incrementHit(code).catch(() => {});

  const now      = new Date().toISOString();
  const shortUrl = `${url.origin}/link/${code}`;

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
      'Link': `<${target}>; rel="canonical"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Server-Timing': 'db;dur=4, cache;dur=1, total;dur=12',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function incrementHit(code) {
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
