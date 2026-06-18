const crypto               = require('crypto');
const { sendStatusEmail }  = require('../email/send');

// Raw body needed for HMAC signature verification
module.exports.config = { api: { bodyParser: false } };

const PAGARME_URL = 'https://api.pagar.me/core/v5';

function authHeader() {
  const s = process.env.PAGARME_SECRET;
  if (!s) throw new Error('PAGARME_SECRET missing');
  return 'Basic ' + Buffer.from(s + ':').toString('base64');
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = sigHeader.replace(/^sha256=/, '');
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

async function fetchOrder(orderId) {
  const r = await fetch(`${PAGARME_URL}/orders/${orderId}`, {
    headers: { 'Authorization': authHeader() },
  });
  return r.json();
}

function mapOrder(raw) {
  const charge = (raw.charges || [])[0] || {};
  const tx     = charge.last_transaction || {};
  const cust   = raw.customer || {};
  const meta   = raw.metadata || {};
  const ship   = raw.shipping || {};
  const addr   = ship.address || {};

  let method = 'outro';
  if (tx.transaction_type === 'pix' || charge.payment_method === 'pix')                         method = 'pix';
  else if (tx.transaction_type === 'boleto' || charge.payment_method === 'boleto')              method = 'boleto';
  else if (tx.transaction_type === 'credit_card' || charge.payment_method === 'credit_card')   method = 'cartao';

  return {
    id:   raw.id,
    code: raw.code || raw.id,
    customer: { name: cust.name || '', email: cust.email || '' },
    amount:      raw.amount || 0,
    method,
    installments: tx.installments || 1,
    items: (raw.items || []).map(i => ({ description: i.description, quantity: i.quantity, amount: i.amount })),
    shipping: {
      carrier:      meta.shipping_carrier || ship.description || 'Correios',
      trackingCode: meta.tracking_code || '',
      address: {
        line1:   addr.line_1  || '',
        line2:   addr.line_2  || '',
        city:    addr.city    || '',
        state:   addr.state   || '',
        zipCode: addr.zip_code || '',
      },
    },
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig     = req.headers['x-hub-signature'] || '';
  const secret  = process.env.PAGARME_WEBHOOK_SECRET;

  if (secret && !verifySignature(rawBody, sig, secret)) {
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  const eventType = event?.type || '';
  const orderId   = event?.data?.id;

  if (!orderId || (!eventType.startsWith('order.') && !eventType.startsWith('charge.'))) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
      const raw   = await fetchOrder(orderId);
      if (raw.id) await sendStatusEmail(mapOrder(raw), 'faturado', '');
    }

    if (eventType === 'order.canceled') {
      const raw   = await fetchOrder(orderId);
      if (raw.id) await sendStatusEmail(mapOrder(raw), 'cancelado', '');
    }
  } catch (e) {
    console.error('Webhook email error:', e.message);
    // Don't return non-200 — Pagar.me would keep retrying
  }

  return res.status(200).json({ ok: true });
};
