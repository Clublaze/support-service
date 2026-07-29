import dotenv from 'dotenv';
dotenv.config();

const positiveInteger = (value, fallback) => {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: positiveInteger(process.env.PORT, 8007),
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  mongoUri: process.env.MONGODB_URI,
  mongoDnsServers: process.env.MONGO_DNS_SERVERS
    ? process.env.MONGO_DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean)
    : [],
  mongoStartupRetryMs: positiveInteger(process.env.MONGO_STARTUP_RETRY_MS, 10000),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtSecret: process.env.JWT_SECRET,

  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET,

  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
  allowedFrontendOrigins: (process.env.FRONTEND_BASE_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  services: {
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8004',
    // club-service owns the shared audit log; see utils/auditServiceClient.js.
    clubServiceUrl: process.env.CLUB_SERVICE_URL || 'http://localhost:8002',
  },

  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    baseUrl: process.env.AWS_S3_BASE_URL,
  },

  upload: {
    maxAttachmentMb: positiveInteger(process.env.MAX_ATTACHMENT_SIZE_MB, 10),
    maxAttachmentsPerTicket: positiveInteger(process.env.MAX_ATTACHMENTS_PER_TICKET, 5),
  },

  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    chatModel: process.env.SUPPORT_CHAT_MODEL || 'claude-haiku-4-5',
    timeoutMs: positiveInteger(process.env.SUPPORT_CHAT_TIMEOUT_MS, 15000),
    maxTokens: positiveInteger(process.env.SUPPORT_CHAT_MAX_TOKENS, 800),
    rateLimitPerHour: positiveInteger(process.env.SUPPORT_CHAT_RATE_LIMIT_PER_HOUR, 30),
  },
};

// Hard fail on startup if critical secrets are missing
if (!env.jwtSecret) {
  console.error('FATAL: JWT_SECRET is not set in environment variables');
  process.exit(1);
}

if (!env.internalServiceSecret) {
  console.error('FATAL: INTERNAL_SERVICE_SECRET is not set in environment variables');
  process.exit(1);
}

if (!env.mongoUri) {
  console.error('FATAL: MONGODB_URI is not set in environment variables');
  process.exit(1);
}

// The chat endpoint fails each request with a clear error if this is missing,
// rather than crashing the whole service on startup — FAQs and tickets should
// keep working even if nobody has provisioned a key yet.
if (!env.ai.anthropicApiKey) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set — /chat will return 503 until it is.');
}

export default env;
