#!/usr/bin/env node
/**
 * build-hi.js — HisaabNow Hindi static page builder
 * ------------------------------------------------
 * Reads your existing index.html, bakes the I18N.hi dictionary straight into
 * the HTML, and writes a fully server-rendered Hindi page to hi/index.html.
 *
 * Also patches index.html so that:
 *   - hreflang points at the real /hi/ URL (reciprocal)
 *   - the EN/HI pill becomes real links (crawlable) instead of JS buttons
 *
 * Run after EVERY edit to index.html:
 *     node build-hi.js
 *
 * Zero dependencies. Node 18+.
 */

const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'index.html';
const OUT_DIR = process.argv[3] || '.';
const ORIGIN = 'https://hisaabnow.com';

/* ------------------------------------------------------------------ *
 * 1. HINDI HEAD COPY — edit these four strings by hand when you like  *
 * ------------------------------------------------------------------ */
const HI = {
  title: 'दुकान के लिए बिलिंग सॉफ्टवेयर और POS | HisaabNow',
  desc: 'भारतीय दुकानों के लिए POS बिलिंग सॉफ्टवेयर। सिर्फ बिक्री नहीं, असली मुनाफा देखें — GST बिलिंग, स्टॉक, उधार खाता और हिंदी वॉइस बिलिंग। 7 दिन फ्री ट्रायल।',
  ogAlt: 'HisaabNow — भारतीय दुकानों के लिए POS और बिलिंग सॉफ्टवेयर',
  appDesc: 'भारत के छोटे व्यापारियों के लिए POS और बिलिंग सॉफ्टवेयर — कैफे, सैलून, रेस्तरां, मिठाई की दुकान और किराना स्टोर। हर बिल पर असली मुनाफा, हिंदी वॉइस बिलिंग और AI बिजनेस इनसाइट्स।'
};

/* ------------------------------------------------------------------ *
 * 2. Pull the I18N dictionary out of the page                         *
 * ------------------------------------------------------------------ */
const src = fs.readFileSync(SRC, 'utf8');

function extractI18N(html) {
  const s = html.indexOf('const I18N = {');
  if (s === -1) throw new Error('I18N dictionary not found — did the variable get renamed?');
  const e = html.indexOf('\n};', s);
  const body = html.slice(s + 'const I18N ='.length, e + 2);
  return new Function('return ' + body)();
}

const I18N = extractI18N(src);
const dict = I18N.hi;
if (!dict) throw new Error('No hi block in I18N');

/* ------------------------------------------------------------------ *
 * 3. Tag-balanced innerHTML replacement                               *
 *    (mirrors exactly what applyLang() does at runtime)               *
 * ------------------------------------------------------------------ */
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

function bakeText(html, table) {
  let out = '';
  let i = 0;
  let hits = 0;
  const missing = new Set();

  const attrRe = /data-i18n="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const key = m[1];
    const attrAt = m.index;

    // walk back to the '<' that opens this tag
    const lt = html.lastIndexOf('<', attrAt);
    const tagMatch = /^<([a-zA-Z0-9-]+)/.exec(html.slice(lt));
    if (!tagMatch) continue;
    const tag = tagMatch[1].toLowerCase();
    if (VOID.has(tag)) continue;

    // find the '>' that closes the opening tag, respecting quoted values
    let j = attrAt, q = null, gt = -1;
    for (; j < html.length; j++) {
      const c = html[j];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '>') { gt = j; break; }
    }
    if (gt === -1) continue;

    // scan forward for the matching close tag, counting nesting
    const openRe = new RegExp('<' + tag + '(\\s|>|/)', 'gi');
    const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
    let depth = 1, cursor = gt + 1, close = -1;
    while (cursor < html.length) {
      openRe.lastIndex = cursor; closeRe.lastIndex = cursor;
      const o = openRe.exec(html);
      const c = closeRe.exec(html);
      if (!c) break;
      if (o && o.index < c.index) { depth++; cursor = o.index + 1; continue; }
      depth--;
      if (depth === 0) { close = c.index; break; }
      cursor = c.index + 1;
    }
    if (close === -1) continue;

    const val = table[key];
    if (typeof val !== 'string') { missing.add(key); continue; }

    out += html.slice(i, gt + 1) + val;
    i = close;
    hits++;
    attrRe.lastIndex = gt + 1;
  }
  out += html.slice(i);

  // placeholders
  out = out.replace(/data-i18n-placeholder="([^"]+)"([^>]*?)placeholder="[^"]*"/g,
    (full, key, mid) => typeof table[key] === 'string'
      ? `data-i18n-placeholder="${key}"${mid}placeholder="${table[key].replace(/"/g, '&quot;')}"`
      : full);

  return { html: out, hits, missing: [...missing] };
}

/* ------------------------------------------------------------------ *
 * 4. Head + schema rewrite for the Hindi page                         *
 * ------------------------------------------------------------------ */
function rewriteHead(html) {
  let h = html;
  const set = (re, to) => { h = h.replace(re, to); };

  set(/<html lang="en" data-lang="en">/, '<html lang="hi" data-lang="hi">');
  set(/<title>[^<]*<\/title>/, `<title>${HI.title}</title>`);
  set(/(<meta name="description" content=")[^"]*(")/, `$1${HI.desc}$2`);
  set(/(<meta property="og:title" content=")[^"]*(")/, `$1${HI.title}$2`);
  set(/(<meta property="og:description" content=")[^"]*(")/, `$1${HI.desc}$2`);
  set(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${HI.ogAlt}$2`);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${HI.title}$2`);
  set(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${HI.desc}$2`);
  set(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1${HI.ogAlt}$2`);
  set(/<meta property="og:locale" content="en_IN">/, '<meta property="og:locale" content="hi_IN">');
  set(/<meta property="og:locale:alternate" content="hi_IN">/, '<meta property="og:locale:alternate" content="en_IN">');
  set(/(<meta property="og:url" content=")[^"]*(")/, `$1${ORIGIN}/hi/$2`);
  set(/(<link rel="canonical" href=")[^"]*(")/, `$1${ORIGIN}/hi/$2`);
  return h;
}

// hreflang cluster, identical on both pages
const HREFLANG = [
  `<link rel="alternate" hreflang="en-in" href="${ORIGIN}/">`,
  `<link rel="alternate" hreflang="hi-in" href="${ORIGIN}/hi/">`,
  `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`
].join('\n');

function fixHreflang(html) {
  return html.replace(
    /<link rel="alternate" hreflang="en-in"[^>]*>[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*>/,
    HREFLANG
  );
}

function rewriteSchema(html) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (full, json) => {
    let g;
    try { g = JSON.parse(json); } catch (e) { console.warn('  ! JSON-LD unparseable, left as-is'); return full; }
    const nodes = g['@graph'] || [g];

    for (const n of nodes) {
      if (n['@type'] === 'SoftwareApplication') {
        n.url = ORIGIN + '/hi/';
        n.description = HI.appDesc;
        n.inLanguage = ['hi', 'en'];
      }
      if (n['@type'] === 'WebSite') n.inLanguage = 'hi';
      if (n['@type'] === 'FAQPage') {
        n['@id'] = ORIGIN + '/hi/#faq';
        n.inLanguage = 'hi';
        n.mainEntity = [];
        for (let i = 1; i <= 20; i++) {
          const q = dict['faq.q' + i], a = dict['faq.a' + i];
          if (!q || !a) continue;
          n.mainEntity.push({
            '@type': 'Question',
            name: strip(q),
            acceptedAnswer: { '@type': 'Answer', text: strip(a) }
          });
        }
      }
      if (n['@type'] === 'BreadcrumbList' && Array.isArray(n.itemListElement)) {
        n.itemListElement.forEach(it => { if (it.item === ORIGIN + '/') it.item = ORIGIN + '/hi/'; });
      }
    }
    return '<script type="application/ld+json">\n' + JSON.stringify(g, null, 2) + '\n</script>';
  });
}

const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ *
 * 5. Language pill → real crawlable links                             *
 * ------------------------------------------------------------------ */
const PILL_EN = `<div class="lang-toggle" role="group" aria-label="Language">
        <a href="/" class="active" data-lang-btn="en" hreflang="en" aria-label="English">EN</a>
        <a href="/hi/" data-lang-btn="hi" hreflang="hi" aria-label="हिंदी">हिं</a>
      </div>`;

const PILL_HI = `<div class="lang-toggle" role="group" aria-label="Language">
        <a href="/" data-lang-btn="en" hreflang="en" aria-label="English">EN</a>
        <a href="/hi/" class="active" data-lang-btn="hi" hreflang="hi" aria-label="हिंदी">हिं</a>
      </div>`;

const PILL_RE = /<div class="lang-toggle" role="group" aria-label="Language">[\s\S]*?<\/div>/;

// CSS: the pill was styled as `button`, now it is an `a`
function fixPillCss(html) {
  return html
    .replace(/\.lang-toggle button \{/, '.lang-toggle button, .lang-toggle a {\n  text-decoration: none;')
    .replace(/\.lang-toggle button\.active \{/, '.lang-toggle button.active, .lang-toggle a.active {')
    .replace(/\.lang-toggle button \{ padding: 5px 9px; \}/, '.lang-toggle button, .lang-toggle a { padding: 5px 9px; }');
}

// the old handler repainted the DOM on click; now the link navigates instead
const OLD_INIT = /document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*let saved = null;[\s\S]*?\}\);\s*\}\);/;
const NEW_INIT = `document.addEventListener('DOMContentLoaded', () => {
  // Language is decided by URL (/ = English, /hi/ = हिंदी), not by JS repaint.
  // One URL, one language — that is what search and AI crawlers need.
  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      try { localStorage.setItem('hn_lang', btn.getAttribute('data-lang-btn')); } catch(e){}
    });
  });
});`;

/* ------------------------------------------------------------------ *
 * 6. Build                                                            *
 * ------------------------------------------------------------------ */
console.log(`\n  Source: ${SRC}  (${(src.length / 1024).toFixed(0)} KB)`);
console.log(`  Dictionary: ${Object.keys(dict).length} Hindi keys\n`);

// --- Hindi page ---
let hi = bakeText(src, dict);
console.log(`  → baked ${hi.hits} Hindi strings into the HTML`);
if (hi.missing.length) console.log(`  ! ${hi.missing.length} keys missing from I18N.hi: ${hi.missing.join(', ')}`);

let hiPage = hi.html;
hiPage = rewriteHead(hiPage);
hiPage = fixHreflang(hiPage);
hiPage = rewriteSchema(hiPage);
hiPage = hiPage.replace(PILL_RE, PILL_HI);
hiPage = fixPillCss(hiPage);
hiPage = hiPage.replace(OLD_INIT, NEW_INIT);
hiPage = hiPage.replace(/let currentLang = 'en';/, "let currentLang = 'hi';");
hiPage = hiPage.replace(/<script id="HN_LANG_REDIRECT">[\s\S]*?<\/script>\s*/, '');

fs.mkdirSync(path.join(OUT_DIR, 'hi'), { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'hi', 'index.html'), hiPage);
console.log(`  → wrote hi/index.html   (${(hiPage.length / 1024).toFixed(0)} KB)`);

// --- patched English page ---
let enPage = src;
// legacy /?lang=hi links (and the old hreflang target) now land on the real page
// (guarded so re-running the build never stacks a second copy)
if (!enPage.includes('HN_LANG_REDIRECT')) enPage = enPage.replace('</head>',
`<script id="HN_LANG_REDIRECT">
// Legacy support: /?lang=hi was never a real page. Send it to /hi/.
(function(){try{var p=new URLSearchParams(location.search);
if(p.get('lang')==='hi'){location.replace('/hi/'+location.hash);}}catch(e){}})();
</script>
</head>`);
enPage = fixHreflang(enPage);
enPage = enPage.replace(PILL_RE, PILL_EN);
enPage = fixPillCss(enPage);
enPage = enPage.replace(OLD_INIT, NEW_INIT);
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), enPage);
console.log(`  → wrote index.html      (${(enPage.length / 1024).toFixed(0)} KB)\n`);

/* --- sitemap.xml with hreflang alternates --- */
const TODAY = new Date().toISOString().slice(0, 10);
const PAGES = [
  // alt: '/hi/'  →  emit an hreflang pair. Only set this once the Hindi
  // twin ACTUALLY exists. Pointing hreflang at a page that serves English
  // is what broke the old sitemap.
  { loc: '/',                           pri: '1.0', alt: '/hi/' },
  { loc: '/hi/',                        pri: '0.9', alt: '/'    },
  { loc: '/salon-billing-software',     pri: '0.9' },
  { loc: '/cafe-billing-software',      pri: '0.9' },
  { loc: '/restaurant-pos',             pri: '0.9' },
  { loc: '/grocery-billing-software',   pri: '0.9' },
  { loc: '/kirana-billing-app',         pri: '0.8' },
  { loc: '/sweet-shop-billing-software',pri: '0.9' },
  { loc: '/about',                      pri: '0.8' }
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.map(p => `  <url>
    <loc>${ORIGIN}${p.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${p.pri}</priority>${p.alt ? `
    <xhtml:link rel="alternate" hreflang="en-in" href="${ORIGIN}/"/>
    <xhtml:link rel="alternate" hreflang="hi-in" href="${ORIGIN}/hi/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>` : ''}
  </url>`).join('\n')}
</urlset>`;
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemap);
console.log(`  → wrote sitemap.xml     (${PAGES.length} URLs, hreflang pairs on / and /hi/)\n`);

/* --- self-check: is there real Devanagari in the Hindi body? --- */
const body = hiPage.split('<body')[1].replace(/<script[\s\S]*?<\/script>/g, '');
const dev = (body.match(/[\u0900-\u097F]/g) || []).length;
const lat = (body.replace(/<[^>]+>/g, '').match(/[A-Za-z]/g) || []).length;
console.log(`  Hindi page, script tags removed: ${dev} Devanagari chars vs ${lat} Latin chars`);
console.log(dev > 2000
  ? '  ✓ Hindi is now in the static HTML — crawlers will see it without running JS.\n'
  : '  ✗ Something went wrong — Hindi did not bake in.\n');
