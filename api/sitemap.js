// api/sitemap.js — Enterprise Dynamic Sitemap

const SB_URL     = 'https://rbqfmhyuzdizaexbfcem.supabase.co';
const SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWZtaHl1emRpemFleGJmY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDQwOTIsImV4cCI6MjA5MDEyMDA5Mn0.jXYe6qqqc5NCxvMPVVhiGqMYXfyiQ92bj5eCQt2J4WM';
const BASE       = 'https://indexernow.vercel.app';
const SHORT_BASE = `${BASE}/link/`;
const PAGE_SIZE  = 500;
const NEWS_HOURS = 48;

const STATIC_PAGES = [
  { loc: `${BASE}/`,            priority: '1.0', changefreq: 'daily' },
  { loc: `${BASE}/sitemap.xml`, priority: '0.3', changefreq: 'daily' },
];

export default async function handler(req, res) {
  // req.query is populated by Vercel after route rewrites — always use this
  const q    = req.query || {};
  const type = q.type || 'index';
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const today = new Date().toISOString().split('T')[0];
  const t0    = Date.now();

  // Fetch all codes from ic_short_links
  let rows = [];
  try {
    const sbRes = await fetch(
      `${SB_URL}/rest/v1/ic_short_links?select=code,created_at&order=created_at.desc&limit=50000`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    rows = sbRes.ok ? await sbRes.json() : [];
  } catch { rows = []; }

  const dbDur      = Date.now() - t0;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // ETag — 304 if nothing changed
  const etag = `"${today}-${rows.length}-${type}-${page}"`;
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  let body, ct;
  if      (type === 'pages') { body = pagesSitemap(today);                  ct = 'application/xml'; }
  else if (type === 'links') { body = linksSitemap(rows, page, today);      ct = 'application/xml'; }
  else if (type === 'news')  { body = newsSitemap(rows);                    ct = 'application/xml'; }
  else if (type === 'html')  { body = htmlSitemap(rows, today, totalPages); ct = 'text/html';       }
  else                       { body = sitemapIndex(today, totalPages);       ct = 'application/xml'; }

  res.setHeader('Content-Type',   `${ct}; charset=utf-8`);
  res.setHeader('Cache-Control',  'public, max-age=3600, s-maxage=3600');
  res.setHeader('Server-Timing',  `db;dur=${dbDur}, total;dur=${Date.now() - t0}`);
  res.setHeader('ETag',           etag);
  res.setHeader('X-Sitemap-URLs', String(rows.length));
  res.setHeader('Link',           `<${BASE}/sitemap.xml>; rel=canonical`);

  return res.status(200).send(body);
}

// ── Sitemap Index ──────────────────────────────────────────────────────
function sitemapIndex(today, totalPages) {
  const items = [
    `\n  <sitemap><loc>${BASE}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>`,
    ...Array.from({ length: totalPages }, (_, i) =>
      `\n  <sitemap><loc>${BASE}/sitemap-links-${i+1}.xml</loc><lastmod>${today}</lastmod></sitemap>`
    ),
    `\n  <sitemap><loc>${BASE}/sitemap-news.xml</loc><lastmod>${today}</lastmod></sitemap>`,
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</sitemapindex>`;
}

// ── Pages Sitemap ──────────────────────────────────────────────────────
function pagesSitemap(today) {
  const entries = STATIC_PAGES.map(p => `
  <url>
    <loc>${xe(p.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${xe(p.loc)}"/>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>`;
}

// ── Links Sitemap (paginated) ──────────────────────────────────────────
function linksSitemap(rows, page, today) {
  const slice   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const entries = slice.map(r => {
    const loc = `${SHORT_BASE}${xe(r.code)}`;
    return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${loc}"/>
  </url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>`;
}

// ── News Sitemap (last 48h) ────────────────────────────────────────────
function newsSitemap(rows) {
  const cutoff = Date.now() - NEWS_HOURS * 3600000;
  const recent = rows
    .filter(r => r.created_at && new Date(r.created_at).getTime() >= cutoff)
    .slice(0, 1000);

  if (!recent.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
</urlset>`;
  }

  const entries = recent.map(r => {
    const loc  = `${SHORT_BASE}${xe(r.code)}`;
    const date = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();
    return `
  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>IndexerNow</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>Resource — ${xe(r.code)}</news:title>
    </news:news>
  </url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;
}

// ── HTML Sitemap ───────────────────────────────────────────────────────
function htmlSitemap(rows, today, totalPages) {
  const items = rows.slice(0, 200).map(r =>
    `<li><a href="${SHORT_BASE}${xe(r.code)}">${xe(r.code)}</a></li>`
  ).join('');

  const subSitemaps = [
    { href: '/sitemap.xml',       label: 'Sitemap Index',  badge: 'Master' },
    { href: '/sitemap-pages.xml', label: 'Pages Sitemap',  badge: `${STATIC_PAGES.length} pages` },
    ...Array.from({ length: totalPages }, (_, i) => ({
      href: `/sitemap-links-${i+1}.xml`,
      label: `Links — Page ${i+1}`,
      badge: `${PAGE_SIZE} links`,
    })),
    { href: '/sitemap-news.xml',  label: 'News Sitemap',   badge: 'Last 48h' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sitemap — IndexerNow</title>
  <link rel="canonical" href="${BASE}/sitemap-html.xml">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Sitemap","url":"${BASE}/sitemap.xml","dateModified":"${today}"}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,sans-serif;background:#09090b;color:#e8eaf0;padding:40px 24px;max-width:900px;margin:0 auto}
    h1{font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:6px}
    .meta{font-size:12px;color:#6b7280;margin-bottom:28px}span.g{color:#00ff88}
    h2{font-size:.65rem;font-weight:700;color:#00ff88;text-transform:uppercase;letter-spacing:.1em;margin:20px 0 8px}
    .grid{display:grid;gap:6px;margin-bottom:24px}
    .sm{display:flex;align-items:center;justify-content:space-between;background:#111115;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px 14px;text-decoration:none;color:#e8eaf0;transition:border-color .15s}
    .sm:hover{border-color:rgba(0,255,136,.3)}.sm .lbl{font-size:.72rem;font-weight:600}
    .sm .bdg{font-size:.55rem;background:rgba(0,255,136,.08);color:#00ff88;border-radius:4px;padding:2px 7px}
    ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:5px}
    ul li a{font-size:.65rem;color:#3b82f6;background:#111115;display:block;padding:4px 9px;border-radius:5px;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ul li a:hover{color:#60a5fa}
  </style>
</head>
<body>
  <h1>Sitemap — IndexerNow</h1>
  <div class="meta">Updated: <span class="g">${today}</span> · <span class="g">${rows.length}</span> short links · <span class="g">${totalPages}</span> sub-sitemaps</div>
  <h2>XML Sitemaps — submit index to Google Search Console</h2>
  <div class="grid">
    ${subSitemaps.map(s => `<a class="sm" href="${s.href}"><span class="lbl">${s.label}</span><span class="bdg">${s.badge}</span></a>`).join('')}
  </div>
  <h2>Short Links (first 200 of ${rows.length})</h2>
  <ul>${items}</ul>
</body>
</html>`;
}

// XML entity escape
function xe(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
