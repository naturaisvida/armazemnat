// In-process session store with 5-min TTL
// Resets on Vercel cold start — gives a good enough approximation for small stores
if (!globalThis._sessions) globalThis._sessions = new Map();

const TTL = 5 * 60 * 1000;

function clean() {
  const now = Date.now();
  for (const [id, ts] of globalThis._sessions) {
    if (now - ts > TTL) globalThis._sessions.delete(id);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  clean();

  if (req.method === 'POST') {
    const body = req.body || {};
    const sid = String(body.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (sid) globalThis._sessions.set(sid, Date.now());
    return res.status(200).json({ ok: true, online: globalThis._sessions.size });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ online: globalThis._sessions.size });
  }

  return res.status(405).end();
};
