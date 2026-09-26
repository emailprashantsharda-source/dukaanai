/* HisaabNow free tools — shared logic (GST calculator, GST invoice generator,
   profit margin calculator). Runs entirely in the browser; nothing is sent
   anywhere. Language strings come from window.HN_T (set on each page). */
(function () {
  'use strict';
  var T = window.HN_T || {};
  function t(k, d) { return T[k] || d || k; }

  // ── helpers ──────────────────────────────────────────────────────────────
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[,\s₹]/g, '')); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function inr(n) {
    return '₹' + r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) { return (Math.round(n * 100) / 100).toLocaleString('en-IN') + '%'; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  // Indian numbering words: "One Lakh Twenty Thousand Five Hundred Rupees and Fifty Paise Only"
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
  function three(n) { var h = Math.floor(n / 100), rest = n % 100; return (h ? ONES[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? two(rest) : ''); }
  function words(n) {
    n = Math.floor(n);
    if (n === 0) return 'Zero';
    var out = [], crore = Math.floor(n / 10000000); n %= 10000000;
    var lakh = Math.floor(n / 100000); n %= 100000;
    var thousand = Math.floor(n / 1000); n %= 1000;
    if (crore) out.push(words(crore) + ' Crore');
    if (lakh) out.push(two(lakh) + ' Lakh');
    if (thousand) out.push(two(thousand) + ' Thousand');
    if (n) out.push(three(n));
    return out.join(' ');
  }
  function amountInWords(amount) {
    var rupees = Math.floor(amount + 1e-9), paise = Math.round((amount - rupees) * 100);
    if (paise === 100) { rupees += 1; paise = 0; }
    return 'Rupees ' + words(rupees) + (paise ? ' and ' + two(paise) + ' Paise' : '') + ' Only';
  }

  // GSTIN: 2-digit state code + PAN + entity no. + Z + mod-36 check character.
  var CP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function gstinCheckChar(g14) {
    var factor = 2, sum = 0;
    for (var i = g14.length - 1; i >= 0; i--) {
      var d = CP.indexOf(g14[i]) * factor;
      factor = factor === 2 ? 1 : 2;
      sum += Math.floor(d / 36) + (d % 36);
    }
    return CP[(36 - (sum % 36)) % 36];
  }
  function checkGstin(g) {
    g = String(g || '').trim().toUpperCase();
    if (!g) return { ok: true, empty: true };
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, msg: t('gstinFormat', 'GSTIN should be 15 characters: 2-digit state code + 10-character PAN + 3 more') };
    if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, msg: t('gstinChecksum', 'This GSTIN has a typo — the last character does not match') };
    var st = STATES[g.slice(0, 2)];
    if (!st) return { ok: false, msg: t('gstinState', 'Unknown state code in GSTIN') };
    return { ok: true, state: g.slice(0, 2), stateName: st };
  }
  var STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };
  window.HN_TOOLS = { amountInWords: amountInWords, checkGstin: checkGstin, gstinCheckChar: gstinCheckChar, STATES: STATES, r2: r2 };

  function fillStates(sel, selected) {
    if (!sel) return;
    sel.innerHTML = '<option value="">' + esc(t('selectState', 'Select state')) + '</option>' + Object.keys(STATES).map(function (c) {
      return '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' + c + ' – ' + esc(STATES[c]) + '</option>';
    }).join('');
  }

  // ── GST calculator ───────────────────────────────────────────────────────
  function initGstCalc() {
    var form = $('gst-calc'); if (!form) return;
    var mode = 'add', rate = 18, supply = 'intra';
    function setSeg(groupId, attr, val) {
      form.querySelectorAll('#' + groupId + ' button').forEach(function (b) { b.classList.toggle('on', b.getAttribute(attr) === String(val)); });
    }
    function calc() {
      var amt = num($('gc-amount').value);
      var custom = $('gc-rate-custom').value;
      var r = custom !== '' ? num(custom) : rate;
      var base, tax, total;
      if (mode === 'add') { base = amt; tax = amt * r / 100; total = amt + tax; }
      else { total = amt; base = amt * 100 / (100 + r); tax = amt - base; }
      base = r2(base); tax = r2(tax); total = r2(total);
      var half = r2(tax / 2);
      $('gc-base').textContent = inr(base);
      $('gc-tax').textContent = inr(tax) + ' (' + pct(r) + ')';
      $('gc-total').textContent = inr(total);
      $('gc-split').innerHTML = supply === 'intra'
        ? 'CGST ' + pct(r / 2) + ': <b>' + inr(half) + '</b> &nbsp;+&nbsp; SGST ' + pct(r / 2) + ': <b>' + inr(r2(tax - half)) + '</b>'
        : 'IGST ' + pct(r) + ': <b>' + inr(tax) + '</b>';
      $('gc-words').textContent = amountInWords(total);
    }
    form.querySelectorAll('#gc-mode button').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); setSeg('gc-mode', 'data-mode', mode); calc(); }); });
    form.querySelectorAll('#gc-rates button').forEach(function (b) { b.addEventListener('click', function () { rate = num(b.getAttribute('data-rate')); $('gc-rate-custom').value = ''; setSeg('gc-rates', 'data-rate', rate); calc(); }); });
    form.querySelectorAll('#gc-supply button').forEach(function (b) { b.addEventListener('click', function () { supply = b.getAttribute('data-supply'); setSeg('gc-supply', 'data-supply', supply); calc(); }); });
    $('gc-amount').addEventListener('input', calc);
    $('gc-rate-custom').addEventListener('input', function () { setSeg('gc-rates', 'data-rate', 'none'); calc(); });
    calc();
  }

  // ── Profit margin calculator ─────────────────────────────────────────────
  function initMargin() {
    var box = $('margin-calc'); if (!box) return;
    var mode = 'price';
    function seg(val) { box.querySelectorAll('#mc-mode button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === val); }); }
    function calc() {
      var cost = num($('mc-cost').value);
      $('mc-price-row').style.display = mode === 'price' ? '' : 'none';
      $('mc-target-row').style.display = mode === 'target' ? '' : 'none';
      var price, profit, margin, markup;
      if (mode === 'price') {
        price = num($('mc-price').value);
      } else {
        var m = num($('mc-target').value);
        price = m >= 100 ? 0 : cost / (1 - m / 100);
      }
      profit = price - cost;
      margin = price > 0 ? profit / price * 100 : 0;
      markup = cost > 0 ? profit / cost * 100 : 0;
      $('mc-out-price').textContent = inr(price);
      $('mc-out-profit').textContent = inr(profit);
      $('mc-out-margin').textContent = pct(margin);
      $('mc-out-markup').textContent = pct(markup);
      var g = num($('mc-gst').value);
      $('mc-out-mrp').textContent = inr(price * (1 + g / 100));
      $('mc-note').textContent = profit < 0 ? t('loss', 'You are selling below cost — this is a loss on every sale.') : '';
    }
    box.querySelectorAll('#mc-mode button').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); seg(mode); calc(); }); });
    ['mc-cost', 'mc-price', 'mc-target', 'mc-gst'].forEach(function (id) { $(id).addEventListener('input', calc); });
    calc();
  }

  // ── GST invoice generator ────────────────────────────────────────────────
  function initInvoice() {
    var root = $('inv-app'); if (!root) return;
    var rows = $('inv-items');
    var RATES = [0, 5, 18, 40];

    function addRow(it) {
      it = it || { desc: '', hsn: '', qty: 1, unit: 'Nos', price: '', gst: 18 };
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input class="i-desc" placeholder="' + esc(t('itemPh', 'Item or service')) + '" value="' + esc(it.desc) + '"></td>' +
        '<td><input class="i-hsn" placeholder="HSN/SAC" value="' + esc(it.hsn) + '" inputmode="numeric"></td>' +
        '<td><input class="i-qty" type="number" min="0" step="any" value="' + esc(it.qty) + '"></td>' +
        '<td><input class="i-unit" value="' + esc(it.unit) + '"></td>' +
        '<td><input class="i-price" type="number" min="0" step="any" placeholder="0.00" value="' + esc(it.price) + '"></td>' +
        '<td><select class="i-gst">' + RATES.map(function (r) { return '<option value="' + r + '"' + (Number(it.gst) === r ? ' selected' : '') + '>' + r + '%</option>'; }).join('') + '</select></td>' +
        '<td class="i-amt">₹0.00</td>' +
        '<td><button type="button" class="i-del" aria-label="' + esc(t('remove', 'Remove')) + '">×</button></td>';
      rows.appendChild(tr);
      tr.querySelector('.i-del').addEventListener('click', function () { tr.remove(); update(); });
      tr.querySelectorAll('input,select').forEach(function (el) { el.addEventListener('input', update); el.addEventListener('change', update); });
      update();
    }

    function read() {
      var d = {
        sName: $('s-name').value.trim(), sAddr: $('s-addr').value.trim(), sGstin: $('s-gstin').value.trim().toUpperCase(),
        sState: $('s-state').value, sPhone: $('s-phone').value.trim(),
        bName: $('b-name').value.trim(), bAddr: $('b-addr').value.trim(), bGstin: $('b-gstin').value.trim().toUpperCase(),
        pos: $('b-state').value, no: $('inv-no').value.trim(), date: $('inv-date').value, notes: $('inv-notes').value.trim(),
        items: [],
      };
      rows.querySelectorAll('tr').forEach(function (tr) {
        d.items.push({
          desc: tr.querySelector('.i-desc').value.trim(), hsn: tr.querySelector('.i-hsn').value.trim(),
          qty: num(tr.querySelector('.i-qty').value), unit: tr.querySelector('.i-unit').value.trim(),
          price: num(tr.querySelector('.i-price').value), gst: num(tr.querySelector('.i-gst').value),
        });
      });
      return d;
    }

    function compute(d) {
      var registered = !!d.sGstin;
      var inter = registered && d.sState && d.pos && d.sState !== d.pos;
      var lines = d.items.filter(function (i) { return i.desc || i.price; }).map(function (i) {
        var taxable = r2(i.qty * i.price);
        var rate = registered ? i.gst : 0;
        var tax = r2(taxable * rate / 100);
        return { i: i, taxable: taxable, rate: rate, tax: tax, cgst: inter ? 0 : r2(tax / 2), sgst: inter ? 0 : r2(tax - r2(tax / 2)), igst: inter ? tax : 0, total: r2(taxable + tax) };
      });
      var sum = function (k) { return r2(lines.reduce(function (a, l) { return a + l[k]; }, 0)); };
      var gross = r2(sum('taxable') + sum('tax'));
      var rounded = Math.round(gross);
      var allExempt = lines.length && lines.every(function (l) { return l.rate === 0; });
      return {
        registered: registered, inter: inter, lines: lines,
        taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), tax: sum('tax'),
        gross: gross, roundOff: r2(rounded - gross), grand: rounded,
        title: !registered ? 'Bill' : (allExempt ? 'Bill of Supply' : 'Tax Invoice'),
      };
    }

    function validate(d) {
      var msgs = [];
      var s = checkGstin(d.sGstin), b = checkGstin(d.bGstin);
      $('s-gstin-msg').textContent = s.ok ? (s.empty ? t('noGstinNote', 'No GSTIN? You can\'t charge GST — this will be a plain bill.') : '✓ ' + s.stateName) : s.msg;
      $('s-gstin-msg').className = 'hint' + (s.ok ? '' : ' bad');
      $('b-gstin-msg').textContent = b.ok ? (b.empty ? '' : '✓ ' + b.stateName) : b.msg;
      $('b-gstin-msg').className = 'hint' + (b.ok ? '' : ' bad');
      if (s.ok && !s.empty && s.state && $('s-state').value !== s.state) $('s-state').value = s.state;
      if (b.ok && !b.empty && b.state && !$('b-state').dataset.touched) $('b-state').value = b.state;
      if (!s.ok) msgs.push(s.msg);
      if (!b.ok) msgs.push(b.msg);
      if (d.no.length > 16) msgs.push(t('invNoLong', 'Invoice number can be at most 16 characters.'));
      return msgs;
    }

    function update() {
      var d = read(); validate(d);
      var c = compute(d);
      rows.querySelectorAll('tr').forEach(function (tr, idx) {
        var it = d.items[idx]; var amt = r2(it.qty * it.price);
        tr.querySelector('.i-amt').textContent = inr(amt);
      });
      $('inv-sum').innerHTML =
        '<div><span>' + esc(t('taxableValue', 'Taxable value')) + '</span><b>' + inr(c.taxable) + '</b></div>' +
        (c.registered ? (c.inter ? '<div><span>IGST</span><b>' + inr(c.igst) + '</b></div>'
          : '<div><span>CGST</span><b>' + inr(c.cgst) + '</b></div><div><span>SGST</span><b>' + inr(c.sgst) + '</b></div>') : '') +
        (c.roundOff ? '<div><span>' + esc(t('roundOff', 'Round off')) + '</span><b>' + inr(c.roundOff) + '</b></div>' : '') +
        '<div class="grand"><span>' + esc(t('total', 'Total')) + '</span><b>' + inr(c.grand) + '</b></div>';
      var note = $('inv-gst-note');
      if (note) { var hasRates = d.items.some(function (i) { return i.gst > 0 && (i.desc || i.price); }); note.style.display = (!c.registered && hasRates) ? '' : 'none'; }
      $('inv-supply').textContent = !c.registered ? '' : (c.inter ? t('interState', 'Inter-state sale → IGST') : t('intraState', 'Same-state sale → CGST + SGST'));
      store('hn_inv_seller', { sName: d.sName, sAddr: d.sAddr, sGstin: d.sGstin, sState: d.sState, sPhone: d.sPhone });
    }

    function render() {
      var d = read(); var errs = validate(d); var c = compute(d);
      if (!d.sName) errs.unshift(t('needSeller', 'Add your business name.'));
      if (!c.lines.length) errs.unshift(t('needItem', 'Add at least one item.'));
      if (c.registered && !d.pos) errs.push(t('needPos', 'Select the place of supply (customer\'s state).'));
      if (errs.length) { $('inv-errors').innerHTML = errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join(''); $('inv-errors').style.display = ''; return; }
      $('inv-errors').style.display = 'none';
      var date = d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      var th = c.registered
        ? (c.inter ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>') : '';
      var body = c.lines.map(function (l, k) {
        var taxCells = c.registered
          ? (c.inter ? '<td class="n">' + inr(l.igst) + '<small>' + pct(l.rate) + '</small></td>'
            : '<td class="n">' + inr(l.cgst) + '<small>' + pct(l.rate / 2) + '</small></td><td class="n">' + inr(l.sgst) + '<small>' + pct(l.rate / 2) + '</small></td>') : '';
        return '<tr><td>' + (k + 1) + '</td><td>' + esc(l.i.desc) + '</td>' + (c.registered ? '<td>' + esc(l.i.hsn) + '</td>' : '') +
          '<td class="n">' + esc(l.i.qty) + ' ' + esc(l.i.unit) + '</td><td class="n">' + inr(l.i.price) + '</td><td class="n">' + inr(l.taxable) + '</td>' + taxCells +
          '<td class="n">' + inr(l.total) + '</td></tr>';
      }).join('');
      var posName = d.pos ? STATES[d.pos] + ' (' + d.pos + ')' : '';
      $('inv-preview').innerHTML =
        '<div class="inv-doc">' +
        '<div class="inv-top"><div><div class="inv-biz">' + esc(d.sName) + '</div><div class="inv-small">' + esc(d.sAddr).replace(/\n/g, '<br>') +
        (d.sPhone ? '<br>Ph: ' + esc(d.sPhone) : '') + (d.sGstin ? '<br><b>GSTIN:</b> ' + esc(d.sGstin) : '') + (d.sState ? '<br>State: ' + esc(STATES[d.sState] || '') + ' (' + d.sState + ')' : '') + '</div></div>' +
        '<div class="inv-title"><div>' + c.title + '</div><div class="inv-small">No: <b>' + esc(d.no) + '</b><br>Date: <b>' + esc(date) + '</b></div></div></div>' +
        '<div class="inv-to"><div class="inv-small"><b>Bill to:</b><br>' + esc(d.bName || '—') + '<br>' + esc(d.bAddr).replace(/\n/g, '<br>') +
        (d.bGstin ? '<br><b>GSTIN:</b> ' + esc(d.bGstin) : '') + '</div>' +
        (c.registered ? '<div class="inv-small"><b>Place of supply:</b> ' + esc(posName) + '<br><b>Reverse charge:</b> No</div>' : '') + '</div>' +
        '<table class="inv-table"><thead><tr><th>#</th><th>Description</th>' + (c.registered ? '<th>HSN/SAC</th>' : '') + '<th>Qty</th><th>Rate</th><th>Taxable</th>' + th + '<th>Amount</th></tr></thead><tbody>' + body + '</tbody></table>' +
        '<div class="inv-bottom"><div class="inv-small"><b>Amount in words:</b><br>' + amountInWords(c.grand) + (d.notes ? '<br><br><b>Notes:</b> ' + esc(d.notes).replace(/\n/g, '<br>') : '') + '</div>' +
        '<div class="inv-totals"><div><span>Taxable value</span><b>' + inr(c.taxable) + '</b></div>' +
        (c.registered ? (c.inter ? '<div><span>IGST</span><b>' + inr(c.igst) + '</b></div>' : '<div><span>CGST</span><b>' + inr(c.cgst) + '</b></div><div><span>SGST</span><b>' + inr(c.sgst) + '</b></div>') : '') +
        (c.roundOff ? '<div><span>Round off</span><b>' + inr(c.roundOff) + '</b></div>' : '') +
        '<div class="grand"><span>Total</span><b>' + inr(c.grand) + '</b></div></div></div>' +
        '<div class="inv-sign"><div class="inv-small">For ' + esc(d.sName) + '<br><br><br>Authorised signatory</div></div>' +
        '<div class="inv-foot">Made free with HisaabNow · hisaabnow.com</div>' +
        '</div>';
      $('inv-preview-wrap').style.display = '';
      $('inv-preview-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    fillStates($('s-state')); fillStates($('b-state'));
    $('b-state').addEventListener('change', function () { this.dataset.touched = '1'; update(); });
    var saved = store('hn_inv_seller');
    if (saved) { ['sName', 'sAddr', 'sGstin', 'sState', 'sPhone'].forEach(function (k) { var el = $({ sName: 's-name', sAddr: 's-addr', sGstin: 's-gstin', sState: 's-state', sPhone: 's-phone' }[k]); if (el && saved[k]) el.value = saved[k]; }); }
    if (!$('inv-date').value) $('inv-date').value = new Date().toISOString().slice(0, 10);
    root.querySelectorAll('input,select,textarea').forEach(function (el) { if (!el.closest('#inv-items')) { el.addEventListener('input', update); el.addEventListener('change', update); } });
    $('inv-add').addEventListener('click', function () { addRow(); });
    $('inv-make').addEventListener('click', render);
    $('inv-print').addEventListener('click', function () { window.print(); });
    addRow({ desc: '', hsn: '', qty: 1, unit: 'Nos', price: '', gst: 18 });
  }

  function init() { initGstCalc(); initMargin(); initInvoice(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
