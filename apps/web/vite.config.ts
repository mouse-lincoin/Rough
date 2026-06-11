import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/yjs') || id.includes('y-protocols') || id.includes('lib0')) {
            return 'vendor-yjs';
          }
          if (id.includes('node_modules/roughjs')) {
            return 'vendor-rough';
          }
          if (id.includes('@hocuspocus') || id.includes('y-websocket')) {
            return 'vendor-collab';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
