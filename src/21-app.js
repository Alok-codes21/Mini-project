import { randomUUID } from 'node:crypto';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { calculateMatrix } from './algorithms/matrix.js';
import { convertNumber } from './algorithms/number-system.js';
import { checkPractice } from './algorithms/practice.js';
import { InputError, parseDetail } from './common.js';
import { addStyleHints } from './style.js';
import { loadConfig } from './config.js';
import { aiChatHandler } from './ai-chat.js';
import openapi from '../docs/openapi.json' with { type: 'json' };

const MATRIX_OPERATIONS = ['add', 'subtract', 'transpose', 'multiply', 'determinant'];
const BODY_LIMIT_BYTES = 64 * 1024;
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const failure = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error: { code, message, ...extra, requestId: res.req.id } });

function corsOriginAllowed(origin, config) {
  if (!origin) return false;
  if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return true;
  // Development convenience only: with no configured origins, any localhost origin works.
  return config.nodeEnv !== 'production' && config.corsOrigins.length === 0 && LOCALHOST_ORIGIN.test(origin);
}

// ?style=hints adds colour hints (module accent, palette, per-step role). Off by default.
const withStyle = (req, response) => (req.query.style === 'hints' ? addStyleHints(response) : response);

// options override environment-derived settings; tests use this to build isolated apps.
export function createApp(options = {}) {
  const config = { ...loadConfig(), ...options };
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  // Request id and one structured log line per request.
  app.use((req, res, next) => {
    const incoming = req.get('X-Request-Id');
    req.id = incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', req.id);
    if (config.logRequests) {
      const started = process.hrtime.bigint();
      res.on('finish', () => console.log(JSON.stringify({
        level: 'info', msg: 'request', requestId: req.id, method: req.method,
        path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Number(process.hrtime.bigint() - started) / 1e6
      })));
    }
    next();
  });

  app.use(helmet());
  // gzip responses (the step traces are large and compress well). Honors Accept-Encoding.
  app.use(compression());
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (corsOriginAllowed(origin, config)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
      res.set('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After, RateLimit, RateLimit-Policy');
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
        res.set('Access-Control-Max-Age', '600');
      }
    } else if (origin) {
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

  app.use('/api', rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.max(1, Math.ceil(config.rateLimit.windowMs / 1000));
      res.set('Retry-After', String(res.getHeader('Retry-After') ?? retryAfter));
      failure(res, 429, 'RATE_LIMITED', 'Too many requests. Wait a moment and try again.');
    }
  }));

  app.get('/api', (req, res) => res.json({
    name: 'Matrix & Number System Learning API', schemaVersion: '1.0',
    modules: ['matrix', 'number-system'],
    routes: ['POST /api/matrix/add', 'POST /api/matrix/subtract', 'POST /api/matrix/transpose', 'POST /api/matrix/multiply', 'POST /api/matrix/determinant', 'POST /api/number-system/convert'],
    limits: {
      matrixRows: 8, matrixColumns: 8, matrixAbsoluteEntry: 1000000, determinantSize: 4, sourceDigits: 64, bodyBytes: BODY_LIMIT_BYTES,
      rateLimit: { requests: config.rateLimit.max, windowSeconds: config.rateLimit.windowMs / 1000 }
    },
    optionalRoutes: ['POST /api/practice/check'],
    detailLevels: ['full', 'compact', 'beginner'],
    supportedBases: [2, 8, 10, 16],
    openapi: '/api/openapi.json'
  }));
  app.get('/api/openapi.json', (req, res) => res.json(openapi));

  // Only JSON bodies are accepted on POST routes.
  app.use('/api', (req, res, next) => {
    const hasBody = Number(req.get('Content-Length')) > 0 || req.get('Transfer-Encoding');
    if (req.method === 'POST' && hasBody && !req.is('application/json')) {
      return failure(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as JSON with Content-Type: application/json.');
    }
    next();
  });
  app.use(express.json({ limit: BODY_LIMIT_BYTES, strict: true }));

  const methodNotAllowed = allow => (req, res) => {
    res.set('Allow', allow);
    failure(res, 405, 'METHOD_NOT_ALLOWED', `Use ${allow} for this route.`);
  };
  for (const operation of MATRIX_OPERATIONS) {
    app.route(`/api/matrix/${operation}`)
      .post((req, res) => res.json(withStyle(req, calculateMatrix(operation, req.body, { detail: parseDetail(req.query.detail) }))))
      .all(methodNotAllowed('POST, OPTIONS'));
  }
  app.route('/api/number-system/convert')
    .post((req, res) => res.json(withStyle(req, convertNumber(req.body, { detail: parseDetail(req.query.detail) }))))
    .all(methodNotAllowed('POST, OPTIONS'));

  app.route('/api/practice/check')
    .post((req, res) => res.json(checkPractice(req.body)))
    .all(methodNotAllowed('POST, OPTIONS'));

  app.route('/api/ai/chat')
    .post(aiChatHandler({ env: options.env ?? process.env, models: options.aiModels }))
    .all(methodNotAllowed('POST, OPTIONS'));

  app.use((req, res) => failure(res, 404, 'NOT_FOUND', 'Route not found. GET /api lists supported routes.'));

  // The single error handler. Clients never see stack traces or internal messages.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof InputError) return failure(res, err.status, err.code, err.message, { field: err.field });
    if (err.type === 'entity.too.large') return failure(res, 413, 'BODY_TOO_LARGE', 'Request body exceeds 64 KB.');
    if (err.type === 'entity.parse.failed') return failure(res, 400, 'INVALID_JSON', 'Send valid JSON with Content-Type: application/json.');
    if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
      return failure(res, 415, 'UNSUPPORTED_ENCODING', 'Unsupported request encoding. Send plain UTF-8 JSON.');
    }
    if (typeof err.code === 'string' && err.code.startsWith('Z_') || err.message === 'Decompression failed') {
      return failure(res, 400, 'BAD_REQUEST', 'The compressed request body is corrupt.');
    }
    if (err.type === 'request.aborted' || err.type === 'request.size.invalid' || err.type === 'stream.encoding.set') {
      return failure(res, 400, 'BAD_REQUEST', 'The request could not be read.');
    }
    const status = err.status ?? err.statusCode;
    if (status >= 400 && status < 500) return failure(res, status, 'BAD_REQUEST', 'The request could not be processed.');
    console.error(JSON.stringify({ level: 'error', msg: 'unhandled error', requestId: req.id, error: err.stack ?? String(err) }));
    return failure(res, 500, 'INTERNAL_ERROR', 'The server could not complete the calculation.');
  });
  return app;
}
