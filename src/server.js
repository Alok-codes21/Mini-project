import { createApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';

let config;
try {
  loadEnvFile();
  config = loadConfig();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}
const server = createApp(config).listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'listening', port: config.port, env: config.nodeEnv }));
});
server.on('error', error => {
  console.error(`Could not start server: ${error.message}`);
  process.exit(1);
});
let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(JSON.stringify({ level: 'info', msg: 'shutting down', signal }));
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), config.shutdownTimeoutMs).unref();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(signal));
