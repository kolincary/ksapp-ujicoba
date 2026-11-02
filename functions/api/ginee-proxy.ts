// Cloudflare Pages Function: /api/ginee-proxy
const DEFAULT_APP_KEY = '74f4f05bb016485b';
const DEFAULT_APP_SECRET = '46218d81e39ad490';
const DEFAULT_COUNTRY = 'ID';

async function cryptoHmacSha256Base64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  let binary = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const payload: any = await request.json().catch(() => ({}));
    const {
      path,
      method = 'POST',
      body,
      appKey,
      appSecret,
      country = DEFAULT_COUNTRY,
    } = payload;

    if (!path) {
      return new Response(JSON.stringify({ error: 'Parameter "path" tidak boleh kosong.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const key = appKey || DEFAULT_APP_KEY;
    const secret = appSecret || DEFAULT_APP_SECRET;

    const cleanMethod = method.toUpperCase();
    const signData = `${cleanMethod}$${path}$`;
    const signature = await cryptoHmacSha256Base64(secret, signData);
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

    const data = await gineeRes.text();
    return new Response(data, {
      status: gineeRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Proxy exception', details: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
