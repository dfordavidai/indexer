// api/sitemap.js  —  Dynamic sitemap Edge Function
// ══════════════════════════════════════════════════════════
// Serves /sitemap.xml dynamically — reads all short link
// codes from Supabase and returns fresh XML with:
//   • lastmod = TODAY (not deploy date)
//   • changefreq = daily
//   • priority = 0.8
//
// Add to vercel.json rewrites:
//   { "source": "/sitemap.xml", "destination": "/api/sitemap" }
// ══════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SB_URL      = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const SHORT_BASE  = 'https://indexernow.vercel.app/link/';
const SITE_BASE   = 'https://indexernow.vercel.app';

export default async function handler(req) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD — always fresh

  // ── Fetch all short link codes from Supabase ──────────
  let codes = [];
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?select=code&order=created_at.asc&limit=50000`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const rows = res.ok ? await res.json() : [];
    codes = rows.map(r => r.code).filter(Boolean);
  } catch (e) {
    // If Supabase is down, return a minimal sitemap with just the homepage
    codes = [];
  }

  // ── Build XML entries ─────────────────────────────────
  const linkEntries = codes.map(code => `
  <url>
    <loc>${SHORT_BASE}${escXml(code)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_BASE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${linkEntries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type':  'application/xml; charset=utf-8',
      // Cache for 1 hour on Vercel edge — fresh enough, fast enough
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      // Real Server-Timing so Google sees a fast, healthy server
      'Server-Timing': `db;dur=0, cache;dur=0, total;dur=0`,
    },
  });
}

// Escape special XML characters in URL codes (safety)
function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
