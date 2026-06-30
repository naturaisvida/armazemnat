// Called by external cron every 5 minutes
// Secure with ?secret=CRON_SECRET or X-Cron-Secret header
// Recommended: cron-job.org (free) → GET https://seu-site.vercel.app/api/cart/cron?secret=CRON_SECRET

const jwt         = require('jsonwebtoken');
const redis       = require('../_lib/redis');
const { sendRaw } = require('../_email/send');

const STORE_URL   = process.env.STORE_URL  || 'https://armazemnatural.shop';
const STORE_EMAIL = process.env.RESEND_FROM_EMAIL || 'Armazém Natural <atendimento@armazemnatural.shop>';

// Gaps AFTER each email before next email
const GAPS = [
  0,                    // placeholder for index 0
  60 * 60 * 1000,       // after email #1: wait 1h for email #2
  23 * 60 * 60 * 1000,  // after email #2: wait 23h for email #3
];

const CONFIGS = [
  null,
  {
    subject: 'Esqueceu alguma coisa? Seu carrinho ainda está esperando',
    title: 'Seu carrinho te aguarda!',
    headline: '{firstName}, parece que você deixou algo para trás.',
    body: 'Você iniciou uma compra na Armazém Natural mas não finalizou. Seus produtos ainda estão reservados para você.',
    cta: 'Voltar ao carrinho',
    urgency: null,
  },
  {
    subject: 'Seu carrinho ainda está esperando — Armazém Natural',
    title: 'Nao deixe escapar!',
    headline: '{firstName}, seus produtos ainda estão no carrinho.',
    body: 'Faz um tempinho que você adicionou produtos ao seu carrinho e não finalizou. Não perca a oportunidade de garantir seus produtos naturais!',
    cta: 'Finalizar compra agora',
    urgency: 'Produtos sujeitos à disponibilidade de estoque.',
  },
  {
    subject: 'Ultima chance — garanta seu pedido na Armazém Natural',
    title: 'Ultima chance!',
    headline: '{firstName}, este é nosso último aviso.',
    body: 'Seu carrinho ainda está aqui, mas não podemos garantir a disponibilidade por muito mais tempo. Finalize sua compra agora e garanta seus produtos naturais!',
    cta: 'Garantir meu pedido',
    urgency: 'Estoque limitado. Finalize agora para garantir.',
  },
];

function escH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtMoney(v) {
  return 'R$&nbsp;' + ((v || 0) / 100).toFixed(2).replace('.', ',');
}

function buildEmail(cart, emailNum) {
  const cfg = CONFIGS[emailNum];
  if (!cfg) return null;

  const firstName  = (cart.customer.name || 'Cliente').split(' ')[0];
  const recoverUrl = cart.checkoutUrl || `${STORE_URL}/checkout.html?cartId=${encodeURIComponent(cart.id)}`;

  const headline = cfg.headline.replace('{firstName}', escH(firstName));

  const itemsHtml = (cart.items || []).map(i =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
        <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(i.description)}</span>
        <span style="font-size:13px;color:#888">${fmtMoney(i.amount)} x ${i.quantity}</span>
      </td>
    </tr>`
  ).join('') || `<tr><td style="padding:10px 0;color:#888;font-size:13px;font-family:Arial,sans-serif">Produto Armazem Natural</td></tr>`;

  const urgencyBlock = cfg.urgency
    ? `<p style="margin:12px 0 0;font-size:12px;color:#ef4444;font-style:italic;font-family:Arial,sans-serif">${cfg.urgency}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(cfg.title)}</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">

<tr><td style="padding:20px 40px 18px;text-align:center;border-bottom:2px solid #f0f0f0">
  <img src="${STORE_URL}/img/logoarmazem.png" alt="Armazem Natural" width="140" style="height:auto;display:block;margin:0 auto">
</td></tr>

<tr><td style="padding:32px 40px 28px">
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a2e22;font-family:Arial,sans-serif">${escH(cfg.title)}</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#555;font-family:Arial,sans-serif">${headline}</p>
  <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">${cfg.body}</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
    <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
      <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">SEU CARRINHO</span>
    </td></tr>
    <tr><td style="padding:8px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
    </td></tr>
    <tr><td style="padding:12px 16px;border-top:1px solid #e8e8e8">
      <strong style="font-size:15px;color:#1a2e22;font-family:Arial,sans-serif">Total: ${fmtMoney(cart.totalAmount)}</strong>
    </td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
    <tr><td style="background:#1a2e22;border-radius:9px">
      <a href="${recoverUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">${escH(cfg.cta)}</a>
    </td></tr>
  </table>
  ${urgencyBlock}
</td></tr>

<tr><td style="padding:20px 40px;border-top:2px solid #f0f0f0;text-align:center">
  <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">Armazem Natural</p>
  <p style="margin:0;font-size:13px;color:#888;font-family:Arial,sans-serif">Duvidas? <a href="mailto:atendimento@armazemnatural.shop" style="color:#15a731;text-decoration:none">atendimento@armazemnatural.shop</a></p>
  <p style="margin:8px 0 0;font-size:11px;color:#bbb;font-family:Arial,sans-serif">Para nao receber mais estes e-mails, <a href="${STORE_URL}/unsubscribe?email=${encodeURIComponent(cart.customer.email || '')}" style="color:#bbb">clique aqui</a>.</p>
</td></tr>

</table>
</td></tr></table>
</body>
</html>`;

  return { subject: cfg.subject, html };
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  // POST — force-send next recovery email to a specific cart (admin only)
  if (req.method === 'POST') {
    const raw    = (req.headers['authorization'] || '').trim();
    const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!token || !secret) return res.status(401).json({ error: 'Não autorizado' });
    try {
      const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (p.role !== 'admin') throw new Error();
    } catch { return res.status(401).json({ error: 'Token inválido' }); }

    const { cartId } = req.body || {};
    if (!cartId) return res.status(400).json({ error: 'cartId obrigatório' });

    const cart = await redis.get(`cart:${cartId}`);
    if (!cart || !cart.customer?.email) return res.status(404).json({ error: 'Carrinho não encontrado ou sem e-mail' });
    if (cart.converted) return res.status(400).json({ error: 'Carrinho já convertido' });

    const emailNum = Math.min(cart.nextEmailNum || 1, 3);
    const emailContent = buildEmail(cart, emailNum);
    if (!emailContent) return res.status(400).json({ error: 'Nenhum e-mail disponível' });

    await sendRaw(cart.customer.email, emailContent.subject, emailContent.html);

    cart.recoveryEmails = cart.recoveryEmails || [];
    cart.recoveryEmails.push({ num: emailNum, sentAt: new Date().toISOString(), manual: true });
    cart.nextEmailNum = emailNum + 1;
    cart.nextRecoveryAt = emailNum < 3
      ? new Date(Date.now() + GAPS[emailNum]).toISOString()
      : null;

    await redis.set(`cart:${cartId}`, cart, 7 * 24 * 60 * 60);
    return res.status(200).json({ ok: true, emailNum, to: cart.customer.email });
  }

  if (req.method !== 'GET') return res.status(405).end();

  const CRON_SECRET = process.env.CRON_SECRET;
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const ids    = await redis.smembers('abandoned_carts');
  const now    = Date.now();
  const result = { total: ids.length, processed: 0, sent: 0, errors: 0 };

  for (const cartId of ids) {
    try {
      const cart = await redis.get(`cart:${cartId}`);

      if (!cart || cart.converted || !cart.customer?.email) {
        await redis.srem('abandoned_carts', cartId);
        continue;
      }

      if (!cart.nextRecoveryAt || new Date(cart.nextRecoveryAt).getTime() > now) continue;
      if (cart.nextEmailNum > 3) {
        await redis.srem('abandoned_carts', cartId);
        continue;
      }

      const emailNum     = cart.nextEmailNum;
      const emailContent = buildEmail(cart, emailNum);
      if (!emailContent) { cart.nextEmailNum++; await redis.set(`cart:${cartId}`, cart, 7*24*60*60); continue; }

      await sendRaw(cart.customer.email, emailContent.subject, emailContent.html);

      cart.recoveryEmails.push({ num: emailNum, sentAt: new Date().toISOString() });
      cart.nextEmailNum = emailNum + 1;
      cart.nextRecoveryAt = emailNum < 3
        ? new Date(Date.now() + GAPS[emailNum]).toISOString()
        : null;

      await redis.set(`cart:${cartId}`, cart, 7 * 24 * 60 * 60);
      result.sent++;
    } catch (e) {
      console.error('Cron recovery error for', cartId, e.message);
      result.errors++;
    }
    result.processed++;
  }

  return res.status(200).json({ ok: true, ...result });
};
