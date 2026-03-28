// api/robots.js
// Serves /robots.txt — maximises Googlebot crawl aggressiveness.
// No Disallow = Google can crawl everything.
// Crawl-delay: 0 on Googlebot = crawl as fast as possible.
// Points Googlebot directly to the sitemap.

export const config = { runtime: 'edge' };

export default function handler(req) {
  const origin = new URL(req.url).origin;

  const txt = `User-agent: *
Allow: /
Disallow: /api/

User-agent: Googlebot
Crawl-delay: 0
Allow: /
Allow: /link/

User-agent: Bingbot
Crawl-delay: 0
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(txt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
