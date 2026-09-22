// In-memory product store. Seeded with 3 products.
const products = [
  { id: 1, name: 'Wireless Mouse', price: 29.9, stock: 50 },
  { id: 2, name: 'Mechanical Keyboard', price: 149.5, stock: 20 },
  { id: 3, name: 'Noise Cancelling Headphones', price: 399.0, stock: 10 }
];

function findById(id) {
  return products.find((product) => product.id === id);
}

function list() {
  return products;
}

module.exports = { findById, list };
