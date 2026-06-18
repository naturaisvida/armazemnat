const RESEND_API = 'https://api.resend.com/emails';

const STATUS_CONFIG = {
  faturado: {
    subject: 'Pagamento aprovado — Pedido #{code}',
    title:   'Pagamento Aprovado!',
    message: 'O pagamento da sua compra foi aprovado. Agradecemos sua preferência pela Armazém Natural! Você receberá atualizações por e-mail sobre o andamento da sua compra até o momento de entrega.',
    accent:  '#15a731',
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

function escH(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(order, statusKey, trackingCode) {
  const cfg = STATUS_CONFIG[statusKey];
  if (!cfg) return null;

  const storeUrl  = process.env.STORE_URL || 'https://armazemnatural.vercel.app';
  const logoUrl   = process.env.STORE_LOGO_URL || 'https://armazemnatural.shop/cdn/shop/files/NATURAL_225x@2x.png';
  const firstName = escH((order.customer.name || 'Cliente').split(' ')[0]);
  const code      = escH(order.code || order.id || '');

  const fmtMoney = v => 'R$&nbsp;' + ((v || 0) / 100).toFixed(2).replace('.', ',');
  const a        = order.shipping?.address || {};
  const addrLine = escH([a.line1, a.line2].filter(Boolean).join(', '));
  const addrCity = escH(`${a.city || ''} / ${a.state || ''} — CEP: ${a.zipCode || ''}`);

  const methodLabel = { pix: 'Pix', boleto: 'Boleto Bancário', cartao: 'Cartão de Crédito', outro: 'Outro' };

  const installments = order.installments || 1;
  const totalLabel   = installments > 1
    ? `${installments}x de ${fmtMoney(Math.round((order.amount || 0) / installments))}`
    : `1x de ${fmtMoney(order.amount || 0)}`;

  const trackingBlock = (trackingCode && statusKey === 'em_transporte') ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px">
      <tr><td style="padding:16px 18px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Código de Rastreio</p>
        <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#1a2e22;letter-spacing:.04em;font-family:Arial,sans-serif">${escH(trackingCode)}</p>
        <p style="margin:0;font-size:12px;color:#555;font-family:Arial,sans-serif">Acompanhe em <a href="https://rastreamento.correios.com.br/app/index.php" style="color:#15a731;text-decoration:none">rastreamento.correios.com.br</a></p>
      </td></tr>
    </table>` : '';

  const itemsHtml = (order.items || []).map(item => {
    const subtotal = fmtMoney((item.amount || 0) * (item.quantity || 1));
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-family:Arial,sans-serif">
        <span style="display:block;font-size:14px;color:#1a2e22;font-weight:600">${escH(item.description || '')}</span>
        <span style="font-size:13px;color:#888">${fmtMoney(item.amount)} × ${item.quantity || 1} — <strong style="color:#555">${subtotal}</strong></span>
      </td>
    </tr>`;
  }).join('') || `<tr><td style="padding:10px 0;font-size:14px;color:#888;font-family:Arial,sans-serif">—</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escH(cfg.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5">
<tr><td align="center" style="padding:32px 16px">

  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">

    <!-- LOGO -->
    <tr>
      <td style="padding:28px 40px 24px;text-align:center;border-bottom:2px solid #f0f0f0">
        <img src="${logoUrl}" height="40" alt="Armazém Natural" style="height:40px;display:block;margin:0 auto;border:0">
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding:32px 40px 28px">

        <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a2e22;line-height:1.3;font-family:Arial,sans-serif">${escH(cfg.title)}</h1>
        <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#1a2e22;font-family:Arial,sans-serif">Olá ${firstName}!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.65;font-family:Arial,sans-serif">${cfg.message}</p>

        ${trackingBlock}

        <!-- CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
          <tr>
            <td style="background:#1a2e22;border-radius:9px">
              <a href="${storeUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Acompanhar compra</a>
            </td>
          </tr>
        </table>

        <!-- ENTREGA -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
          <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
            <span style="font-size:11px;font-weight:700;color:#e67e22;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">&#9679; ENTREGA</span>
          </td></tr>
          <tr><td style="padding:14px 16px;font-size:14px;color:#333;line-height:1.6;font-family:Arial,sans-serif">
            <strong>${escH(order.customer?.name || '')}</strong><br>
            ${addrLine}<br>
            ${addrCity}
            ${order.shipping?.carrier ? `<br><span style="color:#888;font-size:12px">${escH(order.shipping.carrier)}</span>` : ''}
          </td></tr>
        </table>

        <!-- PAGAMENTO -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
          <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
            <span style="font-size:11px;font-weight:700;color:#3b82f6;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">&#9679; PAGAMENTO</span>
          </td></tr>
          <tr><td style="padding:14px 16px;font-size:14px;color:#333;font-family:Arial,sans-serif">
            ${escH(methodLabel[order.method] || 'Outro')}
            ${installments > 1 ? ` &mdash; ${installments}x` : ''}
          </td></tr>
        </table>

        <!-- ITENS -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
          <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #e8e8e8">
            <span style="font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif">&#128722; ITENS</span>
          </td></tr>
          <tr><td style="padding:8px 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
          </td></tr>
        </table>

        <!-- TOTAL -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:9px;overflow:hidden">
          <tr>
            <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">Total</td>
            <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#1a2e22;text-align:right;font-family:Arial,sans-serif">${totalLabel}</td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="padding:20px 40px;border-top:2px solid #f0f0f0;text-align:center">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a2e22;font-family:Arial,sans-serif">Armazém Natural</p>
        <p style="margin:0;font-size:13px;color:#888;font-family:Arial,sans-serif">Dúvidas? Fale conosco &mdash; estamos aqui para ajudar!</p>
      </td>
    </tr>

  </table>

  <p style="margin:14px 0 0;font-size:12px;color:#aaa;text-align:center;font-family:Arial,sans-serif">Você recebe este e-mail pois realizou uma compra na Armazém Natural.</p>

</td></tr>
</table>
</body>
</html>`;
}

async function sendRaw(to, subject, html) {
  const key  = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não configurado');
  const from = process.env.RESEND_FROM_EMAIL || 'Armazém Natural <noreply@armazemnatural.com.br>';

  const r = await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
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
  const html    = buildHtml(order, status, trackingCode || '');
  if (!html) return null;

  return sendRaw(order.customer.email, subject, html);
}

module.exports = { sendStatusEmail, sendRaw, STATUS_CONFIG };
