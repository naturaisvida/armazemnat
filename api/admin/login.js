const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// In-memory rate limiter (resets on cold start — enough for this scale)
const _attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000; // 15 min

function secHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000');
}

function checkRate(ip) {
  const now  = Date.now();
  const rec  = _attempts.get(ip) || { n: 0, reset: now + WINDOW_MS };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + WINDOW_MS; }
  return rec;
}

module.exports = async function handler(req, res) {
  secHeaders(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  // IP para rate-limit
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const rec = checkRate(ip);

  if (rec.n >= MAX_ATTEMPTS) {
    const wait = Math.ceil((rec.reset - Date.now()) / 1000);
    return res.status(429).json({ error: `Muitas tentativas. Aguarde ${wait}s.` });
  }

  const body     = req.body || {};
  const password = body.password;

  // Validação básica de input
  if (!password || typeof password !== 'string' || password.length > 256) {
    rec.n++;
    _attempts.set(ip, rec);
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const hash   = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!hash || !secret) {
    return res.status(500).json({ error: 'Dashboard não configurado. Adicione ADMIN_PASSWORD_HASH e ADMIN_JWT_SECRET no Vercel.' });
  }

  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    rec.n++;
    _attempts.set(ip, rec);
    const restantes = MAX_ATTEMPTS - rec.n;
    return res.status(401).json({ error: `Senha incorreta. ${restantes} tentativa(s) restante(s).` });
  }

  // Login OK — zera tentativas
  _attempts.delete(ip);

  const token = jwt.sign({ role: 'admin', iat: Math.floor(Date.now() / 1000) }, secret, {
    expiresIn: '8h',
    algorithm: 'HS256',
  });

  return res.status(200).json({ token });
};
