#!/usr/bin/env node
/**
 * build-hindi.js — Generate Hindi versions of HisaabNow vertical pages
 *
 *   Usage:
 *     npm install cheerio
 *     node build-hindi.js
 *
 * For each page in ALL_VERTICALS with a PAGE_META entry, this reads the
 * English source HTML, extracts its inline I18N object, replaces all
 * [data-i18n] elements with Hindi values, translates meta tags and the
 * JSON-LD @graph schema, and writes the Hindi version to /hi/{page}.
 *
 * The Hindi files are byte-different from English (Hindi as the first
 * byte of HTML), which is what Google needs for proper Hindi indexation
 * — distinct from the runtime JS toggle that swaps language client-side.
 *
 * To add a new vertical: add an entry to PAGE_META below.
 * To update content: edit the English source file, re-run this script,
 * commit both the source and /hi/ output.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cheerio = require('cheerio');

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://hisaabnow.com';

// All vertical pages we generate (used for cross-link rewriting too)
const ALL_VERTICALS = [
  'for-salons.html',
  'for-cafes.html',
  'for-restaurants.html',
  'for-sweet-shops.html',
  'for-grocery-stores.html'
];

// PAGE_META — Hindi translations for things NOT in the page's inline i18n object.
// The i18n object already covers visible UI text; this config covers:
//   - <title>, meta description, og:image:alt
//   - JSON-LD schema descriptions (Organization, SoftwareApplication, Service, ItemList, etc.)
//   - Breadcrumb crumbs
//
// To add a new vertical: copy the for-salons.html block, change all values to that vertical's
// Hindi equivalents, key it by the source filename.
const PAGE_META = {
  'for-salons.html': {
    titleHi: 'सैलून POS और बिलिंग सॉफ़्टवेयर भारत · स्टाइलिस्ट कमीशन · HisaabNow',
    descHi: 'भारतीय सैलून और बार्बर शॉप के लिए POS बिलिंग ऐप। हर सर्विस का असली मुनाफ़ा, स्टाइलिस्ट कमीशन, दोबारा आने वाले ग्राहक — सब ट्रैक। हिंदी वॉइस बिलिंग। मुफ़्त स्टार्टर प्लान।',
    ogImageAltHi: 'HisaabNow सैलून POS ऐप — भारतीय सैलून के लिए हर सर्विस का असली मुनाफ़ा, स्टाइलिस्ट कमीशन और AI इनसाइट ट्रैक करें',

    // Breadcrumb
    breadcrumbSiteHi: 'HisaabNow',
    breadcrumbCurrentHi: 'सैलून के लिए POS ऐप',

    // Organization
    orgDescHi: 'भारत के 6 करोड़+ छोटे और सूक्ष्म बिज़नेस मालिकों के लिए POS और बिलिंग सॉफ़्टवेयर — सैलून, किराना, कैफ़े, रेस्तरां, मिठाई की दुकानें।',

    // SoftwareApplication
    appNameHi: 'सैलून के लिए HisaabNow',
    appDescHi: 'भारतीय सैलून के लिए POS बिलिंग ऐप। मार्जिन के साथ सर्विस कैटलॉग, स्टाइलिस्ट कमीशन ट्रैकिंग, दोबारा आने वाले ग्राहक अलर्ट, पीक टाइम इनसाइट।',
    audienceTypeHi: 'भारत में सैलून मालिक',

    // Service
    serviceTypeHi: 'सैलून के लिए POS बिलिंग और मैनेजमेंट',
    serviceNameHi: 'HisaabNow सैलून POS',
    serviceDescHi: 'भारत में सैलून के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।',

    // Pricing
    aggregateOfferDescHi: 'मुफ़्त स्टार्टर प्लान; ग्रोथ ₹499/महीना; बिज़नेस ₹1,499/महीना।',

    // ItemList of plans
    itemListNameHi: 'HisaabNow सैलून POS प्लान तुलना',
    itemListDescHi: 'भारतीय सैलून, बार्बर शॉप और ब्यूटी पार्लर के लिए HisaabNow स्टार्टर (मुफ़्त), ग्रोथ (₹499/महीना), और बिज़नेस (₹1,499/महीना) प्लान की तुलना करें।',

    // Individual plans (in order: Starter, Growth, Business)
    plan1NameHi: 'HisaabNow स्टार्टर',
    plan1DescHi: 'नई दुकानों के लिए हमेशा मुफ़्त सैलून POS प्लान — मोबाइल ऐप, बिलिंग और GST इनवॉइस, बेसिक इन्वेंट्री, बेसिक ग्राहक लिस्ट।',
    plan2NameHi: 'HisaabNow ग्रोथ',
    plan2DescHi: 'छोटे बिज़नेस और सैलून के लिए ₹499/महीना सैलून POS प्लान — डेस्कटॉप पैनल, खर्च और मुनाफ़ा ट्रैकिंग, WhatsApp रसीदें, स्टाफ़ मैनेजमेंट और कमीशन, अपॉइंटमेंट बुकिंग, AI इनसाइट शामिल।',
    plan3NameHi: 'HisaabNow बिज़नेस',
    plan3DescHi: 'गंभीर बिज़नेस के लिए ₹1,499/महीना सैलून POS प्लान — पूरा डेस्कटॉप एक्सेस, मल्टी-यूज़र लॉगिन, ब्रांच मैनेजमेंट, एडवांस्ड एनालिटिक्स, प्रायोरिटी सपोर्ट शामिल।'
  }

  // ───────────────── ADD OTHER VERTICALS HERE ─────────────────
  // 'for-cafes.html': {
  //   titleHi: '...',
  //   descHi: '...',
  //   ... (copy the structure above and translate)
  // },
  // 'for-restaurants.html': { ... },
  // 'for-sweet-shops.html':  { ... },
  // 'for-grocery-stores.html': { ... },
};

// ─────────────────────────────────────────────────────────────
// PATHS
// ─────────────────────────────────────────────────────────────

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'hi');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Parse the inline `const I18N = { en: {...}, hi: {...} };` from the page
 * by extracting the JS source and evaluating it in a Node vm sandbox.
 */
function loadI18N(html) {
  const re = /const\s+I18N\s*=\s*(\{[\s\S]*?\n\};)/;
  const m = html.match(re);
  if (!m) throw new Error('Could not find "const I18N = { ... };" in source HTML');

  const sandbox = { result: null };
  vm.createContext(sandbox);
  const expr = 'result = ' + m[1].replace(/;\s*$/, '');
  vm.runInContext(expr, sandbox);
  if (!sandbox.result) throw new Error('I18N evaluated to falsy value');
  return sandbox.result;
}

/** Strip HTML tags from a string (for JSON-LD plain-text fields). */
function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Mutate the JSON-LD @graph in-place, translating relevant fields to Hindi. */
function translateSchema(schema, hi, pageName, meta) {
  const hiUrl = `${BASE_URL}/hi/${pageName}`;
  const graph = schema['@graph'] || [];

  for (const item of graph) {
    const t = item['@type'];

    if (t === 'Organization') {
      if (meta.orgDescHi) item.description = meta.orgDescHi;
    }

    else if (t === 'WebPage') {
      item['@id'] = hiUrl + '#page';
      item.url = hiUrl;
      item.name = meta.titleHi;
      item.description = meta.descHi;
      item.inLanguage = 'hi-IN';
    }

    else if (t === 'SoftwareApplication') {
      item.url = hiUrl;
      if (meta.appNameHi) item.name = meta.appNameHi;
      if (meta.appDescHi) item.description = meta.appDescHi;
      if (item.audience && meta.audienceTypeHi) {
        item.audience.audienceType = meta.audienceTypeHi;
      }
      if (item.offers && item.offers['@type'] === 'AggregateOffer' && meta.aggregateOfferDescHi) {
        // AggregateOffer doesn't have a description field by spec, but offer-level descriptions
        // inside the nested offers array can be translated if needed (kept as-is for now).
      }
    }

    else if (t === 'Service') {
      if (meta.serviceTypeHi) item.serviceType = meta.serviceTypeHi;
      if (meta.serviceNameHi) item.name = meta.serviceNameHi;
      if (meta.serviceDescHi) item.description = meta.serviceDescHi;
      if (item.audience && meta.audienceTypeHi) {
        item.audience.audienceType = meta.audienceTypeHi;
      }
      if (item.offers && meta.aggregateOfferDescHi) {
        item.offers.description = meta.aggregateOfferDescHi;
      }
    }

    else if (t === 'ItemList') {
      item['@id'] = hiUrl + '#plans';
      if (meta.itemListNameHi) item.name = meta.itemListNameHi;
      if (meta.itemListDescHi) item.description = meta.itemListDescHi;
      if (item.itemListElement) {
        const plans = [
          { name: meta.plan1NameHi, desc: meta.plan1DescHi },
          { name: meta.plan2NameHi, desc: meta.plan2DescHi },
          { name: meta.plan3NameHi, desc: meta.plan3DescHi }
        ];
        item.itemListElement.forEach((listItem, idx) => {
          const pt = plans[idx];
          if (!pt || !listItem.item) return;
          if (pt.name) listItem.item.name = pt.name;
          if (pt.desc) listItem.item.description = pt.desc;
          // Plan offer URLs should also point to Hindi pricing anchor
          if (listItem.item.offers && listItem.item.offers.url) {
            listItem.item.offers.url = hiUrl + '#pricing';
          }
        });
      }
    }

    else if (t === 'BreadcrumbList') {
      item['@id'] = hiUrl + '#breadcrumb';
      if (item.itemListElement) {
        item.itemListElement.forEach((b, i) => {
          if (i === 0 && meta.breadcrumbSiteHi) b.name = meta.breadcrumbSiteHi;
          if (i === 1) {
            if (meta.breadcrumbCurrentHi) b.name = meta.breadcrumbCurrentHi;
            b.item = hiUrl;
          }
        });
      }
    }

    else if (t === 'FAQPage') {
      item['@id'] = hiUrl + '#faq';
      if (item.mainEntity) {
        item.mainEntity.forEach((qa, idx) => {
          const qKey = `faq.q${idx + 1}`;
          const aKey = `faq.a${idx + 1}`;
          if (hi[qKey]) qa.name = stripTags(hi[qKey]);
          if (hi[aKey] && qa.acceptedAnswer) {
            qa.acceptedAnswer.text = stripTags(hi[aKey]);
          }
        });
      }
    }
  }
}

/** Generate a single Hindi page from its English source. */
function buildHindiPage(srcPath, outPath, meta) {
  const srcHtml = fs.readFileSync(srcPath, 'utf8');
  const $ = cheerio.load(srcHtml, { decodeEntities: false, xmlMode: false });
  const pageName = path.basename(srcPath);
  const i18n = loadI18N(srcHtml);
  const hi = i18n.hi;
  if (!hi) throw new Error('No "hi" section in i18n object');

  // 1. Document root — set Hindi as default
  $('html').attr('lang', 'hi-IN').attr('data-lang', 'hi');

  // 2. <title>
  $('title').text(meta.titleHi);

  // 3. Meta tags (description, OG, Twitter)
  $('meta[name="description"]').attr('content', meta.descHi);
  $('meta[property="og:title"]').attr('content', meta.titleHi);
  $('meta[property="og:description"]').attr('content', meta.descHi);
  $('meta[property="og:locale"]').attr('content', 'hi_IN');
  $('meta[property="og:locale:alternate"]').attr('content', 'en_IN');
  $('meta[property="og:url"]').attr('content', `${BASE_URL}/hi/${pageName}`);
  $('meta[property="og:image:alt"]').attr('content', meta.ogImageAltHi);
  $('meta[name="twitter:title"]').attr('content', meta.titleHi);
  $('meta[name="twitter:description"]').attr('content', meta.descHi);
  $('meta[name="twitter:image:alt"]').attr('content', meta.ogImageAltHi);

  // 4. Canonical + hreflang
  $('link[rel="canonical"]').attr('href', `${BASE_URL}/hi/${pageName}`);
  $('link[rel="alternate"][hreflang="en-in"]').attr('href', `${BASE_URL}/${pageName}`);
  $('link[rel="alternate"][hreflang="hi-in"]').attr('href', `${BASE_URL}/hi/${pageName}`);
  $('link[rel="alternate"][hreflang="x-default"]').attr('href', `${BASE_URL}/${pageName}`);

  // 5. [data-i18n] → swap inner HTML to Hindi value
  let i18nSwapped = 0;
  $('[data-i18n]').each((_, el) => {
    const key = $(el).attr('data-i18n');
    if (hi[key] !== undefined) {
      $(el).html(String(hi[key]));
      i18nSwapped++;
    }
  });

  // 6. [data-i18n-placeholder] → set placeholder attribute
  $('[data-i18n-placeholder]').each((_, el) => {
    const key = $(el).attr('data-i18n-placeholder');
    if (hi[key] !== undefined) {
      $(el).attr('placeholder', String(hi[key]));
    }
  });

  // 7. Rewrite internal vertical links to /hi/ prefix
  ALL_VERTICALS.forEach(slug => {
    $(`a[href="/${slug}"]`).attr('href', `/hi/${slug}`);
    $(`a[href^="/${slug}?"]`).each((_, el) => $(el).attr('href', `/hi/${slug}`));
  });

  // 8. Footer language switcher — Hindi page's "View in English" link → English URL
  $('.foot-lang-hi a').attr('href', `/${pageName}`);
  $('.foot-lang-en a').attr('href', `/${pageName}?lang=hi`); // hidden by CSS on Hindi pages but kept consistent

  // 9. Set active language toggle in nav
  $('[data-lang-btn="en"]').removeClass('active');
  $('[data-lang-btn="hi"]').addClass('active');

  // 10. JSON-LD schema translation
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    let schema;
    try {
      schema = JSON.parse(raw);
    } catch (e) {
      console.warn(`  ⚠️  Could not parse JSON-LD: ${e.message}`);
      return;
    }
    translateSchema(schema, hi, pageName, meta);
    $(el).text('\n' + JSON.stringify(schema, null, 2) + '\n');
  });

  // 11. Build-time stamp comment at the top
  const buildDate = new Date().toISOString().slice(0, 10);
  const stamp = `<!-- Generated Hindi version — built from /${pageName} on ${buildDate}. DO NOT EDIT DIRECTLY. Edit the source English file and re-run build-hindi.js. -->`;
  let outHtml = $.html();
  outHtml = outHtml.replace(/(<!DOCTYPE html>)/i, `$1\n${stamp}`);

  // 12. Write
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, outHtml, 'utf8');

  return { i18nSwapped };
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

console.log('HisaabNow Hindi build\n──────────────────────');

let built = 0;
let skipped = 0;

for (const slug of ALL_VERTICALS) {
  const src = path.join(ROOT, slug);
  const out = path.join(OUT_DIR, slug);

  if (!fs.existsSync(src)) {
    console.warn(`⚠  Source not found:  ${slug}  — skipping`);
    skipped++;
    continue;
  }

  const meta = PAGE_META[slug];
  if (!meta) {
    console.warn(`⚠  No PAGE_META for:  ${slug}  — add a config block in build-hindi.js, then re-run`);
    skipped++;
    continue;
  }

  process.stdout.write(`→ ${slug}  ... `);
  try {
    const r = buildHindiPage(src, out, meta);
    console.log(`✓ ${r.i18nSwapped} i18n keys swapped  →  hi/${slug}`);
    built++;
  } catch (err) {
    console.log(`✗`);
    console.error(`   ${err.message}`);
    skipped++;
  }
}

console.log('──────────────────────');
console.log(`${built} built · ${skipped} skipped\n`);
