import http from 'node:http';
import { Readable } from 'node:stream';

export function createLocalServer(worker, env) {
  const server = http.createServer({ maxHeaderSize: 16384 }, async (request, response) => {
    try {
      if (!request.url?.startsWith('/')) { response.writeHead(400); response.end(); return; }
      const method = request.method || 'GET';
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      // O limite de requisições local usa apenas o endereço de conexão real.
      headers.set('cf-connecting-ip', request.socket.remoteAddress || 'local');
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const webRequest = new Request(new URL(request.url, env.PUBLIC_BASE_URL), {
        method, headers, ...(hasBody ? { body: Readable.toWeb(request), duplex: 'half' } : {})
      });
      const result = await worker.fetch(webRequest, env);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
    } catch {
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"error":"Falha no servidor local. Nenhuma credencial foi registrada."}');
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}
