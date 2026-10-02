// Reads and validates environment settings. Invalid settings fail at startup with a clear message.
import { existsSync } from 'node:fs';

export function loadEnvFile(path = '.env') {
  // Node 22 can load a .env file itself. Real environment variables always win.
  if (existsSync(path)) process.loadEnvFile(path);
}

function integer(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}. Got "${raw}".`);
  }
  return Number(raw);
}

export function parseOrigins(raw = '', production = false) {
  const origins = raw.split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of origins) {
    if (origin === '*') {
      if (production) throw new Error('CORS_ORIGIN must not be "*" in production. List exact origins.');
      continue;
    }
    let url;
    try { url = new URL(origin); } catch { throw new Error(`CORS_ORIGIN contains an invalid origin: "${origin}".`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGIN entries must be exact origins like https://app.example.com (no path or trailing slash). Got "${origin}".`);
    }
  }
  return origins;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production or test.');
  }
  const production = nodeEnv === 'production';
  const trustProxy = env.TRUST_PROXY ?? '';
  // Warnings are returned, not printed here, so tests and tools can read them. server.js logs them.
  const warnings = [];
  if (production && (env.TRUST_PROXY === undefined || env.TRUST_PROXY === '')) {
    warnings.push('TRUST_PROXY is not set while NODE_ENV=production. Behind a proxy such as Render, every client then shares one IP and one rate-limit bucket. Set TRUST_PROXY=1 (number of proxy hops).');
  }
  return {
    warnings,
    nodeEnv,
    port: integer(env, 'PORT', 3000, 1, 65535),
    // Production: only listed origins. Development with an empty list: any localhost origin.
    corsOrigins: parseOrigins(env.CORS_ORIGIN, production),
    rateLimit: {
      windowMs: integer(env, 'RATE_LIMIT_WINDOW_MS', 60_000, 1000, 86_400_000),
      max: integer(env, 'RATE_LIMIT_MAX', 120, 1, 1_000_000)
    },
    // Number of reverse-proxy hops to trust (0 = none), so rate limits see real client IPs.
    trustProxy: integer({ v: trustProxy }, 'v', 0, 0, 10),
    logRequests: (env.LOG_REQUESTS ?? (nodeEnv === 'test' ? 'false' : 'true')) !== 'false',
    shutdownTimeoutMs: integer(env, 'SHUTDOWN_TIMEOUT_MS', 10_000, 100, 120_000)
  };
}
