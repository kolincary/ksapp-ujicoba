// Vercel Serverless Function: /api/ginee-proxy
// Berfungsi sebagai proxy backend Ginee Open API V3 untuk mengatasi CORS di production Vercel
import crypto from 'crypto';

const DEFAULT_APP_KEY = '74f4f05bb016485b';
const DEFAULT_APP_SECRET = '46218d81e39ad490';
const DEFAULT_COUNTRY = 'ID';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Advai-Country, X-Advai-Date');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const {
      path,
      method = 'POST',
      body,
      appKey,
      appSecret,
      country = DEFAULT_COUNTRY,
    } = req.body || {};

    if (!path) {
      return res.status(400).json({ error: 'Parameter "path" tidak boleh kosong.' });
    }

    const key = appKey || process.env.GINEE_APP_KEY || DEFAULT_APP_KEY;
    const secret = appSecret || process.env.GINEE_APP_SECRET || DEFAULT_APP_SECRET;

    if (!key || !secret) {
      return res.status(400).json({ error: 'App Key dan App Secret Ginee diperlukan.' });
    }

    // Generate HMAC-SHA256 signature sesuai spesifikasi Ginee Open Platform V3: METHOD$URI$
    const cleanMethod = method.toUpperCase();
    const signData = `${cleanMethod}$${path}$`;
    const signature = crypto.createHmac('sha256', secret).update(signData).digest('base64');
    const dateStr = new Date().toUTCString();

    const gineeUrl = `https://api.ginee.com${path}`;
    const gineeRes = await fetch(gineeUrl, {
      method: cleanMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Advai-Country': country,
        'X-Advai-Date': dateStr,
        'Authorization': `${key}:${signature}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await gineeRes.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    return res.status(gineeRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal proxy error' });
  }
}
