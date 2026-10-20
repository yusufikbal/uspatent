// Shared server helpers: Upstash Redis (REST), password hashing, signed session cookies
import crypto from 'node:crypto';

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ITER = 210000;
const SESSION_DAYS = 7;

export async function redis(...cmd) {
  if (!DB_URL || !DB_TOKEN) throw new Error('Veritabanı bağlı değil: Upstash Redis ortam değişkenleri eksik.');
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

export async function hgetallObj(key) {
  const flat = (await redis('HGETALL', key)) || [], o = {};
  for (let i = 0; i < flat.length; i += 2) o[flat[i]] = JSON.parse(flat[i + 1]);
  return o;
}

export function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), ITER, 32, 'sha256').toString('hex') };
}

export function checkPassword(pw, user) {
  const { hash } = hashPassword(pw, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// Users are created in Redis on first use from the SEED_USERS env var (password hashes only, never plaintext)
export async function getUser(username) {
  const raw = await redis('GET', 'user:' + username);
  if (raw) return JSON.parse(raw);
  let seed = [];
  try { seed = JSON.parse(process.env.SEED_USERS || '[]'); } catch {}
  const s = seed.find(u => u.username === username);
  if (!s) return null;
  const user = { username, displayName: s.displayName || username, email: s.email || '', salt: s.salt, hash: s.hash, v: 1 };
  await redis('SET', 'user:' + username, JSON.stringify(user), 'NX');
  return JSON.parse(await redis('GET', 'user:' + username));
}

export const saveUser = u => redis('SET', 'user:' + u.username, JSON.stringify(u));
export const publicUser = u => ({ username: u.username, displayName: u.displayName, email: u.email });

function sign(data) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET ortam değişkeni eksik.');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

// Session cookie = payload.signature; payload carries the user's password version so a password change logs out other devices
export function setSession(res, user) {
  const payload = Buffer.from(JSON.stringify({ u: user.username, v: user.v, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  res.setHeader('Set-Cookie', `sid=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}

export const clearSession = res => res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

export async function requireUser(req, res) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  const [payload, sig] = (m ? m[1] : '').split('.');
  let s = null;
  if (payload && sig) {
    const good = sign(payload);
    if (sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
      s = JSON.parse(Buffer.from(payload, 'base64url').toString());
    }
  }
  const user = s && s.exp > Date.now() ? await getUser(s.u) : null;
  if (!user || user.v !== s.v) { res.status(401).json({ error: 'Oturum açmanız gerekiyor.' }); return null; }
  return user;
}

export const handle = fn => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { await fn(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
};
