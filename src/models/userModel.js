const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 8;

// In-memory user store. Seeded with 3 users; passwords are hashed on startup.
const users = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: bcrypt.hashSync('Password123!', SALT_ROUNDS)
  },
  {
    id: 2,
    name: 'Bruno Costa',
    email: 'bruno@example.com',
    password: bcrypt.hashSync('Bruno@2026', SALT_ROUNDS)
  },
  {
    id: 3,
    name: 'Carla Mendes',
    email: 'carla@example.com',
    password: bcrypt.hashSync('Carla#456', SALT_ROUNDS)
  }
];

let nextId = users.length + 1;

function findByEmail(email) {
  if (!email) {
    return undefined;
  }
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function findById(id) {
  return users.find((user) => user.id === id);
}

function create({ name, email, password }) {
  const user = {
    id: nextId++,
    name,
    email,
    password: bcrypt.hashSync(password, SALT_ROUNDS)
  };
  users.push(user);
  return user;
}

function list() {
  return users;
}

module.exports = { findByEmail, findById, create, list };
