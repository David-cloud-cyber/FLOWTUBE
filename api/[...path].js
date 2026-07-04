const { proxy } = require("./_proxy.js");

// Routeur catch-all : proxifie toute requete /api/<...> vers la meme route de l'edge function.
// Un seul fichier = une seule fonction serverless (limite du forfait Hobby: 12).
module.exports = async function handler(req, res) {
  let pathname = req.url || "";
  const qIndex = pathname.indexOf("?");
  if (qIndex >= 0) pathname = pathname.slice(0, qIndex);
  // Retire le prefixe /api pour retrouver la route edge (/chat, /generations/xxx, /memory, ...).
  pathname = pathname.replace(/^\/api(?=\/|$)/, "");
  if (!pathname || pathname === "/") pathname = "/bootstrap";
  return proxy(req, res, pathname);
};
