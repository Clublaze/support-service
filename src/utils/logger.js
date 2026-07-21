import { createLogger, format, transports } from 'winston';

const { combine, timestamp, colorize, printf, json } = format;

const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const meta = Object.keys(metadata).length
    ? '\n  ' + JSON.stringify(metadata, null, 2)
    : '';
  return `${timestamp} [${level}]: ${message}${meta}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? combine(timestamp(), json())
        : combine(timestamp({ format: 'HH:mm:ss' }), colorize(), devFormat),
    }),
  ],
});

export default logger;
