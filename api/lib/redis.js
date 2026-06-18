// Upstash Redis REST client — no SDK needed, just fetch
// Env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

function getBase() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) throw new Error('UPSTASH_REDIS_REST_URL não configurado');
  return url;
}
function getToken() {
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!t) throw new Error('UPSTASH_REDIS_REST_TOKEN não configurado');
  return t;
}

async function cmd(...args) {
  const r = await fetch(`${getBase()}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([args]),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Redis error: ' + JSON.stringify(d));
  return d[0]?.result ?? null;
}

async function pipeline(...commands) {
  const r = await fetch(`${getBase()}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Redis pipeline error: ' + JSON.stringify(d));
  return d.map(x => x?.result ?? null);
}

const redis = {
  async get(key) {
    const v = await cmd('GET', key);
    if (v === null || v === undefined) return null;
    try { return JSON.parse(v); } catch { return v; }
  },
  async set(key, value, ttlSeconds) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) return cmd('SET', key, str, 'EX', ttlSeconds);
    return cmd('SET', key, str);
  },
  async del(key) { return cmd('DEL', key); },
  async sadd(key, ...members) { return cmd('SADD', key, ...members); },
  async srem(key, ...members) { return cmd('SREM', key, ...members); },
  async smembers(key) { return (await cmd('SMEMBERS', key)) || []; },
  pipeline,
};

module.exports = redis;
