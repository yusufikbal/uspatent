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

// Checks the session, draws the nav bar and reveals the page; returns the user or null
async function boot(active) {
  let me;
  try { me = await api('/api/auth?action=me'); }
  catch (e) {
    if (e.message !== 'auth') document.querySelector('main').innerHTML = `<p class="err">Sunucu hatası: ${esc(e.message)}</p>`;
    document.body.classList.add('ready');
    return null;
  }
  document.body.insertAdjacentHTML('afterbegin', `<nav class="nav">
    <a class="brand" href="/">US Patent Database</a>
    <div class="links">
      <a href="/library.html" class="${active === 'library' ? 'on' : ''}">US Patent Kütüphanesi</a>
      <a href="/profile.html" class="${active === 'profile' ? 'on' : ''}">${esc(me.displayName || me.username)}</a>
      <a href="#" id="logout">Çıkış</a>
    </div></nav>`);
  $('logout').onclick = async e => { e.preventDefault(); await api('/api/auth?action=logout', { method: 'POST' }); location.href = '/login.html'; };
  document.body.classList.add('ready');
  return me;
}

async function addMolecule(raw, form) {
  const ingredients = raw.split('+').map(s => s.trim()).filter(Boolean);
  if (!ingredients.length) throw new Error('Etken madde girin.');
  const m = await api('/api/molecules', { method: 'POST', body: { ingredients, form } });
  location.href = '/molecule.html?id=' + encodeURIComponent(m.id);
}

/* ---------- FDA Orange Book ---------- */
const FDA = 'https://api.fda.gov/drug/orangebook.json';
const unit = s => String(s).replace(/(\d)\s*GM\b/g, '$1 g').replace(/(\d)\s*MCG\b/g, '$1 mcg').replace(/(\d)\s*MG\b/g, '$1 mg').replace(/(\d)\s*ML\b/g, '$1 mL').replace(/\/ML\b/g, '/mL');

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
    const str = ings.map(i => unit(i.strength)).join(' / ');
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
const cacheKey = m => 'usdb.fda.v2.' + m.ingredients.join('+') + '|' + (m.form || '');
async function loadFda(m, force) {
  if (!force) { try { const c = JSON.parse(localStorage.getItem(cacheKey(m))); if (c) return c; } catch (e) {} }
  const d = await fetchFda(m);
  try { localStorage.setItem(cacheKey(m), JSON.stringify(d)); } catch (e) {}
  return d;
}

/* ---------- Excel ---------- */
function patentRows(m, groups, notes) {
  if (!groups.length) return [{ 'Molekül': m.label, 'Ürün': "FDA Orange Book'ta bulunamadı" }];
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
