const jwt    = require('jsonwebtoken');
const redis  = require('../_lib/redis');

function validateAdmin(req, res) {
  const raw    = (req.headers['authorization'] || '').trim();
  const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) { res.status(401).json({ error: 'Não autorizado' }); return false; }
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (p.role !== 'admin') throw new Error();
    return true;
  } catch { res.status(401).json({ error: 'Token inválido' }); return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!validateAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { filter } = req.query;

  const ids = await redis.smembers('abandoned_carts');
  if (!ids.length) return res.status(200).json({ carts: [], total: 0 });

  const carts = (await Promise.all(ids.map(id => redis.get(`cart:${id}`)))).filter(Boolean);

  // Sort newest first
  carts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  let filtered = carts;
  if (filter === 'sem_transacao') {
    filtered = carts.filter(c => !c.cardFailed);
  } else if (filter === 'nao_aprovado') {
    filtered = carts.filter(c => c.cardFailed);
  }

  return res.status(200).json({ carts: filtered, total: carts.length });
};
