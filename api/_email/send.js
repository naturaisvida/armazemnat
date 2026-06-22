const RESEND_API = 'https://api.resend.com/emails';

function escH(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtMoney(v) {
  return 'R$&nbsp;' + ((v || 0) / 100).toFixed(2).replace('.', ',');
}

// ── STATUS CHANGE EMAILS (webhook-triggered) ─────────────────────────────────
const STATUS_CONFIG = {
  faturado: {
    subject: 'Pagamento confirmado — Pedido #{code}',
    title:   'Pagamento Confirmado!',
    message: 'O pagamento da sua compra foi aprovado. Agradecemos sua preferência pela Armazém Natural! Você receberá atualizações por e-mail sobre o andamento da sua compra até o momento de entrega.',
    accent:  '#15a731',
  },
  em_separacao: {
    subject: 'Seu pedido está em separação — #{code}',
    title:   'Pedido em Separação!',
    message: 'Boas notícias! Seu pedido já está sendo separado com todo cuidado pela nossa equipe. Em breve estará pronto para envio.',
    accent:  '#8b5cf6',
  },
  pronto_envio: {
    subject: 'Seu pedido está pronto para envio — #{code}',
    title:   'Pronto para Envio!',
    message: 'Seu pedido já foi separado e embalado, e está pronto para ser despachado. Logo logo ele estará a caminho!',
    accent:  '#0891b2',
  },
  em_transporte: {
    subject: 'Seu pedido está a caminho — #{code}',
    title:   'Pedido a Caminho!',
    message: 'Seu pedido foi despachado e está a caminho. Em breve você receberá sua encomenda!',
    accent:  '#3b82f6',
  },
  entregue: {
    subject: 'Pedido entregue — #{code}',
    title:   'Pedido Entregue!',
    message: 'Seu pedido foi entregue com sucesso. Esperamos que você aproveite muito sua compra! Em caso de dúvidas, estamos à disposição.',
    accent:  '#10b981',
  },
  excecao_entrega: {
    subject: 'Atenção: problema na entrega — #{code}',
    title:   'Problema na Entrega',
    message: 'Houve uma exceção durante a entrega do seu pedido. Nossa equipe já está verificando a situação e entrará em contato em breve.',
    accent:  '#ef4444',
  },
  cancelado: {
    subject: 'Pedido cancelado — #{code}',
    title:   'Pedido Cancelado',
    message: 'Infelizmente seu pedido foi cancelado. Se tiver dúvidas ou quiser mais informações, entre em contato conosco.',
    accent:  '#64748b',
  },
};

function buildStatusHtml(order, statusKey, trackingCode) {
  const cfg = STATUS_CONFIG[statusKey];
  if (!cfg) return null;

  const storeUrl  = process.env.STORE_URL || 'https://armazemnatural.shop';
  const firstName = escH((order.customer.name || 'Cliente').split(' ')[0]);
  const code      = escH(order.code || order.id || '');
  const a         = order.shipping?.address || {};
  const addrLine  = escH([a.line1, a.line2].filter(Boolean).join(', '));
  const addrCity  = escH(`${a.city || ''} / ${a.state || ''} — CEP: ${a.zipCode || ''}`);
  const methodLabel = { pix: 'Pix', boleto: 'Boleto Bancário', cartao: 'Cartão de Crédito', outro: 'Outro' };
  const installments = order.installments || 1;
  const totalLabel   = installments > 1
    ? `${installments}x de ${fmtMoney(Math.round((order.amount || 0) / installments))}`
    : fmtMoney(order.amount || 0);

  const trackingBlock = (trackingCode && statusKey === 'em_transporte') ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px">
      <tr><td style="padding:16px 18px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Código de Rastreio</p>
        <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#1a2e22;letter-spacing:.04em;font-family:Arial,sans-serif">${escH(trackingCode)}</p>
        <p style="margin:0;font-size:12px;color:#555;font-family:Arial,sans-serif">Acompanhe em <a href="https://rastreamento.correios.com.br/app/index.php" style="color:#15a731;text-decoration:none">rastreamento.correios.com.br</a></p>
      </td></tr>
    </table>` : '';

  const itemsHtml = (order.items || []).map(item =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
      <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(item.description || '')}</span>
      <span style="font-size:13px;color:#888">${fmtMoney(item.amount)} x ${item.quantity || 1}</span>
    </td></tr>`
  ).join('') || `<tr><td style="padding:10px 0;font-size:14px;color:#888;font-family:Arial,sans-serif">—</td></tr>`;

  return wrapEmail(escH(cfg.title), `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e22;font-family:Arial,sans-serif">${escH(cfg.title)}</h1>
    <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e22;font-family:Arial,sans-serif">Olá ${firstName}!</p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">${cfg.message}</p>
    ${trackingBlock}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
      <tr><td style="background:#1a2e22;border-radius:9px">
        <a href="${storeUrl}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Acompanhar compra</a>
      </td></tr>
    </table>
    ${buildInfoBox('ENTREGA', '#e67e22', `<strong>${escH(order.customer?.name || '')}</strong><br>${addrLine}<br>${addrCity}`)}
    ${buildInfoBox('PAGAMENTO', '#3b82f6', escH(methodLabel[order.method] || 'Outro') + (installments > 1 ? ` — ${installments}x` : ''))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
      <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
        <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">ITENS</span>
      </td></tr>
      <tr><td style="padding:8px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
      <tr>
        <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">Total</td>
        <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#1a2e22;text-align:right;font-family:Arial,sans-serif">${totalLabel}</td>
      </tr>
    </table>
  `);
}

// ── ORDER CREATION EMAILS (called immediately from api/order.js) ─────────────

function buildPixHtml(order, pixData) {
  const firstName = escH((order.customer.name || 'Cliente').split(' ')[0]);
  const code      = escH(order.code || order.id || '');
  const pixKey    = escH(pixData.pix_qr_code || pixData.qr_code || '');
  const expiresAt = pixData.expires_at || pixData.pix_expiration_date;
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    : '30 minutos';

  const itemsHtml = (order.items || []).map(item =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
      <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(item.description || '')}</span>
      <span style="font-size:12px;color:#888">${fmtMoney(item.amount)} x ${item.quantity || 1}</span>
    </td></tr>`
  ).join('');

  return wrapEmail('PIX Gerado — Aguardando pagamento', `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e22;font-family:Arial,sans-serif">PIX Gerado!</h1>
    <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e22;font-family:Arial,sans-serif">Olá ${firstName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">
      Seu pedido <strong>${code}</strong> foi criado. Para concluir a compra, pague o PIX abaixo.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Chave PIX (copia e cola)</p>
        <p style="margin:0 0 12px;font-size:13px;color:#1a2e22;word-break:break-all;background:#fff;padding:12px;border-radius:8px;border:1px solid #d1fae5;font-family:monospace">${pixKey}</p>
        <p style="margin:0;font-size:12px;color:#15803d;font-family:Arial,sans-serif">Expira hoje às <strong>${expiresLabel}</strong>. Pague antes do prazo para garantir seu pedido.</p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
      <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
        <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">SEU PEDIDO</span>
      </td></tr>
      <tr><td style="padding:8px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #f0f0f0">
        <strong style="font-size:15px;color:#1a2e22;font-family:Arial,sans-serif">Total: ${fmtMoney(order.amount)}</strong>
      </td></tr>
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#888;font-family:Arial,sans-serif">Após o pagamento, você receberá a confirmação por e-mail.</p>
  `);
}

function buildBoletoHtml(order, boletoData) {
  const firstName  = escH((order.customer.name || 'Cliente').split(' ')[0]);
  const code       = escH(order.code || order.id || '');
  const line       = escH(boletoData.line || boletoData.nosso_numero || '');
  const boletoUrl  = boletoData.pdf || boletoData.url || '';
  const dueAt      = boletoData.due_at;
  const dueLabel   = dueAt
    ? new Date(dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '3 dias úteis';

  const itemsHtml = (order.items || []).map(item =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
      <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(item.description || '')}</span>
      <span style="font-size:12px;color:#888">${fmtMoney(item.amount)} x ${item.quantity || 1}</span>
    </td></tr>`
  ).join('');

  return wrapEmail('Boleto Gerado — Armazém Natural', `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e22;font-family:Arial,sans-serif">Boleto Gerado!</h1>
    <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e22;font-family:Arial,sans-serif">Olá ${firstName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">
      Seu pedido <strong>${code}</strong> foi criado. Pague o boleto abaixo para confirmar sua compra.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#fffbeb;border:2px solid #fde68a;border-radius:12px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Linha Digitável</p>
        <p style="margin:0 0 16px;font-size:13px;color:#1a2e22;word-break:break-all;background:#fff;padding:12px;border-radius:8px;border:1px solid #fde68a;font-family:monospace">${line}</p>
        ${boletoUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">
          <tr><td style="background:#1a2e22;border-radius:9px">
            <a href="${escH(boletoUrl)}" style="display:inline-block;padding:11px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Abrir boleto (PDF)</a>
          </td></tr>
        </table>` : ''}
        <p style="margin:0;font-size:12px;color:#92400e;font-family:Arial,sans-serif">Vencimento: <strong>${dueLabel}</strong>. Nao pague apos o vencimento.</p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
      <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
        <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">SEU PEDIDO</span>
      </td></tr>
      <tr><td style="padding:8px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #f0f0f0">
        <strong style="font-size:15px;color:#1a2e22;font-family:Arial,sans-serif">Total: ${fmtMoney(order.amount)}</strong>
      </td></tr>
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#888;font-family:Arial,sans-serif">O pagamento por boleto pode levar até 3 dias úteis para ser confirmado. Após a compensação, você receberá o e-mail de confirmação.</p>
  `);
}

function buildCartaoHtml(order) {
  const firstName = escH((order.customer.name || 'Cliente').split(' ')[0]);
  const code      = escH(order.code || order.id || '');
  const inst      = order.installments || 1;
  const instLabel = inst > 1
    ? `${inst}x de ${fmtMoney(Math.round((order.amount || 0) / inst))} sem juros`
    : fmtMoney(order.amount || 0);

  const itemsHtml = (order.items || []).map(item =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
      <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(item.description || '')}</span>
      <span style="font-size:12px;color:#888">${fmtMoney(item.amount)} x ${item.quantity || 1}</span>
    </td></tr>`
  ).join('');

  return wrapEmail('Pedido confirmado — Armazém Natural', `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e22;font-family:Arial,sans-serif">Pedido Confirmado!</h1>
    <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e22;font-family:Arial,sans-serif">Olá ${firstName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">
      Seu pagamento foi aprovado e o pedido <strong>${code}</strong> já está em preparação. Você receberá uma atualização quando o pedido for enviado.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px">
      <tr><td style="padding:18px 24px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Cartão de Crédito</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">${instLabel}</p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
      <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
        <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">SEU PEDIDO</span>
      </td></tr>
      <tr><td style="padding:8px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #f0f0f0">
        <strong style="font-size:15px;color:#1a2e22;font-family:Arial,sans-serif">Total: ${fmtMoney(order.amount)}</strong>
      </td></tr>
    </table>
  `);
}

// ── SHARED LAYOUT ─────────────────────────────────────────────────────────────
function buildInfoBox(label, color, contentHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
    <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
      <span style="font-size:11px;font-weight:700;color:${color};letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">${label}</span>
    </td></tr>
    <tr><td style="padding:14px 16px;font-size:14px;color:#333;line-height:1.6;font-family:Arial,sans-serif">${contentHtml}</td></tr>
  </table>`;
}

function wrapEmail(title, body) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escH(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="padding:20px 40px 18px;text-align:center;border-bottom:2px solid #f0f0f0">
      <img src="${process.env.STORE_URL || 'https://armazemnatural.shop'}/img/logoarmazem.png" alt="Armazem Natural" width="140" style="height:auto;display:block;margin:0 auto">
    </td></tr>
    <tr><td style="padding:28px 40px 24px">${body}</td></tr>
    <tr><td style="padding:20px 40px;border-top:2px solid #f0f0f0;text-align:center">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">Armazem Natural</p>
      <p style="margin:0;font-size:13px;color:#888;font-family:Arial,sans-serif">Duvidas? <a href="mailto:atendimento@armazemnatural.shop" style="color:#15a731;text-decoration:none">atendimento@armazemnatural.shop</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ── SEND HELPERS ──────────────────────────────────────────────────────────────
async function sendRaw(to, subject, html) {
  const key  = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não configurado');
  const from = process.env.RESEND_FROM_EMAIL || 'Armazém Natural <atendimento@armazemnatural.shop>';
  const r = await fetch(RESEND_API, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, subject, html }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.message || data.name || 'Resend error') + ' ' + r.status);
  return data.id;
}

async function sendStatusEmail(order, status, trackingCode) {
  if (!order?.customer?.email) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  const code    = order.code || order.id || '';
  const subject = cfg.subject.replace('{code}', code);
  const html    = buildStatusHtml(order, status, trackingCode || '');
  if (!html) return null;
  return sendRaw(order.customer.email, subject, html);
}

async function sendPixEmail(order, pixData) {
  if (!order?.customer?.email) return null;
  const code = order.code || order.id || '';
  return sendRaw(
    order.customer.email,
    `PIX gerado — Pedido ${code} aguardando pagamento`,
    buildPixHtml(order, pixData)
  );
}

async function sendBoletoEmail(order, boletoData) {
  if (!order?.customer?.email) return null;
  const code = order.code || order.id || '';
  return sendRaw(
    order.customer.email,
    `Boleto gerado — Pedido ${code}`,
    buildBoletoHtml(order, boletoData)
  );
}

async function sendCartaoEmail(order) {
  if (!order?.customer?.email) return null;
  const code = order.code || order.id || '';
  return sendRaw(
    order.customer.email,
    `Pedido confirmado — ${code}`,
    buildCartaoHtml(order)
  );
}

module.exports = { sendStatusEmail, sendRaw, sendPixEmail, sendBoletoEmail, sendCartaoEmail, STATUS_CONFIG };
