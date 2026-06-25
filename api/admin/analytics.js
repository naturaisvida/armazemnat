const jwt = require('jsonwebtoken');

const PAGARME_URL = 'https://api.pagar.me/core/v5';

function authHeader() {
  const s = process.env.PAGARME_SECRET;
  if (!s) throw new Error('PAGARME_SECRET não configurado');
  return 'Basic ' + Buffer.from(s + ':').toString('base64');
}

function validateAdmin(req, res) {
  const raw    = (req.headers['authorization'] || '').trim();
  const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) { res.status(401).json({ error: 'Não autorizado' }); return false; }
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (p.role !== 'admin') throw new Error();
    return true;
  } catch { res.status(401).json({ error: 'Token inválido ou expirado' }); return false; }
}

async function fetchAll(dateFrom, dateTo) {
  const headers = { Authorization: authHeader() };
  const all = [];
  let page = 1;
  while (page <= 20) {
    const pm = new URLSearchParams({ size: 50, page });
    // BRT = UTC-3: meia-noite BRT = T03:00Z; fim do dia BRT = dia+1 T02:59:59Z
    if (dateFrom) pm.set('created_since', new Date(dateFrom + 'T03:00:00.000Z').toISOString());
    if (dateTo) { const u = new Date(dateTo + 'T03:00:00.000Z'); u.setUTCDate(u.getUTCDate() + 1); pm.set('created_until', u.toISOString()); }
    const r    = await fetch(`${PAGARME_URL}/orders?${pm}`, { headers });
    const _t   = await r.text();
    let data;
    try { data = _t ? JSON.parse(_t) : {}; } catch { data = {}; }
    if (!r.ok || !Array.isArray(data.data)) break;
    data.data.filter(o => (o.metadata || {}).source === 'checkout_html').forEach(o => all.push(o));
    if (!data.paging?.next) break;
    page++;
  }
  return all;
}

function processOrders(raws) {
  const orders = raws.map(raw => {
    const charge = (raw.charges || [])[0] || {};
    const tx     = charge.last_transaction || {};
    const meta   = raw.metadata || {};
    const addr   = raw.shipping?.address || {};

    let method = 'outro';
    if      (tx.transaction_type === 'pix'         || charge.payment_method === 'pix')         method = 'pix';
    else if (tx.transaction_type === 'boleto'       || charge.payment_method === 'boleto')      method = 'boleto';
    else if (tx.transaction_type === 'credit_card'  || charge.payment_method === 'credit_card') method = 'cartao';

    let status = meta.custom_status || '';
    if (!status) {
      const cs = charge.status || '', os = raw.status || '';
      if (os === 'canceled' || cs === 'canceled' || cs === 'failed') status = 'cancelado';
      else if (cs === 'paid' || os === 'paid')                        status = 'faturado';
      else                                                            status = 'aguardando_pagamento';
    }

    const isPaid     = ['faturado','em_separacao','pronto_envio','em_transporte','entregue','excecao_entrega'].includes(status);
    const isCanceled = status === 'cancelado';

    return {
      amount:       raw.amount || 0,
      amountPaid:   (() => { const c = parseInt(meta.amount_charged, 10); return (Number.isFinite(c) && c > 0) ? c : (charge.amount || raw.amount || 0); })(),
      status, isPaid, isCanceled,
      method,
      installments: tx.installments || 1,
      createdAt:    raw.created_at || '',
      state:        addr.state || '',
      email:        raw.customer?.email || '',
      items: (raw.items || []).map(i => ({
        description: i.description || '',
        code:        i.code        || '',
        quantity:    i.quantity    || 1,
        amount:      i.amount      || 0,
      })),
    };
  });

  const paid     = orders.filter(o => o.isPaid);
  const canceled = orders.filter(o => o.isCanceled);
  const active   = orders.filter(o => !o.isCanceled);

  const vendasAmt  = active.reduce((s, o) => s + o.amountPaid, 0);
  const receitaAmt = paid.reduce((s, o) => s + o.amountPaid, 0);
  const ticketMed  = paid.length ? Math.round(receitaAmt / paid.length) : 0;

  // PIX / Boleto conversion
  const pixAll = orders.filter(o => o.method === 'pix');
  const bolAll = orders.filter(o => o.method === 'boleto');

  // Recurring customers
  const custMap = {};
  orders.forEach(o => { if (o.email) custMap[o.email] = (custMap[o.email] || 0) + 1; });
  const uniqueCust    = Object.keys(custMap).length || 1;
  const recurringCust = Object.values(custMap).filter(v => v > 1).length;

  // Per method (paid)
  const porMetodo = { pix:{count:0,amount:0}, boleto:{count:0,amount:0}, cartao:{count:0,amount:0}, outro:{count:0,amount:0} };
  paid.forEach(o => { const m = porMetodo[o.method] || porMetodo.outro; m.count++; m.amount += o.amountPaid; });

  // Installments (cartao paid)
  const parcelamentos = {};
  paid.filter(o => o.method === 'cartao').forEach(o => {
    const k = String(o.installments || 1);
    parcelamentos[k] = (parcelamentos[k] || 0) + 1;
  });

  // Products (all paid items)
  const prodMap = {};
  paid.forEach(o => o.items.forEach(item => {
    const k = item.description || 'Produto';
    if (!prodMap[k]) prodMap[k] = { name: k, code: item.code, count: 0, amount: 0 };
    prodMap[k].count  += item.quantity;
    prodMap[k].amount += item.amount * item.quantity;
  }));
  const totalVendas = Object.values(prodMap).reduce((s, p) => s + p.amount, 0) || 1;
  const topProdutos = Object.values(prodMap)
    .sort((a, b) => b.count - a.count)
    .map(p => ({ ...p, pct: Math.round(p.amount / totalVendas * 10000) / 100 }));

  // Top states
  const stateMap = {};
  paid.forEach(o => {
    const s = o.state || 'N/A';
    if (!stateMap[s]) stateMap[s] = { state: s, count: 0, amount: 0 };
    stateMap[s].count++;
    stateMap[s].amount += o.amountPaid;
  });
  const topEstados = Object.values(stateMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(e => ({ ...e, pct: Math.round(e.count / (paid.length || 1) * 100) }));

  // Daily breakdown
  const dayMap = {};
  orders.forEach(o => {
    const d = o.createdAt ? new Date(new Date(o.createdAt).getTime() - 3 * 3600000).toISOString().slice(0, 10) : '';
    if (!d) return;
    if (!dayMap[d]) dayMap[d] = { date: d, amount: 0, count: 0, paidAmount: 0, paidCount: 0, canceledCount: 0 };
    dayMap[d].amount += o.amountPaid;
    dayMap[d].count++;
    if (o.isPaid)     { dayMap[d].paidAmount += o.amountPaid; dayMap[d].paidCount++; }
    if (o.isCanceled) { dayMap[d].canceledCount++; }
  });
  const porDia = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    total:   orders.length,
    vendas:  { amount: vendasAmt,  count: active.length },
    receita: { amount: receitaAmt, count: paid.length },
    ticket_medio: ticketMed,
    cancelados: { count: canceled.length, rate: orders.length ? canceled.length / orders.length : 0 },
    pix:    { total: pixAll.length, paid: pixAll.filter(o=>o.isPaid).length, rate: pixAll.length ? pixAll.filter(o=>o.isPaid).length/pixAll.length : 0 },
    boleto: { total: bolAll.length, paid: bolAll.filter(o=>o.isPaid).length, rate: bolAll.length ? bolAll.filter(o=>o.isPaid).length/bolAll.length : 0 },
    recorrentes: { count: recurringCust, total: uniqueCust, rate: recurringCust / uniqueCust },
    por_metodo:   porMetodo,
    parcelamentos,
    top_produtos: topProdutos,
    top_estados:  topEstados,
    por_dia:      porDia,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    return res.status(204).end();
  }

  if (!validateAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const q        = req.query || {};
  const dateFrom = (q.date_from || '').slice(0, 10);
  const dateTo   = (q.date_to   || '').slice(0, 10);

  try {
    const orders  = await fetchAll(dateFrom, dateTo);
    const metrics = processOrders(orders);
    return res.status(200).json(metrics);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
