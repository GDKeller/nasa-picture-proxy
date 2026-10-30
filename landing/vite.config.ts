import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 8788,
  },
  plugins: [
    {
      // Dev only: point the hero image at the local Worker so page loads don't hit production.
      name: 'local-hero-img',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html.replace('src="https://api.nasapicture.com/optimized"', 'src="http://localhost:8787/optimized"'),
    },
  ],
});
