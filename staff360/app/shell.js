/* HisaabNow Staff360 — standalone web app shell (hisaabnow.com/staff360/app)
 * Firebase login (same project as HisaabNow), App Check, business picker /
 * sign-up, then hands over to staff360.js in STANDALONE mode. No secrets here:
 * the Firebase web config and App Check site key are public by design; every
 * permission is enforced by the staff360* Cloud Functions. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB8v9gYxCg4qBfLl2J08D9TeUVygKVAqC8', authDomain: 'panshopmanager.firebaseapp.com', projectId: 'panshopmanager',
  storageBucket: 'panshopmanager.firebasestorage.app', messagingSenderId: '448042777087', appId: '1:448042777087:web:9b4c4a0bd4dbc425bccfca',
};
export const APPCHECK_SITE_KEY = '6LfZQcYsAAAAAL9TGObuIHv-SllzTi_aHkmNdlnH';

export function initFirebase() {
  const app = initializeApp(FIREBASE_CONFIG);
  try { initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true }); } catch (e) { console.warn('[Staff360] App Check', e); }
  return app;
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TKEY = 's360_tenant';

export function bootApp() {
  const app = initFirebase();
  const auth = getAuth(app);
  const fns = getFunctions(app, 'us-central1');
  window.kfFunctions = fns;
  window.kfCallable = httpsCallable;
  window.STAFF360_STANDALONE = true;
  window.STAFF360_BASE = '/staff360/app/';
  window.HISAABNOW_BUILD = window.STAFF360_BUILD || 's360sa2';
  const call = (name, data) => httpsCallable(fns, name)(data || {}).then((r) => r.data);
  let tenants = [];
  let user = null;

  function screen(html) { $('boot').innerHTML = html; $('boot').hidden = false; }
  function errMsg(e) {
    const code = String((e && e.code) || '').replace('functions/', '');
    if (code === 'unauthenticated') return 'Your session expired. Please log in again.';
    if (/app.?check|appCheck/i.test(String(e && e.message)) || code === 'failed-precondition' && /app check/i.test(String(e && e.message))) return 'Security check failed on this browser. Please refresh the page.';
    if (navigator.onLine === false) return 'You are offline. Connect to the internet and try again.';
    return (e && e.message) || 'Something went wrong';
  }

  function openTenant(t) {
    try { localStorage.setItem(TKEY, t.id); } catch (e) {}
    window.MShop = { getActive: () => ({ shopId: t.id, name: t.name, cardType: 'staff360' }) };
    document.documentElement.setAttribute('data-current-role', t.role === 'employee' ? 'cashier' : t.role);
    $('boot').hidden = true;
    const go = () => { window.Staff360.open('overview'); };
    if (window.Staff360) return go();
    const s = document.createElement('script');
    s.src = '/staff360/app/staff360.js?v=' + encodeURIComponent(window.HISAABNOW_BUILD);
    s.onload = go;
    s.onerror = () => screen('<div class="card"><h2>Could not load Staff360</h2><p>Check your connection and refresh.</p><button class="btn" onclick="location.reload()">Refresh</button></div>');
    document.body.appendChild(s);
  }

  function signup() {
    screen(`<form class="card" id="su"><span class="eyebrow">HisaabNow <b>Staff360</b></span><h2>Set up your business</h2>
      <p>You start on Basic: add your staff and mark attendance. Upgrade any time.</p>
      <label class="fld"><span>Business name</span><input class="in" name="name" required minlength="2" maxlength="60" placeholder="e.g. Sharma Clinic" autocomplete="organization"></label>
      <label class="fld"><span>Type of business</span><select class="in" name="type">
        <option value="retail">Retail shop</option><option value="kirana">Grocery / kirana</option><option value="restaurant">Restaurant / cafe</option>
        <option value="salon">Salon / spa</option><option value="clinic">Clinic</option><option value="office">Office</option><option value="service">Service business</option><option value="other">Other</option></select></label>
      <div id="suerr" role="alert"></div><button class="btn" type="submit">Create my Staff360</button>
      <p class="small">Signed in as ${esc(user.phoneNumber || '')} · <a href="#" id="lo">Log out</a></p></form>`);
    $('lo').onclick = (e) => { e.preventDefault(); signOut(auth); };
    $('su').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target); const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Creating…';
      try {
        const r = await call('staff360CreateOrg', { name: f.get('name'), businessType: f.get('type'), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        try { window.hnEvent && window.hnEvent('staff360_signup', {}); } catch (x) {}
        tenants = [{ id: r.id, name: String(f.get('name')), kind: 'org', role: 'owner' }];
        openTenant(tenants[0]);
      } catch (err) { b.disabled = false; b.textContent = 'Create my Staff360'; $('suerr').innerHTML = `<div class="err">${esc(errMsg(err))}</div>`; }
    };
  }

  function picker() {
    screen(`<div class="card"><span class="eyebrow">HisaabNow <b>Staff360</b></span><h2>Choose a business</h2>
      ${tenants.map((t, i) => `<button class="pick" data-i="${i}"><b>${esc(t.name)}</b><small>${t.role === 'employee' ? 'Staff' : t.role === 'manager' ? 'Manager' : 'Owner'}${t.kind === 'shop' ? ' · HisaabNow shop' : ''}</small></button>`).join('')}
      <p class="small"><a href="#" id="add">+ Set up another business</a> · <a href="#" id="lo">Log out</a></p></div>`);
    document.querySelectorAll('.pick').forEach((b) => { b.onclick = () => openTenant(tenants[+b.dataset.i]); });
    $('add').onclick = (e) => { e.preventDefault(); signup(); };
    $('lo').onclick = (e) => { e.preventDefault(); signOut(auth); };
  }

  async function load() {
    screen('<div class="card"><div class="spin" aria-label="Loading"></div><p>Opening Staff360…</p></div>');
    try {
      tenants = (await call('staff360MyTenants', {})).tenants || [];
    } catch (e) {
      screen(`<div class="card"><h2>Could not open Staff360</h2><p>${esc(errMsg(e))}</p><button class="btn" id="rt">Try again</button><p class="small"><a href="#" id="lo">Log out</a></p></div>`);
      $('rt').onclick = load; $('lo').onclick = (ev) => { ev.preventDefault(); signOut(auth); };
      return;
    }
    if (!tenants.length) return signup();
    const want = new URLSearchParams(location.search).get('t') || (() => { try { return localStorage.getItem(TKEY); } catch (e) { return null; } })();
    const hit = tenants.find((t) => t.id === want);
    if (hit) return openTenant(hit);
    if (tenants.length === 1) return openTenant(tenants[0]);
    return picker();
  }

  function newBusiness() {
    ['s360', 's360e'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
    signup();
  }

  window.STAFF360_SHELL = {
    newBusiness,
    menu() {
      const cur = window.MShop && window.MShop.getActive();
      const bg = document.createElement('div');
      bg.className = 'menu-bg';
      bg.innerHTML = `<div class="menu" role="dialog" aria-modal="true" aria-label="Account"><b>${esc(cur ? cur.name : '')}</b><small>${esc(user && user.phoneNumber || '')}</small>
        ${tenants.filter((t) => !cur || t.id !== cur.shopId).map((t) => `<button data-t="${esc(t.id)}">Switch to ${esc(t.name)}</button>`).join('')}
        <button data-a="new">+ Set up another business</button><button data-a="out">Log out</button><button data-a="x">Close</button></div>`;
      bg.onclick = (e) => {
        const b = e.target.closest('button');
        if (e.target === bg || (b && b.dataset.a === 'x')) return bg.remove();
        if (!b) return;
        if (b.dataset.t) { location.href = '/staff360/app/?t=' + encodeURIComponent(b.dataset.t); }
        if (b.dataset.a === 'out') signOut(auth);
        if (b.dataset.a === 'new') { bg.remove(); newBusiness(); }
      };
      document.body.appendChild(bg);
    },
  };

  onAuthStateChanged(auth, (u) => {
    if (!u) { location.replace('/staff360/login/' + location.search); return; }
    user = u;
    load();
  });
}
