// api/sitemap.js
// Dynamic XML sitemap — pulled live from Supabase
// Cached for 5 minutes at the edge so Google always gets fresh URLs
// Submit this URL to GSC: https://yourdomain.vercel.app/sitemap.xml

export const config = { runtime: 'edge' };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

export default async function handler(req) {
  const origin = new URL(req.url).origin;
  const today  = new Date().toISOString().split('T')[0];

  let codes = [];

  try {
    // Fetch all active short link codes (limit 50,000)
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?select=code&order=created_at.desc&limit=50000`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      codes = (rows || []).map(r => r.code);
    }
  } catch (err) {
    console.error('Sitemap Supabase error:', err);
  }

  const entries = codes
    .map(
      code => `  <url>
    <loc>${origin}/link/${code}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'X-Robots-Tag': 'noindex', // Sitemap itself shouldn't be indexed
    },
  });
}
