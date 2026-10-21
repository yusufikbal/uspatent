// Shared client helpers: API calls, nav bar, FDA Orange Book fetching, Excel export
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = d => d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
const fmtTs = iso => iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const param = k => new URLSearchParams(location.search).get(k);

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.includes('action=login')) {
    location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
    throw new Error('auth');
  }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

/* ---------- Brand and icons ---------- */
// USPatents mark: navy field with a star, three stripes running out of the emblem
function logoMark(id = 'lm') {
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <clipPath id="${id}c"><circle cx="20" cy="20" r="18"/></clipPath>
      <linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d55ad"/><stop offset="1" stop-color="#11285c"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3550"/><stop offset="1" stop-color="#b80d29"/></linearGradient>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect width="40" height="40" fill="#0d0f13"/>
      <rect width="19" height="40" fill="url(#${id}n)"/>
      <polygon fill="#fff" points="10.5,15.4 11.59,18.5 14.88,18.58 12.26,20.57 13.2,23.72 10.5,21.85 7.8,23.72 8.74,20.57 6.12,18.58 9.41,18.5"/>
      <rect x="21.5" y="11.4" width="24" height="4.4" rx="2.2" fill="url(#${id}s)"/>
      <rect x="21.5" y="17.8" width="24" height="4.4" rx="2.2" fill="#f2f3f5"/>
      <rect x="21.5" y="24.2" width="24" height="4.4" rx="2.2" fill="url(#${id}s)"/>
    </g>
    <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
  </svg>`;
}
const WORDMARK = '<span class="wm"><b>US</b>Patents</span>';

const ICONS = {
  search: '<path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="7"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevRight: '<path d="m9 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.6M4 4v4h4m-4 5a8 8 0 0 0 14.9 3.6M20 20v-4h-4"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  molecule: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="m6.7 7.2 3.4 3.3m7.2-3.3-3.4 3.3M12 14.5V18"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5m0 3.3v.2"/>',
  filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');

// Fills every [data-icon] / [data-logo] placeholder in static page markup
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); el.removeAttribute('data-icon'); });
  root.querySelectorAll('[data-logo]').forEach((el, i) => { el.innerHTML = logoMark('lg' + i); el.removeAttribute('data-logo'); });
}

/* ---------- Shared UI pieces ---------- */
const skeletonCards = (n = 3) => Array.from({ length: n }, (_, i) =>
  `<div class="sk-card"><span class="sk"></span><div style="flex:1"><span class="sk" style="width:${34 - i * 6}%;height:14px"></span><span class="sk" style="width:${22 + i * 5}%;height:10px;margin-top:10px"></span></div><span class="sk" style="width:120px;height:38px;border-radius:20px"></span></div>`).join('');
const skeletonRows = (n, cols) => Array.from({ length: n }, () =>
  `<tr>${Array.from({ length: cols }, (_, c) => `<td><span class="sk" style="width:${c ? 50 + (c * 13) % 40 : 70}%;height:12px"></span></td>`).join('')}</tr>`).join('');
function emptyState(ic, title, text, actions = '', alert = false) {
  return `<div class="empty-state${alert ? ' alert' : ''}"><div class="ring">${icon(ic)}</div><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
// Patent / exclusivity expiry: expired, within 12 months, or active
function expStatus(d) {
  if (!d) return '';
  if (d < today) return 'expired';
  const soon = String(+today.slice(0, 4) + 1) + today.slice(4);
  return d < soon ? 'soon' : '';
}

// Checks the session, draws the nav bar and reveals the page; returns the user or null
async function boot(active) {
  let me;
  try { me = await api('/api/auth?action=me'); }
  catch (e) {
    if (e.message !== 'auth') document.querySelector('main').innerHTML = emptyState('alert', 'Sunucuya ulaşılamadı', esc(e.message), '', true);
    document.body.classList.add('ready');
    return null;
  }
  const name = me.displayName || me.username;
  document.body.insertAdjacentHTML('afterbegin', `<header class="topbar"><nav class="nav" aria-label="Ana menü">
    <a class="brand" href="/" aria-label="USPatents ana sayfa">${logoMark('nav')}${WORDMARK}</a>
    <div class="navlinks">
      <a href="/" class="${active === 'home' ? 'on' : ''}">Ana sayfa</a>
      <a href="/library.html" class="${active === 'library' ? 'on' : ''}">Kütüphane</a>
    </div>
    <div class="usermenu">
      <button class="userbtn" id="userBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="userMenu">
        <span class="avatar" id="navAvatar">${esc(initials(name))}</span><span class="uname" id="navName">${esc(name)}</span>${icon('chevDown')}
      </button>
      <div class="menu" id="userMenu" role="menu" hidden>
        <div class="menu-head"><b id="menuName">${esc(name)}</b><small>@${esc(me.username)}</small></div>
        <a href="/profile.html" role="menuitem">${icon('user')} Profil ve güvenlik</a>
        <button id="logout" role="menuitem">${icon('logout')} Çıkış yap</button>
      </div>
    </div></nav></header>`);
  const btn = $('userBtn'), menu = $('userMenu');
  const setMenu = open => { menu.hidden = !open; btn.setAttribute('aria-expanded', open); };
  btn.onclick = e => { e.stopPropagation(); setMenu(menu.hidden); };
  document.addEventListener('click', e => { if (!e.target.closest('.usermenu')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  $('logout').onclick = async () => { await api('/api/auth?action=logout', { method: 'POST' }); location.href = '/login.html'; };
  // "/" jumps to the page's search field
  document.addEventListener('keydown', e => {
    const s = document.querySelector('[data-search]');
    if (e.key === '/' && s && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); s.focus(); }
  });
  hydrateIcons();
  document.body.classList.add('ready');
  return me;
}

function setNavUser(name) {
  $('navName').textContent = name; $('menuName').textContent = name; $('navAvatar').textContent = initials(name);
}

async function addMolecule(raw, form) {
  const ingredients = raw.split('+').map(s => s.trim()).filter(Boolean);
  if (!ingredients.length) throw new Error('Etken madde girin.');
  const m = await api('/api/molecules', { method: 'POST', body: { ingredients, form } });
  location.href = '/molecule.html?id=' + encodeURIComponent(m.id);
}

/* ---------- FDA Orange Book ---------- */
const FDA = 'https://api.fda.gov/drug/orangebook.json';
const unit = s => String(s).replace(/(\d)\s*GM\b/g, '$1 g').replace(/(\d)\s*MCG\b/g, '$1 mcg').replace(/(\d)\s*MG\b/g, '$1 mg').replace(/(\d)\s*ML\b/g, '$1 mL').replace(/\/ML\b/g, '/mL')
  .replace(/(\d+(?:\.\d+)?)\s*%/g, '%$1');
// "TABLET, EXTENDED RELEASE" -> "Tablet, extended release"
const formLabel = f => { const s = String(f || '').toLowerCase().trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };

async function fetchFda(m) {
  const q = m.ingredients.map(i => `products.active_ingredients.name:"${i}"`).join(' AND ');
  let recs = [], skip = 0, total = 0, updated = '';
  do {
    const r = await fetch(`${FDA}?search=${encodeURIComponent(q)}&limit=1000&skip=${skip}`), j = await r.json();
    if (r.status === 404) break;
    if (!r.ok) throw new Error(j.error?.message || 'HTTP ' + r.status);
    total = j.meta.results.total; updated = j.meta.last_updated; recs = recs.concat(j.results); skip += j.results.length;
  } while (skip < total);
  return { at: new Date().toISOString(), updated, groups: buildGroups(m, recs) };
}

// Exact ingredient combination (+ optional dosage form) -> products (Brand + NDA) with one row per patent
function buildGroups(m, recs) {
  const has = (spec, name) => name.toUpperCase().split(/\W+/).includes(spec) || name.toUpperCase().startsWith(spec);
  const groups = new Map();
  for (const r of recs) {
    const p = r.products[0], ings = p.active_ingredients || [];
    if (ings.length !== m.ingredients.length || !m.ingredients.every(s => ings.some(i => has(s, i.name)))) continue;
    if (m.form && !(p.dosage_form || '').toUpperCase().includes(m.form)) continue;
    const key = p.brand_name + ' · ' + p.application_type + p.application_number;
    if (!groups.has(key)) groups.set(key, { key, brand: p.brand_name, nda: p.application_type + p.application_number, doses: [], pats: {}, excl: [], approval: '', pre1982: false });
    const g = groups.get(key);
    const str = [formLabel(p.dosage_form), ings.map(i => unit(i.strength)).join(' / ')].filter(Boolean).join(' ');
    g.doses.push({ no: r.product_number, str });
    if (r.approved_prior_to_1982) g.pre1982 = true;
    else if (r.approval_date && (!g.approval || r.approval_date < g.approval)) g.approval = r.approval_date;
    for (const x of r.exclusivity || []) g.excl.push({ no: r.product_number, str, code: x.exclusivity_code, exp: x.exclusivity_expiration_date });
    for (const pt of r.patents || []) {
      const base = pt.patent_number.replace(/\*.*$/, ''), e = g.pats[base] ||= { pn: base, exp: '', ped: '' };
      if (/\*PED/i.test(pt.patent_number)) e.ped = pt.expiration_date > e.ped ? pt.expiration_date : e.ped;
      else e.exp = pt.expiration_date > e.exp ? pt.expiration_date : e.exp;
    }
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(g => ({
    key: g.key, brand: g.brand, nda: g.nda, approval: g.pre1982 ? 'pre1982' : g.approval,
    doses: g.doses.sort((a, b) => a.no.localeCompare(b.no)),
    patents: Object.values(g.pats).sort((a, b) => a.exp.localeCompare(b.exp) || a.pn.localeCompare(b.pn)),
    excl: g.excl.sort((a, b) => a.no.localeCompare(b.no) || a.exp.localeCompare(b.exp) || a.code.localeCompare(b.code)),
  }));
}

const fmtApproval = a => a === 'pre1982' ? "1 Ocak 1982'den önce" : fmtDate(a) || '—';

// Orange Book exclusivity codes; numbered codes (I-935, ODE-123 …) use their prefix
const EXCL_CODES = {
  NCE: 'New Chemical Entity (Yeni Kimyasal Madde)',
  NP: 'New Product (Yeni Ürün)',
  NPP: 'New Patient Population (Yeni Hasta Popülasyonu)',
  NDF: 'New Dosage Form (Yeni Dozaj Formu)',
  NC: 'New Combination (Yeni Kombinasyon)',
  NS: 'New Strength (Yeni Doz/Güç)',
  NR: 'New Route of Administration (Yeni Uygulama Yolu)',
  NE: 'New Ester or Salt (Yeni Ester veya Tuz)',
  RTO: 'Rx to OTC Switch (Reçeteliden Reçetesize Geçiş)',
  ODE: 'Orphan Drug Exclusivity (Yetim İlaç Münhasırlığı)',
  PED: 'Pediatric Exclusivity (Pediatrik Münhasırlık)',
  PC: 'Patent Challenge – 180 Day Exclusivity (Patent İtirazı, 180 gün)',
  CGT: 'Competitive Generic Therapy (Rekabetçi Jenerik Tedavi)',
  GAIN: 'Generating Antibiotic Incentives Now (Antibiyotik Teşviki, QIDP)',
  W: 'Waived Exclusivity (Feragat Edilmiş Münhasırlık)',
  I: 'New Indication (Yeni Endikasyon)',
  D: 'New Dosing Schedule (Yeni Dozaj Şeması)',
  M: 'Miscellaneous (Diğer)',
};
function exclDef(code) {
  const base = code.replace(/\*$/, ''), prefix = base.split('-')[0];
  const def = EXCL_CODES[base] || EXCL_CODES[prefix];
  if (!def) return 'Tanım bulunamadı (FDA Orange Book kod listesine bakın)';
  return def + (code.endsWith('*') ? ' — * ek koşullu, ayrıntı FDA Orange Book\'ta' : '');
}

// Processed results are cached per browser; "Verileri güncelle" forces a fresh API call
const cacheKey = m => 'usdb.fda.v3.' + m.ingredients.join('+') + '|' + (m.form || '');
async function loadFda(m, force) {
  if (!force) { try { const c = JSON.parse(localStorage.getItem(cacheKey(m))); if (c) return c; } catch (e) {} }
  const d = await fetchFda(m);
  try { localStorage.setItem(cacheKey(m), JSON.stringify(d)); } catch (e) {}
  return d;
}

// Keep the library list's product/patent counts in step with the latest FDA data
async function syncSummary(m, d) {
  const s = { products: d.groups.length, patents: d.groups.reduce((a, g) => a + g.patents.length, 0), fetchedAt: d.at }, o = m.summary || {};
  if (o.products === s.products && o.patents === s.patents && o.fetchedAt === s.fetchedAt) return;
  m.summary = s;
  await api('/api/molecules?id=' + encodeURIComponent(m.id), { method: 'PATCH', body: { summary: s } });
}

/* ---------- Excel ---------- */
function patentRows(m, groups, notes) {
  if (!groups.length) return [{ 'Molekül': m.label, 'Ürün': "FDA'de onaylı ürün yoktur (Orange Book'ta kayıt yok)" }];
  return groups.flatMap(g => g.patents.map(p => ({
    'Molekül': m.label, 'Ürün': g.brand, 'NDA': g.nda, 'İlk Onay Tarihi': fmtApproval(g.approval), 'US Patent No.': 'US ' + p.pn,
    'Expiration Date': fmtDate(p.exp), 'PED Expiration': fmtDate(p.ped), 'Patent Yorumu': notes[p.pn]?.text || '',
  })));
}
function exclRows(m, groups) {
  return groups.flatMap(g => g.excl.map(x => ({
    'Molekül': m.label, 'Ürün': g.brand, 'NDA': g.nda, 'Product No': x.no, 'Strength': x.str,
    'Exclusivity Code': x.code, 'Tanım': exclDef(x.code), 'Exclusivity Expiration': fmtDate(x.exp),
  })));
}
function downloadExcel(rows, name, excl = []) {
  if (typeof XLSX === 'undefined') return alert('Excel kütüphanesi yüklenemedi.');
  const ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
  ws['!cols'] = [36, 20, 10, 16, 14, 14, 14, 60].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Patents');
  const we = XLSX.utils.json_to_sheet(excl.length ? excl : [{ 'Bilgi': 'Exclusivity kaydı yok' }]);
  we['!cols'] = [36, 20, 10, 10, 30, 16, 50, 20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, we, 'Exclusivity');
  XLSX.writeFile(wb, `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
