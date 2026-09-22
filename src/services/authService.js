const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'starwest2026-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

class ServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function register({ name, email, password }) {
  if (!name || !email || !password) {
    throw new ServiceError(400, 'Name, email, and password are required');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new ServiceError(400, 'Email must be a valid email address');
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    throw new ServiceError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (userModel.findByEmail(email)) {
    throw new ServiceError(409, 'Email is already registered');
  }

  const user = userModel.create({ name, email, password });
  return { id: user.id, name: user.name, email: user.email };
}

function login({ email, password }) {
  if (!email || !password) {
    throw new ServiceError(400, 'Email and password are required');
  }

  const user = userModel.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new ServiceError(401, 'Invalid email or password');
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email }
  };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { register, login, verifyToken, ServiceError };
