<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
<xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sitemap — IndexerNow</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#e8eaf0;min-height:100vh}
    .hdr{background:#111115;border-bottom:1px solid rgba(255,255,255,0.07);padding:18px 32px;display:flex;align-items:center;gap:12px}
    .logo{width:32px;height:32px;background:#00ff88;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
    .hdr-title{font-size:1rem;font-weight:700;color:#fff}
    .hdr-sub{font-size:.55rem;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-top:2px}
    .badge{margin-left:auto;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.2);color:#00ff88;font-size:.58rem;padding:3px 10px;border-radius:6px;font-family:monospace}
    .wrap{max-width:960px;margin:0 auto;padding:28px 24px}
    .notice{background:#111115;border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:12px 16px;font-size:.68rem;color:#6b7280;margin-bottom:24px;line-height:1.7}
    .notice strong{color:#3b82f6}.notice a{color:#00ff88;text-decoration:none}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px}
    .stat{background:#111115;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px 14px}
    .stat .v{font-size:1.3rem;font-weight:700;color:#00ff88;font-family:monospace}
    .stat .l{font-size:.52rem;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-top:3px}
    table{width:100%;border-collapse:collapse;background:#111115;border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;font-size:.7rem}
    th{font-size:.52rem;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;padding:9px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.07);font-weight:500}
    td{padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:rgba(255,255,255,0.02)}
    a{color:#00ff88;text-decoration:none}a:hover{text-decoration:underline}
    .loc{max-width:440px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tag{font-size:.5rem;padding:2px 6px;border-radius:3px;margin-left:5px}
    .tag-idx{background:rgba(59,130,246,.12);color:#3b82f6}
    .tag-lnk{background:rgba(0,255,136,.08);color:#00ff88}
    .tag-nws{background:rgba(245,158,11,.1);color:#f59e0b}
    .tag-pg{background:rgba(168,85,247,.1);color:#a855f7}
    .date{color:#6b7280;font-family:monospace;font-size:.65rem}
    .freq{color:#6b7280;font-size:.62rem;text-transform:uppercase;letter-spacing:.04em}
    .p1{color:#00ff88;font-family:monospace;font-size:.65rem}
    .p2{color:#3b82f6;font-family:monospace;font-size:.65rem}
    .p3{color:#6b7280;font-family:monospace;font-size:.65rem}
  </style>
</head>
<body>
  <div class="hdr">
    <div class="logo">⚡</div>
    <div>
      <div class="hdr-title">IndexerNow Sitemap</div>
      <div class="hdr-sub">indexernow.vercel.app</div>
    </div>
    <div class="badge">Googlebot ✓</div>
  </div>
  <div class="wrap">
    <div class="notice">
      <strong>XML Sitemap</strong> — designed for search engine crawlers.
      Submit <strong>/sitemap.xml</strong> to <strong>Google Search Console → Sitemaps</strong>.
      Human view: <a href="/sitemap-html.xml">/sitemap-html.xml</a>
    </div>

    <!-- Sitemap Index -->
    <xsl:if test="sitemapindex">
      <xsl:variable name="c" select="count(sitemapindex/sitemap)"/>
      <div class="stats">
        <div class="stat"><div class="v"><xsl:value-of select="$c"/></div><div class="l">Sub-sitemaps</div></div>
        <div class="stat"><div class="v">Live</div><div class="l">Status</div></div>
        <div class="stat"><div class="v">Daily</div><div class="l">Refresh</div></div>
      </div>
      <table>
        <tr><th>Sitemap URL</th><th>Type</th><th>Last Modified</th></tr>
        <xsl:for-each select="sitemapindex/sitemap">
          <tr>
            <td class="loc"><a href="{loc}"><xsl:value-of select="loc"/></a></td>
            <td>
              <xsl:choose>
                <xsl:when test="contains(loc,'news')"><span class="tag tag-nws">News</span></xsl:when>
                <xsl:when test="contains(loc,'pages')"><span class="tag tag-pg">Pages</span></xsl:when>
                <xsl:when test="contains(loc,'links')"><span class="tag tag-lnk">Links</span></xsl:when>
                <xsl:otherwise><span class="tag tag-idx">Index</span></xsl:otherwise>
              </xsl:choose>
            </td>
            <td class="date"><xsl:value-of select="lastmod"/></td>
          </tr>
        </xsl:for-each>
      </table>
    </xsl:if>

    <!-- URL set -->
    <xsl:if test="urlset">
      <xsl:variable name="c" select="count(urlset/url)"/>
      <div class="stats">
        <div class="stat"><div class="v"><xsl:value-of select="$c"/></div><div class="l">URLs</div></div>
        <div class="stat"><div class="v">Live</div><div class="l">Status</div></div>
        <div class="stat"><div class="v">Daily</div><div class="l">Refresh</div></div>
      </div>
      <table>
        <tr><th>URL</th><th>Last Modified</th><th>Change Freq</th><th>Priority</th></tr>
        <xsl:for-each select="urlset/url">
          <tr>
            <td class="loc"><a href="{loc}"><xsl:value-of select="loc"/></a></td>
            <td class="date"><xsl:value-of select="lastmod"/></td>
            <td class="freq"><xsl:value-of select="changefreq"/></td>
            <td>
              <xsl:choose>
                <xsl:when test="priority &gt;= 0.9"><span class="p1"><xsl:value-of select="priority"/></span></xsl:when>
                <xsl:when test="priority &gt;= 0.5"><span class="p2"><xsl:value-of select="priority"/></span></xsl:when>
                <xsl:otherwise><span class="p3"><xsl:value-of select="priority"/></span></xsl:otherwise>
              </xsl:choose>
            </td>
          </tr>
        </xsl:for-each>
      </table>
    </xsl:if>
  </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
