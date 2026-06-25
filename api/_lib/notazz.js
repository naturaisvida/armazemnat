// Notazz — emissao de NF-e (create_nfe_55) a partir de um pedido Pagar.me.
// A tributacao (NCM/CFOP/CST/aliquotas) vem do template configurado no painel
// do Notazz; aqui mandamos so os dados do pedido. Doc: app.notazz.com/docs/api

const NOTAZZ_URL = 'https://app.notazz.com/api';

// Forma de pagamento NF-e (tPag): 03=cartao credito, 15=boleto, 17=PIX
const PAYMENT_FORM = { cartao: '03', boleto: '15', pix: '17' };

// Quebra "numero, rua, bairro" (formato gravado pelos nossos checkouts) em partes.
// Para pedidos de outras origens (Yampi) o formato pode variar — por isso o
// preview existe: conferir o que foi separado antes de emitir.
function parseAddress(line1) {
  const parts = String(line1 || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { number: parts[0], street: parts.slice(1, -1).join(', '), district: parts[parts.length - 1] };
  }
  if (parts.length === 2) return { number: parts[0], street: parts[1], district: '' };
  return { number: 'S/N', street: parts[0] || '', district: '' };
}

function fmt2(cents) { return (Math.round(cents || 0) / 100).toFixed(2); }

function issueDate(raw) {
  const charge = (raw.charges || [])[0] || {};
  const iso = charge.paid_at || raw.created_at || '';
  // "YYYY-MM-DDTHH:mm:ss..." -> "YYYY-MM-DD HH:mm:ss"
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : '';
}

// Mapeia um pedido cru do Pagar.me para os parametros do create_nfe_55.
function mapOrderToNotazz(raw, { requestOrigin = 'pagarme' } = {}) {
  const charge = (raw.charges || [])[0] || {};
  const tx     = charge.last_transaction || {};
  const cust   = raw.customer || {};
  const meta   = raw.metadata || {};
  const ship   = raw.shipping || {};
  const addr   = ship.address || {};

  let method = 'outro';
  if (tx.transaction_type === 'pix'         || charge.payment_method === 'pix')         method = 'pix';
  else if (tx.transaction_type === 'boleto' || charge.payment_method === 'boleto')      method = 'boleto';
  else if (tx.transaction_type === 'credit_card' || charge.payment_method === 'credit_card') method = 'cartao';

  const doc      = (meta.edit_customer_document || cust.document || '').replace(/\D/g, '');
  const taxType  = doc.length > 11 ? 'J' : 'F';
  const installments = tx.installments || charge.installments || parseInt(meta.installments, 10) || 1;

  const a       = parseAddress(meta.edit_shipping_line1 || addr.line_1);
  const items   = (raw.items || []);
  const freight = ship.amount || 0;
  const baseProducts = items.reduce((s, i) => s + (i.amount || 0) * (i.quantity || 1), 0);
  const charged = parseInt(meta.amount_charged, 10) || charge.amount || raw.amount || 0;

  // Regra fiscal — espelha as notas que a Yampi ja emitia:
  //  - PIX: nota pelo valor PAGO (desconto embutido no produto, DESCONTO=0)
  //  - Cartao: valor BASE dos produtos (juros NAO entra na nota)
  //  - Boleto: valor base
  //  - Frete sempre separado (por conta do emitente)
  let notaProducts, notaFreight;
  if (method === 'pix' && charged > 0 && charged < baseProducts + freight) {
    const denom  = (baseProducts + freight) || 1;
    notaFreight  = Math.round(charged * freight / denom);
    notaProducts = charged - notaFreight;
  } else {
    notaProducts = baseProducts;
    notaFreight  = freight;
  }
  const prodScale = baseProducts > 0 ? notaProducts / baseProducts : 1;

  const products = {};
  items.forEach((i, idx) => {
    products[String(idx + 1)] = {
      DOCUMENT_PRODUCT_COD:           i.code || ('SKU' + (idx + 1)),
      DOCUMENT_PRODUCT_NAME:          String(i.description || 'Produto').slice(0, 120),
      DOCUMENT_PRODUCT_QTD:           String(i.quantity || 1),
      DOCUMENT_PRODUCT_UNITARY_VALUE: fmt2((i.amount || 0) * prodScale),
    };
  });

  return {
    METHOD:                  'create_nfe_55',
    EXTERNAL_ID:             raw.id,                 // id do pedido Pagar.me (consulta/idempotencia)
    REQUEST_ORIGIN:          String(requestOrigin).slice(0, 15),
    DOCUMENT_ISSUE_DATE:     issueDate(raw),
    DOCUMENT_GOAL:           '1',                    // Normal
    DOCUMENT_OPERATION_TYPE: '1',                    // saida
    DOCUMENT_NATURE_OPERATION: 'VENDA',
    DOCUMENT_PAYMENT_FORM:   PAYMENT_FORM[method] || '99',
    DOCUMENT_PAYMENT_FORM_INDICATOR: installments > 1 ? '1' : '0',
    DOCUMENT_BASEVALUE:      fmt2(notaProducts),     // SO produtos (sem frete), conforme doc
    DOCUMENT_FRETE: {                                // frete por conta do emitente (0)
      DOCUMENT_FRETE_MOD:   '0',
      DOCUMENT_FRETE_VALUE: fmt2(notaFreight),
    },
    DESTINATION_NAME:        meta.edit_customer_name || cust.name || '',
    DESTINATION_TAXID:       doc,
    DESTINATION_TAXTYPE:     taxType,
    DESTINATION_EMAIL:       meta.edit_customer_email || cust.email || '',
    DESTINATION_STREET:      a.street,
    DESTINATION_NUMBER:      a.number,
    DESTINATION_COMPLEMENT:  meta.edit_shipping_line2 || addr.line_2 || '',
    DESTINATION_DISTRICT:    a.district,
    DESTINATION_CITY:        meta.edit_shipping_city  || addr.city  || '',
    DESTINATION_UF:          (meta.edit_shipping_state || addr.state || '').toUpperCase(),
    DESTINATION_ZIPCODE:     (meta.edit_shipping_zip   || addr.zip_code || '').replace(/\D/g, ''),
    DESTINATION_COUNTRY:     'BR',
    DOCUMENT_PRODUCT:        products,
    // meta p/ revisao no preview (NAO sao campos do Notazz):
    _preview: {
      method, installments, source: meta.source || '', code: raw.code || raw.id,
      valores: {
        produtos_base: fmt2(baseProducts),
        frete:         fmt2(freight),
        cobrado:       fmt2(charged),
        nota_produtos: fmt2(notaProducts),
        nota_frete:    fmt2(notaFreight),
        nota_total:    fmt2(notaProducts + notaFreight),
      },
    },
  };
}

// Emite (ou simula) a NF-e. mode='dryrun' nao envia nada.
async function emitNota(params, { apiKey, mode = 'dryrun' } = {}) {
  const { _preview, ...payload } = params;
  if (mode === 'dryrun' || !apiKey) {
    return { dryRun: true, payload, preview: _preview };
  }
  const r = await fetch(NOTAZZ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ API_KEY: apiKey, ...payload }),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { dryRun: false, http: r.status, response: json };
}

module.exports = { mapOrderToNotazz, emitNota, NOTAZZ_URL };
