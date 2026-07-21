import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({ name: 'http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames: ['method', 'route', 'status_code'], buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], registers: [register] });
export const httpRequestsTotal = new client.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', labelNames: ['method', 'route', 'status_code'], registers: [register] });
export const httpRequestsInFlight = new client.Gauge({ name: 'http_requests_in_flight', help: 'HTTP requests currently being handled', registers: [register] });
export const mongoConnectionUp = new client.Gauge({ name: 'mongo_connection_up', help: 'MongoDB connection status (1 = connected, 0 = disconnected)', registers: [register] });
export const redisConnectionUp = new client.Gauge({ name: 'redis_connection_up', help: 'Redis connection status (1 = connected, 0 = disconnected)', registers: [register] });
export const chatRequestsTotal = new client.Counter({ name: 'support_chat_requests_total', help: 'Total chat requests to the support assistant', labelNames: ['status'], registers: [register] });
export const ticketsCreatedTotal = new client.Counter({ name: 'support_tickets_created_total', help: 'Total tickets and grievances created', labelNames: ['type', 'source'], registers: [register] });

export function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/health' || req.path === '/ready') return next();
  const end = httpRequestDuration.startTimer();
  httpRequestsInFlight.inc();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    end(labels);
    httpRequestsInFlight.dec();
  });
  next();
}
