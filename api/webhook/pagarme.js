const { sendStatusEmail } = require('../_email/send');

const PAGARME_URL           = 'https://api.pagar.me/core/v5';
const GADS_CONVERSION_ID    = '18164681866';
const GADS_CONVERSION_LABEL = '9Wc0CM6w3LAcEIqZzNVD';

async function sendGoogleConversion(gclid, amountCents, orderId) {
  if (!gclid) return;
  const value = (amountCents / 100).toFixed(2);
  const url = 'https://www.googleadservices.com/pagead/conversion/' + GADS_CONVERSION_ID + '/'
    + '?gclid=' + encodeURIComponent(gclid)
    + '&value=' + value + '&currency_code=BRL'
    + '&label=' + GADS_CONVERSION_LABEL
    + '&guid=ON&script=0';
  try {
    await fetch(url);
    console.log('[gads] conversion sent orderId=' + orderId + ' gclid=' + gclid.slice(0,8) + '... value=R$' + value);
  } catch (e) {
    console.error('[gads] error:', e.message);
  }
}

function pagarmeAuth() {
  const s = process.env.PAGARME_SECRET;
  if (!s) throw new Error('PAGARME_SECRET missing');
  return 'Basic ' + Buffer.from(s + ':').toString('base64');
}

// Valida Basic Auth enviado pelo Pagar.me no webhook
function checkBasicAuth(authHeader) {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASS;
  if (!user || !pass) return true; // não configurado — aceita tudo

  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const colon   = decoded.indexOf(':');
  const u       = decoded.slice(0, colon);
  const p       = decoded.slice(colon + 1);
  return u === user && p === pass;
}

async function fetchOrder(orderId) {
  const r = await fetch(`${PAGARME_URL}/orders/${orderId}`, {
    headers: { 'Authorization': pagarmeAuth() },
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
  if (tx.transaction_type === 'pix' || charge.payment_method === 'pix')                       method = 'pix';
  else if (tx.transaction_type === 'boleto' || charge.payment_method === 'boleto')            method = 'boleto';
  else if (tx.transaction_type === 'credit_card' || charge.payment_method === 'credit_card') method = 'cartao';

  return {
    id:   raw.id,
    code: raw.code || raw.id,
    customer: { name: cust.name || '', email: cust.email || '' },
    amount:   raw.amount || 0,
    method,
    installments: tx.installments || 1,
    items: (raw.items || []).map(i => ({ description: i.description, quantity: i.quantity, amount: i.amount })),
    shipping: {
      carrier:      meta.shipping_carrier || ship.description || 'Correios',
      trackingCode: meta.tracking_code || '',
      address: {
        line1:   addr.line_1   || '',
        line2:   addr.line_2   || '',
        city:    addr.city     || '',
        state:   addr.state    || '',
        zipCode: addr.zip_code || '',
      },
    },
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).end();

  // Verifica Basic Auth (mesmo esquema do webhook.php)
  if (!checkBasicAuth(req.headers['authorization'] || '')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const event     = req.body || {};
  const eventType = event.type  || '';
  const data      = event.data  || {};

  // Para order.* o ID está em data.id
  // Para charge.* o ID do pedido está em data.order_id
  const orderId = eventType.startsWith('charge.')
    ? (data.order_id || data.order?.id)
    : data.id;

  if (!orderId || (!eventType.startsWith('order.') && !eventType.startsWith('charge.'))) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
      const raw = await fetchOrder(orderId);
      if (!raw.id) return res.status(200).json({ ok: true, skipped: true });
      if ((raw.metadata || {}).source !== 'checkout_html') return res.status(200).json({ ok: true, skipped: 'not_checkout_html' });
      const mapped = mapOrder(raw);
      // Dispara conversao Google Ads apenas para PIX e boleto confirmados
      // (cartao ja e rastreado pelo frontend no sucesso.html)
      if (mapped.method === 'pix' || mapped.method === 'boleto') {
        const gclid = (raw.metadata || {}).gclid || '';
        await sendGoogleConversion(gclid, raw.amount || 0, raw.id);
      }
      await sendStatusEmail(mapped, 'faturado', '');
    }

    if (eventType === 'order.canceled' || eventType === 'charge.refunded') {
      const raw = await fetchOrder(orderId);
      if (!raw.id) return res.status(200).json({ ok: true, skipped: true });
      if ((raw.metadata || {}).source !== 'checkout_html') return res.status(200).json({ ok: true, skipped: 'not_checkout_html' });
      await sendStatusEmail(mapOrder(raw), 'cancelado', '');
    }
  } catch (e) {
    console.error('Webhook email error:', e.message);
  }

  return res.status(200).json({ ok: true });
};
