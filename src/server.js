import app from './app.js';
import env from './config/env.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

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

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force-exit if connections don't close cleanly within 10s
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
  });
};

start();
