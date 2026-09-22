const checkoutService = require('../services/checkoutService');

function checkout(req, res, next) {
  try {
    const result = checkoutService.checkout(req.user.id, req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { checkout };
