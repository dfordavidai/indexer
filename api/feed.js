// api/feed.js
// RSS/Atom feed — served at /feed.xml
// Google's feed crawler checks this constantly.
// Every new short link added here = immediate crawl trigger.
// PubSubHubbub + WebSub both notify hubs when this feed updates.

export const config = { runtime: 'edge' };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

export default async function handler(req) {
  const origin = new URL(req.url).origin;
  const now    = new Date().toISOString();
  const today  = now.split('T')[0];

  let rows = [];

  try {
    // Fetch the 200 most recently added links
    const res = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?select=code,created_at&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
        },
      }
    );
    if (res.ok) rows = (await res.json()) || [];
  } catch (err) {
    console.error('Feed Supabase error:', err);
  }

  const items = rows
    .map(r => {
      const url     = `${origin}/link/${r.code}`;
      const pubDate = r.created_at
        ? new Date(r.created_at).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>Resource ${escXml(r.code)}</title>
      <link>${escXml(url)}</link>
      <guid isPermaLink="true">${escXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>Indexed resource at ${escXml(url)}</description>
    </item>`;
    })
    .join('\n');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:webfeeds="http://webfeeds.org/rss/1.0">
  <channel>
    <title>IndexerNow Resource Feed</title>
    <link>${origin}</link>
    <description>Live feed of indexed resources</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
    <atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
    <atom:link rel="hub" href="https://pubsubhubbub.superfeedr.com/"/>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
      'X-Robots-Tag': 'noindex',
      // Link preconnect signals for crawlers
      'Link': `<${origin}/sitemap.xml>; rel="sitemap", <${origin}/feed.xml>; rel="alternate"; type="application/rss+xml"`,
    },
  });
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
