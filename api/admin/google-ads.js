// Google Ads API v17 integration
// Required env vars:
//   GOOGLE_ADS_DEVELOPER_TOKEN   — from Google Ads account (Tools > API Center)
//   GOOGLE_ADS_CLIENT_ID         — from Google Cloud Console OAuth2 credentials
//   GOOGLE_ADS_CLIENT_SECRET     — from Google Cloud Console OAuth2 credentials
//   GOOGLE_ADS_REFRESH_TOKEN     — generated via OAuth2 flow (see docs)
//   GOOGLE_ADS_CUSTOMER_ID       — Google Ads account ID (without dashes, e.g. 1234567890)

const jwt = require('jsonwebtoken');

function validateAdmin(req, res) {
  const raw    = (req.headers['authorization'] || '').trim();
  const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) { res.status(401).json({ error: 'Não autorizado' }); return false; }
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (p.role !== 'admin') throw new Error();
    return true;
  } catch { res.status(401).json({ error: 'Token inválido' }); return false; }
}

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('OAuth token error: ' + t);
  }
  const d = await r.json();
  return d.access_token;
}

async function queryAds(accessToken, customerId, query) {
  const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization':           'Bearer ' + accessToken,
      'developer-token':          process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'Content-Type':            'application/json',
      'login-customer-id':       customerId,
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('Ads API error: ' + r.status + ' ' + t.slice(0, 300));
  }
  const lines = (await r.text()).split('\n').filter(l => l.trim());
  const results = [];
  for (const line of lines) {
    try {
      const batch = JSON.parse(line);
      if (batch.results) results.push(...batch.results);
    } catch { /* partial line, skip */ }
  }
  return results;
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!validateAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!CUSTOMER_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN || !process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    return res.status(503).json({ error: 'Google Ads não configurado', configured: false });
  }

  // Date range from query string (YYYY-MM-DD)
  const dateFrom = req.query.date_from || (() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10);
  })();
  const dateTo = req.query.date_to || new Date().toISOString().slice(0, 10);

  try {
    const accessToken = await getAccessToken();

    // Campaign performance
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const campaignRows = await queryAds(accessToken, CUSTOMER_ID, campaignQuery);

    // Account-level totals
    const totals = campaignRows.reduce((acc, row) => {
      const m = row.metrics || {};
      acc.cost        += Number(m.cost_micros        || 0) / 1_000_000;
      acc.clicks      += Number(m.clicks             || 0);
      acc.impressions += Number(m.impressions        || 0);
      acc.conversions += Number(m.conversions        || 0);
      acc.convValue   += Number(m.conversions_value  || 0);
      return acc;
    }, { cost: 0, clicks: 0, impressions: 0, conversions: 0, convValue: 0 });

    const campaigns = campaignRows.map(row => ({
      id:          row.campaign?.id,
      name:        row.campaign?.name || '—',
      status:      row.campaign?.status,
      cost:        Number(row.metrics?.cost_micros || 0) / 1_000_000,
      clicks:      Number(row.metrics?.clicks || 0),
      impressions: Number(row.metrics?.impressions || 0),
      conversions: Number(row.metrics?.conversions || 0),
      convValue:   Number(row.metrics?.conversions_value || 0),
      ctr:         Number(row.metrics?.ctr || 0),
      avgCpc:      Number(row.metrics?.average_cpc || 0) / 1_000_000,
    }));

    return res.status(200).json({
      configured: true,
      dateFrom,
      dateTo,
      totals: {
        cost:        totals.cost,
        clicks:      totals.clicks,
        impressions: totals.impressions,
        conversions: totals.conversions,
        convValue:   totals.convValue,
        ctr:         totals.impressions ? totals.clicks / totals.impressions : 0,
      },
      campaigns,
    });

  } catch (err) {
    console.error('Google Ads error:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar dados do Google Ads', detail: err.message });
  }
};
