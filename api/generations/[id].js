const { proxy } = require("../_proxy.js");

module.exports = async function handler(req, res) {
  return proxy(req, res, "/generations/" + encodeURIComponent(req.query.id));
};
