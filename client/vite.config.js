import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [
      react(),
      {
        name: 'ecunga-api-proxy-hint',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            // eslint-disable-next-line no-console -- dev-only UX hint
            console.info(
              `\n  \x1b[36m[e-CUNGA]\x1b[0m /api is proxied to \x1b[1m${apiTarget}\x1b[0m — if you see ECONNREFUSED, start the API (repo root: \x1b[1mnpm run dev:server\x1b[0m or \x1b[1mnpm run dev\x1b[0m).\n`
            );
          });
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('error', (err, _req, res) => {
              if (!res || typeof res.writeHead !== 'function' || res.writableEnded) return;
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'Backend not reachable.',
                  hint: `Start the API on ${apiTarget} (repo root: npm run dev:server, or npm run dev for client+server).`,
                  detail: String(err?.code || err?.message || err),
                })
              );
            });
          },
        },
      },
    },
  };
});
