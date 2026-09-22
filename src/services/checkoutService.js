const productModel = require('../models/productModel');
const { ServiceError } = require('./authService');

const PAYMENT_METHODS = ['cash', 'credit_card'];
const CASH_DISCOUNT_RATE = 0.1;

function round(value) {
  return Math.round(value * 100) / 100;
}

// Checkout rules:
//   a) only cash or credit_card are accepted
//   b) cash gives a 10% discount
//   c) only authenticated users can checkout (enforced by the auth middleware)
function checkout(userId, { items, paymentMethod, creditCard }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError(400, 'Items are required and must be a non-empty array');
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ServiceError(400, `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  if (paymentMethod === 'credit_card') {
    if (!creditCard || !creditCard.number || !creditCard.holderName || !creditCard.expirationDate || !creditCard.cvv) {
      throw new ServiceError(400, 'Credit card details are required for credit_card payments');
    }
  }

  const detailedItems = items.map((item) => {
    if (!Number.isInteger(item.productId)) {
      throw new ServiceError(400, 'Each item must have an integer productId');
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ServiceError(400, 'Each item must have an integer quantity of at least 1');
    }

    const product = productModel.findById(item.productId);
    if (!product) {
      throw new ServiceError(404, `Product ${item.productId} not found`);
    }

    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      total: round(product.price * item.quantity)
    };
  });

  const subtotal = round(detailedItems.reduce((sum, item) => sum + item.total, 0));
  const discount = paymentMethod === 'cash' ? round(subtotal * CASH_DISCOUNT_RATE) : 0;
  const total = round(subtotal - discount);

  return {
    userId,
    items: detailedItems,
    paymentMethod,
    subtotal,
    discount,
    total,
    message: 'Checkout completed successfully'
  };
}

module.exports = { checkout, PAYMENT_METHODS, CASH_DISCOUNT_RATE };
