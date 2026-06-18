const PAGARME_URL = 'https://api.pagar.me/core/v5';
const { sendPixEmail, sendBoletoEmail, sendCartaoEmail } = require('./_email/send');

function authHeader() {
  const s = process.env.PAGARME_SECRET;
  return 'Basic ' + Buffer.from(s + ':').toString('base64');
}

async function pagarmeReq(method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': authHeader(), 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(PAGARME_URL + path, opts);
  const data = await r.json();
  data._http = r.status;
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET ?status=orderId — polling PIX
  if (req.method === 'GET') {
    const id = (req.query.status || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: true, message: 'ID do pedido ausente' });
    const data = await pagarmeReq('GET', '/orders/' + id);
    return res.status(data._http || 200).json(data);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Método não permitido' });
  }

  const input = req.body;
  if (!input || !input.method) {
    return res.status(400).json({ error: true, message: 'Dados inválidos' });
  }

  const {
    method,
    amount,
    shipping_amount = 0,
    shipping_label = 'Correios',
    customer = {},
    address = {},
    items = [],
    installments = 1,
    card_token,
    pix_expires_in = 1800,
    observacao = '',
    utm = {},
  } = input;

  if (!amount || parseInt(amount) <= 0) {
    return res.status(400).json({ error: true, message: 'Valor inválido' });
  }
  if (!customer.name || !customer.document) {
    return res.status(400).json({ error: true, message: 'Dados do cliente incompletos' });
  }
  if (!items.length) {
    return res.status(400).json({ error: true, message: 'Nenhum item no pedido' });
  }
  if (method === 'cartao' && !card_token) {
    return res.status(400).json({ error: true, message: 'Token do cartão ausente' });
  }

  const doc = (customer.document || '').replace(/\D/g, '');
  const cust = {
    name:          customer.name,
    email:         customer.email,
    document:      doc,
    document_type: doc.length === 14 ? 'CNPJ' : 'CPF',
    type:          'individual',
    phones: {
      mobile_phone: {
        country_code: '55',
        area_code:    (customer.phone_area   || '').replace(/\D/g, ''),
        number:       (customer.phone_number || '').replace(/\D/g, ''),
      }
    }
  };

  const addr = {
    line_1:   address.line_1   || '',
    line_2:   address.line_2   || '',
    zip_code: (address.zip_code || '').replace(/\D/g, ''),
    city:     address.city     || '',
    state:    (address.state   || '').toUpperCase().replace(/[^A-Z]/g, ''),
    country:  'BR',
  };

  const orderItems = items.map((it, i) => ({
    amount:      parseInt(it.amount) || 0,
    description: String(it.description || 'Produto').slice(0, 255),
    quantity:    Math.max(1, parseInt(it.quantity) || 1),
    code:        'SKU' + (i + 1),
  }));

  let payment;
  if (method === 'pix') {
    payment = [{ payment_method: 'pix', amount: parseInt(amount), pix: { expires_in: parseInt(pix_expires_in) } }];
  } else if (method === 'boleto') {
    const due = new Date();
    due.setDate(due.getDate() + 3);
    payment = [{
      payment_method: 'boleto',
      amount: parseInt(amount),
      boleto: { instructions: 'Não receber após o vencimento.', due_at: due.toISOString() }
    }];
  } else if (method === 'cartao') {
    payment = [{
      payment_method: 'credit_card',
      amount: parseInt(amount),
      credit_card: {
        recurrence:           false,
        installments:         parseInt(installments),
        statement_descriptor: 'ARMAZEM NATURAL',
        card_token:           card_token,
        billing_address:      addr,
      }
    }];
  } else {
    return res.status(400).json({ error: true, message: 'Método de pagamento inválido' });
  }

  const orderData = {
    items:    orderItems,
    customer: cust,
    payments: payment,
    shipping: {
      amount:          parseInt(shipping_amount) || 0,
      description:     shipping_amount > 0 ? `Frete ${shipping_label}` : 'Frete Grátis',
      recipient_name:  cust.name,
      recipient_phone: '55' + cust.phones.mobile_phone.area_code + cust.phones.mobile_phone.number,
      address:         addr,
    },
    metadata: {
      observacao:    String(observacao).slice(0, 300),
      source:        'checkout_html',
      utm_source:    String(utm.source   || '').slice(0, 100),
      utm_medium:    String(utm.medium   || '').slice(0, 100),
      utm_campaign:  String(utm.campaign || '').slice(0, 100),
      utm_content:   String(utm.content  || '').slice(0, 100),
      utm_term:      String(utm.term     || '').slice(0, 100),
    },
    closed: true,
  };

  const result = await pagarmeReq('POST', '/orders', orderData);

  if ((result._http || 200) >= 400) {
    const msg = result.message || 'Erro ao processar pagamento';
    return res.status(result._http).json({ error: true, message: msg, details: result });
  }

  // Send order confirmation email (fire-and-forget)
  try {
    const charge = (result.charges || [])[0] || {};
    const tx     = charge.last_transaction || {};
    const emailOrder = {
      id:           result.id,
      code:         result.code || result.id,
      customer:     { name: cust.name, email: cust.email },
      amount:       parseInt(amount),
      installments: parseInt(installments),
      items:        orderItems,
      method,
    };

    if (method === 'pix' && tx.qr_code) {
      sendPixEmail(emailOrder, {
        pix_qr_code:         tx.qr_code,
        pix_expiration_date: tx.expires_at,
      }).catch(() => {});
    } else if (method === 'boleto' && (tx.line || tx.pdf)) {
      sendBoletoEmail(emailOrder, {
        line:   tx.line,
        pdf:    tx.pdf,
        url:    tx.url,
        due_at: tx.due_at,
      }).catch(() => {});
    } else if (method === 'cartao' && charge.status === 'paid') {
      sendCartaoEmail(emailOrder).catch(() => {});
    }
  } catch (e) {
    // Email failure must NOT block order response
    console.error('Email send error:', e.message);
  }

  return res.status(200).json(result);
};
