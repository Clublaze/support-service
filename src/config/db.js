import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import env from './env.js';

const numericEnv = (key, fallback) => {
  const value = parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const mongoOptions = {
  serverSelectionTimeoutMS: numericEnv('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000),
  connectTimeoutMS: numericEnv('MONGO_CONNECT_TIMEOUT_MS', 10000),
  socketTimeoutMS: numericEnv('MONGO_SOCKET_TIMEOUT_MS', 45000),
  maxPoolSize: numericEnv('MONGO_MAX_POOL_SIZE', 10),
  minPoolSize: numericEnv('MONGO_MIN_POOL_SIZE', 0),
  family: numericEnv('MONGO_NETWORK_FAMILY', 4),
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, mongoOptions);

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

  } catch (error) {
    logger.error(`MongoDB initial connection failed: ${error.message}`);
    throw error;
  }
};

export default connectDB;
