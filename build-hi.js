#!/usr/bin/env node
/**
 * build-hi.js — HisaabNow Hindi static page builder  (v2)
 * ------------------------------------------------------
 * Bakes each page's own I18N.hi dictionary into static HTML and writes a real
 * Hindi URL. No cheerio, no dependencies, no hand-maintained copy of your
 * visible text — the dictionary the live toggle already uses IS the source.
 *
 *     node build-hi.js
 *
 * Adding a vertical: add a block to PAGES below. Only 3 head strings and the
 * schema prose need hand translation; the other ~245 strings come from I18N.hi.
 *
 * Run after EVERY edit to any source page. Safe to run repeatedly (idempotent).
 */

const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://hisaabnow.com';
const OUT_DIR = process.argv[2] || '.';

/* ══════════════════════════════════════════════════════════════════════
   PAGE CONFIG
   ══════════════════════════════════════════════════════════════════════ */
const PAGES = [
  {
    src: 'index.html',
    out: 'hi/index.html',
    enPath: '/',
    hiPath: '/hi/',
    rewriteSchemaUrls: false,          // '/' would match every site-wide @id
    head: {
      title: 'दुकान के लिए बिलिंग सॉफ्टवेयर और POS | HisaabNow',
      desc: 'भारतीय दुकानों के लिए POS बिलिंग सॉफ्टवेयर। सिर्फ बिक्री नहीं, असली मुनाफा देखें — GST बिलिंग, स्टॉक, उधार खाता और हिंदी वॉइस बिलिंग। 7 दिन फ्री ट्रायल।',
      ogAlt: 'HisaabNow — भारतीय दुकानों के लिए POS और बिलिंग सॉफ्टवेयर'
    },
    schemaText: {
      "POS & billing software for Indian small businesses — cafés, salons, restaurants, sweet shops, and kirana stores. Tracks real profit on every sale, supports Hindi voice billing, and provides AI-driven business insights.":
        'भारत के छोटे व्यापारियों के लिए POS और बिलिंग सॉफ्टवेयर — कैफे, सैलून, रेस्तरां, मिठाई की दुकान और किराना स्टोर। हर बिल पर असली मुनाफा, हिंदी वॉइस बिलिंग और AI बिजनेस इनसाइट्स।'
    }
  },

  {
    src: 'salon-billing-software.html',
    out: 'hi/salon-billing-software.html',   // GitHub Pages serves this at /hi/salon-billing-software
    enPath: '/salon-billing-software',
    hiPath: '/hi/salon-billing-software',
    rewriteSchemaUrls: true,
    head: {
      title: 'सैलून बिलिंग सॉफ्टवेयर और POS भारत · स्टाइलिस्ट कमीशन | HisaabNow',
      desc: 'भारतीय सैलून और बार्बर शॉप के लिए POS बिलिंग ऐप। हर सर्विस का असली मुनाफा, स्टाइलिस्ट कमीशन, दोबारा आने वाले ग्राहक — सब ट्रैक। हिंदी वॉइस बिलिंग। 7 दिन फ्री ट्रायल।',
      ogAlt: 'HisaabNow सैलून POS ऐप — भारतीय सैलून के लिए हर सर्विस का असली मुनाफ़ा, स्टाइलिस्ट कमीशन और AI इनसाइट ट्रैक करें'
    },
    // Exact English → Hindi for schema prose. Most of this is your own wording
    // from the old build-hindi.js PAGE_META, with the pricing lines rewritten
    // to Trial / Pro ₹199 / King ₹299.
    schemaText: {
      "POS and billing software for India's 60+ million micro and small business owners — salons, kirana stores, cafés, restaurants, sweet shops.":
        'भारत के 6 करोड़+ छोटे और सूक्ष्म बिज़नेस मालिकों के लिए POS और बिलिंग सॉफ़्टवेयर — सैलून, किराना, कैफ़े, रेस्तरां, मिठाई की दुकानें।',

      "Salon POS & Billing Software India · Stylist Commission · HisaabNow":
        'सैलून POS और बिलिंग सॉफ़्टवेयर भारत · स्टाइलिस्ट कमीशन · HisaabNow',

      "HisaabNow for Salons": 'सैलून के लिए HisaabNow',

      "POS billing app for Indian salons. Service catalog with margins, Stylist commission tracking, repeat customer alerts, peak time insights.":
        'भारतीय सैलून के लिए POS बिलिंग ऐप। मार्जिन के साथ सर्विस कैटलॉग, स्टाइलिस्ट कमीशन ट्रैकिंग, दोबारा आने वाले ग्राहक अलर्ट, पीक टाइम इनसाइट।',

      "Owners of salons in India": 'भारत में सैलून मालिक',

      "POS billing and management for salons": 'सैलून के लिए POS बिलिंग और मैनेजमेंट',
      "HisaabNow Salons POS": 'HisaabNow सैलून POS',

      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for salons in India.":
        'भारत में सैलून के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।',

      "7-day free trial; Pro ₹199/month or ₹1,990/year; King ₹299/month or ₹2,990/year.":
        '7 दिन का फ्री ट्रायल; Pro ₹199/महीना या ₹1,990/साल; King ₹299/महीना या ₹2,990/साल।',

      "HisaabNow salon POS plan comparison": 'HisaabNow सैलून POS प्लान तुलना',

      "Compare HisaabNow Free Trial (7 days), Pro (₹199/month), and King (₹299/month) plans for Indian salons, barber shops, and beauty parlours.":
        'भारतीय सैलून, बार्बर शॉप और ब्यूटी पार्लर के लिए HisaabNow फ्री ट्रायल (7 दिन), Pro (₹199/महीना) और King (₹299/महीना) प्लान की तुलना करें।',

      "Free Trial": 'फ्री ट्रायल',
      "HisaabNow Free Trial": 'HisaabNow फ्री ट्रायल',

      "7-day free trial — full Pro features, no card needed.":
        '7 दिन का फ्री ट्रायल — सभी Pro फ़ीचर, कार्ड की ज़रूरत नहीं।',

      "7-day free trial with every feature — mobile app, billing & GST invoices, inventory, customer list. No card needed.":
        '7 दिन का फ्री ट्रायल, हर फ़ीचर के साथ — मोबाइल ऐप, बिलिंग और GST इनवॉइस, इन्वेंट्री, ग्राहक लिस्ट। कार्ड की ज़रूरत नहीं।',

      "₹199/month for small businesses & salons — adds desktop panel, expense & profit tracking, WhatsApp receipts, staff management & commission, appointment booking, AI insights.":
        'छोटे बिज़नेस और सैलून के लिए ₹199/महीना — डेस्कटॉप पैनल, खर्च और मुनाफ़ा ट्रैकिंग, WhatsApp रसीदें, स्टाफ़ मैनेजमेंट और कमीशन, अपॉइंटमेंट बुकिंग, AI इनसाइट शामिल।',

      "₹199/month salon POS plan for small businesses & salons — adds desktop panel, expense & profit tracking, WhatsApp receipts, staff management & commission, appointment booking, AI insights.":
        'छोटे बिज़नेस और सैलून के लिए ₹199/महीना सैलून POS प्लान — डेस्कटॉप पैनल, खर्च और मुनाफ़ा ट्रैकिंग, WhatsApp रसीदें, स्टाफ़ मैनेजमेंट और कमीशन, अपॉइंटमेंट बुकिंग, AI इनसाइट शामिल।',

      "₹299/month for serious businesses — adds full desktop access, multi-user login, branch management, advanced analytics, priority support.":
        'गंभीर बिज़नेस के लिए ₹299/महीना — पूरा डेस्कटॉप एक्सेस, मल्टी-यूज़र लॉगिन, ब्रांच मैनेजमेंट, एडवांस्ड एनालिटिक्स, प्रायोरिटी सपोर्ट शामिल।',

      "₹299/month salon POS plan for serious businesses — adds full desktop access, multi-user login, branch management, advanced analytics, priority support.":
        'गंभीर बिज़नेस के लिए ₹299/महीना सैलून POS प्लान — पूरा डेस्कटॉप एक्सेस, मल्टी-यूज़र लॉगिन, ब्रांच मैनेजमेंट, एडवांस्ड एनालिटिक्स, प्रायोरिटी सपोर्ट शामिल।',

      "Salons": 'सैलून के लिए POS ऐप'
    }
  }
];

/* ══════════════════════════════════════════════════════════════════════
   ENGINE — nothing below needs editing to add a page
   ══════════════════════════════════════════════════════════════════════ */

const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

function extractI18N(html, file) {
  const s = html.indexOf('const I18N = {');
  if (s === -1) throw new Error(`no I18N dictionary in ${file}`);
  const e = html.indexOf('\n};', s);
  return new Function('return ' + html.slice(s + 'const I18N ='.length, e + 2))();
}

/** Replace innerHTML of every [data-i18n] element — same as applyLang() does. */
function bakeText(html, table) {
  let out = '', i = 0, hits = 0;
  const missing = new Set();
  const attrRe = /data-i18n="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const key = m[1], attrAt = m.index;
    const lt = html.lastIndexOf('<', attrAt);
    const tm = /^<([a-zA-Z0-9-]+)/.exec(html.slice(lt));
    if (!tm) continue;
    const tag = tm[1].toLowerCase();
    if (VOID.has(tag)) continue;

    let j = attrAt, q = null, gt = -1;
    for (; j < html.length; j++) {
      const c = html[j];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '>') { gt = j; break; }
    }
    if (gt === -1) continue;

    const openRe = new RegExp('<' + tag + '(\\s|>|/)', 'gi');
    const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
    let depth = 1, cursor = gt + 1, close = -1;
    while (cursor < html.length) {
      openRe.lastIndex = cursor; closeRe.lastIndex = cursor;
      const o = openRe.exec(html), c = closeRe.exec(html);
      if (!c) break;
      if (o && o.index < c.index) { depth++; cursor = o.index + 1; continue; }
      if (--depth === 0) { close = c.index; break; }
      cursor = c.index + 1;
    }
    if (close === -1) continue;

    const val = table[key];
    if (typeof val !== 'string') { missing.add(key); continue; }
    out += html.slice(i, gt + 1) + val;
    i = close; hits++;
    attrRe.lastIndex = gt + 1;
  }
  out += html.slice(i);

  out = out.replace(/data-i18n-placeholder="([^"]+)"([^>]*?)placeholder="[^"]*"/g,
    (full, key, mid) => typeof table[key] === 'string'
      ? `data-i18n-placeholder="${key}"${mid}placeholder="${table[key].replace(/"/g, '&quot;')}"`
      : full);

  return { html: out, hits, missing: [...missing] };
}

function rewriteHead(html, cfg) {
  const { title, desc, ogAlt } = cfg.head;
  let h = html;
  h = h.replace(/<html lang="[^"]*"(?: data-lang="[^"]*")?>/, '<html lang="hi" data-lang="hi">');
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`);
  h = h.replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${ogAlt}$2`);
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`);
  h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`);
  h = h.replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1${ogAlt}$2`);
  h = h.replace(/<meta property="og:locale" content="[^"]*">/, '<meta property="og:locale" content="hi_IN">');
  h = h.replace(/<meta property="og:locale:alternate" content="[^"]*">/, '<meta property="og:locale:alternate" content="en_IN">');
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${ORIGIN}${cfg.hiPath}$2`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${ORIGIN}${cfg.hiPath}$2`);
  return h;
}

function fixHreflang(html, cfg) {
  const block = [
    `<link rel="alternate" hreflang="en-in" href="${ORIGIN}${cfg.enPath}">`,
    `<link rel="alternate" hreflang="hi-in" href="${ORIGIN}${cfg.hiPath}">`,
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${cfg.enPath}">`
  ].join('\n');
  return html.replace(
    /<link rel="alternate" hreflang="en-in"[^>]*>[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*>/,
    block);
}

function rewriteSchema(html, cfg, dict) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (full, json) => {
    let g;
    try { g = JSON.parse(json); } catch (e) { console.warn('    ! JSON-LD unparseable, left as-is'); return full; }

    const map = cfg.schemaText || {};
    const TEXT_FIELDS = new Set(['name', 'description', 'alternateName', 'headline',
      'serviceType', 'audienceType']);

    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n)) {
        if (typeof v === 'string') {
          if (TEXT_FIELDS.has(k) && map[v]) n[k] = map[v];
          else if (cfg.rewriteSchemaUrls && v.startsWith(ORIGIN + cfg.enPath))
            n[k] = ORIGIN + cfg.hiPath + v.slice((ORIGIN + cfg.enPath).length);
        } else walk(v);
      }
    })(g['@graph'] || g);

    for (const n of (g['@graph'] || [g])) {
      if (n['@type'] === 'FAQPage') {
        n.inLanguage = 'hi';
        const qa = [];
        for (let i = 1; i <= 30; i++) {
          const q = dict['faq.q' + i], a = dict['faq.a' + i];
          if (!q || !a) continue;
          qa.push({ '@type': 'Question', name: strip(q),
                    acceptedAnswer: { '@type': 'Answer', text: strip(a) } });
        }
        if (qa.length) n.mainEntity = qa;
      }
      if (n['@type'] === 'SoftwareApplication') n.inLanguage = ['hi', 'en'];
      if (n['@type'] === 'WebSite' || n['@type'] === 'WebPage') n.inLanguage = 'hi';
    }

    return '<script type="application/ld+json">\n' + JSON.stringify(g, null, 2) + '\n</script>';
  });
}

const PILL_RE = /<div class="lang-toggle"[^>]*>[\s\S]*?<\/div>/;
const pill = (cfg, active) => `<div class="lang-toggle" role="group" aria-label="Language">
        <a href="${cfg.enPath}"${active === 'en' ? ' class="active"' : ''} data-lang-btn="en" hreflang="en" aria-label="English">EN</a>
        <a href="${cfg.hiPath}"${active === 'hi' ? ' class="active"' : ''} data-lang-btn="hi" hreflang="hi" aria-label="हिंदी">हिं</a>
      </div>`;

function fixPillCss(html) {
  return html
    .replace(/\.lang-toggle button \{/g, '.lang-toggle button, .lang-toggle a {\n  text-decoration: none;')
    .replace(/\.lang-toggle button\.active \{/g, '.lang-toggle button.active, .lang-toggle a.active {');
}

const NEUTRALISE = [
  ['if (saved && I18N[saved]) applyLang(saved);',
   '/* language is decided by the URL, not repainted by JS */'],
  ["btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang-btn')));",
   "btn.addEventListener('click', () => { try { localStorage.setItem('hn_lang', btn.getAttribute('data-lang-btn')); } catch(e){} });"]
];
const neutralise = h => NEUTRALISE.reduce((acc, [from, to]) => acc.split(from).join(to), h);

const redirect = cfg => `<script id="HN_LANG_REDIRECT">
// Legacy support: ?lang=hi was never a real page. Send it to the Hindi URL.
(function(){try{var p=new URLSearchParams(location.search);
if(p.get('lang')==='hi'){location.replace('${cfg.hiPath}'+location.hash);}}catch(e){}})();
</script>
</head>`;

/* ── build ───────────────────────────────────────────────────────────── */
console.log('\n  HisaabNow Hindi build\n  ─────────────────────');
let built = 0;

for (const cfg of PAGES) {
  if (!fs.existsSync(cfg.src)) { console.log(`\n  ⚠  ${cfg.src} not found — skipped`); continue; }
  const src = fs.readFileSync(cfg.src, 'utf8');
  const dict = extractI18N(src, cfg.src).hi;
  if (!dict) { console.log(`\n  ⚠  ${cfg.src} has no hi dictionary — skipped`); continue; }

  console.log(`\n  ${cfg.src}  →  ${cfg.hiPath}`);
  console.log(`    dictionary: ${Object.keys(dict).length} Hindi keys`);

  const baked = bakeText(src, dict);
  console.log(`    baked ${baked.hits} strings into static HTML`);
  if (baked.missing.length)
    console.log(`    ! ${baked.missing.length} keys have no Hindi: ${baked.missing.join(', ')}`);

  let hi = baked.html;
  hi = rewriteHead(hi, cfg);
  hi = fixHreflang(hi, cfg);
  hi = rewriteSchema(hi, cfg, dict);
  hi = hi.replace(PILL_RE, pill(cfg, 'hi'));
  hi = fixPillCss(hi);
  hi = neutralise(hi);
  hi = hi.replace(/let currentLang = 'en';/, "let currentLang = 'hi';");
  hi = hi.replace(/<script id="HN_LANG_REDIRECT">[\s\S]*?<\/script>\s*/, '');
  hi = hi.replace(/href="[^"]*\?lang=hi"/g, `href="${cfg.hiPath}"`);
  hi = hi.replace(/href="\/for-[a-z-]+\.html"/g, `href="${cfg.enPath}"`);

  fs.mkdirSync(path.dirname(path.join(OUT_DIR, cfg.out)), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, cfg.out), hi);

  // English page: reciprocal hreflang, crawlable pill, legacy redirect
  let en = src;
  if (!en.includes('HN_LANG_REDIRECT')) en = en.replace('</head>', redirect(cfg));
  en = fixHreflang(en, cfg);
  en = en.replace(PILL_RE, pill(cfg, 'en'));
  en = fixPillCss(en);
  en = neutralise(en);
  en = en.replace(/href="[^"]*\?lang=hi"/g, `href="${cfg.hiPath}"`);
  fs.writeFileSync(path.join(OUT_DIR, cfg.src), en);

  const body = hi.split('<body')[1].replace(/<script[\s\S]*?<\/script>/g, '');
  const dev = (body.match(/[\u0900-\u097F]/g) || []).length;
  console.log(`    ${dev} Devanagari chars in static HTML  ${dev > 2000 ? '✓' : '✗ CHECK THIS'}`);
  built++;
}

/* ── sitemap ─────────────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().slice(0, 10);
const PAIRS = PAGES.filter(p => fs.existsSync(p.src)).map(p => ({ en: p.enPath, hi: p.hiPath }));
const OTHERS = ['/cafe-billing-software', '/restaurant-pos', '/grocery-billing-software',
                '/kirana-billing-app', '/sweet-shop-billing-software', '/about'];

const alt = (en, hi) => `
    <xhtml:link rel="alternate" hreflang="en-in" href="${ORIGIN}${en}"/>
    <xhtml:link rel="alternate" hreflang="hi-in" href="${ORIGIN}${hi}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${en}"/>`;

const urls = [];
for (const p of PAIRS) {
  urls.push(`  <url>\n    <loc>${ORIGIN}${p.en}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>1.0</priority>${alt(p.en, p.hi)}\n  </url>`);
  urls.push(`  <url>\n    <loc>${ORIGIN}${p.hi}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>0.9</priority>${alt(p.en, p.hi)}\n  </url>`);
}
for (const u of OTHERS)
  urls.push(`  <url>\n    <loc>${ORIGIN}${u}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>0.8</priority>\n  </url>`);

fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by build-hi.js. hreflang hi-in is emitted ONLY for pages that
     have a real Hindi twin. Do not hand-edit; it will be overwritten. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`);

console.log(`\n  ─────────────────────`);
console.log(`  ${built} Hindi page(s) built · sitemap.xml: ${PAIRS.length * 2 + OTHERS.length} URLs\n`);
