const EDGE_BASE = (process.env.SUPABASE_EDGE_URL || "https://fuvrxobxjcqyevsjsdfd.supabase.co/functions/v1/flowtube-api").replace(/\/$/, "");

function copyHeaders(req) {
  const headers = {};
  const pass = [
    "content-type",
    "authorization",
    "stripe-signature",
    "x-moneyfusion-secret",
    "x-moneyfusion-signature",
    "x-flowtube-provider-secret",
    "x-fal-webhook-secret",
    "x-flowtube-admin-secret",
    "x-huggyflow-admin-secret"
  ];
  for (const name of pass) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  if (process.env.FLOWTUBE_EDGE_SECRET) headers["x-flowtube-secret"] = process.env.FLOWTUBE_EDGE_SECRET;
  if (process.env.HUGGYFLOW_EDGE_SECRET) headers["x-huggyflow-secret"] = process.env.HUGGYFLOW_EDGE_SECRET;
  return headers;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  if (typeof req.body === "string") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxy(req, res, path) {
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const query = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const response = await fetch(EDGE_BASE + path + query, {
    method: req.method,
    headers: copyHeaders(req),
    body,
  });

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
    if (typeof res.flush === "function") res.flush();
  }
  res.end();
}

module.exports = { proxy };
