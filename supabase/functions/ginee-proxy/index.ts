// Supabase Edge Function: ginee-proxy
// Berfungsi sebagai backend proxy untuk Ginee Open API guna mengatasi CORS browser restriction
// Deploy command: npx supabase functions deploy ginee-proxy --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-advai-country, x-advai-date',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      path,
      method = 'POST',
      body,
      appKey,
      appSecret,
      country = 'ID',
      host = 'https://api.ginee.com',
    } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Parameter "path" tidak boleh kosong.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const key = (appKey || Deno.env.get('GINEE_APP_KEY') || '').trim();
    const secret = (appSecret || Deno.env.get('GINEE_APP_SECRET') || '').trim();

    if (!key || !secret) {
      return new Response(
        JSON.stringify({ error: 'App Key dan App Secret Ginee diperlukan.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HMAC-SHA256 signature sesuai spesifikasi resmi Ginee Open API
    // Format: HttpMethod + "$" + RequestUri + "$"
    const signData = `${method.toUpperCase()}$${path}$`;
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signData));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Forward request ke Ginee Open API
    const gineeUrl = `${host.replace(/\/+$/, '')}${path}`;
    const dateStr = new Date().toUTCString();

    const gineeResponse = await fetch(gineeUrl, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'X-Advai-Country': country,
        'X-Advai-Date': dateStr,
        'Authorization': `${key}:${signature}`,
      },
      body: body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    const responseText = await gineeResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(JSON.stringify(responseData), {
      status: gineeResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
