const { proxy } = require("./_proxy.js");

// Routeur catch-all pour les routes simples (/api/bootstrap, /api/chat, /api/generate, ...).
// Les routes imbriquees ont des wrappers explicites, car Vercel ne les resolvait pas partout.
module.exports = async function handler(req, res) {
  let pathname = req.url || "";
  const qIndex = pathname.indexOf("?");
  if (qIndex >= 0) pathname = pathname.slice(0, qIndex);
  // Retire le prefixe /api pour retrouver la route edge (/chat, /generations/xxx, /memory, ...).
  pathname = pathname.replace(/^\/api(?=\/|$)/, "");
  if (!pathname || pathname === "/") pathname = "/bootstrap";
  return proxy(req, res, pathname);
};
