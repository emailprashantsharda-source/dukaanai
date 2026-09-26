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
        'भारत के छोटे व्यापारियों के लिए POS और बिलिंग सॉफ्टवेयर — कैफे, सैलून, रेस्तरां, मिठाई की दुकान और किराना स्टोर। हर बिल पर असली मुनाफा, हिंदी वॉइस बिलिंग और AI बिजनेस इनसाइट्स।',

      /* The five plan Offer descriptions. Previously unmapped, so they were
         served in English inside the Hindi page's JSON-LD. They carry the
         prices, so they belong here — same byte-for-byte key rule applies. */
      "7 days, all King features, no card needed":
        '7 दिन, सभी King फ़ीचर, कार्ड की ज़रूरत नहीं',
      "Single-salon Pro plan, billed monthly":
        'एक दुकान के लिए Pro प्लान, मासिक बिलिंग',
      "Single-salon Pro plan, billed annually — 2 months free (save ₹998)":
        'एक दुकान के लिए Pro प्लान, सालाना बिलिंग — 2 महीने free (₹998 की बचत)',
      "Up to 5 outlets, appointments, customer CRM, staff commissions":
        '5 आउटलेट तक, अपॉइंटमेंट, कस्टमर CRM, स्टाफ़ कमीशन',
      "Up to 5 outlets, billed annually — 2 months free (save ₹1,598)":
        '5 आउटलेट तक, सालाना बिलिंग — 2 महीने free (₹1,598 की बचत)'
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
    // to Trial / Pro ₹499 / King ₹799.
    //
    // WARNING: every key below is matched against the source page BYTE FOR
    // BYTE (see rewriteSchema → `map[v]`). A key that no longer appears in
    // salon-billing-software.html does not error — the string is silently
    // left in English on the Hindi page. So when a price changes in the
    // source schema, the key here MUST change with it, in the same commit.
    schemaText: {
      "POS and billing software for India's 60+ million micro and small business owners — salons, kirana, cafés, restaurants, sweet shops.":
        'भारत के 6 करोड़+ छोटे और सूक्ष्म बिज़नेस मालिकों के लिए POS और बिलिंग सॉफ़्टवेयर — सैलून, किराना, कैफ़े, रेस्तरां, मिठाई की दुकानें।',

      "Salon POS & Billing Software India · Stylist Commission · HisaabNow":
        'सैलून POS और बिलिंग सॉफ़्टवेयर भारत · स्टाइलिस्ट कमीशन · HisaabNow',

      "HisaabNow for Salons": 'सैलून के लिए HisaabNow',

      "POS billing app for Indian salons. Service catalog with margins, Stylist commission tracking, Repeat customer alerts, Peak hour insights.":
        'भारतीय सैलून के लिए POS बिलिंग ऐप। मार्जिन के साथ सर्विस कैटलॉग, स्टाइलिस्ट कमीशन ट्रैकिंग, दोबारा आने वाले ग्राहक अलर्ट, पीक टाइम इनसाइट।',

      "Owners of salons in India": 'भारत में सैलून मालिक',

      "POS billing and management for salons": 'सैलून के लिए POS बिलिंग और मैनेजमेंट',
      "HisaabNow Salons POS": 'HisaabNow सैलून POS',

      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for salons in India.":
        'भारत में सैलून के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।',

      "7-day free trial; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year. Annual = 2 months free.":
        '7 दिन का फ्री ट्रायल; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल। सालाना प्लान में 2 महीने free।',

      "HisaabNow salon POS plan comparison": 'HisaabNow सैलून POS प्लान तुलना',

      "Compare HisaabNow Free Trial (7 days), Pro (₹499/month), and King (₹799/month) plans for Indian salons, barber shops, and beauty parlours.":
        'भारतीय सैलून, बार्बर शॉप और ब्यूटी पार्लर के लिए HisaabNow फ्री ट्रायल (7 दिन), Pro (₹499/महीना) और King (₹799/महीना) प्लान की तुलना करें।',

      "Free Trial": 'फ्री ट्रायल',
      "HisaabNow Free Trial": 'HisaabNow फ्री ट्रायल',

      "7-day free trial — full Pro features, no card needed.":
        '7 दिन का फ्री ट्रायल — सभी Pro फ़ीचर, कार्ड की ज़रूरत नहीं।',

      "7-day free trial with every feature — mobile app, billing & GST invoices, inventory, customer list. No card needed.":
        '7 दिन का फ्री ट्रायल, हर फ़ीचर के साथ — मोबाइल ऐप, बिलिंग और GST इनवॉइस, इन्वेंट्री, ग्राहक लिस्ट। कार्ड की ज़रूरत नहीं।',

      "₹499/month for small businesses & salons — adds desktop panel, expense & profit tracking, WhatsApp receipts, staff management & commission, appointment booking, AI insights.":
        'छोटे बिज़नेस और सैलून के लिए ₹499/महीना — डेस्कटॉप पैनल, खर्च और मुनाफ़ा ट्रैकिंग, WhatsApp रसीदें, स्टाफ़ मैनेजमेंट और कमीशन, अपॉइंटमेंट बुकिंग, AI इनसाइट शामिल।',

      "₹499/month salon POS plan for small businesses & salons — adds desktop panel, expense & profit tracking, WhatsApp receipts, staff management & commission, appointment booking, AI insights.":
        'छोटे बिज़नेस और सैलून के लिए ₹499/महीना सैलून POS प्लान — डेस्कटॉप पैनल, खर्च और मुनाफ़ा ट्रैकिंग, WhatsApp रसीदें, स्टाफ़ मैनेजमेंट और कमीशन, अपॉइंटमेंट बुकिंग, AI इनसाइट शामिल।',

      "₹799/month for serious businesses — adds full desktop access, multi-user login, branch management, advanced analytics, priority support.":
        'गंभीर बिज़नेस के लिए ₹799/महीना — पूरा डेस्कटॉप एक्सेस, मल्टी-यूज़र लॉगिन, ब्रांच मैनेजमेंट, एडवांस्ड एनालिटिक्स, प्रायोरिटी सपोर्ट शामिल।',

      "₹799/month salon POS plan for serious businesses — adds full desktop access, multi-user login, branch management, advanced analytics, priority support.":
        'गंभीर बिज़नेस के लिए ₹799/महीना सैलून POS प्लान — पूरा डेस्कटॉप एक्सेस, मल्टी-यूज़र लॉगिन, ब्रांच मैनेजमेंट, एडवांस्ड एनालिटिक्स, प्रायोरिटी सपोर्ट शामिल।',

      "Salons": 'सैलून के लिए POS ऐप'
    }
  },
  {
    src: 'cafe-billing-software.html',
    out: 'hi/cafe-billing-software.html',
    enPath: '/cafe-billing-software',
    hiPath: '/hi/cafe-billing-software',
    rewriteSchemaUrls: true,
    head: {
      title: "कैफ़े बिलिंग सॉफ्टवेयर और POS भारत | HisaabNow",
      desc: "भारतीय कैफ़े और कॉफ़ी शॉप के लिए बिलिंग सॉफ्टवेयर और POS। रेसिपी कॉस्ट ट्रैकिंग, हिंदी वॉइस बिलिंग, हर कप पर असली मुनाफ़ा। 7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं।",
      ogAlt: "HisaabNow कैफ़े POS — भारतीय कैफ़े के लिए बिलिंग और मुनाफ़ा ट्रैकिंग"
    },
    schemaText: {
      "HisaabNow for Cafés":
        "कैफ़े के लिए HisaabNow",
      "POS billing app for Indian cafés. Recipe builder with auto-cost, Hindi voice billing, Ingredient stock auto-alert, WhatsApp receipts in 2 taps.":
        "भारतीय कैफ़े के लिए POS बिलिंग ऐप। ऑटो-कॉस्ट के साथ रेसिपी बिल्डर, हिंदी वॉइस बिलिंग, इंग्रेडिएंट स्टॉक अलर्ट, 2 टैप में WhatsApp रसीद।",
      "7-day free trial, no card needed; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year. Annual = 2 months free.":
        "7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल। सालाना प्लान में 2 महीने free।",
      "India":
        "भारत",
      "Owners of cafés in India":
        "भारत में कैफ़े मालिक",
      "POS billing and management for cafés":
        "कैफ़े के लिए POS बिलिंग और मैनेजमेंट",
      "HisaabNow Cafés POS":
        "HisaabNow कैफ़े POS",
      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for cafés in India.":
        "भारत में कैफ़े के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।",
      "7-day free trial; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year":
        "7 दिन का फ्री ट्रायल; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल",
      "Cafés":
        "कैफ़े"
    }
  },
  {
    src: 'restaurant-pos.html',
    out: 'hi/restaurant-pos.html',
    enPath: '/restaurant-pos',
    hiPath: '/hi/restaurant-pos',
    rewriteSchemaUrls: true,
    head: {
      title: "रेस्टोरेंट POS सिस्टम और बिलिंग सॉफ्टवेयर | HisaabNow",
      desc: "भारतीय रेस्टोरेंट और ढाबों के लिए क्लाउड-बेस्ड POS सिस्टम। टेबल-वाइज़ बिलिंग, KOT प्रिंटिंग, हिंदी वॉइस बिलिंग और हर डिश पर असली मुनाफ़ा। 7 दिन का फ्री ट्रायल।",
      ogAlt: "HisaabNow रेस्टोरेंट POS — टेबल बिलिंग और हर डिश का मुनाफ़ा"
    },
    schemaText: {
      "HisaabNow for Restaurants":
        "रेस्टोरेंट के लिए HisaabNow",
      "Restaurant POS system & billing software for Indian restaurants. Table-wise billing, recipe builder with auto-cost, Hindi voice billing, ingredient stock auto-alert, WhatsApp receipts in 2 taps.":
        "भारतीय रेस्टोरेंट के लिए POS सिस्टम और बिलिंग सॉफ्टवेयर। टेबल-वाइज़ बिलिंग, ऑटो-कॉस्ट रेसिपी बिल्डर, हिंदी वॉइस बिलिंग, इंग्रेडिएंट स्टॉक अलर्ट, 2 टैप में WhatsApp रसीद।",
      "7-day free trial, no card needed; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year. Annual = 2 months free.":
        "7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल। सालाना प्लान में 2 महीने free।",
      "India":
        "भारत",
      "Restaurant owners in India":
        "भारत में रेस्टोरेंट मालिक",
      "Restaurant POS system and billing software":
        "रेस्टोरेंट POS सिस्टम और बिलिंग सॉफ्टवेयर",
      "HisaabNow Restaurant POS":
        "HisaabNow रेस्टोरेंट POS",
      "Restaurant POS system, table-wise billing, GST invoicing, recipe-based profit tracking, and customer management for restaurants in India.":
        "भारत में रेस्टोरेंट के लिए POS सिस्टम, टेबल-वाइज़ बिलिंग, GST इनवॉइसिंग, रेसिपी के हिसाब से मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।",
      "7-day free trial; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year":
        "7 दिन का फ्री ट्रायल; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल",
      "Restaurants":
        "रेस्टोरेंट"
    }
  },
  {
    src: 'grocery-billing-software.html',
    out: 'hi/grocery-billing-software.html',
    enPath: '/grocery-billing-software',
    hiPath: '/hi/grocery-billing-software',
    rewriteSchemaUrls: true,
    head: {
      title: "ग्रोसरी बिलिंग सॉफ्टवेयर और POS भारत | HisaabNow",
      desc: "भारतीय किराना, जनरल स्टोर और मिनी-मार्ट के लिए ग्रोसरी बिलिंग सॉफ्टवेयर। बारकोड स्कैन, WhatsApp रिमाइंडर वाला उधार खाता, लो-स्टॉक अलर्ट, हर आइटम पर असली मुनाफ़ा। 7 दिन का फ्री ट्रायल।",
      ogAlt: "HisaabNow ग्रोसरी POS — बारकोड बिलिंग, उधार खाता और स्टॉक अलर्ट"
    },
    schemaText: {
      "HisaabNow for Grocery Stores":
        "ग्रोसरी स्टोर के लिए HisaabNow",
      "POS billing app for Indian grocery stores. Barcode scan to bill, Udhaar khaata with auto-WhatsApp, Low-stock alerts on bestsellers, Real margin per SKU.":
        "भारतीय ग्रोसरी स्टोर के लिए POS बिलिंग ऐप। बारकोड स्कैन से बिल, ऑटो-WhatsApp वाला उधार खाता, बेस्टसेलर पर लो-स्टॉक अलर्ट, हर SKU पर असली मार्जिन।",
      "7-day free trial, no card needed; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year. Annual = 2 months free.":
        "7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल। सालाना प्लान में 2 महीने free।",
      "India":
        "भारत",
      "Owners of grocery stores in India":
        "भारत में ग्रोसरी स्टोर मालिक",
      "POS billing and management for grocery stores":
        "ग्रोसरी स्टोर के लिए POS बिलिंग और मैनेजमेंट",
      "HisaabNow Grocery Stores POS":
        "HisaabNow ग्रोसरी स्टोर POS",
      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for grocery stores in India.":
        "भारत में ग्रोसरी स्टोर के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।",
      "7-day free trial; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year":
        "7 दिन का फ्री ट्रायल; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल",
      "Grocery Stores":
        "ग्रोसरी स्टोर"
    }
  },
  {
    src: 'kirana-billing-app.html',
    out: 'hi/kirana-billing-app.html',
    enPath: '/kirana-billing-app',
    hiPath: '/hi/kirana-billing-app',
    rewriteSchemaUrls: true,
    head: {
      title: "किराना बिलिंग ऐप और दुकान मैनेजमेंट सिस्टम | HisaabNow",
      desc: "किराना और सुपरमार्केट के लिए HisaabNow — बारकोड से बिल, ऑटो-WhatsApp रिमाइंडर वाला उधार खाता, स्टॉक अलर्ट और हिंदी वॉइस बिलिंग। 7 दिन फ्री में आज़माएं।",
      ogAlt: "HisaabNow किराना ऐप — बिलिंग, उधार खाता और स्टॉक एक ही ऐप में"
    },
    schemaText: {
      "HisaabNow for Kirana Stores":
        "किराना स्टोर के लिए HisaabNow",
      "Kirana billing app and POS for Indian dukaan owners. Barcode scan to bill, udhaar khaata with auto-WhatsApp reminders, Hindi voice billing, low-stock alerts, real margin per SKU.":
        "भारतीय दुकानदारों के लिए किराना बिलिंग ऐप और POS। बारकोड स्कैन से बिल, ऑटो-WhatsApp रिमाइंडर वाला उधार खाता, हिंदी वॉइस बिलिंग, लो-स्टॉक अलर्ट, हर SKU पर असली मार्जिन।",
      "7-day free trial, no card needed; Pro ₹99/month or ₹990/year; King ₹199/month or ₹1,990/year.":
        "7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं; Pro ₹99/महीना या ₹990/साल; King ₹199/महीना या ₹1,990/साल।",
      "India":
        "भारत",
      "Owners of kirana stores and dukaans in India":
        "भारत में किराना स्टोर और दुकान मालिक",
      "POS billing and management for kirana stores":
        "किराना स्टोर के लिए POS बिलिंग और मैनेजमेंट",
      "HisaabNow Grocery Stores POS":
        "HisaabNow किराना स्टोर POS",
      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for kirana stores and dukaans in India.":
        "भारत में किराना स्टोर और दुकानों के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।",
      "7-day free trial; Pro ₹99/month or ₹990/year; King ₹199/month or ₹1,990/year":
        "7 दिन का फ्री ट्रायल; Pro ₹99/महीना या ₹990/साल; King ₹199/महीना या ₹1,990/साल",
      "Grocery Stores":
        "किराना स्टोर"
    }
  },
  {
    src: 'sweet-shop-billing-software.html',
    out: 'hi/sweet-shop-billing-software.html',
    enPath: '/sweet-shop-billing-software',
    hiPath: '/hi/sweet-shop-billing-software',
    rewriteSchemaUrls: true,
    head: {
      title: "मिठाई की दुकान के लिए बिलिंग सॉफ्टवेयर | HisaabNow",
      desc: "भारतीय मिठाई की दुकानों और हलवाइयों के लिए POS और बिलिंग सॉफ्टवेयर। वज़न के हिसाब से कीमत (किलो/आधा किलो/ग्राम), त्योहार स्टॉक अलर्ट, एक्सपायरी ट्रैकिंग। 7 दिन का फ्री ट्रायल।",
      ogAlt: "HisaabNow मिठाई दुकान POS — वज़न से बिलिंग और एक्सपायरी ट्रैकिंग"
    },
    schemaText: {
      "HisaabNow for Sweet Shops":
        "मिठाई की दुकान के लिए HisaabNow",
      "POS billing app for Indian sweet shops. Weight-based pricing, Festival inventory alerts, Expiry tracking — never waste, Tray-to-bill counter mode.":
        "भारतीय मिठाई की दुकानों के लिए POS बिलिंग ऐप। वज़न के हिसाब से कीमत, त्योहार पर स्टॉक अलर्ट, एक्सपायरी ट्रैकिंग — कोई बर्बादी नहीं, ट्रे-टू-बिल काउंटर मोड।",
      "7-day free trial, no card needed; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year. Annual = 2 months free.":
        "7 दिन का फ्री ट्रायल, कार्ड की ज़रूरत नहीं; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल। सालाना प्लान में 2 महीने free।",
      "India":
        "भारत",
      "Owners of sweet shops in India":
        "भारत में मिठाई की दुकान के मालिक",
      "POS billing and management for sweet shops":
        "मिठाई की दुकान के लिए POS बिलिंग और मैनेजमेंट",
      "HisaabNow Sweet Shops POS":
        "HisaabNow मिठाई दुकान POS",
      "Point-of-sale, billing, GST invoicing, profit tracking, and customer management for sweet shops in India.":
        "भारत में मिठाई की दुकानों के लिए पॉइंट-ऑफ़-सेल, बिलिंग, GST इनवॉइसिंग, मुनाफ़ा ट्रैकिंग और ग्राहक मैनेजमेंट।",
      "7-day free trial; Pro ₹499/month or ₹4,990/year; King ₹799/month or ₹7,990/year":
        "7 दिन का फ्री ट्रायल; Pro ₹499/महीना या ₹4,990/साल; King ₹799/महीना या ₹7,990/साल",
      "Sweet Shops":
        "मिठाई की दुकानें"
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
// Pages with a Hindi twin are listed via PAGES above; only English-only pages go here.
const OTHERS = ['/about'];

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

/* Keep every URL the SEO agent (or you) added that this script doesn't know
   about — blog posts, new landing pages, etc. Before Sep 2026 this script
   rewrote sitemap.xml from the fixed list above and silently dropped them.
   Entries are only kept if their HTML file still exists, so deleting a page
   and re-running this also removes it from the sitemap. */
const SITEMAP_PATH = path.join(OUT_DIR, 'sitemap.xml');
const ownLocs = new Set(urls.map(u => (u.match(/<loc>([^<]+)<\/loc>/) || [])[1]));
let kept = 0, dropped = [];
if (fs.existsSync(SITEMAP_PATH)) {
  const old = fs.readFileSync(SITEMAP_PATH, 'utf8');
  for (const block of old.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    if (!loc || ownLocs.has(loc)) continue;
    let rel = loc.replace(ORIGIN, '').replace(/^\//, '');
    const file = rel === '' ? 'index.html' : rel.endsWith('/') ? rel + 'index.html' : rel + '.html';
    if (!fs.existsSync(path.join(OUT_DIR, file))) { dropped.push(loc); continue; }
    urls.push('  ' + block.trim());
    ownLocs.add(loc);
    kept++;
  }
}

fs.writeFileSync(SITEMAP_PATH,
`<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by build-hi.js. Keeps any extra URLs already in this file
     (blog posts, SEO-agent pages) as long as their HTML file exists. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`);
if (dropped.length) console.log(`  sitemap: removed ${dropped.length} URL(s) whose file no longer exists:\n    ` + dropped.join('\n    '));

console.log(`\n  ─────────────────────`);
console.log(`  ${built} Hindi page(s) built · sitemap.xml: ${urls.length} URLs (${kept} kept from existing sitemap)\n`);
