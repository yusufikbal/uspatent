import crypto from 'node:crypto';
import { redis, hgetallObj, requireUser, handle } from './_lib.js';

const KEY = 'molecules';
const DEFAULT_OWNER = 'Yusuf İkbal Aldemir';
const DEFAULTS = [
  { id: 'm1', label: 'Empagliflozin + Linagliptin + Metformin (XR)', ingredients: ['EMPAGLIFLOZIN', 'LINAGLIPTIN', 'METFORMIN'], form: 'EXTENDED RELEASE' },
  { id: 'm2', label: 'Nifedipine + Lidocaine', ingredients: ['NIFEDIPINE', 'LIDOCAINE'], form: '' },
  { id: 'm3', label: 'Semaglutide', ingredients: ['SEMAGLUTIDE'], form: '' },
];
const valid = s => /^[A-Z0-9 ,.()\-]{2,60}$/.test(s);
const titleCase = s => s.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, c => c.toUpperCase());
const sameCombo = (m, ingredients, form) => [...m.ingredients].sort().join('+') === [...ingredients].sort().join('+') && (m.form || '') === form;

export default handle(async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const { id } = req.query, body = req.body || {};

  if (req.method === 'GET') {
    if (!(await redis('EXISTS', 'seeded:molecules'))) {
      for (const m of DEFAULTS) await redis('HSETNX', KEY, m.id, JSON.stringify({ ...m, createdBy: DEFAULT_OWNER, createdAt: new Date().toISOString() }));
      await redis('SET', 'seeded:molecules', '1');
    }
    const all = await hgetallObj(KEY);
    // The first three molecules were seeded before "Ekleyen" existed; credit them once
    for (const d of DEFAULTS) {
      if (all[d.id] && !all[d.id].createdBy) {
        all[d.id].createdBy = DEFAULT_OWNER;
        await redis('HSET', KEY, d.id, JSON.stringify(all[d.id]));
      }
    }
    return res.json(Object.values(all).sort((a, b) => a.label.localeCompare(b.label, 'tr')));
  }

  if (req.method === 'POST') {
    const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : []).map(s => String(s).trim().toUpperCase()).filter(Boolean);
    const form = String(body.form || '').trim().toUpperCase();
    if (!ingredients.length || ingredients.length > 10 || !ingredients.every(valid) || (form && !valid(form))) {
      return res.status(400).json({ error: 'Geçersiz etken madde veya form (harf, rakam, boşluk ve - kullanın).' });
    }
    const existing = Object.values(await hgetallObj(KEY)).find(m => sameCombo(m, ingredients, form));
    if (existing) return res.json(existing);
    const m = {
      id: crypto.randomUUID().slice(0, 8),
      label: ingredients.map(titleCase).join(' + ') + (form ? ` (${form.toLowerCase()})` : ''),
      ingredients, form, createdBy: user.displayName, createdAt: new Date().toISOString(),
    };
    await redis('HSET', KEY, m.id, JSON.stringify(m));
    return res.status(201).json(m);
  }

  const raw = id ? await redis('HGET', KEY, id) : null;
  if (!raw) return res.status(404).json({ error: 'Molekül bulunamadı.' });

  // Product/patent counts shown in the library list, reported by the molecule page after it loads FDA data
  if (req.method === 'PATCH') {
    const m = JSON.parse(raw), s = body.summary || {};
    m.summary = { products: +s.products || 0, patents: +s.patents || 0, fetchedAt: String(s.fetchedAt || '').slice(0, 30) };
    await redis('HSET', KEY, id, JSON.stringify(m));
    return res.json(m);
  }

  if (req.method === 'DELETE') {
    await redis('HDEL', KEY, id);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Desteklenmeyen istek.' });
});
