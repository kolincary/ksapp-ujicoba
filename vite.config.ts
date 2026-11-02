import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      // Enable SPA routing - redirect all routes to index.html
      historyApiFallback: true,
      proxy: {
        '/api/ginee': {
          target: 'https://api.ginee.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/ginee/, ''),
        },
      },
    },
    // Also configure for preview/production builds
    preview: {
      port: 3001,
      host: '0.0.0.0',
    },
    // Ensure /admin route works as SPA navigation
    appType: 'spa',
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
