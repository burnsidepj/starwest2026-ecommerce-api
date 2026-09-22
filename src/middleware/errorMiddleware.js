function notFound(req, res) {
  return res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({ error: message });
}

module.exports = { notFound, errorHandler };
