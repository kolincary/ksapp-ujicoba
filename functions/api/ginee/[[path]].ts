// Cloudflare Pages Function: Proxy for /api/ginee/* to https://api.ginee.com/*
export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const rawPath = params.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');
  const url = new URL(request.url);
  const targetUrl = `https://api.ginee.com/${path}${url.search}`;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('host');

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Ginee Proxy Error', details: err?.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
