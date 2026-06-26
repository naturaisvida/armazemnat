const redis = require('../_lib/redis');

const CART_TTL = 7 * 24 * 60 * 60; // 7 days

function san(s, max) {
  return String(s || '').replace(/[<>"]/g, '').slice(0, max);
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const { cartId, step, customer, address, items, totalAmount, converted, cardFailed, checkoutUrl } = body;

  if (!cartId || typeof cartId !== 'string' || !/^[a-zA-Z0-9_-]{5,80}$/.test(cartId)) {
    return res.status(400).json({ error: 'cartId inválido' });
  }

  let cart = await redis.get(`cart:${cartId}`);
  const now = new Date().toISOString();

  if (!cart) {
    cart = {
      id: cartId,
      createdAt: now,
      updatedAt: now,
      step: 'dados_pessoais',
      customer: {},
      address: {},
      items: [],
      totalAmount: 0,
      checkoutUrl: '',
      recoveryEmails: [],
      nextRecoveryAt: null,
      nextEmailNum: 1,
      converted: false,
      cardFailed: false,
      source: 'checkout_html',
      ip: '',
    };
  }

  cart.updatedAt = now;
  const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim().slice(0, 45);
  if (clientIp) cart.ip = clientIp;
  if (step)       cart.step        = san(step, 30);
  if (totalAmount !== undefined) cart.totalAmount = Math.max(0, parseInt(totalAmount) || 0);
  if (checkoutUrl) cart.checkoutUrl = san(checkoutUrl, 500);

  if (customer) {
    cart.customer = {
      name:     san(customer.name, 100),
      email:    san(customer.email, 200).toLowerCase().trim(),
      phone:    san(customer.phone, 20).replace(/\D/g, ''),
      document: san(customer.document, 14).replace(/\D/g, ''),
    };
  }

  if (address) {
    cart.address = {
      cep:   san(address.cep,   10).replace(/\D/g, ''),
      line1: san(address.line1, 200),
      city:  san(address.city,  100),
      state: san(address.state, 2).toUpperCase(),
    };
  }

  if (items && Array.isArray(items)) {
    cart.items = items.slice(0, 10).map(i => ({
      description: san(i.description, 200),
      quantity:    Math.max(1, parseInt(i.quantity) || 1),
      amount:      Math.max(0, parseInt(i.amount) || 0),
    }));
  }

  // Mark as converted (purchase completed)
  if (converted) {
    cart.converted   = true;
    cart.convertedAt = now;
    await redis.set(`cart:${cartId}`, cart, CART_TTL);
    await redis.srem('abandoned_carts', cartId);
    return res.status(200).json({ ok: true, converted: true });
  }

  // Card payment failed — expedite recovery
  if (cardFailed) {
    cart.cardFailed = true;
    cart.step = 'pagamento';
    if (cart.nextEmailNum <= 1) {
      cart.nextRecoveryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      cart.nextEmailNum   = 1;
    }
  }

  // Schedule first recovery email
  if (cart.customer?.email && !cart.converted && !cart.nextRecoveryAt) {
    cart.nextRecoveryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    cart.nextEmailNum   = 1;
  }

  if (cart.customer?.email && !cart.converted) {
    await redis.sadd('abandoned_carts', cartId);
  }

  await redis.set(`cart:${cartId}`, cart, CART_TTL);
  return res.status(200).json({ ok: true });
};
