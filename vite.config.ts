import * as esbuild from 'esbuild';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { readGasBackendUrl } from './scripts/read-gas-backend-url.mjs';

const root = path.resolve(import.meta.dirname);
const gasBackendUrl = readGasBackendUrl();

function devServiceWorker(): Plugin {
  return {
    name: 'dev-service-worker',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/sw.js') {
          next();
          return;
        }

        try {
          const result = await esbuild.build({
            entryPoints: [path.join(root, 'src/sw.ts')],
            bundle: true,
            format: 'iife',
            platform: 'browser',
            target: ['es2017'],
            write: false,
            define: {
              __SW_BACKEND_URL__: JSON.stringify(gasBackendUrl),
            },
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          res.end(result.outputFiles[0].text);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __SW_BACKEND_URL__: JSON.stringify(gasBackendUrl),
  },
  plugins: [devServiceWorker()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: 'src/sw.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        manualChunks: undefined,
      },
    },
  },
});
