import { execFileSync } from 'node:child_process';
import { rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { build } from '../frontend/node_modules/esbuild/lib/main.js';
execFileSync('npm', ['--prefix', 'frontend', 'run', 'build'], { stdio: 'inherit' });
// Keep backend API documentation (src/app.js imports docs/openapi.json).
rmSync('docs/assets', { recursive: true, force: true });
cpSync('frontend/dist', 'docs', { recursive: true });
mkdirSync('docs/api', { recursive: true });
await build({ entryPoints: ['api/index.js'], outfile: 'docs/api/index.js', bundle: true, minify: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
writeFileSync('docs/package.json', JSON.stringify({ private: true, type: 'module', engines: { node: '22.x' } }, null, 2) + '\n');
writeFileSync('docs/vercel.json', JSON.stringify({ rewrites: [{ source: '/api/:path*', destination: '/api/index?__route=:path*' }] }, null, 2) + '\n');
