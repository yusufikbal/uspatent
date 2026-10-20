import { redis, hgetallObj, requireUser, handle } from './_lib.js';

// Patent comments, keyed by patent number and shared by all users
export default handle(async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') return res.json(await hgetallObj('notes'));

  if (req.method === 'PUT') {
    const pn = String(req.body?.pn || '').toUpperCase(), text = String(req.body?.text || '');
    if (!/^[A-Z0-9]{4,15}$/.test(pn) || text.length > 5000) return res.status(400).json({ error: 'Geçersiz patent no veya yorum çok uzun.' });
    if (!text.trim()) { await redis('HDEL', 'notes', pn); return res.json({ pn, note: null }); }
    const note = { text, by: user.displayName, at: new Date().toISOString() };
    await redis('HSET', 'notes', pn, JSON.stringify(note));
    return res.json({ pn, note });
  }

  res.status(405).json({ error: 'Desteklenmeyen istek.' });
});
