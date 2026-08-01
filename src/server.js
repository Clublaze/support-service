import * as Sentry from '@sentry/node';
import app from './app.js';
import env from './config/env.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

// A missing/misspelled NODE_ENV used to fail open. Fail closed at boot.
const VALID_ENVS = ['production', 'staging', 'development', 'test'];
if (!VALID_ENVS.includes(process.env.NODE_ENV)) {
  console.error(`FATAL: NODE_ENV must be one of ${VALID_ENVS.join(', ')} — got "${process.env.NODE_ENV}"`);
  process.exit(1);
}

const startWithRetry = async () => {
  while (true) {
    try {
      await connectDB();
      return;
    } catch (err) {
      logger.error(`MongoDB connection failed, retrying in ${env.mongoStartupRetryMs}ms: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, env.mongoStartupRetryMs));
    }
  }
};

const start = async () => {
  await startWithRetry();

  const server = app.listen(env.port, () => {
    logger.info(`support-service listening on port ${env.port} (${env.nodeEnv})`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force-exit if connections don't close cleanly within 15s
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A stray rejection from a fire-and-forget publish or cron tick must not
  // take the service offline for every user — log it, don't shut down.
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled rejection: ${err.stack}`);
    Sentry.captureException(err);
  });

  // An uncaught exception IS fatal — flush Sentry before exiting.
  process.on('uncaughtException', async (err) => {
    logger.error(`Uncaught exception: ${err?.message}`, { stack: err?.stack });
    try {
      Sentry.captureException(err);
      await Sentry.flush(2000);
    } catch { /* nothing left to do */ }
    process.exit(1);
  });
};

start();
