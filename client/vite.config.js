import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escapeSeoKeywordsForHtmlAttr,
  getSeoKeywordsMetaContent,
} from './scripts/generate-seo-keywords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Root workspace node_modules (one level up from client/)
const rootModules = path.resolve(__dirname, '..', 'node_modules');

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
    resolve: {
      // Force Vite to use ONE copy of React — prevents the duplicate-React
      // crash when the workspace symlinks this package under ecunga-client/
      dedupe: ['react', 'react-dom', 'react-router-dom', 'scheduler'],
      alias: {
        react: path.join(rootModules, 'react'),
        'react-dom': path.join(rootModules, 'react-dom'),
        'react/jsx-runtime': path.join(rootModules, 'react', 'jsx-runtime'),
        'react/jsx-dev-runtime': path.join(rootModules, 'react', 'jsx-dev-runtime'),
      },
    },
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
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('jsx-runtime') || id.includes('jsx-dev-runtime')) {
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
