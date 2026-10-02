import express from 'express';
import { calculateMatrix } from './algorithms/matrix.js';
import { convertNumber } from './algorithms/number-system.js';
import { InputError } from './common.js';

export function createApp({ corsOrigin = process.env.CORS_ORIGIN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    if (corsOrigin && req.headers.origin === corsOrigin) {
      res.set('Access-Control-Allow-Origin', corsOrigin);
      res.vary('Origin');
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
  app.get('/api', (req, res) => res.json({
    name: 'Matrix & Number System Learning API', schemaVersion: '1.0',
    modules: ['matrix', 'number-system'],
    routes: ['POST /api/matrix/add', 'POST /api/matrix/subtract', 'POST /api/matrix/transpose', 'POST /api/matrix/multiply', 'POST /api/matrix/determinant', 'POST /api/number-system/convert'],
    limits: { matrixRows: 8, matrixColumns: 8, matrixAbsoluteEntry: 1000000, determinantSize: 4, sourceDigits: 64, bodyBytes: 65536 },
    supportedBases: [2, 8, 10, 16]
  }));
  for (const operation of ['add', 'subtract', 'transpose', 'multiply', 'determinant']) {
    app.post(`/api/matrix/${operation}`, (req, res) => res.json(calculateMatrix(operation, req.body)));
  }
  app.post('/api/number-system/convert', (req, res) => res.json(convertNumber(req.body)));
  app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found. GET /api lists supported routes.' } }));
  app.use((err, req, res, next) => {
    if (err instanceof InputError) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: err.message, field: err.field } });
    if (err.type === 'entity.too.large') return res.status(413).json({ success: false, error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 64 KB.' } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Send valid JSON with Content-Type: application/json.' } });
    if (err.status === 415) return res.status(415).json({ success: false, error: { code: 'UNSUPPORTED_ENCODING', message: 'Unsupported request encoding.' } });
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The server could not complete the calculation.' } });
  });
  return app;
}
