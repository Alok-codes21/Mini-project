// Same backend app, hosted as one same-origin preview function. No algorithm fork.
import { createApp } from '../src/app.js';
const app = createApp({ nodeEnv: 'production', logRequests: false, trustProxy: 1 });
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('__route');
  if (route !== null) {
    url.searchParams.delete('__route');
    req.url = `/api/${route}${url.search}`;
  }
  return app(req, res);
}
