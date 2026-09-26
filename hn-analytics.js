/* HisaabNow site analytics — one script for every page that doesn't already
   carry GA4 (product pages, Hindi pages, blog, tools, comparison pages).
   Loads GA4 (same property as the homepage), tracks the actions that lead to
   trials, and tags every link to the app with the page it came from, so app
   sign-ins and first bills can be traced back to the page that sent them. */
(function () {
  'use strict';
  var GA_ID = 'G-QZ3LYFSXX1';
  var path = location.pathname.replace(/\.html$/, '') || '/';
  var lang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2);

  // Page type + slug: /hi/tools/gst-calculator → type "tools", slug "gst-calculator", lang hi
  var parts = path.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  if (parts[0] === 'hi') parts.shift();
  var type = parts.length === 0 ? 'home' : (['blog', 'tools', 'compare'].indexOf(parts[0]) >= 0 ? parts[0] : 'product');
  var slug = (type === 'product' ? parts[0] : parts[1]) || (type === 'home' ? 'home' : type + '-index');
  var campaign = (lang === 'hi' ? 'hi-' : '') + slug;

  // 1. GA4 — load once; cross-domain linker keeps the visit joined into the app.
  if (typeof window.gtag !== 'function') {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: true,
      page_lang: lang,
      content_group: type,
      linker: { domains: ['hisaabnow.com', 'app.hisaabnow.com'] },
    });
  }
  function track(name, params) {
    try {
      var p = params || {};
      p.page_lang = lang; p.page_type = type; p.page_slug = slug;
      window.gtag('event', name, p);
    } catch (e) { /* never break the page */ }
  }
  function where(el) {
    return el.closest('nav') ? 'nav' : el.closest('footer') ? 'footer' : el.closest('.hero, header') ? 'hero' : el.closest('.cta, aside') ? 'cta_box' : 'body';
  }

  function init() {
    // 2. Tag app links with their source page (keeps any UTM already present).
    document.querySelectorAll('a[href*="app.hisaabnow.com"]').forEach(function (a) {
      try {
        var u = new URL(a.href);
        if (!u.searchParams.get('utm_source')) {
          u.searchParams.set('utm_source', 'website');
          u.searchParams.set('utm_medium', type);
          u.searchParams.set('utm_campaign', campaign);
        }
        if (!u.searchParams.get('utm_content')) u.searchParams.set('utm_content', where(a));
        a.href = u.toString();
      } catch (e) { /* leave link as is */ }
      a.addEventListener('click', function () { track('app_cta_clicked', { label: (a.textContent || '').trim().slice(0, 40), location: where(a) }); });
    });

    // 3. WhatsApp clicks
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      a.addEventListener('click', function () { track('whatsapp_click', { location: where(a) }); });
    });

    // 4. Product-page lead form ("Try free" → WhatsApp). Counted as a lead.
    var form = document.getElementById('lead-form');
    if (form) {
      form.addEventListener('submit', function () {
        var biz = form.querySelector('[name="business"]');
        track('generate_lead', { form: 'product_lead_form', business: biz ? biz.value : '' });
      });
    }

    // 5. Free tools usage (one event per action per page view)
    var once = {};
    function tool(action, tname) { var k = tname + action; if (once[k]) return; once[k] = 1; track('tool_used', { tool: tname, action: action }); }
    var bind = function (id, ev, action, tname) { var el = document.getElementById(id); if (el) el.addEventListener(ev, function () { tool(action, tname); }); };
    bind('inv-make', 'click', 'create_invoice', 'gst_invoice');
    bind('inv-print', 'click', 'print_invoice', 'gst_invoice');
    bind('gc-amount', 'input', 'calculate', 'gst_calculator');
    bind('mc-cost', 'input', 'calculate', 'margin_calculator');
    bind('mc-price', 'input', 'calculate', 'margin_calculator');

    // 6. Engaged reader
    var done75 = false;
    window.addEventListener('scroll', function () {
      if (done75) return;
      if ((window.scrollY + window.innerHeight) / document.body.scrollHeight >= 0.75) { done75 = true; track('scroll_75', {}); }
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
