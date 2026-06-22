const jwt                  = require('jsonwebtoken');
const { sendStatusEmail }  = require('../_email/send');
const redis                = require('../_lib/redis');

const PAGARME_URL = 'https://api.pagar.me/core/v5';

// Status de fulfillment definidos manualmente pelo admin (guardados no Redis,
// NÃO no Pagar.me). Pagamento (aguardando_pagamento/faturado) é automático.
const MANUAL_STATUSES = [
  'em_separacao',
  'pronto_envio',
  'em_transporte',
  'entregue',
  'excecao_entrega',
  'cancelado',
  'nao_integrado',
];

// Statuses que disparam e-mail ao cliente
const EMAIL_STATUSES = ['em_separacao','pronto_envio','em_transporte','entregue','excecao_entrega','cancelado'];

// --- Helpers ---------------------------------------------------------------

function secHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000');
}

function authHeader() {
  const s = process.env.PAGARME_SECRET;
  if (!s) throw new Error('PAGARME_SECRET não configurado');
  return 'Basic ' + Buffer.from(s + ':').toString('base64');
}

function validateAdmin(req, res) {
  const raw    = (req.headers['authorization'] || '').trim();
  const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) {
    res.status(401).json({ error: 'Não autorizado' });
    return false;
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') throw new Error();
    return true;
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return false;
  }
}

async function pagarmeReq(method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': authHeader(), 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(PAGARME_URL + path, opts);
  const _t = await r.text();
  let data;
  try { data = _t ? JSON.parse(_t) : {}; } catch { data = {}; }
  data._http = r.status;
  return data;
}

// Maps raw Pagar.me order to our internal format
function formatOrder(raw) {
  const charge  = (raw.charges || [])[0] || {};
  const tx      = charge.last_transaction || {};
  const cust    = raw.customer || {};
  const meta    = raw.metadata || {};
  const ship    = raw.shipping || {};
  const addr    = ship.address || {};

  // Payment method
  let method = 'outro';
  if (tx.transaction_type === 'pix')         method = 'pix';
  else if (tx.transaction_type === 'boleto') method = 'boleto';
  else if (tx.transaction_type === 'credit_card') method = 'cartao';
  else if (charge.payment_method === 'credit_card') method = 'cartao';
  else if (charge.payment_method === 'boleto')      method = 'boleto';
  else if (charge.payment_method === 'pix')         method = 'pix';

  // Determine effective status
  let status = meta.custom_status || '';
  if (!status) {
    const cs = charge.status || '';
    const os = raw.status || '';
    if (os === 'canceled' || cs === 'canceled' || cs === 'failed') status = 'cancelado';
    else if (cs === 'paid' || os === 'paid')                        status = 'faturado';
    else                                                            status = 'aguardando_pagamento';
  }

  const basePhone = (cust.phones?.mobile_phone?.area_code || '') + (cust.phones?.mobile_phone?.number || '');

  // Parcelas: metadata (novo, confiável) → last_transaction → 1
  const metaInst = parseInt(meta.installments, 10);
  const installments = (Number.isFinite(metaInst) && metaInst > 0)
    ? metaInst
    : (tx.installments || charge.installments || 1);

  // Valor cobrado (COM juros): metadata → charge.amount → order.amount
  const metaCharged = parseInt(meta.amount_charged, 10);
  const amountPaid = (Number.isFinite(metaCharged) && metaCharged > 0)
    ? metaCharged
    : (charge.amount || raw.amount || 0);

  return {
    id:         raw.id,
    code:       raw.code || raw.id,
    customer: {
      name:     meta.edit_customer_name     || cust.name     || '',
      email:    meta.edit_customer_email    || cust.email    || '',
      document: meta.edit_customer_document || cust.document || '',
      phone:    meta.edit_customer_phone    || basePhone,
    },
    amount:      raw.amount   || 0,
    amountPaid,
    status,
    method,
    installments,
    createdAt:  raw.created_at,
    updatedAt:  raw.updated_at,
    emails: (() => { try { return JSON.parse(meta.email_log || '[]'); } catch { return []; } })(),
    items: (raw.items || []).map(i => ({
      description: i.description,
      quantity:    i.quantity,
      amount:      i.amount,
    })),
    shipping: {
      carrier:      meta.shipping_carrier || (ship.description || 'Correios'),
      trackingCode: meta.tracking_code    || '',
      recipientName: meta.edit_shipping_name || cust.name || '',
      address: {
        line1:    meta.edit_shipping_line1 || addr.line_1   || '',
        line2:    meta.edit_shipping_line2 || addr.line_2   || '',
        city:     meta.edit_shipping_city  || addr.city     || '',
        state:    meta.edit_shipping_state || addr.state    || '',
        zipCode:  meta.edit_shipping_zip   || addr.zip_code || '',
        country:  addr.country             || 'BR',
      },
    },
  };
}

// Sanitize string query params — allow only safe chars
function safeStr(v, maxLen = 100) {
  if (!v || typeof v !== 'string') return '';
  return v.replace(/[<>"'`]/g, '').slice(0, maxLen);
}

function safeInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// Build CSV with BOM for Excel
function buildCsv(orders) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fmt = v => v ? (v / 100).toFixed(2).replace('.', ',') : '0,00';
  const dt  = v => v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';

  const header = [
    'Nº Pedido','Cliente','E-mail','CPF/CNPJ','Telefone',
    'Total (R$)','Status','Pagamento','Parcelas','Data',
    'Produto','Qtd','Valor Item',
    'CEP','Endereço','Cidade','Estado','Rastreio',
  ].join(';');

  const rows = orders.flatMap(o =>
    o.items.map(item => [
      esc(o.code),
      esc(o.customer.name),
      esc(o.customer.email),
      esc(o.customer.document),
      esc(o.customer.phone),
      fmt(o.amountPaid),
      esc(o.status),
      esc(o.method),
      o.installments,
      dt(o.createdAt),
      esc(item.description),
      item.quantity,
      fmt(item.amount),
      esc(o.shipping.address.zipCode),
      esc(o.shipping.address.line1 + (o.shipping.address.line2 ? ', ' + o.shipping.address.line2 : '')),
      esc(o.shipping.address.city),
      esc(o.shipping.address.state),
      esc(o.shipping.trackingCode),
    ].join(';'))
  );

  return '﻿' + [header, ...rows].join('\n');
}

// --- Handler ---------------------------------------------------------------

module.exports = async function handler(req, res) {
  secHeaders(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (!validateAdmin(req, res)) return;

  // ── GET — list orders ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const q          = req.query || {};
    const page       = safeInt(q.page, 1, 1, 500);
    const status     = safeStr(q.status, 30);
    const search     = safeStr(q.search, 100);
    const dateFrom   = safeStr(q.date_from, 30);
    const dateTo     = safeStr(q.date_to, 30);
    const methodF    = safeStr(q.method, 20);
    const doExport   = q.export === 'csv';

    // Build Pagar.me params
    const pm = new URLSearchParams({ size: 50, page });
    if (dateFrom) pm.set('created_since', new Date(dateFrom).toISOString());
    if (dateTo)   pm.set('created_until', new Date(dateTo + 'T23:59:59').toISOString());

    // If searching by e-mail or CPF
    if (search && search.includes('@'))       pm.set('customer_email', search);
    else if (search && /^\d+$/.test(search)) pm.set('customer_document', search);

    const raw = await pagarmeReq('GET', `/orders?${pm}`);

    if (raw._http >= 400) {
      return res.status(502).json({ error: 'Erro ao buscar pedidos no Pagar.me' });
    }

    // Filtra apenas pedidos criados pelo site (exclui Yampi, Shopify, etc.)
    let orders = (raw.data || [])
      .filter(o => (o.metadata || {}).source === 'checkout_html')
      .map(formatOrder);

    // Mescla o status de fulfillment do Redis (fonte de verdade; metadata = legado).
    // Em try/catch: se o Redis falhar, a lista continua funcionando com o status base.
    if (orders.length) {
      try {
        const recs = await redis.pipeline(...orders.map(o => ['GET', 'ostatus:' + o.id]));
        orders.forEach((o, i) => {
          let rec = recs[i];
          if (rec && typeof rec === 'string') { try { rec = JSON.parse(rec); } catch { rec = null; } }
          if (rec && rec.status) {
            o.status = rec.status;
            if (rec.trackingCode) o.shipping.trackingCode = rec.trackingCode;
            if (Array.isArray(rec.emailLog)) o.emails = rec.emailLog;
          }
        });
      } catch (e) {
        console.error('[orders] merge de status do Redis falhou:', e.message);
      }
    }

    // Name search (client-side, Pagar.me doesn't support name search)
    if (search && !search.includes('@') && !/^\d+$/.test(search)) {
      const q2 = search.toLowerCase();
      orders = orders.filter(o =>
        o.customer.name.toLowerCase().includes(q2) ||
        o.code.toLowerCase().includes(q2)
      );
    }

    // Status filter
    if (status && status !== 'todos') {
      orders = orders.filter(o => o.status === status);
    }

    // Payment method filter
    if (methodF && methodF !== 'todos') {
      orders = orders.filter(o => o.method === methodF);
    }

    // Export CSV
    if (doExport) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pedidos-${Date.now()}.csv"`);
      return res.status(200).send(buildCsv(orders));
    }

    return res.status(200).json({
      orders,
      total:   orders.length,
      page,
      hasNext: !!(raw.paging?.next),
    });
  }

  // ── PATCH — update order status/tracking/customer/shipping ──────────────
  if (req.method === 'PATCH') {
    const body = req.body || {};
    const { orderId, editType } = body;

    if (!orderId || typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]{5,50}$/.test(orderId)) {
      return res.status(400).json({ error: 'orderId inválido' });
    }

    // ── Edit customer info ─────────────────────────────────────────────────
    if (editType === 'customer' || editType === 'shipping') {
      const current = await pagarmeReq('GET', `/orders/${orderId}`);
      if (current._http >= 400) return res.status(404).json({ error: 'Pedido não encontrado' });

      const newMeta = { ...(current.metadata || {}) };

      if (editType === 'customer') {
        if (body.name     != null) newMeta.edit_customer_name     = String(body.name).replace(/[<>"]/g,'').slice(0, 100);
        if (body.email    != null) newMeta.edit_customer_email    = String(body.email).replace(/[<>"]/g,'').slice(0, 200);
        if (body.phone    != null) newMeta.edit_customer_phone    = String(body.phone).replace(/\D/g,'').slice(0, 15);
        if (body.document != null) newMeta.edit_customer_document = String(body.document).replace(/\D/g,'').slice(0, 14);
      }

      if (editType === 'shipping') {
        if (body.name    != null) newMeta.edit_shipping_name  = String(body.name).replace(/[<>"]/g,'').slice(0, 100);
        if (body.line1   != null) newMeta.edit_shipping_line1 = String(body.line1).replace(/[<>"]/g,'').slice(0, 200);
        if (body.line2   != null) newMeta.edit_shipping_line2 = String(body.line2).replace(/[<>"]/g,'').slice(0, 100);
        if (body.city    != null) newMeta.edit_shipping_city  = String(body.city).replace(/[<>"]/g,'').slice(0, 100);
        if (body.state   != null) newMeta.edit_shipping_state = String(body.state).replace(/[^a-zA-Z]/g,'').slice(0, 2).toUpperCase();
        if (body.zipCode != null) newMeta.edit_shipping_zip   = String(body.zipCode).replace(/\D/g,'').slice(0, 8);
      }

      const updated = await pagarmeReq('PATCH', `/orders/${orderId}`, { metadata: newMeta });
      if (updated._http >= 400) return res.status(502).json({ error: 'Erro ao salvar alterações' });
      return res.status(200).json({ ok: true, editType });
    }

    // ── Status de fulfillment (Redis, NÃO toca no Pagar.me) ─────────────────
    const { status, trackingCode, order: snapshot } = body;

    if (!MANUAL_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const safeTracking = trackingCode
      ? String(trackingCode).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
      : '';

    const willSendEmail = EMAIL_STATUSES.includes(status);

    // Registro atual no Redis (preserva rastreio e log de e-mail)
    let rec = {};
    try { rec = (await redis.get('ostatus:' + orderId)) || {}; } catch { rec = {}; }
    if (typeof rec !== 'object' || rec === null) rec = {};
    const prevLog = Array.isArray(rec.emailLog) ? rec.emailLog : [];

    // Envia o e-mail usando o snapshot do pedido enviado pelo dashboard
    // (assim não precisa consultar o Pagar.me).
    let emailSent  = false;
    let emailError = null;
    const emailTo  = snapshot?.customer?.email || '';
    if (willSendEmail && snapshot && emailTo) {
      try {
        const emailId = await sendStatusEmail(snapshot, status, safeTracking);
        emailSent = !!emailId;
      } catch (e) {
        emailError = e.message;
      }
    } else if (willSendEmail && !emailTo) {
      emailError = 'Pedido sem e-mail do cliente';
    }

    const logEntry = willSendEmail ? {
      status, sentAt: new Date().toISOString(), to: emailTo, ok: emailSent,
    } : null;

    const newRec = {
      status,
      trackingCode: safeTracking || rec.trackingCode || '',
      updatedAt:    new Date().toISOString(),
      emailLog:     logEntry ? [...prevLog, logEntry].slice(-20) : prevLog,
    };

    try {
      await redis.set('ostatus:' + orderId, newRec);
    } catch (e) {
      return res.status(502).json({ error: 'Erro ao salvar status', detail: e.message });
    }

    return res.status(200).json({ ok: true, orderId, status, emailSent, ...(emailError ? { emailError } : {}) });
  }

  return res.status(405).json({ error: 'Método não permitido' });
};
