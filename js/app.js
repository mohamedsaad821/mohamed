/* حساباتي — برنامج محاسبة بسيط للمحلات (بيع، شراء، مصاريف، مخزن، رواتب، تقارير)
 * كل البيانات تحفظ على الجهاز نفسه (localStorage) ويمكن أخذ نسخة احتياطية منها. */
'use strict';
(function () {
  const KEY = 'hesabati-db-v1';
  const APP_VERSION = '1.8';
  const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  const EXP_CATS = ['إيجار', 'كهرباء', 'مولدة', 'ماء', 'نقل وتوصيل', 'صيانة', 'إنترنت واتصالات', 'ضيافة', 'أخرى'];
  const UNITS = ['قطعة', 'كارتون', 'علبة', 'كغم', 'لتر', 'متر', 'درزن'];

  /* ---------- Data ---------- */
  function defaults() {
    return {
      settings: { shopName: 'متجري', shopPhone: '', currency: 'د.ع', arabicDigits: false, openingCash: 0, lastBackup: '', invoiceTemplate: true },
      products: [], customers: [], suppliers: [],
      sales: [], purchases: [], expenses: [],
      payments: [], supplierPayments: [],
      employees: [], advances: [], payrolls: [],
      seq: { sale: 0, purchase: 0 }
    };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') return normalize(d);
    } catch (e) { /* ignore */ }
    return defaults();
  }
  function normalize(d) {
    const base = defaults();
    const out = Object.assign(base, d);
    out.settings = Object.assign(defaults().settings, d.settings || {});
    out.seq = Object.assign(defaults().seq, d.seq || {});
    return out;
  }
  let db = load();
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('تعذر حفظ البيانات! يرجى أخذ نسخة احتياطية فوراً.'); }
  }
  // البيانات تحفظ على الجهاز فقط (أوفلاين)
  function save() { saveLocal(); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- Helpers ---------- */
  const $ = s => document.querySelector(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const thisMonth = () => today().slice(0, 7);
  const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  const byId = (arr, id) => arr.find(x => x.id === id);
  const AR = '٠١٢٣٤٥٦٧٨٩';
  function digits(s) { return db.settings.arabicDigits ? String(s).replace(/\d/g, d => AR[d]) : String(s); }
  function num(n) { return digits((Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US')); }
  function money(n) { return num(Math.round(Number(n) || 0)) + ' ' + db.settings.currency; }
  function fmtIn(n) { n = Math.round(Number(n) || 0); return n ? n.toLocaleString('en-US') : ''; }
  function toNum(v) {
    v = String(v == null ? '' : v).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/٫/g, '.').replace(/[,،\s]/g, '');
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtDate(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return digits(dd + '/' + m + '/' + y); }
  function monthName(ym) { const [y, m] = ym.split('-'); return MONTHS[Number(m) - 1] + ' ' + digits(y); }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function nval(id) { return toNum(val(id)); }

  // داخل إطار (رابط المعاينة) لا تعمل الطباعة ولا التنزيل
  const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  if (EMBED) document.documentElement.classList.add('embed');

  // نافذة تأكيد داخل الصفحة بدلاً من confirm/alert/prompt
  function ask(msg, o = {}) {
    return new Promise(res => {
      const d = $('#dlg');
      d.innerHTML = `<div class="dlg-box" role="alertdialog">
        <div class="dlg-msg">${esc(msg).replace(/\n/g, '<br>')}</div>
        ${o.input === 'area' ? '<textarea class="input" id="dlgIn" rows="6"></textarea>' : o.input ? '<input class="input" id="dlgIn">' : ''}
        ${o.html || ''}
        ${o.text != null ? `<textarea class="input" id="dlgText" rows="7" readonly>${esc(o.text)}</textarea>
          <button class="btn secondary block" id="dlgCopy" style="margin-top:8px">نسخ النص</button>` : ''}
        <div class="btn-row">
          ${o.cancel === false ? '' : `<button class="btn secondary" id="dlgNo">${o.cancelText || 'إلغاء'}</button>`}
          <button class="btn ${o.danger ? 'danger' : ''}" id="dlgYes">${o.ok || 'موافق'}</button>
        </div></div>`;
      d.hidden = false;
      const done = v => { d.hidden = true; d.innerHTML = ''; res(v); };
      $('#dlgYes').onclick = () => done(o.input ? val('dlgIn') : true);
      const no = $('#dlgNo'); if (no) no.onclick = () => done(o.input ? null : false);
      const cp = $('#dlgCopy');
      if (cp) cp.onclick = () => {
        const ta = $('#dlgText');
        navigator.clipboard.writeText(o.text).then(() => toast('تم النسخ')).catch(() => { ta.focus(); ta.select(); });
      };
      const inp = $('#dlgIn'); if (inp) setTimeout(() => inp.focus(), 50);
      d.querySelectorAll('a.dlg-close').forEach(a => a.addEventListener('click', () => setTimeout(() => done(true), 300)));
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // تنسيق حقول المبالغ أثناء الكتابة (250,000)
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.classList && el.classList.contains('money')) {
      const n = Math.round(toNum(el.value));
      const f = el.value.trim() === '' ? '' : n.toLocaleString('en-US');
      if (el.value !== f) el.value = f;
    }
  });
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el.matches && el.matches('input.money, input.qty')) setTimeout(() => { try { el.select(); } catch (x) { /* */ } }, 0);
  });

  /* ---------- Calculations ---------- */
  const lineCost = s => sum(s.items, l => l.qty * l.cost);
  const saleProfit = s => s.total - lineCost(s);
  const openingOf = (arr, id) => { const c = byId(arr, id); return c ? Number(c.opening) || 0 : 0; };
  const customerBalance = id => openingOf(db.customers, id) +
    sum(db.sales.filter(s => s.customerId === id), s => s.total - s.paid) - sum(db.payments.filter(p => p.partyId === id), p => p.amount);
  const supplierBalance = id => openingOf(db.suppliers, id) +
    sum(db.purchases.filter(s => s.supplierId === id), s => s.total - s.paid) - sum(db.supplierPayments.filter(p => p.partyId === id), p => p.amount);
  const partyBalance = (kind, id) => kind === 'customer' ? customerBalance(id) : supplierBalance(id);
  // نص الرصيد: «عليه» = مطلوب لي، «له» = أنا مطلوب له
  function balWord(kind, bal) {
    if (!Math.round(bal)) return 'لا يوجد رصيد';
    const owesMe = kind === 'customer' ? bal > 0 : bal < 0;
    return (owesMe ? 'عليه ' : 'له ') + money(Math.abs(bal));
  }
  function balBadge(kind, bal) {
    if (!Math.round(bal)) return '<span class="badge b-green">لا يوجد رصيد</span>';
    const owesMe = kind === 'customer' ? bal > 0 : bal < 0;
    return `<span class="badge ${owesMe ? 'b-amber' : 'b-blue'}">${balWord(kind, bal)}</span>`;
  }
  const advBalance = empId =>
    sum(db.advances.filter(a => a.employeeId === empId), a => a.amount) - sum(db.payrolls.filter(p => p.employeeId === empId), p => p.advDeducted);
  const payrollCost = p => p.base + p.bonus - p.deduction;

  function cashBox() {
    return (Number(db.settings.openingCash) || 0)
      + sum(db.sales, s => s.paid) + sum(db.payments, p => p.amount)
      - sum(db.purchases, s => s.paid) - sum(db.supplierPayments, p => p.amount)
      - sum(db.expenses, e => e.amount) - sum(db.advances, a => a.amount) - sum(db.payrolls, p => p.net);
  }
  function profitIn(from, to) {
    const inR = d => d >= from && d <= to;
    const sales = db.sales.filter(s => inR(s.date));
    const revenue = sum(sales, s => s.total);
    const cogs = sum(sales, lineCost);
    const expenses = sum(db.expenses.filter(e => inR(e.date)), e => e.amount);
    const salaries = sum(db.payrolls.filter(p => inR(p.date)), payrollCost);
    return { revenue, cogs, gross: revenue - cogs, expenses, salaries, net: revenue - cogs - expenses - salaries, count: sales.length };
  }

  /* ---------- Sheet (bottom modal) ---------- */
  let sheetOnClose = null;
  function openSheet(title, html, onClose) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
    $('#sheetBody').scrollTop = 0;
    sheetOnClose = onClose || null;
  }
  function closeSheet() {
    $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; $('#sheetBody').innerHTML = '';
    const cb = sheetOnClose; sheetOnClose = null; if (cb) cb();
  }
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBackdrop').onclick = closeSheet;

  // التحديث: يعيد فتح البرنامج بآخر نسخة، والبيانات محفوظة على الجهاز فلا تتأثر
  async function updateApp() {
    saveLocal();
    toast('جاري التحديث…');
    if (!EMBED && navigator.serviceWorker) {
      try { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); } catch (e) { /* */ }
    }
    setTimeout(() => location.reload(), 300);
  }

  /* ---------- Router ---------- */
  const ROOTS = ['home', 'sales', 'stock', 'reports', 'more'];
  const TAB_OF = { 'sale-new': 'sales', 'purchase-new': 'more' };
  function setTop(title, action) {
    $('#title').textContent = title;
    $('#topAction').innerHTML = action || '';
  }
  function go(h) { location.hash = h; }
  function render() {
    const route = (location.hash.slice(1) || 'home').split('/')[0];
    const view = VIEWS[route] || VIEWS.home;
    $('#backBtn').hidden = ROOTS.includes(route) || !VIEWS[route];
    const tab = ROOTS.includes(route) ? route : (TAB_OF[route] || 'more');
    document.querySelectorAll('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    $('#view').innerHTML = '';
    view();
    window.scrollTo(0, 0);
  }
  $('#backBtn').onclick = () => { if (history.length > 1) history.back(); else go('home'); };
  window.addEventListener('hashchange', () => { if (!$('#sheet').hidden) closeSheet(); render(); });
  const V = html => { $('#view').innerHTML = html; };
  const plusBtn = onclick => `<button class="link-btn" style="font-size:26px;line-height:1" onclick="${onclick}" aria-label="إضافة">+</button>`;

  /* ---------- Home ---------- */
  function home() {
    setTop(db.settings.shopName || 'حساباتي');
    const t = today(), m = thisMonth();
    const day = profitIn(t, t);
    const mon = profitIn(m + '-01', m + '-31');
    const recv = sum(db.customers, c => Math.max(0, customerBalance(c.id)));
    const pay = sum(db.suppliers, s => Math.max(0, supplierBalance(s.id))) + sum(db.customers, c => Math.max(0, -customerBalance(c.id)));
    const low = db.products.filter(p => p.qty <= (p.minQty || 0));
    const hasData = db.sales.length + db.products.length > 0;
    const lastB = (db.settings.lastBackup || '').slice(0, 10);
    const activeToday = db.sales.some(x => x.date === t) || db.expenses.some(x => x.date === t) || db.purchases.some(x => x.date === t);
    const needBackup = hasData && (!lastB || (activeToday && lastB < t) || (Date.now() - new Date(db.settings.lastBackup).getTime()) > 7 * 864e5);
    const recent = db.sales.slice(-5).reverse();

    V(`
      <div class="hero">
        <div class="l">مبيعات اليوم — ${fmtDate(t)}</div>
        <div class="v">${money(day.revenue)}</div>
        <div class="sub"><span>عدد الفواتير: ${num(day.count)}</span><span>ربح اليوم: ${money(day.net)}</span></div>
      </div>
      <div class="actions">
        <button class="action" onclick="App.newInvoice('sale')"><span class="ai">🛒</span>بيع جديد</button>
        <button class="action" onclick="App.newInvoice('purchase')"><span class="ai">🚚</span>شراء</button>
        <button class="action" onclick="App.expenseForm()"><span class="ai">💸</span>مصروف</button>
        <button class="action" onclick="App.paymentForm('customer')"><span class="ai">💰</span>قبض من زبون</button>
        <button class="action" onclick="App.advanceForm()"><span class="ai">🤝</span>سلفة موظف</button>
        <button class="action" onclick="App.go('payroll')"><span class="ai">👥</span>الرواتب</button>
      </div>
      ${showInstallHint() ? `<div class="card" style="background:var(--blue-soft);color:var(--blue)"><b>ثبّت البرنامج على الشاشة الرئيسية:</b><br>
        اضغط زر المشاركة <b>⬆︎</b> بأسفل سفاري ← <b>إضافة إلى الشاشة الرئيسية</b> ← <b>إضافة</b>.<br>
        <span class="small">إذا عندك بيانات بالنسخة القديمة: خذ منها نسخة احتياطية، وبعدين هنا من الإعدادات ← استرجاع نسخة.</span></div>` : ''}
      ${needBackup ? `<div class="card" style="background:var(--amber-soft);color:var(--amber)"><b>تذكير:</b> ${activeToday ? 'لم تأخذ نسخة احتياطية لشغل اليوم.' : 'لم تأخذ نسخة احتياطية منذ أكثر من أسبوع.'} <a href="#settings" class="bold">خذ نسخة الآن</a></div>` : ''}
      <div class="stats">
        <div class="stat wide"><div class="l">رصيد الصندوق (النقد المتوفر)</div><div class="v">${money(cashBox())}</div></div>
        <div class="stat"><div class="l">مبيعات الشهر</div><div class="v">${money(mon.revenue)}</div></div>
        <div class="stat ${mon.net >= 0 ? 'good' : 'bad'}"><div class="l">صافي ربح الشهر</div><div class="v">${money(mon.net)}</div></div>
        <div class="stat warn"><div class="l">ديون لنا (على الزبائن)</div><div class="v">${money(recv)}</div></div>
        <div class="stat bad"><div class="l">ديون علينا (للموردين والعملاء)</div><div class="v">${money(pay)}</div></div>
        <div class="stat"><div class="l">مصاريف اليوم</div><div class="v">${money(day.expenses)}</div></div>
        <div class="stat ${low.length ? 'bad' : ''}"><div class="l">منتجات قاربت على النفاد</div><div class="v">${num(low.length)}</div></div>
      </div>
      ${low.length ? `<div class="section-title">تنبيه المخزن</div><div class="list">${low.slice(0, 5).map(p => `
        <div class="row" onclick="App.productForm('${p.id}')"><div class="grow"><div class="t">${esc(p.name)}</div></div>
        <span class="badge ${p.qty <= 0 ? 'b-red' : 'b-amber'}">${p.qty <= 0 ? 'نفد' : 'باقي ' + num(p.qty)}</span></div>`).join('')}</div>` : ''}
      <div class="section-title">آخر المبيعات</div>
      ${recent.length ? `<div class="list">${recent.map(saleRow).join('')}</div>` : `<div class="card empty">لا توجد مبيعات بعد. اضغط «بيع جديد» للبدء.${!db.products.length ? '<br><br><a href="#stock" class="bold">ابدأ بإضافة منتجاتك إلى المخزن</a>' : ''}</div>`}
    `);
  }

  // يظهر فقط عند فتح البرنامج من سفاري على الآيفون وقبل تثبيته
  function showInstallHint() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    return ios && !standalone && !EMBED;
  }

  /* ---------- Sales / Purchases lists ---------- */
  let salesFilter = 'all';
  function saleRow(s) {
    const c = byId(db.customers, s.customerId);
    const rem = s.total - s.paid;
    return `<div class="row" onclick="App.showInvoice('sale','${s.id}')">
      <div class="grow"><div class="t">${esc(c ? c.name : 'زبون نقدي')}</div>
      <div class="s">فاتورة #${num(s.no)} · ${fmtDate(s.date)}</div></div>
      <div class="end"><div class="bold">${money(s.total)}</div>
      ${s.type === 'credit' ? (rem > 0 ? `<span class="badge b-amber">آجل · باقي ${money(rem)}</span>` : `<span class="badge b-green">آجل · مسدد</span>`) : `<span class="badge b-green">نقدي</span>`}</div></div>`;
  }
  function salesList() {
    setTop('المبيعات', plusBtn("App.newInvoice('sale')"));
    let list = db.sales.slice().reverse();
    if (salesFilter !== 'all') list = list.filter(s => s.type === salesFilter);
    const q = salesQuery.trim();
    if (q) list = list.filter(s => { const c = byId(db.customers, s.customerId); return String(s.no) === q || (c && c.name.includes(q)); });
    V(`
      <button class="btn block" onclick="App.newInvoice('sale')" style="margin-bottom:12px">+ فاتورة بيع جديدة</button>
      <div class="seg">
        ${[['all', 'الكل'], ['cash', 'نقدي'], ['credit', 'آجل']].map(([k, l]) => `<button class="${salesFilter === k ? 'on' : ''}" onclick="App.setSalesFilter('${k}')">${l}</button>`).join('')}
      </div>
      <div class="search"><input class="input" placeholder="بحث باسم الزبون أو رقم الفاتورة" value="${esc(salesQuery)}" oninput="App.salesSearch(this.value)"></div>
      <div id="salesListBody">${list.length ? `<div class="list">${list.slice(0, 300).map(saleRow).join('')}</div>` : '<div class="card empty">لا توجد فواتير</div>'}</div>
    `);
  }
  let salesQuery = '';

  function purchaseRow(p) {
    const s = byId(db.suppliers, p.supplierId);
    const rem = p.total - p.paid;
    return `<div class="row" onclick="App.showInvoice('purchase','${p.id}')">
      <div class="grow"><div class="t">${esc(s ? s.name : 'مورد نقدي')}</div>
      <div class="s">شراء #${num(p.no)} · ${fmtDate(p.date)} · ${num(p.items.length)} صنف</div></div>
      <div class="end"><div class="bold">${money(p.total)}</div>
      ${rem > 0 ? `<span class="badge b-red">باقي علينا ${money(rem)}</span>` : `<span class="badge b-green">مدفوع</span>`}</div></div>`;
  }
  function purchasesList() {
    setTop('المشتريات', plusBtn("App.newInvoice('purchase')"));
    const list = db.purchases.slice().reverse();
    V(`
      <button class="btn block" onclick="App.newInvoice('purchase')" style="margin-bottom:12px">+ فاتورة شراء جديدة</button>
      <div class="card small muted">فاتورة الشراء تضيف الكميات إلى المخزن تلقائياً وتحدّث سعر الكلفة.</div>
      ${list.length ? `<div class="list">${list.map(purchaseRow).join('')}</div>` : '<div class="card empty">لا توجد مشتريات</div>'}
    `);
  }

  /* ---------- Invoice editor (sale & purchase) ---------- */
  let ed = null;
  function newEd(kind) {
    return { kind, date: today(), type: 'cash', partyId: '', lines: [], discount: 0, paid: 0, note: '' };
  }
  function edTotals() {
    const sub = sum(ed.lines, l => l.qty * l.price);
    const disc = Math.min(sub, Math.max(0, toNum(ed.discount)));
    const total = Math.max(0, sub - disc);
    const paid = ed.type === 'cash' ? total : Math.min(total, Math.max(0, toNum(ed.paid)));
    return { sub, disc, total, paid, rem: total - paid };
  }
  function editor(kind) {
    if (!ed || ed.kind !== kind) ed = newEd(kind);
    const isSale = kind === 'sale';
    setTop(isSale ? 'فاتورة بيع' : 'فاتورة شراء');
    const parties = isSale ? db.customers : db.suppliers;
    V(`
      <div class="seg">
        <button class="${ed.type === 'cash' ? 'on' : ''}" onclick="App.edType('cash')">${isSale ? 'بيع نقدي' : 'شراء نقدي'}</button>
        <button class="${ed.type === 'credit' ? 'on' : ''}" onclick="App.edType('credit')">${isSale ? 'بيع آجل (دين)' : 'شراء آجل (دين)'}</button>
      </div>
      <div class="card">
        <label class="field"><span>${isSale ? 'الزبون' : 'المورد'} ${ed.type === 'credit' ? '(مطلوب)' : '(اختياري)'}</span>
          <div style="display:flex;gap:8px">
            <select class="input" id="edParty" onchange="App.edField('partyId',this.value)">
              <option value="">${isSale ? 'زبون نقدي' : 'بدون مورد'}</option>
              ${parties.map(p => `<option value="${p.id}" ${p.id === ed.partyId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
            <button class="btn secondary small" onclick="App.edNewParty()">+ جديد</button>
          </div>
        </label>
        <label class="field" style="margin:0"><span>التاريخ</span><input type="date" class="input" value="${ed.date}" onchange="App.edField('date',this.value)"></label>
      </div>
      ${edCreditHint()}
      <div class="section-title">المنتجات</div>
      <div class="list" id="edLines">${edLinesHTML()}</div>
      <button class="btn secondary block" onclick="App.picker()">+ إضافة منتج</button>
      <div class="card" style="margin-top:12px">
        <div class="grid2">
          <label class="field"><span>الخصم</span><input class="input money" inputmode="numeric" placeholder="0" value="${fmtIn(ed.discount)}" oninput="App.edField('discount',this.value)"></label>
          ${ed.type === 'credit' ? `<label class="field"><span>المدفوع الآن</span><input class="input money" inputmode="numeric" placeholder="0" value="${fmtIn(ed.paid)}" oninput="App.edField('paid',this.value)"></label>` : '<div></div>'}
        </div>
        <label class="field"><span>ملاحظات</span><input class="input" value="${esc(ed.note)}" oninput="App.edField('note',this.value)"></label>
        <div class="totals" id="edTotals">${edTotalsHTML()}</div>
      </div>
      <div class="btn-row">
        <button class="btn" onclick="App.edSave()">حفظ الفاتورة</button>
        <button class="btn danger" style="flex:0 0 auto" onclick="App.edCancel()">إلغاء</button>
      </div>
    `);
  }
  function edCreditHint() {
    if (!ed.partyId) return '';
    const bal = partyBalance(ed.kind === 'sale' ? 'customer' : 'supplier', ed.partyId);
    const credit = ed.kind === 'sale' ? -bal : bal;  // ما أنا مطلوب له
    if (credit > 0 && ed.kind === 'sale') {
      return `<div class="card" style="background:var(--blue-soft);color:var(--blue)">لهذا الزبون رصيد له: <b>${money(credit)}</b> (أنت مطلوب له).
        ${ed.type === 'credit' && !toNum(ed.paid) ? '<br>✓ قيمة هذه الفاتورة ستُخصم من رصيده.' : `<br><button class="btn small" style="margin-top:8px" onclick="App.edUseCredit()">خصم الفاتورة من رصيده</button>`}</div>`;
    }
    if (bal > 0 && ed.kind === 'sale') return `<div class="card small" style="background:var(--amber-soft);color:var(--amber)">على هذا الزبون دين سابق: <b>${money(bal)}</b></div>`;
    return '';
  }
  function stockOf(pid) { const p = byId(db.products, pid); return p ? p.qty : 0; }
  function edLinesHTML() {
    if (!ed.lines.length) return '<div class="empty">لم تتم إضافة منتجات بعد</div>';
    return ed.lines.map((l, i) => `<div class="line">
      <div><div class="name">${esc(l.name)}</div>
      <div class="small muted">${ed.kind === 'sale' ? 'المتوفر بالمخزن: ' + num(stockOf(l.productId)) : 'سعر الكلفة للوحدة'}</div></div>
      <button class="x-btn" onclick="App.edDel(${i})" aria-label="حذف">×</button>
      <div class="ctrls">
        <div class="stepper"><button onclick="App.edStep(${i},1)">+</button><input class="qty" inputmode="decimal" value="${l.qty}" oninput="App.edLine(${i},'qty',this.value)"><button onclick="App.edStep(${i},-1)">−</button></div>
        <input class="input price money" inputmode="numeric" value="${fmtIn(l.price)}" oninput="App.edLine(${i},'price',this.value)" aria-label="السعر">
        <b id="lt${i}">${money(l.qty * l.price)}</b>
      </div></div>`).join('');
  }
  function edTotalsHTML() {
    const t = edTotals();
    return `<div class="tr"><span class="muted">المجموع</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div class="tr"><span class="muted">الخصم</span><span>− ${money(t.disc)}</span></div>` : ''}
      <div class="tr big"><span>الإجمالي</span><span>${money(t.total)}</span></div>
      ${ed.type === 'credit' ? `<div class="tr"><span class="muted">المدفوع</span><span>${money(t.paid)}</span></div>
      <div class="tr bold"><span>${ed.kind === 'sale' ? 'يضاف إلى حساب الزبون' : 'يضاف إلى حساب المورد'}</span><span class="neg">${money(t.rem)}</span></div>
      ${ed.partyId ? `<div class="tr small"><span class="muted">رصيده بعد الفاتورة</span><span>${balWord(ed.kind === 'sale' ? 'customer' : 'supplier', partyBalance(ed.kind === 'sale' ? 'customer' : 'supplier', ed.partyId) + t.rem)}</span></div>` : ''}` : ''}`;
  }
  function edRefresh(lines) {
    if (lines) $('#edLines').innerHTML = edLinesHTML();
    else ed.lines.forEach((l, i) => { const el = document.getElementById('lt' + i); if (el) el.textContent = money(l.qty * l.price); });
    $('#edTotals').innerHTML = edTotalsHTML();
  }
  function edAdd(p) {
    const ex = ed.lines.find(l => l.productId === p.id);
    if (ex) ex.qty = Math.round((ex.qty + 1) * 1000) / 1000;
    else ed.lines.push({ productId: p.id, name: p.name, qty: 1, price: ed.kind === 'sale' ? p.price : p.cost, cost: p.cost });
  }
  function picker() {
    const draw = q => {
      q = (q || '').trim();
      const list = db.products.filter(p => !q || p.name.includes(q) || (p.code && p.code === q));
      return list.length ? `<div class="list">${list.map(p => {
        const inCart = ed.lines.find(l => l.productId === p.id);
        return `<div class="row" onclick="App.pick('${p.id}')"><div class="grow"><div class="t">${esc(p.name)}</div>
          <div class="s">المتوفر: ${num(p.qty)} ${esc(p.unit || '')} · ${ed.kind === 'sale' ? 'البيع ' + money(p.price) : 'الكلفة ' + money(p.cost)}</div></div>
          ${inCart ? `<span class="badge b-green">✓ ${num(inCart.qty)}</span>` : '<span class="badge b-blue">إضافة</span>'}</div>`;
      }).join('')}</div>` : `<div class="empty">لا توجد منتجات${q ? ' مطابقة' : ''}</div>`;
    };
    pickerDraw = draw;
    openSheet('اختر منتج', `
      <div class="search"><input class="input" id="pickQ" placeholder="ابحث عن منتج" oninput="App.pickSearch(this.value)"></div>
      <button class="btn secondary block" style="margin-bottom:12px" onclick="App.productForm(null, true)">+ منتج جديد</button>
      <div id="pickList">${draw('')}</div>
      <button class="btn block" style="margin-top:8px" onclick="App.closeSheet()">تم</button>
    `, () => { if (ed && $('#edLines')) edRefresh(true); });
  }
  let pickerDraw = null;
  async function edSave() {
    const isSale = ed.kind === 'sale';
    const lines = ed.lines.filter(l => l.qty > 0);
    if (!lines.length) return toast('أضف منتجاً واحداً على الأقل');
    if (ed.type === 'credit' && !ed.partyId) return toast(isSale ? 'اختر الزبون للبيع الآجل' : 'اختر المورد للشراء الآجل');
    if (isSale) {
      const short = lines.filter(l => l.qty > stockOf(l.productId));
      if (short.length && !(await ask('الكمية المطلوبة أكبر من المتوفر في المخزن:\n' + short.map(l => '• ' + l.name + ' (المتوفر ' + num(stockOf(l.productId)) + ')').join('\n') + '\n\nهل تريد المتابعة؟'))) return;
    }
    const t = edTotals();
    const doc = {
      id: uid(), no: ++db.seq[ed.kind], date: ed.date || today(), type: ed.type,
      items: lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, price: Math.round(l.price), cost: isSale ? (byId(db.products, l.productId) || l).cost : Math.round(l.price) })),
      discount: t.disc, total: t.total, paid: t.paid, note: ed.note, createdAt: new Date().toISOString()
    };
    if (isSale) {
      doc.customerId = ed.partyId;
      doc.items.forEach(l => { const p = byId(db.products, l.productId); if (p) p.qty = round3(p.qty - l.qty); });
      db.sales.push(doc);
    } else {
      doc.supplierId = ed.partyId;
      doc.items.forEach(l => {
        const p = byId(db.products, l.productId); if (!p) return;
        const oldQ = Math.max(0, p.qty);
        p.cost = oldQ > 0 ? Math.round((oldQ * p.cost + l.qty * l.cost) / (oldQ + l.qty)) : l.cost;
        p.qty = round3(p.qty + l.qty);
      });
      db.purchases.push(doc);
    }
    save();
    const kind = ed.kind; ed = null;
    toast('تم حفظ الفاتورة');
    go(isSale ? 'sales' : 'purchases');
    setTimeout(() => showInvoice(kind, doc.id), 50);
  }
  const round3 = n => Math.round(n * 1000) / 1000;

  function invoiceHTML(kind, inv) {
    const isSale = kind === 'sale';
    const party = isSale ? byId(db.customers, inv.customerId) : byId(db.suppliers, inv.supplierId);
    const sub = sum(inv.items, l => l.qty * l.price);
    return `<div style="text-align:center;margin-bottom:10px"><h2 style="margin:0">${esc(db.settings.shopName)}</h2>
      ${db.settings.shopPhone ? `<div class="small muted">${esc(digits(db.settings.shopPhone))}</div>` : ''}</div>
      <div class="card">
        <div class="kv"><span class="k">${isSale ? 'فاتورة بيع' : 'فاتورة شراء'} رقم</span><span class="v">#${num(inv.no)}</span></div>
        <div class="kv"><span class="k">التاريخ</span><span class="v">${fmtDate(inv.date)}</span></div>
        <div class="kv"><span class="k">${isSale ? 'الزبون' : 'المورد'}</span><span class="v">${esc(party ? party.name : (isSale ? 'زبون نقدي' : '—'))}</span></div>
        <div class="kv"><span class="k">نوع الدفع</span><span class="v">${inv.type === 'credit' ? 'آجل' : 'نقدي'}</span></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">المبلغ</th></tr></thead>
        <tbody>${inv.items.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${num(l.qty)}</td><td class="n">${num(l.price)}</td><td class="n">${num(l.qty * l.price)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="card">
        ${inv.discount ? `<div class="kv"><span class="k">المجموع</span><span class="v">${money(sub)}</span></div><div class="kv"><span class="k">الخصم</span><span class="v">${money(inv.discount)}</span></div>` : ''}
        <div class="kv total"><span class="k">الإجمالي</span><span class="v">${money(inv.total)}</span></div>
        <div class="kv"><span class="k">المدفوع</span><span class="v">${money(inv.paid)}</span></div>
        ${inv.total - inv.paid > 0 ? `<div class="kv"><span class="k">المتبقي</span><span class="v neg">${money(inv.total - inv.paid)}</span></div>` : ''}
        ${inv.note ? `<div class="kv"><span class="k">ملاحظات</span><span class="v">${esc(inv.note)}</span></div>` : ''}
      </div>`;
  }
  function showInvoice(kind, id) {
    const inv = byId(kind === 'sale' ? db.sales : db.purchases, id);
    if (!inv) return;
    openSheet((kind === 'sale' ? 'فاتورة بيع #' : 'فاتورة شراء #') + num(inv.no), `
      ${invoiceHTML(kind, inv)}
      <div class="btn-row">
        ${kind === 'purchase' ? `<button class="btn secondary no-embed" onclick="App.printInvoice('${kind}','${id}')">طباعة</button>` : ''}
        <button class="btn secondary" onclick="App.invoicePDF('${kind}','${id}')">PDF</button>
      </div>
      ${(() => { const c = kind === 'sale' && db.settings.invoiceTemplate !== false && byId(db.customers, inv.customerId); return c && waNumber(c.phone) ? `<div class="btn-row"><button class="btn wa-btn" onclick="App.waImage('${id}')">إرسال صورة الفاتورة على واتساب ${esc(c.name)}</button></div>` : ''; })()}
      <div class="btn-row"><button class="btn danger" onclick="App.deleteInvoice('${kind}','${id}')">حذف الفاتورة</button></div>
    `);
  }
  /* ---------- PDF ---------- */
  const H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let libsP = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(el); });
  }
  function loadPdfLibs() {
    if (!libsP) libsP = Promise.all([loadScript(H2C), loadScript(JSPDF)]).catch(e => { libsP = null; throw e; });
    return libsP;
  }
  let pdfBusy = false;
  async function makePDF(title, html, filename) {
    if (pdfBusy) return;
    pdfBusy = true;
    toast('جاري تجهيز ملف PDF…');
    try {
      try { await loadPdfLibs(); }
      catch (e) { return ask('تعذر تجهيز ملف PDF. تأكد من اتصال الإنترنت وحاول مرة أخرى.', { cancel: false }); }
      const box = document.createElement('div');
      box.className = 'pdf-doc'; box.dir = 'rtl';
      box.innerHTML = `<div class="pdf-head"><div><div class="pdf-shop">${esc(db.settings.shopName)}</div>
          ${db.settings.shopPhone ? `<div>${esc(digits(db.settings.shopPhone))}</div>` : ''}</div>
          <div class="pdf-meta"><div class="pdf-title">${esc(title)}</div><div>تاريخ الإصدار: ${fmtDate(today())}</div></div></div>
        ${html}<div class="pdf-foot">صدر من برنامج حساباتي</div>`;
      document.body.appendChild(box);
      let blob;
      try {
        const scale = 2;
        const top0 = box.getBoundingClientRect().top;
        // مواضع القطع المسموحة بين الصفوف حتى لا ينقسم سطر بين صفحتين
        const breaks = Array.from(box.querySelectorAll('tr, .kv, .row, .stat, .card, .section-title, .pdf-head, .table-wrap, .line'))
          .map(el => Math.round((el.getBoundingClientRect().bottom - top0) * scale)).sort((a, b) => a - b);
        const canvas = await window.html2canvas(box, { scale, backgroundColor: '#ffffff', logging: false });
        const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 22;
        const iw = pw - 2 * m, ratio = iw / canvas.width;
        const pageH = Math.floor((ph - 2 * m) / ratio);
        let y = 0, first = true;
        while (y < canvas.height - 2) {
          let end = Math.min(canvas.height, y + pageH);
          if (end < canvas.height) {
            const cand = breaks.filter(b => b > y + pageH * 0.5 && b <= end);
            if (cand.length) end = cand[cand.length - 1];
          }
          const part = document.createElement('canvas');
          part.width = canvas.width; part.height = end - y;
          const ctx = part.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, part.height);
          ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
          if (!first) pdf.addPage();
          pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, iw, (end - y) * ratio);
          first = false; y = end;
        }
        blob = pdf.output('blob');
      } finally { box.remove(); }
      await deliverFile(blob, filename, title);
    } catch (e) {
      console.error(e);
      ask('حدث خطأ أثناء تجهيز ملف PDF. حاول مرة أخرى.', { cancel: false });
    } finally { pdfBusy = false; }
  }
  /* ---------- فاتورة البيع بتصميم المحل ---------- */
  // مواضع الحقول على صورة التصميم (1024×1536)
  const TPL = {
    w: 1024, h: 1536,
    no: [103, 424], date: [103, 459],
    rowY0: 609, rowH: 53.6, rows: 10,
    name: [905, 345], qty: 472, price: 313, total: 131,
    totalBox: [165, 1190],
    panel: [584, 1138, 406, 132]
  };
  const CFONT = '"SF Arabic", "Geeza Pro", -apple-system, "Segoe UI", Tahoma, Arial, sans-serif';
  let tplP = null, jspdfP = null;
  function loadTpl() {
    if (!tplP) tplP = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => { tplP = null; rej(new Error('template')); };
      im.src = window.INVOICE_TEMPLATE || 'img/invoice-template.jpg';
    });
    return tplP;
  }
  function loadJsPDF() {
    if (window.jspdf) return Promise.resolve();
    if (!jspdfP) jspdfP = loadScript(JSPDF).catch(e => { jspdfP = null; throw e; });
    return jspdfP;
  }
  function templatePages(inv, im) {
    const S = 1.5;
    const cust = byId(db.customers, inv.customerId);
    const chunks = [];
    for (let i = 0; i < Math.max(1, inv.items.length); i += TPL.rows) chunks.push(inv.items.slice(i, i + TPL.rows));
    return chunks.map((items, pi) => {
      const last = pi === chunks.length - 1;
      const c = document.createElement('canvas');
      c.width = TPL.w * S; c.height = TPL.h * S;
      const x = c.getContext('2d');
      x.scale(S, S);
      x.drawImage(im, 0, 0, TPL.w, TPL.h);
      x.textBaseline = 'middle'; x.direction = 'rtl';
      const txt = (t, X, Y, o = {}) => {
        x.font = `${o.bold ? '700' : '600'} ${o.size || 20}px ${CFONT}`;
        x.fillStyle = o.color || '#0b2a6b';
        x.textAlign = o.align || 'center';
        let str = String(t);
        if (o.max && x.measureText(str).width > o.max) {
          while (str.length > 1 && x.measureText(str + '…').width > o.max) str = str.slice(0, -1);
          str += '…';
        }
        x.fillText(str, X, Y);
      };
      // تغطية النقاط المطبوعة تحت الحقول
      const cover = (cx, cy, cw, chh, fill) => {
        x.save(); x.fillStyle = fill; x.beginPath();
        if (x.roundRect) x.roundRect(cx, cy, cw, chh, 8); else x.rect(cx, cy, cw, chh);
        x.fill(); x.restore();
      };
      cover(44, 409, 120, 30, '#f7f9fe'); cover(44, 444, 120, 30, '#f7f9fe');
      cover(46, 1160, 238, 60, '#f6f9ff');
      txt(num(inv.no), TPL.no[0], TPL.no[1], { bold: true, size: 20 });
      txt(fmtDate(inv.date), TPL.date[0], TPL.date[1], { bold: true, size: 18 });
      items.forEach((l, i) => {
        const y = TPL.rowY0 + TPL.rowH * i;
        txt(l.name, TPL.name[0], y, { align: 'right', max: TPL.name[1], size: 20 });
        txt(num(l.qty), TPL.qty, y, { size: 20 });
        txt(num(l.price), TPL.price, y, { size: 20 });
        txt(num(l.qty * l.price), TPL.total, y, { bold: true, size: 20 });
      });
      if (chunks.length > 1) txt(`صفحة ${num(pi + 1)} من ${num(chunks.length)}`, 512, 1283, { size: 15, color: '#475569' });
      if (!last) { txt('يتبع…', TPL.totalBox[0], TPL.totalBox[1], { bold: true, size: 22 }); return c; }
      txt(money(inv.total), TPL.totalBox[0], TPL.totalBox[1], { bold: true, size: 25, color: '#0b3fa8' });
      // لوحة المعلومات: الزبون، نوع الفاتورة، الدفعة، المتبقي
      const rem = inv.total - inv.paid;
      const rows = [
        ['الزبون', cust ? cust.name : 'زبون نقدي'],
        ['نوع الفاتورة', inv.type === 'credit' ? 'آجل' : 'نقدي'],
        inv.discount ? ['الخصم', money(inv.discount)] : null,
        ['الدفعة المستلمة', money(inv.paid)],
        ['المتبقي', money(rem), rem > 0 ? '#dc2626' : '#15803d']
      ];
      if (cust && inv.type === 'credit') {
        const b = customerBalance(cust.id);
        rows.push(['رصيد الحساب', !Math.round(b) ? 'مسدد' : (b > 0 ? 'مطلوب منكم ' : 'لكم ') + money(Math.abs(b)), b > 0 ? '#dc2626' : '#15803d']);
      }
      const list = rows.filter(Boolean);
      const [px, py, pw, ph] = TPL.panel;
      x.save();
      x.fillStyle = 'rgba(255,255,255,0.94)'; x.strokeStyle = '#1d5fd6'; x.lineWidth = 2;
      x.beginPath();
      if (x.roundRect) x.roundRect(px, py, pw, ph, 18); else x.rect(px, py, pw, ph);
      x.fill(); x.stroke();
      x.restore();
      const rh = (ph - 12) / list.length, fs = Math.min(19, rh * 0.78);
      list.forEach(([k, v, col], i) => {
        const y = py + 6 + rh * (i + 0.5);
        if (i) { x.strokeStyle = '#dbe6fb'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 14, py + 6 + rh * i); x.lineTo(px + pw - 14, py + 6 + rh * i); x.stroke(); }
        txt(k, px + pw - 16, y, { align: 'right', size: fs, color: '#475569' });
        txt(v, px + 16, y, { align: 'left', bold: true, size: fs, color: col || '#0b2a6b', max: pw * 0.55 });
      });
      return c;
    });
  }
  async function saleInvoicePDF(inv) {
    if (pdfBusy) return;
    pdfBusy = true;
    toast('جاري تجهيز الفاتورة…');
    let ok = false;
    try {
      let im;
      try { [, im] = await Promise.all([loadJsPDF(), loadTpl()]); }
      catch (e) { return ask('تعذر تجهيز ملف PDF. تأكد من اتصال الإنترنت وحاول مرة أخرى.', { cancel: false }); }
      const pages = templatePages(inv, im);
      const W = TPL.w * 0.75, H = TPL.h * 0.75;
      const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: [W, H] });
      pages.forEach((c, i) => { if (i) pdf.addPage([W, H]); pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H); });
      await deliverFile(pdf.output('blob'), 'فاتورة-' + inv.no + '.pdf', 'فاتورة #' + inv.no);
      ok = true;
    } catch (e) {
      console.error(e);
      ask('حدث خطأ أثناء تجهيز الفاتورة. حاول مرة أخرى.', { cancel: false });
    } finally { pdfBusy = false; }
    if (ok) offerWhatsApp(inv);
  }

  // صورة الفاتورة (كل الصفحات فوق بعض)
  async function invoiceImageBlob(inv) {
    const im = await loadTpl();
    const pages = templatePages(inv, im);
    let c = pages[0];
    if (pages.length > 1) {
      c = document.createElement('canvas');
      c.width = pages[0].width; c.height = pages[0].height * pages.length;
      const x = c.getContext('2d');
      pages.forEach((pg, i) => x.drawImage(pg, 0, pg.height * i));
    }
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
  }
  async function saleInvoiceImage(inv) {
    if (pdfBusy) return;
    pdfBusy = true; toast('جاري تجهيز الصورة…');
    try {
      let blob;
      try { blob = await invoiceImageBlob(inv); }
      catch (e) { return ask('تعذر تجهيز الصورة. تأكد من اتصال الإنترنت وحاول مرة أخرى.', { cancel: false }); }
      await deliverFile(blob, 'فاتورة-' + inv.no + '.png', 'فاتورة #' + inv.no);
    } finally { pdfBusy = false; }
  }
  // نسخ صورة الفاتورة ثم فتح محادثة الزبون؛ يلصقها ويضغط إرسال
  function waInvoiceImage(inv) {
    const cust = byId(db.customers, inv.customerId);
    if (!cust || !waNumber(cust.phone)) return ask('أضف رقم واتساب للزبون أولاً من صفحة العملاء.', { cancel: false });
    const link = 'https://wa.me/' + waNumber(cust.phone);
    const blobP = invoiceImageBlob(inv);
    let copied;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
      // يجب استدعاء الكتابة مباشرة أثناء الضغط (متطلب سفاري)
      copied = navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
    } catch (e) { copied = Promise.reject(e); }
    toast('جاري تجهيز الصورة…');
    copied.then(() => {
      ask(`تم نسخ صورة الفاتورة ✓\n\n١. اضغط «فتح واتساب ${cust.name}».\n٢. اضغط مطولاً على خانة الكتابة واختر «لصق».\n٣. اضغط «إرسال».`, {
        cancel: false, ok: 'إغلاق',
        html: `<a class="btn block wa-btn dlg-close" href="${esc(link)}" target="_blank" rel="noopener">فتح واتساب ${esc(cust.name)}</a>`
      });
    }).catch(async () => {
      // إذا ما نجح النسخ: نشارك الصورة كملف ثم نفتح المحادثة
      try { await deliverFile(await blobP, 'فاتورة-' + inv.no + '.png', 'فاتورة #' + inv.no); } catch (e) { /* */ }
      ask(`احفظ الصورة أو شاركها، ثم افتح محادثة ${cust.name} وأرفقها واضغط «إرسال».`, {
        cancel: false, ok: 'إغلاق',
        html: `<a class="btn block wa-btn dlg-close" href="${esc(link)}" target="_blank" rel="noopener">فتح واتساب ${esc(cust.name)}</a>`
      });
    });
  }

  /* ---------- واتساب ---------- */
  function waNumber(phone) {
    let d = String(phone || '').replace(/[٠-٩]/g, ch => AR.indexOf(ch)).replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = '964' + d.slice(1);
    else if (d.length === 10 && d[0] === '7') d = '964' + d;
    return d.length >= 11 ? d : '';
  }
  const waLink = (phone, text) => 'https://wa.me/' + waNumber(phone) + '?text=' + encodeURIComponent(text);
  function offerWhatsApp(inv) {
    const cust = byId(db.customers, inv.customerId);
    if (!cust || !waNumber(cust.phone)) return;
    ask(`تم تجهيز ملف الفاتورة.\nافتح محادثة ${cust.name} على واتساب، الرسالة جاهزة وما عليك إلا تضغط «إرسال».`, {
      cancel: false, ok: 'إغلاق',
      html: `<a class="btn block wa-btn dlg-close" href="${esc(waLink(cust.phone, invoiceText('sale', inv)))}" target="_blank" rel="noopener">فتح واتساب ${esc(cust.name)}</a>`
    });
  }

  async function deliverFile(blob, filename, title) {
    if (EMBED) {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (!dl) return ask('حفظ الملفات غير متاح في هذه الصفحة.', { cancel: false });
      try { await dl.save({ filename, data: blob }); toast('تم'); }
      catch (e) { if (e && e.code !== 'declined') ask('تعذر حفظ الملف. حاول مرة أخرى بعد قليل.', { cancel: false }); }
      return;
    }
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('تم تنزيل الملف');
  }

  function printHTML(html) {
    $('#printArea').innerHTML = html;
    setTimeout(() => window.print(), 50);
  }
  function invoiceText(kind, inv) {
    const isSale = kind === 'sale';
    const party = isSale ? byId(db.customers, inv.customerId) : byId(db.suppliers, inv.supplierId);
    return [db.settings.shopName, (isSale ? 'فاتورة بيع' : 'فاتورة شراء') + ' #' + num(inv.no) + ' — ' + fmtDate(inv.date),
      party ? (isSale ? 'الزبون: ' : 'المورد: ') + party.name : '', '',
      ...inv.items.map(l => `${l.name} × ${num(l.qty)} = ${money(l.qty * l.price)}`), '',
      inv.discount ? 'الخصم: ' + money(inv.discount) : '',
      'الإجمالي: ' + money(inv.total), 'المدفوع: ' + money(inv.paid),
      inv.total - inv.paid > 0 ? 'المتبقي: ' + money(inv.total - inv.paid) : '',
      party && isSale ? (b => 'رصيد حسابك: ' + (!Math.round(b) ? 'مسدد' : (b > 0 ? 'مطلوب منكم ' : 'لكم ') + money(Math.abs(b))))(customerBalance(party.id)) : ''
    ].filter((x, i, a) => x !== '' || (a[i - 1] !== '')).join('\n');
  }
  async function shareText(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch (e) { ask('انسخ النص:', { cancel: false, text }); }
  }
  async function deleteInvoice(kind, id) {
    if (!(await ask('هل أنت متأكد من حذف الفاتورة؟ سيتم تعديل المخزن تلقائياً.'))) return;
    const arr = kind === 'sale' ? db.sales : db.purchases;
    const inv = byId(arr, id); if (!inv) return;
    inv.items.forEach(l => { const p = byId(db.products, l.productId); if (p) p.qty = round3(p.qty + (kind === 'sale' ? l.qty : -l.qty)); });
    arr.splice(arr.indexOf(inv), 1);
    save(); closeSheet(); render(); toast('تم الحذف');
  }

  /* ---------- Stock ---------- */
  let stockFilter = 'all', stockQuery = '';
  function stock() {
    setTop('المخزن', plusBtn('App.productForm()'));
    const value = sum(db.products, p => Math.max(0, p.qty) * p.cost);
    const saleValue = sum(db.products, p => Math.max(0, p.qty) * p.price);
    const lowCount = db.products.filter(p => p.qty <= (p.minQty || 0)).length;
    V(`
      <div class="stats">
        <div class="stat"><div class="l">قيمة المخزن (بالكلفة)</div><div class="v">${money(value)}</div></div>
        <div class="stat"><div class="l">قيمة المخزن (بسعر البيع)</div><div class="v">${money(saleValue)}</div></div>
      </div>
      <button class="btn block" style="margin-bottom:12px" onclick="App.productForm()">+ إضافة منتج</button>
      <div class="seg">
        <button class="${stockFilter === 'all' ? 'on' : ''}" onclick="App.setStockFilter('all')">الكل (${num(db.products.length)})</button>
        <button class="${stockFilter === 'low' ? 'on' : ''}" onclick="App.setStockFilter('low')">قارب النفاد (${num(lowCount)})</button>
      </div>
      <div class="search"><input class="input" placeholder="ابحث عن منتج" value="${esc(stockQuery)}" oninput="App.stockSearch(this.value)"></div>
      <div id="stockBody">${stockListHTML()}</div>
    `);
  }
  function stockListHTML() {
    let list = db.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (stockFilter === 'low') list = list.filter(p => p.qty <= (p.minQty || 0));
    const q = stockQuery.trim();
    if (q) list = list.filter(p => p.name.includes(q) || (p.code && p.code === q));
    if (!list.length) return `<div class="card empty">${db.products.length ? 'لا توجد نتائج' : 'المخزن فارغ. أضف منتجاتك للبدء.'}</div>`;
    return `<div class="list">${list.map(p => `<div class="row" onclick="App.productForm('${p.id}')">
      <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">البيع ${money(p.price)} · الكلفة ${money(p.cost)}</div></div>
      <div class="end"><span class="badge ${p.qty <= 0 ? 'b-red' : p.qty <= (p.minQty || 0) ? 'b-amber' : 'b-green'}">${num(p.qty)} ${esc(p.unit || '')}</span></div>
    </div>`).join('')}</div>`;
  }
  function productForm(id, fromPicker) {
    const p = id ? byId(db.products, id) : null;
    const sold = p ? sum(db.sales, s => sum(s.items.filter(l => l.productId === p.id), l => l.qty)) : 0;
    const html = `
      <label class="field"><span>اسم المنتج *</span><input class="input" id="pName" value="${esc(p ? p.name : '')}"></label>
      <div class="grid2">
        <label class="field"><span>الوحدة</span><input class="input" id="pUnit" list="unitsList" value="${esc(p ? p.unit : 'قطعة')}"></label>
        <label class="field"><span>الباركود / الرمز</span><input class="input" id="pCode" value="${esc(p ? p.code || '' : '')}"></label>
      </div>
      <datalist id="unitsList">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
      <div class="grid2">
        <label class="field"><span>سعر الشراء (الكلفة)</span><input class="input money" inputmode="numeric" id="pCost" value="${fmtIn(p ? p.cost : 0)}" placeholder="0"></label>
        <label class="field"><span>سعر البيع</span><input class="input money" inputmode="numeric" id="pPrice" value="${fmtIn(p ? p.price : 0)}" placeholder="0"></label>
      </div>
      <div class="grid2">
        <label class="field"><span>${p ? 'الكمية الحالية (للتعديل/الجرد)' : 'الكمية الافتتاحية'}</span><input class="input qty" inputmode="decimal" id="pQty" value="${p ? p.qty : ''}" placeholder="0"></label>
        <label class="field"><span>تنبيه عند وصول الكمية إلى</span><input class="input qty" inputmode="decimal" id="pMin" value="${p ? (p.minQty || 0) : 5}"></label>
      </div>
      ${p ? `<div class="card small muted">ربح الوحدة: <b>${money(p.price - p.cost)}</b> · الكمية المباعة: <b>${num(sold)}</b></div>` : ''}
      <button class="btn block" onclick="App.saveProduct('${p ? p.id : ''}', ${fromPicker ? 'true' : 'false'})">حفظ</button>
      ${p ? `<div class="btn-row"><button class="btn danger" onclick="App.deleteProduct('${p.id}')">حذف المنتج</button></div>` : ''}`;
    if (fromPicker) {
      // نحفظ حالة نافذة الاختيار لنعود إليها بعد إضافة المنتج
      sheetOnClose = null;
    }
    openSheet(p ? 'تعديل منتج' : 'منتج جديد', html, fromPicker ? () => { if (ed && $('#edLines')) edRefresh(true); } : null);
    if (!p) setTimeout(() => { const el = $('#pName'); if (el) el.focus(); }, 250);
  }
  async function saveProduct(id, fromPicker) {
    const name = val('pName');
    if (!name) return toast('اكتب اسم المنتج');
    const data = { name, unit: val('pUnit'), code: val('pCode'), cost: Math.round(nval('pCost')), price: Math.round(nval('pPrice')), qty: round3(nval('pQty')), minQty: nval('pMin') };
    if (data.price && data.cost && data.price < data.cost && !(await ask('سعر البيع أقل من سعر الشراء. هل تريد المتابعة؟'))) return;
    let p;
    if (id) { p = byId(db.products, id); Object.assign(p, data); }
    else {
      if (db.products.some(x => x.name === name) && !(await ask('يوجد منتج بنفس الاسم. إضافة على أي حال؟'))) return;
      p = Object.assign({ id: uid(), createdAt: today() }, data); db.products.push(p);
    }
    save();
    if (fromPicker && ed) { edAdd(p); toast('تمت الإضافة للفاتورة'); closeSheet(); return; }
    closeSheet(); toast('تم الحفظ'); render();
  }
  async function deleteProduct(id) {
    if (!(await ask('حذف المنتج؟ (الفواتير القديمة لن تتأثر)'))) return;
    db.products = db.products.filter(p => p.id !== id);
    save(); closeSheet(); render(); toast('تم الحذف');
  }

  /* ---------- Customers & Suppliers ---------- */
  const PARTY = {
    customer: { list: () => db.customers, set: v => { db.customers = v; }, one: 'زبون', many: 'العملاء', pay: () => db.payments, payVerb: 'قبض دفعة من الزبون', invoices: id => db.sales.filter(s => s.customerId === id), invKind: 'sale', route: 'customers' },
    supplier: { list: () => db.suppliers, set: v => { db.suppliers = v; }, one: 'مورد', many: 'الموردون', pay: () => db.supplierPayments, payVerb: 'تسديد دفعة للمورد', invoices: id => db.purchases.filter(s => s.supplierId === id), invKind: 'purchase', route: 'suppliers' }
  };
  let partyQuery = '';
  function partyList(kind) {
    const P = PARTY[kind];
    setTop(P.many, plusBtn(`App.partyForm('${kind}')`));
    const all = P.list().map(c => ({ c, bal: partyBalance(kind, c.id) }));
    const mine = sum(all, x => kind === 'customer' ? Math.max(0, x.bal) : Math.max(0, -x.bal));
    const theirs = sum(all, x => kind === 'customer' ? Math.max(0, -x.bal) : Math.max(0, x.bal));
    let list = all;
    if (partyQuery.trim()) list = list.filter(x => x.c.name.includes(partyQuery.trim()) || (x.c.phone || '').includes(partyQuery.trim()));
    list.sort((a, b) => b.bal - a.bal || a.c.name.localeCompare(b.c.name, 'ar'));
    V(`
      <div class="stats">
        <div class="stat warn"><div class="l">مطلوب لي (عليهم)</div><div class="v">${money(mine)}</div></div>
        <div class="stat bad"><div class="l">أنا مطلوب (لهم)</div><div class="v">${money(theirs)}</div></div>
      </div>
      <div class="btn-row" style="margin:0 0 12px">
        <button class="btn" onclick="App.partyForm('${kind}')">+ ${P.one} جديد</button>
        <button class="btn secondary" onclick="App.paymentForm('${kind}')">${kind === 'customer' ? 'قبض دفعة' : 'تسديد دفعة'}</button>
      </div>
      <div class="search"><input class="input" placeholder="بحث بالاسم أو الهاتف" value="${esc(partyQuery)}" oninput="App.partySearch('${kind}',this.value)"></div>
      ${list.length ? `<div class="list">${list.map(({ c, bal }) => `<div class="row" onclick="App.showParty('${kind}','${c.id}')">
        <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(digits(c.phone || ''))}</div></div>
        <div class="end">${balBadge(kind, bal)}</div>
        <span class="chev">‹</span></div>`).join('')}</div>` : `<div class="card empty">لا يوجد ${P.many}</div>`}
    `);
  }
  function partyForm(kind, id, onSaved) {
    const P = PARTY[kind];
    const c = id ? byId(P.list(), id) : null;
    openSheet(c ? 'تعديل ' + P.one : P.one + ' جديد', `
      <label class="field"><span>الاسم *</span><input class="input" id="cName" value="${esc(c ? c.name : '')}"></label>
      <label class="field"><span>${kind === 'customer' ? 'رقم الواتساب' : 'رقم الهاتف'}</span><input class="input" id="cPhone" type="tel" inputmode="tel" value="${esc(c ? c.phone : '')}" placeholder="07xxxxxxxxx"></label>
      <label class="field"><span>العنوان / ملاحظات</span><input class="input" id="cNotes" value="${esc(c ? c.notes : '')}"></label>
      <div class="card">
        <div class="bold" style="margin-bottom:8px">الرصيد الافتتاحي (الحساب القديم قبل البرنامج)</div>
        <div class="seg" id="cDirSeg">
          <button type="button" data-dir="me" class="${!c || (Number(c.opening) || 0) * (kind === 'customer' ? 1 : -1) >= 0 ? 'on' : ''}" onclick="App.setDir(this)">${kind === 'customer' ? 'عليه (مطلوب لي)' : 'عليه (مطلوب لي)'}</button>
          <button type="button" data-dir="them" class="${c && (Number(c.opening) || 0) * (kind === 'customer' ? 1 : -1) < 0 ? 'on' : ''}" onclick="App.setDir(this)">له (أنا مطلوب له)</button>
        </div>
        <label class="field" style="margin:0"><span>المبلغ</span><input class="input money" inputmode="numeric" id="cOpen" placeholder="0" value="${fmtIn(c ? Math.abs(Number(c.opening) || 0) : 0)}"></label>
        <div class="small muted" style="margin-top:8px">${kind === 'customer' ? 'إذا كنت مطلوباً للزبون اختر «له»، وعند بيعه بضاعة بالآجل تُخصم قيمتها من رصيده تلقائياً.' : 'إذا كنت مطلوباً للمورد اختر «له».'}</div>
      </div>
      <button class="btn block" id="cSave">حفظ</button>
    `);
    setTimeout(() => { const el = $('#cName'); if (el && !c) el.focus(); }, 250);
    $('#cSave').onclick = () => {
      const name = val('cName'); if (!name) return toast('اكتب الاسم');
      let rec;
      const amt = Math.abs(Math.round(nval('cOpen')));
      const dirBtn = document.querySelector('#cDirSeg .on');
      const owesMe = !dirBtn || dirBtn.dataset.dir === 'me';
      // العميل: موجب = عليه. المورد: موجب = له (أنا مطلوب)
      const opening = (kind === 'customer') === owesMe ? amt : -amt;
      if (c) { Object.assign(c, { name, phone: val('cPhone'), notes: val('cNotes'), opening }); rec = c; }
      else {
        rec = { id: uid(), name, phone: val('cPhone'), notes: val('cNotes'), opening, openingDate: today(), createdAt: today() };
        P.list().push(rec);
      }
      save(); closeSheet(); toast('تم الحفظ');
      if (onSaved) onSaved(rec); else render();
    };
  }
  function showParty(kind, id) {
    const P = PARTY[kind];
    const c = byId(P.list(), id); if (!c) return;
    const invs = P.invoices(id);
    const pays = P.pay().filter(p => p.partyId === id);
    const bal = partyBalance(kind, id);
    const rows = [
      ...invs.map(s => ({ date: s.date, ts: s.createdAt || '', html: `<div class="row" onclick="App.showInvoice('${P.invKind}','${s.id}')"><div class="grow"><div class="t">${s.items.length ? (kind === 'customer' ? 'فاتورة بيع' : 'فاتورة شراء') + ' #' + num(s.no) : esc(s.note || 'رصيد افتتاحي')}</div><div class="s">${fmtDate(s.date)} · ${s.type === 'credit' ? 'آجل' : 'نقدي'}</div></div><div class="end"><div>${money(s.total)}</div>${s.total - s.paid > 0 ? `<div class="small muted">على الحساب ${money(s.total - s.paid)}</div>` : ''}</div></div>` })),
      ...pays.map(p => ({ date: p.date, ts: p.createdAt || '', html: `<div class="row" onclick="App.deletePayment('${kind}','${p.id}')"><div class="grow"><div class="t pos">${kind === 'customer' ? 'دفعة مقبوضة' : 'دفعة مسددة'}</div><div class="s">${fmtDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</div></div><div class="end pos bold">${money(p.amount)}</div></div>` }))
    ].sort((a, b) => (b.date + b.ts).localeCompare(a.date + a.ts));
    const op = Number(c.opening) || 0;
    if (op) rows.push({ html: `<div class="row" onclick="App.partyForm('${kind}','${id}')"><div class="grow"><div class="t">رصيد افتتاحي</div><div class="s">${fmtDate(c.openingDate || c.createdAt)} · اضغط للتعديل</div></div><div class="end">${balBadge(kind, op)}</div></div>` });
    const totalInv = sum(invs, s => s.total);
    const owesMe = kind === 'customer' ? bal > 0 : bal < 0;
    openSheet(c.name, `
      <div class="stats">
        <div class="stat wide ${!Math.round(bal) ? 'good' : owesMe ? 'warn' : 'bad'}"><div class="l">${!Math.round(bal) ? 'الحساب مسدد' : owesMe ? 'الرصيد: عليه (مطلوب لي)' : 'الرصيد: له (أنا مطلوب له)'}</div><div class="v">${money(Math.abs(bal))}</div>
        ${!owesMe && Math.round(bal) && kind === 'customer' ? '<div class="small muted">يُسدد من البضاعة: عند بيعه بالآجل تُخصم القيمة من رصيده.</div>' : ''}</div>
        <div class="stat"><div class="l">${kind === 'customer' ? 'إجمالي المشتريات' : 'إجمالي التوريد'}</div><div class="v">${money(totalInv)}</div></div>
        <div class="stat"><div class="l">عدد الفواتير</div><div class="v">${num(invs.filter(s => s.items.length).length)}</div></div>
      </div>
      ${c.phone ? `<div class="card"><div class="kv"><span class="k">الهاتف</span><a class="v" href="tel:${esc(c.phone)}">${esc(digits(c.phone))}</a></div>${c.notes ? `<div class="kv"><span class="k">ملاحظات</span><span class="v">${esc(c.notes)}</span></div>` : ''}</div>` : ''}
      <div class="btn-row">
        <button class="btn" onclick="App.paymentForm('${kind}','${id}')">${kind === 'customer' ? 'قبض دفعة' : 'تسديد دفعة'}</button>
        ${waNumber(c.phone) ? `<a class="btn wa-btn" href="${esc(waLink(c.phone, statementText(kind, id)))}" target="_blank" rel="noopener">كشف حساب واتساب</a>` : `<button class="btn secondary" onclick="App.shareStatement('${kind}','${id}')">إرسال كشف حساب</button>`}
      </div>
      <div class="section-title">كشف الحساب</div>
      ${rows.length ? `<div class="list">${rows.map(r => r.html).join('')}</div>` : '<div class="card empty">لا توجد حركات</div>'}
      <div class="btn-row">
        <button class="btn secondary" onclick="App.partyForm('${kind}','${id}')">تعديل البيانات</button>
        <button class="btn danger" onclick="App.deleteParty('${kind}','${id}')">حذف</button>
      </div>
    `);
  }
  function shareStatement(kind, id) { shareText(statementText(kind, id), 'كشف حساب'); }
  function statementText(kind, id) {
    const P = PARTY[kind]; const c = byId(P.list(), id);
    const invs = P.invoices(id); const pays = P.pay().filter(p => p.partyId === id);
    const lines = [db.settings.shopName, 'كشف حساب: ' + c.name, 'بتاريخ ' + fmtDate(today()), ''];
    if (Number(c.opening)) lines.push('رصيد افتتاحي: ' + balWord(kind, Number(c.opening)));
    invs.slice(-15).forEach(s => lines.push(`${fmtDate(s.date)}  ${s.items.length ? 'فاتورة #' + num(s.no) : (s.note || 'رصيد سابق')}: ${money(s.total)}${s.paid ? ' (مدفوع ' + money(s.paid) + ')' : ''}`));
    pays.slice(-15).forEach(p => lines.push(`${fmtDate(p.date)}  دفعة: ${money(p.amount)}`));
    lines.push('', 'الرصيد: ' + balWord(kind, partyBalance(kind, id)));
    return lines.join('\n');
  }
  async function deleteParty(kind, id) {
    const P = PARTY[kind];
    if (P.invoices(id).length || P.pay().some(p => p.partyId === id)) return ask('لا يمكن حذف ' + P.one + ' لديه فواتير أو دفعات. احذف الحركات أولاً.', { cancel: false });
    if (!(await ask('حذف ' + P.one + '؟'))) return;
    P.set(P.list().filter(c => c.id !== id));
    save(); closeSheet(); render();
  }
  function paymentForm(kind, partyId) {
    const P = PARTY[kind];
    const list = P.list();
    if (!list.length) return toast('لا يوجد ' + P.many + ' بعد');
    const opts = list.map(c => ({ c, b: partyBalance(kind, c.id) })).sort((a, b) => b.b - a.b);
    openSheet(P.payVerb, `
      <label class="field"><span>${P.one === 'زبون' ? 'الزبون' : 'المورد'}</span>
        <select class="input" id="payParty" onchange="App.payHint('${kind}')">${opts.map(({ c, b }) => `<option value="${c.id}" ${c.id === partyId ? 'selected' : ''}>${esc(c.name)} — ${balWord(kind, b)}</option>`).join('')}</select></label>
      <div class="card small" id="payHint"></div>
      <label class="field"><span>المبلغ *</span><input class="input money" inputmode="numeric" id="payAmt" placeholder="0"></label>
      <label class="field"><span>التاريخ</span><input type="date" class="input" id="payDate" value="${today()}"></label>
      <label class="field"><span>ملاحظة</span><input class="input" id="payNote"></label>
      <button class="btn block" onclick="App.savePayment('${kind}')">حفظ الدفعة</button>
    `);
    payHint(kind);
  }
  function payHint(kind) {
    const id = val('payParty'); const b = partyBalance(kind, id);
    $('#payHint').innerHTML = `الرصيد الحالي: <b>${balWord(kind, b)}</b> ${b > 0 ? `<button class="link-btn" onclick="document.getElementById('payAmt').value='${fmtIn(b)}'">تسديد الكل</button>` : ''}`;
  }
  function savePayment(kind) {
    const amount = Math.round(nval('payAmt'));
    if (amount <= 0) return toast('اكتب المبلغ');
    const partyId = val('payParty');
    PARTY[kind].pay().push({ id: uid(), partyId, amount, date: val('payDate') || today(), note: val('payNote'), createdAt: new Date().toISOString() });
    save(); closeSheet(); toast('تم حفظ الدفعة'); render();
    if (location.hash.slice(1) === PARTY[kind].route) setTimeout(() => showParty(kind, partyId), 50);
  }
  async function deletePayment(kind, pid) {
    const arr = PARTY[kind].pay(); const p = byId(arr, pid); if (!p) return;
    if (!(await ask('حذف هذه الدفعة (' + money(p.amount) + ')؟'))) return;
    arr.splice(arr.indexOf(p), 1); save(); closeSheet(); render(); toast('تم الحذف');
  }

  /* ---------- Expenses ---------- */
  let expMonth = thisMonth();
  function expenses() {
    setTop('المصاريف', plusBtn('App.expenseForm()'));
    const list = db.expenses.filter(e => e.date.startsWith(expMonth)).sort((a, b) => b.date.localeCompare(a.date));
    const total = sum(list, e => e.amount);
    const cats = {};
    list.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    V(`
      <label class="field"><span>الشهر</span><input type="month" class="input" value="${expMonth}" onchange="App.setExpMonth(this.value)"></label>
      <div class="stats"><div class="stat wide bad"><div class="l">مصاريف ${monthName(expMonth)}</div><div class="v">${money(total)}</div></div></div>
      <button class="btn block" style="margin-bottom:12px" onclick="App.expenseForm()">+ إضافة مصروف</button>
      ${Object.keys(cats).length ? `<div class="card">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
        <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span>${esc(k)}</span><b>${money(v)}</b></div>
        <div class="bar"><i style="width:${(v / total * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>` : ''}
      ${list.length ? `<div class="list">${list.map(e => `<div class="row" onclick="App.expenseForm('${e.id}')">
        <div class="grow"><div class="t">${esc(e.category)}</div><div class="s">${fmtDate(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</div></div>
        <div class="end bold neg">${money(e.amount)}</div></div>`).join('')}</div>` : '<div class="card empty">لا توجد مصاريف في هذا الشهر</div>'}
    `);
  }
  function expenseForm(id) {
    const e = id ? byId(db.expenses, id) : null;
    const cats = Array.from(new Set(EXP_CATS.concat(db.expenses.map(x => x.category))));
    openSheet(e ? 'تعديل مصروف' : 'مصروف جديد', `
      <label class="field"><span>نوع المصروف</span>
        <div class="chips" id="catChips">${cats.map(c => `<button class="chip ${e && e.category === c ? 'on' : ''}" onclick="App.pickCat(this)">${esc(c)}</button>`).join('')}</div>
        <input class="input" id="eCat" placeholder="أو اكتب نوعاً آخر" value="${esc(e ? e.category : '')}">
      </label>
      <label class="field"><span>المبلغ *</span><input class="input money" inputmode="numeric" id="eAmt" value="${fmtIn(e ? e.amount : 0)}" placeholder="0"></label>
      <label class="field"><span>التاريخ</span><input type="date" class="input" id="eDate" value="${e ? e.date : today()}"></label>
      <label class="field"><span>ملاحظة</span><input class="input" id="eNote" value="${esc(e ? e.note : '')}"></label>
      <button class="btn block" onclick="App.saveExpense('${e ? e.id : ''}')">حفظ</button>
      ${e ? `<div class="btn-row"><button class="btn danger" onclick="App.deleteExpense('${e.id}')">حذف</button></div>` : ''}
    `);
  }
  function saveExpense(id) {
    const amount = Math.round(nval('eAmt'));
    const category = val('eCat') || 'أخرى';
    if (amount <= 0) return toast('اكتب المبلغ');
    const data = { category, amount, date: val('eDate') || today(), note: val('eNote') };
    if (id) Object.assign(byId(db.expenses, id), data);
    else db.expenses.push(Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data));
    save(); closeSheet(); toast('تم الحفظ'); render();
  }
  async function deleteExpense(id) {
    if (!(await ask('حذف المصروف؟'))) return;
    db.expenses = db.expenses.filter(e => e.id !== id); save(); closeSheet(); render();
  }

  /* ---------- Employees & Payroll ---------- */
  function employees() {
    setTop('الموظفون', plusBtn('App.employeeForm()'));
    const act = db.employees.filter(e => e.active !== false);
    V(`
      <div class="stats">
        <div class="stat"><div class="l">عدد الموظفين</div><div class="v">${num(act.length)}</div></div>
        <div class="stat"><div class="l">مجموع الرواتب الشهرية</div><div class="v">${money(sum(act, e => e.salary))}</div></div>
      </div>
      <div class="btn-row" style="margin:0 0 12px">
        <button class="btn" onclick="App.employeeForm()">+ موظف جديد</button>
        <button class="btn secondary" onclick="App.go('payroll')">صرف الرواتب</button>
      </div>
      ${db.employees.length ? `<div class="list">${db.employees.map(e => {
        const adv = advBalance(e.id);
        return `<div class="row" onclick="App.showEmployee('${e.id}')"><div class="grow"><div class="t">${esc(e.name)} ${e.active === false ? '<span class="badge b-gray">متوقف</span>' : ''}</div>
        <div class="s">${esc(e.job || '')}${e.job ? ' · ' : ''}الراتب ${money(e.salary)}</div></div>
        <div class="end">${adv > 0 ? `<span class="badge b-amber">سلف ${money(adv)}</span>` : ''}</div><span class="chev">‹</span></div>`;
      }).join('')}</div>` : '<div class="card empty">لا يوجد موظفون. أضف موظفيك لترتيب صرف رواتبهم.</div>'}
      <div class="card small muted"><b>طريقة صرف الرواتب:</b><br>
      ١. أضف الموظف مع راتبه الشهري.<br>
      ٢. خلال الشهر سجّل أي <b>سلفة</b> يأخذها الموظف.<br>
      ٣. نهاية الشهر من «صرف الرواتب» اختر الشهر واضغط «صرف»؛ يحسب البرنامج: الراتب + المكافأة − الخصومات − السلف = <b>الصافي المستلم</b>.<br>
      ٤. تظهر الرواتب تلقائياً في تقرير الأرباح والمصاريف.</div>
    `);
  }
  function employeeForm(id) {
    const e = id ? byId(db.employees, id) : null;
    openSheet(e ? 'تعديل موظف' : 'موظف جديد', `
      <label class="field"><span>الاسم *</span><input class="input" id="emName" value="${esc(e ? e.name : '')}"></label>
      <div class="grid2">
        <label class="field"><span>العمل / الوظيفة</span><input class="input" id="emJob" value="${esc(e ? e.job : '')}" placeholder="بائع، محاسب…"></label>
        <label class="field"><span>الهاتف</span><input class="input" id="emPhone" type="tel" inputmode="tel" value="${esc(e ? e.phone : '')}"></label>
      </div>
      <div class="grid2">
        <label class="field"><span>الراتب الشهري *</span><input class="input money" inputmode="numeric" id="emSal" value="${fmtIn(e ? e.salary : 0)}" placeholder="0"></label>
        <label class="field"><span>تاريخ المباشرة</span><input type="date" class="input" id="emStart" value="${e ? e.startDate || '' : today()}"></label>
      </div>
      ${e ? `<label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="emActive" ${e.active !== false ? 'checked' : ''} style="width:22px;height:22px"> <span style="margin:0">الموظف على رأس العمل</span></label>` : ''}
      <button class="btn block" onclick="App.saveEmployee('${e ? e.id : ''}')">حفظ</button>
      ${e ? `<div class="btn-row"><button class="btn danger" onclick="App.deleteEmployee('${e.id}')">حذف الموظف</button></div>` : ''}
    `);
  }
  function saveEmployee(id) {
    const name = val('emName'); const salary = Math.round(nval('emSal'));
    if (!name) return toast('اكتب اسم الموظف');
    const data = { name, job: val('emJob'), phone: val('emPhone'), salary, startDate: val('emStart') };
    if (id) { const e = byId(db.employees, id); Object.assign(e, data); e.active = $('#emActive').checked; }
    else db.employees.push(Object.assign({ id: uid(), active: true }, data));
    save(); closeSheet(); toast('تم الحفظ'); render();
  }
  async function deleteEmployee(id) {
    if (db.payrolls.some(p => p.employeeId === id) || db.advances.some(a => a.employeeId === id)) {
      return ask('لهذا الموظف رواتب أو سلف مسجلة. بدلاً من الحذف، عدّل بياناته وأزل علامة «على رأس العمل».', { cancel: false });
    }
    if (!(await ask('حذف الموظف؟'))) return;
    db.employees = db.employees.filter(e => e.id !== id); save(); closeSheet(); render();
  }
  function showEmployee(id) {
    const e = byId(db.employees, id); if (!e) return;
    const adv = advBalance(id);
    const items = [
      ...db.advances.filter(a => a.employeeId === id).map(a => ({ d: a.date, html: `<div class="row" onclick="App.deleteAdvance('${a.id}')"><div class="grow"><div class="t">سلفة</div><div class="s">${fmtDate(a.date)}${a.note ? ' · ' + esc(a.note) : ''}</div></div><div class="end bold" style="color:var(--amber)">${money(a.amount)}</div></div>` })),
      ...db.payrolls.filter(p => p.employeeId === id).map(p => ({ d: p.date, html: `<div class="row" onclick="App.showPayslip('${p.id}')"><div class="grow"><div class="t">راتب ${monthName(p.month)}</div><div class="s">صُرف ${fmtDate(p.date)}</div></div><div class="end bold pos">${money(p.net)}</div></div>` }))
    ].sort((a, b) => b.d.localeCompare(a.d));
    openSheet(e.name, `
      <div class="stats">
        <div class="stat"><div class="l">الراتب الشهري</div><div class="v">${money(e.salary)}</div></div>
        <div class="stat ${adv > 0 ? 'warn' : ''}"><div class="l">السلف غير المخصومة</div><div class="v">${money(adv)}</div></div>
      </div>
      <div class="btn-row">
        <button class="btn" onclick="App.payrollForm('${id}','${thisMonth()}')">صرف راتب</button>
        <button class="btn secondary" onclick="App.advanceForm('${id}')">تسجيل سلفة</button>
      </div>
      <div class="section-title">السجل</div>
      ${items.length ? `<div class="list">${items.map(x => x.html).join('')}</div>` : '<div class="card empty">لا توجد حركات</div>'}
      <div class="btn-row"><button class="btn secondary" onclick="App.employeeForm('${id}')">تعديل البيانات</button></div>
    `);
  }
  function advanceForm(empId) {
    const act = db.employees.filter(e => e.active !== false);
    if (!act.length) return toast('أضف موظفاً أولاً');
    openSheet('سلفة موظف', `
      <label class="field"><span>الموظف</span><select class="input" id="aEmp">${act.map(e => `<option value="${e.id}" ${e.id === empId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>المبلغ *</span><input class="input money" inputmode="numeric" id="aAmt" placeholder="0"></label>
      <label class="field"><span>التاريخ</span><input type="date" class="input" id="aDate" value="${today()}"></label>
      <label class="field"><span>ملاحظة</span><input class="input" id="aNote"></label>
      <div class="card small muted">تُخصم السلفة من راتب الموظف عند صرف الراتب.</div>
      <button class="btn block" onclick="App.saveAdvance()">حفظ السلفة</button>
    `);
  }
  function saveAdvance() {
    const amount = Math.round(nval('aAmt')); if (amount <= 0) return toast('اكتب المبلغ');
    db.advances.push({ id: uid(), employeeId: val('aEmp'), amount, date: val('aDate') || today(), note: val('aNote') });
    save(); closeSheet(); toast('تم تسجيل السلفة'); render();
  }
  async function deleteAdvance(id) {
    const a = byId(db.advances, id); if (!a) return;
    if (!(await ask('حذف السلفة (' + money(a.amount) + ')؟'))) return;
    db.advances = db.advances.filter(x => x.id !== id); save(); closeSheet(); render();
  }

  let payMonth = thisMonth();
  function payroll() {
    setTop('صرف الرواتب');
    const act = db.employees.filter(e => e.active !== false || db.payrolls.some(p => p.employeeId === e.id && p.month === payMonth));
    const paid = db.payrolls.filter(p => p.month === payMonth);
    const unpaid = act.filter(e => !paid.some(p => p.employeeId === e.id));
    V(`
      <label class="field"><span>الشهر</span><input type="month" class="input" value="${payMonth}" onchange="App.setPayMonth(this.value)"></label>
      <div class="stats">
        <div class="stat good"><div class="l">المصروف لشهر ${monthName(payMonth)}</div><div class="v">${money(sum(paid, p => p.net))}</div></div>
        <div class="stat warn"><div class="l">المتبقي (${num(unpaid.length)} موظف)</div><div class="v">${money(sum(unpaid, e => Math.max(0, e.salary - advBalance(e.id))))}</div></div>
      </div>
      ${unpaid.length > 1 ? `<button class="btn block" style="margin-bottom:12px" onclick="App.payAll()">صرف رواتب الجميع (${num(unpaid.length)})</button>` : ''}
      ${act.length ? `<div class="list">${act.map(e => {
        const p = paid.find(x => x.employeeId === e.id);
        const adv = advBalance(e.id);
        return `<div class="row" onclick="${p ? `App.showPayslip('${p.id}')` : `App.payrollForm('${e.id}','${payMonth}')`}">
          <div class="grow"><div class="t">${esc(e.name)}</div><div class="s">الراتب ${money(e.salary)}${adv > 0 ? ' · سلف ' + money(adv) : ''}</div></div>
          <div class="end">${p ? `<span class="badge b-green">✓ صُرف ${money(p.net)}</span>` : '<span class="badge b-blue">صرف</span>'}</div></div>`;
      }).join('')}</div>` : '<div class="card empty">لا يوجد موظفون. <a href="#employees">أضف موظفاً</a></div>'}
    `);
  }
  async function payrollForm(empId, month) {
    const e = byId(db.employees, empId); if (!e) return;
    if (db.payrolls.some(p => p.employeeId === empId && p.month === month) && !(await ask('تم صرف راتب ' + monthName(month) + ' لهذا الموظف سابقاً. صرف مرة أخرى؟'))) return;
    const adv = advBalance(empId);
    openSheet('صرف راتب: ' + e.name, `
      <label class="field"><span>عن شهر</span><input type="month" class="input" id="prMonth" value="${month}"></label>
      <label class="field"><span>الراتب الأساسي</span><input class="input money" inputmode="numeric" id="prBase" value="${fmtIn(e.salary)}" oninput="App.prCalc()"></label>
      <div class="grid2">
        <label class="field"><span>مكافأة / إضافي</span><input class="input money" inputmode="numeric" id="prBonus" placeholder="0" oninput="App.prCalc()"></label>
        <label class="field"><span>خصم (غياب/تأخير)</span><input class="input money" inputmode="numeric" id="prDed" placeholder="0" oninput="App.prCalc()"></label>
      </div>
      <label class="field"><span>خصم السلف (رصيد السلف: ${money(adv)})</span><input class="input money" inputmode="numeric" id="prAdv" value="${fmtIn(Math.min(adv, e.salary))}" oninput="App.prCalc()"></label>
      <label class="field"><span>تاريخ الصرف</span><input type="date" class="input" id="prDate" value="${today()}"></label>
      <label class="field"><span>ملاحظة</span><input class="input" id="prNote"></label>
      <div class="card totals" id="prTotals"></div>
      <button class="btn block" onclick="App.savePayroll('${empId}')">تأكيد الصرف</button>
    `);
    prCalc();
  }
  function prCalc() {
    const base = nval('prBase'), bonus = nval('prBonus'), ded = nval('prDed'), adv = nval('prAdv');
    const net = base + bonus - ded - adv;
    $('#prTotals').innerHTML = `
      <div class="tr"><span class="muted">الراتب + المكافأة</span><span>${money(base + bonus)}</span></div>
      <div class="tr"><span class="muted">الخصومات + السلف</span><span>− ${money(ded + adv)}</span></div>
      <div class="tr big"><span>الصافي المستلم</span><span class="${net < 0 ? 'neg' : ''}">${money(net)}</span></div>`;
  }
  function savePayroll(empId) {
    const base = Math.round(nval('prBase')), bonus = Math.round(nval('prBonus')), deduction = Math.round(nval('prDed'));
    const advDeducted = Math.round(nval('prAdv'));
    const net = base + bonus - deduction - advDeducted;
    if (advDeducted > advBalance(empId)) return toast('خصم السلف أكبر من رصيد السلف');
    if (net < 0) return toast('الصافي بالسالب، قلل خصم السلف');
    const rec = { id: uid(), employeeId: empId, month: val('prMonth') || payMonth, base, bonus, deduction, advDeducted, net, date: val('prDate') || today(), note: val('prNote') };
    db.payrolls.push(rec); save(); closeSheet(); toast('تم صرف الراتب'); render();
    setTimeout(() => showPayslip(rec.id), 50);
  }
  async function payAll() {
    const paidIds = db.payrolls.filter(p => p.month === payMonth).map(p => p.employeeId);
    const list = db.employees.filter(e => e.active !== false && !paidIds.includes(e.id));
    const rows = list.map(e => { const adv = Math.min(advBalance(e.id), e.salary); return { e, adv, net: e.salary - adv }; });
    if (!(await ask(`صرف رواتب ${monthName(payMonth)} لـ ${list.length} موظف؟\nالمجموع الصافي: ${money(sum(rows, r => r.net))}\n(يتم خصم السلف تلقائياً، بدون مكافآت أو خصومات)`))) return;
    rows.forEach(({ e, adv, net }) => db.payrolls.push({ id: uid(), employeeId: e.id, month: payMonth, base: e.salary, bonus: 0, deduction: 0, advDeducted: adv, net, date: today(), note: '' }));
    save(); render(); toast('تم صرف الرواتب');
  }
  function payslipHTML(p) {
    const e = byId(db.employees, p.employeeId) || { name: '—' };
    return `<div style="text-align:center;margin-bottom:10px"><h2 style="margin:0">${esc(db.settings.shopName)}</h2><div>قسيمة راتب — ${monthName(p.month)}</div></div>
      <div class="card">
        <div class="kv"><span class="k">الموظف</span><span class="v">${esc(e.name)}</span></div>
        <div class="kv"><span class="k">تاريخ الصرف</span><span class="v">${fmtDate(p.date)}</span></div>
        <div class="kv"><span class="k">الراتب الأساسي</span><span class="v">${money(p.base)}</span></div>
        <div class="kv"><span class="k">المكافأة / الإضافي</span><span class="v pos">+ ${money(p.bonus)}</span></div>
        <div class="kv"><span class="k">الخصومات</span><span class="v neg">− ${money(p.deduction)}</span></div>
        <div class="kv"><span class="k">السلف المخصومة</span><span class="v neg">− ${money(p.advDeducted)}</span></div>
        <div class="kv total"><span class="k">الصافي المستلم</span><span class="v">${money(p.net)}</span></div>
        ${p.note ? `<div class="kv"><span class="k">ملاحظة</span><span class="v">${esc(p.note)}</span></div>` : ''}
      </div>`;
  }
  function showPayslip(id) {
    const p = byId(db.payrolls, id); if (!p) return;
    openSheet('قسيمة الراتب', `${payslipHTML(p)}
      <div class="btn-row"><button class="btn secondary no-embed" onclick="App.printPayslip('${id}')">طباعة</button>
      <button class="btn secondary" onclick="App.payslipPDF('${id}')">PDF</button>
      <button class="btn danger" onclick="App.deletePayroll('${id}')">إلغاء الصرف</button></div>`);
  }
  async function deletePayroll(id) {
    if (!(await ask('إلغاء صرف هذا الراتب؟ (السلف المخصومة ستعود لرصيد الموظف)'))) return;
    db.payrolls = db.payrolls.filter(p => p.id !== id); save(); closeSheet(); render();
  }

  /* ---------- Reports ---------- */
  const rp = { preset: 'month', from: '', to: '', tab: 'profit' };
  function rpRange() {
    const n = new Date();
    if (rp.preset === 'today') return [today(), today()];
    if (rp.preset === 'week') { const d = new Date(n); d.setDate(d.getDate() - 6); return [dstr(d), today()]; }
    if (rp.preset === 'month') return [thisMonth() + '-01', thisMonth() + '-31'];
    if (rp.preset === 'last') { const d = new Date(n.getFullYear(), n.getMonth() - 1, 1); const m = dstr(d).slice(0, 7); return [m + '-01', m + '-31']; }
    if (rp.preset === 'year') return [n.getFullYear() + '-01-01', n.getFullYear() + '-12-31'];
    return [rp.from || today(), rp.to || today()];
  }
  function reports() {
    setTop('التقارير', `<button class="link-btn" onclick="App.reportPDF()">PDF</button>`);
    if (!rp.from) { rp.from = thisMonth() + '-01'; rp.to = today(); }
    const presets = [['today', 'اليوم'], ['week', 'آخر ٧ أيام'], ['month', 'هذا الشهر'], ['last', 'الشهر الماضي'], ['year', 'هذه السنة'], ['custom', 'فترة محددة']];
    const tabs = [['profit', 'الأرباح'], ['sales', 'المبيعات'], ['expenses', 'المصاريف'], ['customers', 'العملاء'], ['stock', 'المخزن'], ['salaries', 'الرواتب']];
    V(`
      <div class="chips">${presets.map(([k, l]) => `<button class="chip ${rp.preset === k ? 'on' : ''}" onclick="App.rpSet('preset','${k}')">${l}</button>`).join('')}</div>
      ${rp.preset === 'custom' ? `<div class="grid2"><label class="field"><span>من</span><input type="date" class="input" value="${rp.from}" onchange="App.rpSet('from',this.value)"></label>
        <label class="field"><span>إلى</span><input type="date" class="input" value="${rp.to}" onchange="App.rpSet('to',this.value)"></label></div>` : ''}
      <div class="seg">${tabs.map(([k, l]) => `<button class="${rp.tab === k ? 'on' : ''}" onclick="App.rpSet('tab','${k}')">${l}</button>`).join('')}</div>
      <div id="reportBody">${reportBody()}</div>
      <div class="btn-row">
        <button class="btn" onclick="App.reportPDF()">حفظ ومشاركة التقرير PDF</button>
        <button class="btn secondary no-embed" style="flex:0 0 auto" onclick="App.printReport()">طباعة</button>
      </div>
    `);
  }
  function reportBody() {
    const [from, to] = rpRange();
    const inR = d => d >= from && d <= to;
    const period = `<div class="small muted" style="margin:0 6px 8px">الفترة: ${fmtDate(from)} — ${fmtDate(to > today() ? today() : to)}</div>`;
    const empty = '<div class="card empty">لا توجد بيانات في هذه الفترة</div>';

    if (rp.tab === 'profit') {
      const r = profitIn(from, to);
      const sales = db.sales.filter(s => inR(s.date));
      const prod = {};
      sales.forEach(s => s.items.forEach(l => {
        const k = l.productId || l.name; prod[k] = prod[k] || { name: l.name, qty: 0, rev: 0, profit: 0 };
        prod[k].qty += l.qty; prod[k].rev += l.qty * l.price; prod[k].profit += l.qty * (l.price - l.cost);
      }));
      const top = Object.values(prod).sort((a, b) => b.profit - a.profit).slice(0, 10);
      return period + `
        <div class="card">
          <div class="kv"><span class="k">إجمالي المبيعات (${num(r.count)} فاتورة)</span><span class="v">${money(r.revenue)}</span></div>
          <div class="kv"><span class="k">كلفة البضاعة المباعة</span><span class="v neg">− ${money(r.cogs)}</span></div>
          <div class="kv"><span class="k bold">مجمل الربح</span><span class="v">${money(r.gross)}</span></div>
          <div class="kv"><span class="k">المصاريف</span><span class="v neg">− ${money(r.expenses)}</span></div>
          <div class="kv"><span class="k">الرواتب</span><span class="v neg">− ${money(r.salaries)}</span></div>
          <div class="kv total"><span class="k">صافي الربح</span><span class="v ${r.net >= 0 ? 'pos' : 'neg'}">${money(r.net)}</span></div>
          ${r.revenue ? `<div class="small muted" style="margin-top:6px">نسبة الربح الصافي من المبيعات: ${num((r.net / r.revenue * 100).toFixed(1))}٪</div>` : ''}
        </div>
        <div class="section-title">أكثر المنتجات ربحاً</div>
        ${top.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">المبيعات</th><th class="n">الربح</th></tr></thead>
          <tbody>${top.map(p => `<tr><td>${esc(p.name)}</td><td class="n">${num(p.qty)}</td><td class="n">${num(p.rev)}</td><td class="n ${p.profit >= 0 ? 'pos' : 'neg'}">${num(p.profit)}</td></tr>`).join('')}</tbody></table></div>` : empty}`;
    }

    if (rp.tab === 'sales') {
      const sales = db.sales.filter(s => inR(s.date) && s.items.length);
      const cash = sales.filter(s => s.type === 'cash'), credit = sales.filter(s => s.type === 'credit');
      const collected = sum(db.payments.filter(p => inR(p.date)), p => p.amount);
      const days = {};
      sales.forEach(s => { days[s.date] = (days[s.date] || 0) + s.total; });
      const maxDay = Math.max(1, ...Object.values(days));
      return period + `
        <div class="stats">
          <div class="stat wide"><div class="l">إجمالي المبيعات (${num(sales.length)} فاتورة)</div><div class="v">${money(sum(sales, s => s.total))}</div></div>
          <div class="stat good"><div class="l">بيع نقدي (${num(cash.length)})</div><div class="v">${money(sum(cash, s => s.total))}</div></div>
          <div class="stat warn"><div class="l">بيع آجل (${num(credit.length)})</div><div class="v">${money(sum(credit, s => s.total))}</div></div>
          <div class="stat"><div class="l">المقبوض من الآجل وقت البيع</div><div class="v">${money(sum(credit, s => s.paid))}</div></div>
          <div class="stat"><div class="l">دفعات محصلة من الزبائن</div><div class="v">${money(collected)}</div></div>
          <div class="stat"><div class="l">الخصومات الممنوحة</div><div class="v">${money(sum(sales, s => s.discount))}</div></div>
          <div class="stat"><div class="l">متوسط الفاتورة</div><div class="v">${money(sales.length ? sum(sales, s => s.total) / sales.length : 0)}</div></div>
        </div>
        ${Object.keys(days).length > 1 ? `<div class="section-title">المبيعات اليومية</div><div class="card">${Object.keys(days).sort().reverse().slice(0, 31).map(d => `
          <div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between" class="small"><span>${fmtDate(d)}</span><b>${money(days[d])}</b></div>
          <div class="bar"><i style="width:${(days[d] / maxDay * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>` : ''}
        <div class="section-title">الفواتير</div>
        ${sales.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>الزبون</th><th>النوع</th><th class="n">الإجمالي</th><th class="n">المتبقي</th></tr></thead>
          <tbody>${sales.slice().reverse().map(s => { const c = byId(db.customers, s.customerId); return `<tr onclick="App.showInvoice('sale','${s.id}')"><td>${num(s.no)}</td><td>${fmtDate(s.date)}</td><td>${esc(c ? c.name : 'نقدي')}</td><td>${s.type === 'credit' ? 'آجل' : 'نقدي'}</td><td class="n">${num(s.total)}</td><td class="n">${s.total - s.paid ? num(s.total - s.paid) : '—'}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="4">المجموع</td><td class="n">${num(sum(sales, s => s.total))}</td><td class="n">${num(sum(sales, s => s.total - s.paid))}</td></tr></tfoot></table></div>` : empty}`;
    }

    if (rp.tab === 'expenses') {
      const list = db.expenses.filter(e => inR(e.date));
      const sal = sum(db.payrolls.filter(p => inR(p.date)), payrollCost);
      const adv = sum(db.advances.filter(a => inR(a.date)), a => a.amount);
      const purch = sum(db.purchases.filter(p => inR(p.date) && p.items.length), p => p.total);
      const total = sum(list, e => e.amount);
      const cats = {};
      list.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
      return period + `
        <div class="stats">
          <div class="stat wide bad"><div class="l">المصاريف التشغيلية</div><div class="v">${money(total)}</div></div>
          <div class="stat"><div class="l">الرواتب</div><div class="v">${money(sal)}</div></div>
          <div class="stat"><div class="l">السلف المدفوعة</div><div class="v">${money(adv)}</div></div>
          <div class="stat wide"><div class="l">المشتريات (بضاعة)</div><div class="v">${money(purch)}</div></div>
        </div>
        <div class="section-title">حسب النوع</div>
        ${list.length ? `<div class="card">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
          <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span>${esc(k)}</span><b>${money(v)} <span class="muted small">(${num((v / total * 100).toFixed(0))}٪)</span></b></div>
          <div class="bar"><i style="width:${(v / total * 100).toFixed(1)}%;background:var(--red)"></i></div></div>`).join('')}</div>
        <div class="section-title">التفاصيل</div>
        <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th class="n">المبلغ</th></tr></thead>
          <tbody>${list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.category)}</td><td>${esc(e.note || '')}</td><td class="n">${num(e.amount)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">المجموع</td><td class="n">${num(total)}</td></tr></tfoot></table></div>` : empty}`;
    }

    if (rp.tab === 'customers') {
      const rows = db.customers.map(c => {
        const inv = db.sales.filter(s => s.customerId === c.id && inR(s.date) && s.items.length);
        const pays = db.payments.filter(p => p.partyId === c.id && inR(p.date));
        const last = db.sales.filter(s => s.customerId === c.id).map(s => s.date).sort().pop();
        return { c, count: inv.length, buy: sum(inv, s => s.total), paid: sum(inv, s => s.paid) + sum(pays, p => p.amount), bal: customerBalance(c.id), last };
      });
      const cashSales = db.sales.filter(s => !s.customerId && inR(s.date));
      const active = rows.filter(r => r.count || Math.round(r.bal)).sort((a, b) => b.buy - a.buy);
      const debtors = rows.filter(r => r.bal > 0).sort((a, b) => b.bal - a.bal);
      const creditors = rows.filter(r => r.bal < 0).sort((a, b) => a.bal - b.bal);
      return period + `
        <div class="stats">
          <div class="stat"><div class="l">عدد العملاء</div><div class="v">${num(db.customers.length)}</div></div>
          <div class="stat"><div class="l">اشتروا في الفترة</div><div class="v">${num(rows.filter(r => r.count).length)}</div></div>
          <div class="stat warn"><div class="l">عليهم - مطلوب لي (${num(debtors.length)})</div><div class="v">${money(sum(debtors, r => r.bal))}</div></div>
          <div class="stat bad"><div class="l">لهم - أنا مطلوب (${num(creditors.length)})</div><div class="v">${money(-sum(creditors, r => r.bal))}</div></div>
        </div>
        <div class="section-title">مشتريات العملاء في الفترة</div>
        ${active.length || cashSales.length ? `<div class="table-wrap"><table><thead><tr><th>الزبون</th><th class="n">الفواتير</th><th class="n">المشتريات</th><th class="n">المدفوع</th><th class="n">الرصيد الكلي</th><th>آخر شراء</th></tr></thead>
          <tbody>${active.map(r => `<tr onclick="App.showParty('customer','${r.c.id}')"><td>${esc(r.c.name)}</td><td class="n">${num(r.count)}</td><td class="n">${num(r.buy)}</td><td class="n">${num(r.paid)}</td><td class="n ${r.bal > 0 ? 'neg' : ''}">${balWord('customer', r.bal)}</td><td>${fmtDate(r.last)}</td></tr>`).join('')}
          ${cashSales.length ? `<tr><td class="muted">زبائن نقديون</td><td class="n">${num(cashSales.length)}</td><td class="n">${num(sum(cashSales, s => s.total))}</td><td class="n">${num(sum(cashSales, s => s.paid))}</td><td class="n">—</td><td></td></tr>` : ''}</tbody></table></div>` : empty}
        ${debtors.length ? `<div class="section-title">العملاء المدينون</div><div class="list">${debtors.map(r => `<div class="row" onclick="App.showParty('customer','${r.c.id}')"><div class="grow"><div class="t">${esc(r.c.name)}</div><div class="s">${esc(digits(r.c.phone || ''))}${r.last ? ' · آخر شراء ' + fmtDate(r.last) : ''}</div></div><div class="end bold neg">${money(r.bal)}</div></div>`).join('')}</div>` : ''}
        ${creditors.length ? `<div class="section-title">عملاء لهم رصيد (أنا مطلوب لهم)</div><div class="list">${creditors.map(r => `<div class="row" onclick="App.showParty('customer','${r.c.id}')"><div class="grow"><div class="t">${esc(r.c.name)}</div><div class="s">${esc(digits(r.c.phone || ''))}</div></div><div class="end bold" style="color:var(--blue)">${money(-r.bal)}</div></div>`).join('')}</div>` : ''}`;
    }

    if (rp.tab === 'stock') {
      const ps = db.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const soldQ = {};
      db.sales.filter(s => inR(s.date)).forEach(s => s.items.forEach(l => { soldQ[l.productId] = (soldQ[l.productId] || 0) + l.qty; }));
      return period + `
        <div class="stats">
          <div class="stat"><div class="l">عدد الأصناف</div><div class="v">${num(ps.length)}</div></div>
          <div class="stat bad"><div class="l">نفدت / قاربت</div><div class="v">${num(ps.filter(p => p.qty <= (p.minQty || 0)).length)}</div></div>
          <div class="stat"><div class="l">قيمة المخزن بالكلفة</div><div class="v">${money(sum(ps, p => Math.max(0, p.qty) * p.cost))}</div></div>
          <div class="stat good"><div class="l">الربح المتوقع للمخزن</div><div class="v">${money(sum(ps, p => Math.max(0, p.qty) * (p.price - p.cost)))}</div></div>
        </div>
        ${ps.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th><th class="n">المتوفر</th><th class="n">مباع بالفترة</th><th class="n">الكلفة</th><th class="n">البيع</th><th class="n">القيمة</th></tr></thead>
          <tbody>${ps.map(p => `<tr><td>${esc(p.name)} ${p.qty <= (p.minQty || 0) ? '<span class="badge b-red">!</span>' : ''}</td><td class="n">${num(p.qty)}</td><td class="n">${num(soldQ[p.id] || 0)}</td><td class="n">${num(p.cost)}</td><td class="n">${num(p.price)}</td><td class="n">${num(Math.max(0, p.qty) * p.cost)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">المجموع</td><td class="n">${num(sum(ps, p => Math.max(0, p.qty) * p.cost))}</td></tr></tfoot></table></div>` : '<div class="card empty">المخزن فارغ</div>'}`;
    }

    if (rp.tab === 'salaries') {
      const list = db.payrolls.filter(p => inR(p.date));
      const advs = db.advances.filter(a => inR(a.date));
      return period + `
        <div class="stats">
          <div class="stat"><div class="l">صافي الرواتب المدفوعة</div><div class="v">${money(sum(list, p => p.net))}</div></div>
          <div class="stat"><div class="l">السلف المدفوعة بالفترة</div><div class="v">${money(sum(advs, a => a.amount))}</div></div>
          <div class="stat wide"><div class="l">كلفة الرواتب (راتب + مكافأة − خصم)</div><div class="v">${money(sum(list, payrollCost))}</div></div>
        </div>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>الموظف</th><th>الشهر</th><th class="n">الأساسي</th><th class="n">مكافأة</th><th class="n">خصم</th><th class="n">سلف</th><th class="n">الصافي</th></tr></thead>
          <tbody>${list.map(p => { const e = byId(db.employees, p.employeeId); return `<tr onclick="App.showPayslip('${p.id}')"><td>${esc(e ? e.name : '—')}</td><td>${monthName(p.month)}</td><td class="n">${num(p.base)}</td><td class="n">${num(p.bonus)}</td><td class="n">${num(p.deduction)}</td><td class="n">${num(p.advDeducted)}</td><td class="n bold">${num(p.net)}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td colspan="6">المجموع</td><td class="n">${num(sum(list, p => p.net))}</td></tr></tfoot></table></div>` : empty}
        ${db.employees.some(e => advBalance(e.id) > 0) ? `<div class="section-title">سلف غير مخصومة</div><div class="list">${db.employees.filter(e => advBalance(e.id) > 0).map(e => `<div class="row" onclick="App.showEmployee('${e.id}')"><div class="grow t">${esc(e.name)}</div><div class="end bold" style="color:var(--amber)">${money(advBalance(e.id))}</div></div>`).join('')}</div>` : ''}`;
    }
    return '';
  }
  const REPORT_NAMES = { profit: 'تقرير الأرباح', sales: 'تقرير المبيعات', expenses: 'تقرير المصاريف', customers: 'تقرير العملاء', stock: 'تقرير المخزن', salaries: 'تقرير الرواتب' };
  function printReport() {
    printHTML(`<h2>${esc(db.settings.shopName)} — ${REPORT_NAMES[rp.tab]}</h2>` + $('#reportBody').innerHTML);
  }
  function reportPDF() {
    const [from, to] = rpRange();
    const name = REPORT_NAMES[rp.tab];
    makePDF(name, reportBody(), name.replace(/ /g, '-') + '-' + from + '_' + (to > today() ? today() : to) + '.pdf');
  }

  /* ---------- More & Settings ---------- */
  function more() {
    setTop('المزيد');
    const item = (href, icon, t, s) => `<a class="row" href="#${href}"><span style="font-size:22px">${icon}</span><div class="grow"><div class="t" style="color:var(--text)">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div><span class="chev">‹</span></a>`;
    V(`
      <div class="section-title">العمليات</div>
      <div class="list">
        ${item('purchases', '🚚', 'المشتريات', 'إدخال بضاعة للمخزن')}
        ${item('expenses', '💸', 'المصاريف', 'إيجار، كهرباء، مولدة…')}
      </div>
      <div class="section-title">الحسابات</div>
      <div class="list">
        ${item('customers', '🧑‍🤝‍🧑', 'العملاء', 'الديون وكشف الحساب والدفعات')}
        ${item('suppliers', '🏭', 'الموردون', 'ما علينا للموردين')}
      </div>
      <div class="section-title">الموظفون</div>
      <div class="list">
        ${item('employees', '👤', 'الموظفون', 'البيانات والسلف')}
        ${item('payroll', '💵', 'صرف الرواتب', 'الصرف الشهري وقسائم الرواتب')}
      </div>
      <div class="section-title">عام</div>
      <div class="list">${item('settings', '⚙️', 'الإعدادات والنسخ الاحتياطي', '')}</div>
    `);
  }
  function settings() {
    setTop('الإعدادات');
    const s = db.settings;
    V(`
      <div class="card">
        <label class="field"><span>اسم المحل</span><input class="input" id="sName" value="${esc(s.shopName)}"></label>
        <label class="field"><span>هاتف المحل (يظهر في الفاتورة)</span><input class="input" id="sPhone" type="tel" value="${esc(s.shopPhone)}"></label>
        <label class="field"><span>رصيد الصندوق الافتتاحي</span><input class="input money" inputmode="numeric" id="sOpen" value="${fmtIn(s.openingCash)}" placeholder="0"></label>
        <label class="field"><span>رمز العملة</span><input class="input" id="sCur" value="${esc(s.currency)}"></label>
        <label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="sTpl" ${s.invoiceTemplate !== false ? 'checked' : ''} style="width:22px;height:22px"><span style="margin:0">استخدام تصميم الفاتورة الخاص (SMART CARD) لفواتير البيع</span></label>
        <label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="sDig" ${s.arabicDigits ? 'checked' : ''} style="width:22px;height:22px"><span style="margin:0">عرض الأرقام بالهندية (١٢٣)</span></label>
        <button class="btn block" onclick="App.saveSettings()">حفظ الإعدادات</button>
      </div>
      <div class="section-title">تحديث البرنامج</div>
      <div class="card">
        <p class="small muted" style="margin-top:0">عند وصول تعديلات جديدة اضغط «تحديث البرنامج». بياناتك محفوظة على هذا الجهاز ولا تتأثر بالتحديث.</p>
        <button class="btn block" onclick="App.updateApp()">تحديث البرنامج</button>
      </div>
      <div class="section-title">النسخ الاحتياطي</div>
      <div class="card">
        <p class="small muted" style="margin-top:0">البيانات محفوظة على هذا الجهاز فقط. خذ نسخة احتياطية بشكل دوري واحفظها في «الملفات» أو أرسلها لنفسك على الواتساب/التلغرام.
        ${s.lastBackup ? `<br>آخر نسخة: <b>${fmtDate(s.lastBackup.slice(0, 10))}</b>` : ''}</p>
        <div class="btn-row">
          <button class="btn" onclick="App.exportData()">أخذ نسخة احتياطية ومشاركتها</button>
          <button class="btn secondary" onclick="document.getElementById('importFile').click()">استرجاع نسخة</button>
        </div>
        <button class="btn secondary block" style="margin-top:10px" onclick="App.importText()">استرجاع من نص</button>
        <input type="file" id="importFile" accept=".json,application/json" hidden onchange="App.importData(this)">
      </div>
      <div class="section-title">أخرى</div>
      <div class="card">
        ${!db.products.length && !db.sales.length ? `<button class="btn secondary block" style="margin-bottom:10px" onclick="App.loadDemo()">تحميل بيانات تجريبية للتجربة</button>` : ''}
        <button class="btn danger block" onclick="App.resetAll()">مسح جميع البيانات</button>
      </div>
      <p class="small muted" style="text-align:center">حساباتي — الإصدار ${APP_VERSION}</p>
    `);
  }
  function saveSettings() {
    Object.assign(db.settings, { shopName: val('sName') || 'متجري', shopPhone: val('sPhone'), openingCash: Math.round(nval('sOpen')), currency: val('sCur') || 'د.ع', arabicDigits: $('#sDig').checked, invoiceTemplate: $('#sTpl').checked });
    save(); toast('تم الحفظ'); render();
  }
  async function exportData() {
    db.settings.lastBackup = new Date().toISOString(); save();
    const json = JSON.stringify(db, null, 1);
    if (EMBED) {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) {
        try { await dl.save({ filename: 'hesabati-backup-' + today() + '.json', data: json }); toast('تم'); render(); return; }
        catch (e) { if (e && e.code === 'declined') return; }
      }
      await ask('انسخ هذا النص واحفظه في «الملاحظات» أو أرسله لنفسك. لاسترجاعه اضغط «استرجاع من نص» والصق النص.', { cancel: false, text: json });
      render(); return;
    }
    const name = 'hesabati-backup-' + today() + '.json';
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'نسخة احتياطية - حساباتي' }); toast('تم'); render(); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('تم تنزيل النسخة'); render();
  }
  function restoreDB(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('bad');
    db = normalize(d); save(); toast('تم استرجاع البيانات'); go('home'); render();
  }
  async function importText() {
    const t = await ask('الصق نص النسخة الاحتياطية هنا. سيتم استبدال جميع البيانات الحالية.', { input: 'area', ok: 'استرجاع' });
    if (!t) return;
    try { restoreDB(t); } catch (e) { ask('النص غير صالح. تأكد أنك نسخت النسخة الاحتياطية كاملة.', { cancel: false }); }
  }
  function importData(input) {
    const f = input.files && input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('bad');
        if (!(await ask('سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. متابعة؟'))) return;
        db = normalize(d); save(); toast('تم استرجاع البيانات'); go('home'); render();
      } catch (e) { ask('الملف غير صالح', { cancel: false }); }
      input.value = '';
    };
    r.readAsText(f);
  }
  async function resetAll() {
    if (!(await ask('سيتم مسح كل البيانات نهائياً! هل أخذت نسخة احتياطية؟'))) return;
    if ((await ask('للتأكيد اكتب كلمة: مسح', { input: true, danger: true })) !== 'مسح') return;
    db = defaults(); save(); toast('تم مسح البيانات'); go('home'); render();
  }
  function loadDemo() {
    const d = new Date(); const day = n => { const x = new Date(d); x.setDate(x.getDate() - n); return dstr(x); };
    const P = [['سكر ١ كغم', 1250, 1500, 'كيس'], ['رز بسمتي ٥ كغم', 11000, 13000, 'كيس'], ['زيت دوار الشمس', 2750, 3250, 'قنينة'], ['شاي محمود', 4500, 5500, 'علبة'], ['معجون طماطم', 750, 1000, 'علبة'], ['طحين ١٠ كغم', 9000, 10500, 'كيس'], ['مياه معدنية', 3000, 4000, 'كارتون']];
    db.products = P.map(([name, cost, price, unit], i) => ({ id: uid(), name, cost, price, unit, code: '', qty: [40, 12, 30, 3, 50, 8, 20][i], minQty: 5, createdAt: day(30) }));
    db.customers = [['أبو علي', '07701234567'], ['حسين كاظم', '07801112233'], ['مطعم الرافدين', '07509998877']].map(([name, phone]) => ({ id: uid(), name, phone, notes: '' }));
    db.suppliers = [{ id: uid(), name: 'شركة النور للمواد الغذائية', phone: '07712223344', notes: '' }];
    db.employees = [{ id: uid(), name: 'علي حسن', job: 'بائع', phone: '', salary: 600000, startDate: day(200), active: true }, { id: uid(), name: 'مصطفى جاسم', job: 'عامل مخزن', phone: '', salary: 450000, startDate: day(100), active: true }];
    const mk = (n, cust, type, items, paidPart) => {
      const total = sum(items, ([pi, q]) => q * db.products[pi].price);
      db.sales.push({ id: uid(), no: ++db.seq.sale, date: day(n), type, customerId: cust ? cust.id : '', items: items.map(([pi, q]) => ({ productId: db.products[pi].id, name: db.products[pi].name, qty: q, price: db.products[pi].price, cost: db.products[pi].cost })), discount: 0, total, paid: type === 'cash' ? total : paidPart, note: '', createdAt: new Date().toISOString() });
    };
    mk(6, null, 'cash', [[0, 4], [2, 2]]); mk(5, db.customers[0], 'credit', [[1, 2], [3, 1]], 10000);
    mk(3, db.customers[2], 'credit', [[5, 3], [6, 5]], 0); mk(2, null, 'cash', [[4, 10], [0, 6]]);
    mk(1, db.customers[1], 'cash', [[1, 1], [2, 3]]); mk(0, null, 'cash', [[3, 2], [6, 1], [0, 2]]);
    db.purchases.push({ id: uid(), no: ++db.seq.purchase, date: day(7), type: 'credit', supplierId: db.suppliers[0].id, items: [{ productId: db.products[1].id, name: db.products[1].name, qty: 10, price: 11000, cost: 11000 }], discount: 0, total: 110000, paid: 50000, note: '', createdAt: new Date().toISOString() });
    db.payments.push({ id: uid(), partyId: db.customers[0].id, amount: 5000, date: day(1), note: '', createdAt: new Date().toISOString() });
    db.expenses.push({ id: uid(), category: 'مولدة', amount: 75000, date: day(4), note: 'اشتراك أمبيرات' }, { id: uid(), category: 'إيجار', amount: 500000, date: day(6), note: '' }, { id: uid(), category: 'نقل وتوصيل', amount: 15000, date: day(2), note: '' });
    db.advances.push({ id: uid(), employeeId: db.employees[0].id, amount: 100000, date: day(3), note: '' });
    db.settings.openingCash = 1000000;
    save(); toast('تم تحميل البيانات التجريبية'); go('home'); render();
  }

  const VIEWS = {
    home, sales: salesList, stock, reports, more, settings, expenses, employees, payroll,
    purchases: purchasesList,
    'sale-new': () => editor('sale'), 'purchase-new': () => editor('purchase'),
    customers: () => partyList('customer'), suppliers: () => partyList('supplier')
  };

  /* ---------- Public API (used by inline handlers) ---------- */
  window.App = {
    go, closeSheet, showInvoice, deleteInvoice, productForm, saveProduct, deleteProduct,
    partyForm, showParty, deleteParty, paymentForm, payHint, savePayment, deletePayment, shareStatement,
    expenseForm, saveExpense, deleteExpense,
    employeeForm, saveEmployee, deleteEmployee, showEmployee, advanceForm, saveAdvance, deleteAdvance,
    payrollForm, prCalc, savePayroll, payAll, showPayslip, deletePayroll,
    printReport, reportPDF, saveSettings, updateApp, exportData, importData, importText, resetAll, loadDemo, picker,
    newInvoice(kind) { ed = newEd(kind); if (location.hash === '#' + kind + '-new') render(); else go(kind + '-new'); },
    edType(t) { ed.type = t; if (t === 'cash') ed.paid = 0; render(); },
    edField(k, v) { ed[k] = v; if (k === 'partyId') render(); else if (k === 'discount' || k === 'paid') edRefresh(false); },
    edUseCredit() { ed.type = 'credit'; ed.paid = 0; render(); },
    setDir(btn) { btn.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn)); },
    edLine(i, k, v) { ed.lines[i][k] = toNum(v); edRefresh(false); },
    edStep(i, d) { const l = ed.lines[i]; l.qty = Math.max(0, round3(l.qty + d)); if (l.qty === 0) ed.lines.splice(i, 1); edRefresh(true); },
    edDel(i) { ed.lines.splice(i, 1); edRefresh(true); },
    edSave, async edCancel() { if (ed.lines.length && !(await ask('إلغاء الفاتورة؟'))) return; const k = ed.kind; ed = null; go(k === 'sale' ? 'sales' : 'purchases'); },
    edNewParty() { partyForm(ed.kind === 'sale' ? 'customer' : 'supplier', null, rec => { ed.partyId = rec.id; render(); }); },
    pick(id) { const p = byId(db.products, id); if (!p) return; edAdd(p); $('#pickList').innerHTML = pickerDraw(val('pickQ')); toast('تمت إضافة ' + p.name); },
    pickSearch(q) { $('#pickList').innerHTML = pickerDraw(q); },
    printInvoice(kind, id) { printHTML(invoiceHTML(kind, byId(kind === 'sale' ? db.sales : db.purchases, id))); },
    shareInvoice(kind, id) { shareText(invoiceText(kind, byId(kind === 'sale' ? db.sales : db.purchases, id)), 'فاتورة'); },
    invoicePDF(kind, id) {
      const inv = byId(kind === 'sale' ? db.sales : db.purchases, id); if (!inv) return;
      if (kind === 'sale' && db.settings.invoiceTemplate !== false) return saleInvoicePDF(inv);
      makePDF((kind === 'sale' ? 'فاتورة بيع' : 'فاتورة شراء') + ' #' + inv.no, invoiceHTML(kind, inv), (kind === 'sale' ? 'فاتورة-' : 'شراء-') + inv.no + '.pdf');
    },
    invoiceImage(id) { const inv = byId(db.sales, id); if (inv) saleInvoiceImage(inv); },
    waImage(id) { const inv = byId(db.sales, id); if (inv) waInvoiceImage(inv); },
    payslipPDF(id) {
      const p = byId(db.payrolls, id); if (!p) return;
      const e = byId(db.employees, p.employeeId);
      makePDF('قسيمة راتب', payslipHTML(p), 'راتب-' + (e ? e.name.replace(/ /g, '-') : '') + '-' + p.month + '.pdf');
    },
    printPayslip(id) { printHTML(payslipHTML(byId(db.payrolls, id))); },
    setSalesFilter(f) { salesFilter = f; render(); },
    salesSearch(q) { salesQuery = q; const pos = q.length; render(); const el = document.querySelector('.search input'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } },
    setStockFilter(f) { stockFilter = f; render(); },
    stockSearch(q) { stockQuery = q; $('#stockBody').innerHTML = stockListHTML(); },
    partySearch(kind, q) { partyQuery = q; const pos = q.length; render(); const el = document.querySelector('.search input'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } },
    pickCat(btn) { document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('on')); btn.classList.add('on'); $('#eCat').value = btn.textContent; },
    setExpMonth(m) { expMonth = m || thisMonth(); render(); },
    setPayMonth(m) { payMonth = m || thisMonth(); render(); },
    rpSet(k, v) { rp[k] = v; render(); }
  };

  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
