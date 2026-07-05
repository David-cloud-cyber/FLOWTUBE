const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function contentType(filePath) {
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const target = "https://fuvrxobxjcqyevsjsdfd.supabase.co/functions/v1/flowtube-api" + url.pathname.replace(/^\/api/, "");
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = {
        "content-type": req.headers["content-type"] || "application/json",
      };
      [
        "authorization",
        "x-flowtube-secret",
        "x-huggyflow-secret",
        "x-flowtube-admin-secret",
        "x-huggyflow-admin-secret",
        "x-moneyfusion-secret",
        "x-moneyfusion-signature",
        "x-flowtube-provider-secret",
        "x-fal-webhook-secret",
      ].forEach((name) => {
        if (req.headers[name]) headers[name] = req.headers[name];
      });
      if (process.env.FLOWTUBE_EDGE_SECRET) headers["x-flowtube-secret"] = process.env.FLOWTUBE_EDGE_SECRET;
      if (process.env.HUGGYFLOW_EDGE_SECRET) headers["x-huggyflow-secret"] = process.env.HUGGYFLOW_EDGE_SECRET;
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
      });
      const responseHeaders = Object.fromEntries(upstream.headers);
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];
      res.writeHead(upstream.status, responseHeaders);
      if (!upstream.body) return res.end();
      for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
      res.end();
      return;
    }
    const filePath = url.pathname === "/" ? path.join(root, "index.html") : path.join(root, decodeURIComponent(url.pathname));
    sendFile(res, filePath, contentType(filePath));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(3000, () => {
  console.log("Huggyflow dev server: http://localhost:3000");
});
