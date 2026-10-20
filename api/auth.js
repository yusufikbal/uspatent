import { redis, getUser, saveUser, publicUser, hashPassword, checkPassword, setSession, clearSession, requireUser, handle } from './_lib.js';

export default handle(async (req, res) => {
  const { action } = req.query;
  const body = req.body || {};

  if (action === 'login' && req.method === 'POST') {
    const username = String(body.username || '').trim().toLowerCase(), password = String(body.password || '');
    const rl = 'rl:' + username;
    const tries = await redis('INCR', rl);
    if (tries === 1) await redis('EXPIRE', rl, 900);
    if (tries > 10) return res.status(429).json({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' });
    const user = username ? await getUser(username) : null;
    const ok = user ? checkPassword(password, user) : (hashPassword(password), false);
    if (!ok) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    await redis('DEL', rl);
    setSession(res, user);
    return res.json(publicUser(user));
  }

  if (action === 'logout' && req.method === 'POST') { clearSession(res); return res.json({ ok: true }); }

  const user = await requireUser(req, res);
  if (!user) return;

  if (action === 'me' && req.method === 'GET') return res.json(publicUser(user));

  if (action === 'profile' && req.method === 'PUT') {
    const displayName = String(body.displayName || '').trim(), email = String(body.email || '').trim();
    if (!displayName || displayName.length > 80) return res.status(400).json({ error: 'Ad Soyad 1–80 karakter olmalı.' });
    if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ error: 'Geçerli bir e-posta girin.' });
    Object.assign(user, { displayName, email });
    await saveUser(user);
    return res.json(publicUser(user));
  }

  if (action === 'password' && req.method === 'POST') {
    const current = String(body.current || ''), next = String(body.next || '');
    if (!checkPassword(current, user)) return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    if (next.length < 8 || next.length > 128) return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı.' });
    Object.assign(user, hashPassword(next), { v: (user.v || 1) + 1 });
    await saveUser(user);
    setSession(res, user);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: 'Bilinmeyen işlem.' });
});
