import { defineConfig, type Plugin } from 'vite';

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
          const result = await server.transformRequest('/src/sw.ts');
          if (!result?.code) {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          res.end(result.code);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [devServiceWorker()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: 'src/sw.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
