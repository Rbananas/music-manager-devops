const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const requests = new promClient.Counter({
  name: 'music_manager_http_requests_total',
  help: 'HTTP requests served by the Music Manager API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});
const duration = new promClient.Histogram({
  name: 'music_manager_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

function instrumentRequests(req, res, next) {
  const end = duration.startTimer({ method: req.method });
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    requests.inc({ method: req.method, route, status_code: String(res.statusCode) });
    end({ route });
  });
  next();
}

module.exports = { register, instrumentRequests };
