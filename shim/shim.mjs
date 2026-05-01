import http from 'node:http';

const HOST = process.env.SHIM_HOST || '0.0.0.0';
const PORT = Number(process.env.SHIM_PORT || 1432);
const UPSTREAM = (process.env.ENOWXAI_UPSTREAM || 'http://enowxai:1430/v1').replace(/\/$/, '');
const MAX_RETRIES = Number(process.env.SHIM_MAX_RETRIES || 2);

export function prepareRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  return { ...body, stream: false };
}

export function hasInvalidToolArguments(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];

  for (const choice of choices) {
    const calls = choice?.message?.tool_calls || choice?.delta?.tool_calls || [];
    if (!Array.isArray(calls)) continue;

    for (const call of calls) {
      const args = call?.function?.arguments;
      if (typeof args !== 'string' || args.trim() === '') continue;

      try {
        JSON.parse(args);
      } catch {
        return true;
      }
    }
  }

  return false;
}

export function buildUpstreamUrl(requestUrl, upstream) {
  const upstreamBase = new URL(upstream);
  const upstreamPath = requestUrl.startsWith('/v1/') || requestUrl === '/v1'
    ? requestUrl
    : `${upstreamBase.pathname.replace(/\/$/, '')}${requestUrl.startsWith('/') ? requestUrl : `/${requestUrl}`}`;
  return new URL(upstreamPath, upstreamBase.origin);
}

export function prepareUpstreamHeaders(requestHeaders) {
  const headers = { ...requestHeaders };
  delete headers.host;
  delete headers['content-length'];
  headers['content-type'] = 'application/json';
  return headers;
}

export function toChatCompletionSse(payload) {
  const choice = payload?.choices?.[0] || {};
  const message = choice.message || {};
  const base = {
    id: payload.id,
    object: 'chat.completion.chunk',
    created: payload.created,
    model: payload.model,
  };
  const events = [];

  if (message.content) {
    events.push({
      ...base,
      choices: [{ index: choice.index || 0, delta: { content: message.content }, finish_reason: null }],
    });
  }

  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    events.push({
      ...base,
      choices: [{ index: choice.index || 0, delta: { tool_calls: message.tool_calls }, finish_reason: null }],
    });
  }

  events.push({
    ...base,
    choices: [{ index: choice.index || 0, delta: {}, finish_reason: choice.finish_reason || 'stop' }],
    ...(payload.usage ? { usage: payload.usage } : {}),
  });

  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        req.destroy();
        reject(new Error('request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function forwardJson(req, bodyText) {
  const upstreamUrl = buildUpstreamUrl(req.url, UPSTREAM);
  const headers = prepareUpstreamHeaders(req.headers);

  let parsed;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    parsed = undefined;
  }

  const clientRequestedStream = parsed?.stream === true;
  const finalBody = parsed ? JSON.stringify(prepareRequestBody(parsed)) : bodyText;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : finalBody,
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    if (!contentType.includes('application/json')) {
      return { status: response.status, headers: { 'content-type': contentType }, body: text };
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { status: response.status, headers: { 'content-type': contentType }, body: text };
    }

    if (!hasInvalidToolArguments(json)) {
      if (clientRequestedStream && Array.isArray(json?.choices)) {
        return {
          status: response.status,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          },
          body: toChatCompletionSse(json),
        };
      }

      return { status: response.status, headers: { 'content-type': contentType }, body: JSON.stringify(json) };
    }

    console.warn(`[shim] invalid/truncated tool arguments from upstream attempt=${attempt + 1}/${MAX_RETRIES + 1}`);
  }

  return {
    status: 502,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      error: {
        type: 'upstream_tool_arguments_truncated',
        message: 'Upstream returned invalid/truncated tool call arguments after retries. Response was blocked before reaching OpenCode.',
      },
    }),
  };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const body = await readBody(req);
      const result = await forwardJson(req, body);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'shim_error', message: error.message } }));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, HOST, () => {
    console.log(`[shim] listening on ${HOST}:${PORT}, upstream=${UPSTREAM}, force_stream=false`);
  });
}
