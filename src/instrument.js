import * as Sentry from '@sentry/node';

// Student emails and Mongo ObjectIds routinely appear in request paths,
// query strings, and breadcrumbs — scrubbed before anything leaves the
// process. Mirrors the frontend's main.jsx beforeSend (M15).
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const OBJECT_ID_RE = /[0-9a-f]{24}/g;
const scrubPii = (value) =>
  typeof value === 'string' ? value.replace(EMAIL_RE, '[email]').replace(OBJECT_ID_RE, '[id]') : value;

const beforeSend = (event) => {
  if (event.request?.url) event.request.url = scrubPii(event.request.url);
  if (event.request?.query_string) event.request.query_string = scrubPii(event.request.query_string);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({ ...b, message: scrubPii(b.message) }));
  }
  return event;
};

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: false,
  beforeSend,
});
