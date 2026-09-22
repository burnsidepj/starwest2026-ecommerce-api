const startedAt = Date.now();

function healthcheck(req, res) {
  return res.status(200).json({
    status: 'UP',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString()
  });
}

module.exports = { healthcheck };
