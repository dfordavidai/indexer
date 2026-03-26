// api/link/[code].js
// Vercel Edge Function — handles /link/:code
// Looks up the short code in Supabase ic_short_links table
// and responds with a 301 redirect to the target URL.
// Also increments the hit counter asynchronously via RPC.

export const config = { runtime: 'edge' };

const SB_URL = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';

const HEADERS = {
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type':  'application/json'
};

export default async function handler(req) {
  const url  = new URL(req.url);
  const code = url.pathname.split('/').pop();

  if (!code || code.length < 3) {
    return new Response('Not found', { status: 404 });
  }

  try {
    // Lookup code in Supabase ic_short_links
    const resp = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?code=eq.${encodeURIComponent(code)}&select=target&limit=1`,
      { headers: HEADERS }
    );

    if (!resp.ok) {
      return new Response('Lookup failed', { status: 502 });
    }

    const rows = await resp.json();

    if (!rows || !rows.length || !rows[0].target) {
      return new Response('Short link not found', { status: 404 });
    }

    const target = rows[0].target;

    // Increment hit counter via Supabase RPC (fire-and-forget).
    // Requires this function in your Supabase SQL editor:
    //
    //   create or replace function increment_hits(p_code text)
    //   returns void language sql security definer as $$
    //     update ic_short_links set hits = hits + 1 where code = p_code;
    //   $$;
    //
    fetch(`${SB_URL}/rest/v1/rpc/increment_hits`, {
      method:  'POST',
      headers: HEADERS,
      body:    JSON.stringify({ p_code: code })
    }).catch(() => {});

    // 301 Permanent Redirect — Googlebot follows and passes PageRank
    return new Response(null, {
      status: 301,
      headers: {
        'Location':      target,
        'Cache-Control': 'public, max-age=86400',
        'X-Redirect-By': 'IndexCore'
      }
    });

  } catch (err) {
    return new Response('Server error', { status: 500 });
  }
}
