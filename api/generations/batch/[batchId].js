const { proxy } = require("../../_proxy.js");

module.exports = async function handler(req, res) {
  return proxy(req, res, `/generations/batch/${encodeURIComponent(req.query.batchId)}`);
};
