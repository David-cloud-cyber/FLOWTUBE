const { proxy } = require("../_proxy.js");

module.exports = async function handler(req, res) {
  return proxy(req, res, "/billing/webhook");
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
