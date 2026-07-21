import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

import env from './config/env.js';
import logger from './utils/logger.js';
import responseUtil from './utils/response.util.js';
import errorMiddleware from './middleware/error.middleware.js';
import AppError from './utils/AppError.js';
import { register, metricsMiddleware, mongoConnectionUp, redisConnectionUp } from './utils/metrics.js';
import redis from './config/redis.js';

import supportRoutes from './routes/support.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.allowedFrontendOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(responseUtil);

if (env.isDev) {
  app.use(morgan('dev'));
}

app.use(metricsMiddleware);

// ── Health & metrics — unauthenticated, used by Docker/orchestrator and Prometheus ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'support-service', time: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  const mongoUp = mongoose.connection.readyState === 1;
  const redisUp = redis.status === 'ready';
  mongoConnectionUp.set(mongoUp ? 1 : 0);
  redisConnectionUp.set(redisUp ? 1 : 0);

  if (mongoUp && redisUp) {
    return res.json({ status: 'ready', mongo: mongoUp, redis: redisUp });
  }
  res.status(503).json({ status: 'not ready', mongo: mongoUp, redis: redisUp });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/support/admin', adminRoutes); // more specific prefix mounted first
app.use('/api/v1/support', supportRoutes);

app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorMiddleware);

export default app;
