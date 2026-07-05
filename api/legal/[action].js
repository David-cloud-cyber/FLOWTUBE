const { proxy } = require("../_proxy.js");

function param(req, name, index) {
  const value = req.query && req.query[name];
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value === "string") return value;
  const pathname = (req.url || "").split("?")[0];
  return pathname.split("/").filter(Boolean)[index] || "";
}

module.exports = async function handler(req, res) {
  return proxy(req, res, `/legal/${encodeURIComponent(param(req, "action", 2))}`);
};
