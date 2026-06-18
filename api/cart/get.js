// Public endpoint — cartId acts as a secret token to access cart data
const redis = require('../lib/redis');

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).end();

  const { cartId } = req.query;
  if (!cartId || !/^[a-zA-Z0-9_-]{5,80}$/.test(cartId)) {
    return res.status(400).json({ error: 'cartId inválido' });
  }

  const cart = await redis.get(`cart:${cartId}`);
  if (!cart) return res.status(404).json({ error: 'Carrinho não encontrado' });

  // Return only data needed to pre-fill checkout — no internal recovery fields
  return res.status(200).json({
    customer: cart.customer || {},
    address:  cart.address  || {},
    items:    cart.items    || [],
    totalAmount: cart.totalAmount || 0,
    step:     cart.step,
  });
};
