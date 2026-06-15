import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {
  escapeSeoKeywordsForHtmlAttr,
  getSeoKeywordsMetaContent,
} from './scripts/generate-seo-keywords.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [
      react(),
      {
        name: 'ecunga-inject-seo-keywords',
        transformIndexHtml(html) {
          const raw = getSeoKeywordsMetaContent();
          return html.replace(
            '__ECUNGA_SEO_KEYWORDS__',
            escapeSeoKeywordsForHtmlAttr(raw)
          );
        },
      },
      {
        name: 'ecunga-api-proxy-hint',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            // eslint-disable-next-line no-console -- dev-only UX hint
            console.info(
              `\n  \x1b[36m[e-Cunga]\x1b[0m /api is proxied to \x1b[1m${apiTarget}\x1b[0m — if you see ECONNREFUSED, start the API (repo root: \x1b[1mnpm run dev:server\x1b[0m or \x1b[1mnpm run dev\x1b[0m).\n`
            );
          });
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
      },
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx')) {
                return 'vendor-xlsx';
              }
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'vendor-pdf';
              }
              if (id.includes('emoji-picker-react')) {
                return 'vendor-emoji';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-query';
              }
              return 'vendor-other';
            }
          },
        },
      },
    },
  };
});
