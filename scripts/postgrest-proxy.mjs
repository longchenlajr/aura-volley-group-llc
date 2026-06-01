import http from 'node:http';

const POSTGREST_PORT = 3001;
const PROXY_PORT = 54321;
const PREFIX = '/rest/v1';

const server = http.createServer((req, res) => {
  const path = req.url.startsWith(PREFIX)
    ? req.url.slice(PREFIX.length) || '/'
    : req.url;

  const options = {
    hostname: '127.0.0.1',
    port: POSTGREST_PORT,
    path,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${POSTGREST_PORT}` },
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('[proxy]', err.message);
    if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); }
  });

  req.pipe(proxy, { end: true });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`PostgREST proxy: :${PROXY_PORT}/rest/v1/* → :${POSTGREST_PORT}/*`);
});
