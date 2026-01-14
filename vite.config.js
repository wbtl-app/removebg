import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: '../public/models/*',
          dest: 'models'
        }
      ]
    })
  ],
  optimizeDeps: {
    exclude: ['@imgly/background-removal']
  }
});
