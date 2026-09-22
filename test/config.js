// Supertest runs against the HTTP address of a running API instance rather than
// requiring the Express app, so the API must be up before the suite starts.
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// Valid credentials taken from the "Existent Data" section of README.md.
const seededUser = {
  email: 'alice@example.com',
  password: 'Password123!',
  id: 1,
  name: 'Alice Johnson'
};

// Products taken from the "Existent Data" section of README.md.
const products = {
  wirelessMouse: { id: 1, name: 'Wireless Mouse', price: 29.9 },
  mechanicalKeyboard: { id: 2, name: 'Mechanical Keyboard', price: 149.5 },
  headphones: { id: 3, name: 'Noise Cancelling Headphones', price: 399.0 }
};

// The API rounds monetary values to 2 decimals. Expected values must be rounded
// the same way, otherwise floating point noise breaks the comparison: 798 * 0.1
// evaluates to 79.80000000000001 in JavaScript, not 79.8.
function round(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { baseUrl, seededUser, products, round };
