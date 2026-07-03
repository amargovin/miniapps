import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project dir: prefer REMOX_PROJECT_DIR, fall back to PROJECT_DIR / VITE_PROJECT_DIR
const projectDir =
  process.env.REMOX_PROJECT_DIR ||
  process.env.PROJECT_DIR ||
  process.env.VITE_PROJECT_DIR ||
  '';

const remotionSrc = projectDir ? path.join(projectDir, 'remotion/src') : '';
const remotionPublic = projectDir ? path.join(projectDir, 'remotion/public') : '';

export default defineConfig({
  plugins: [react()],

  // Serve the project's remotion/public/ as the Vite static root.
  // This makes staticFile('images/foo.png') → /images/foo.png → served correctly.
  ...(remotionPublic ? { publicDir: remotionPublic } : {}),

  server: {
    port: 3848,
    proxy: {
      '/api': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3847',
        ws: true,
      },
      '/project-stills': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
    },
    fs: {
      // Allow Vite to serve files from the studio dir AND the project's remotion src
      allow: [
        __dirname,
        ...(remotionSrc ? [remotionSrc] : []),
        ...(remotionPublic ? [remotionPublic] : []),
        ...(projectDir ? [projectDir] : []),
        path.join(__dirname, '..', 'remotion/src'),
      ],
    },
  },

  resolve: {
    alias: {
      // CRITICAL: Force ALL remotion imports to use the studio's copy
      // This prevents the dual-context bug where scene TSX resolves remotion
      // from the project's node_modules while Player uses the studio's
      'remotion': path.resolve(__dirname, 'node_modules/remotion'),
      '@remotion/transitions': path.resolve(__dirname, 'node_modules/@remotion/transitions'),
      '@remotion/player': path.resolve(__dirname, 'node_modules/@remotion/player'),
      '@remotion/media-utils': path.resolve(__dirname, 'node_modules/@remotion/media-utils'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      // Scene files import '../theme' — resolve to the project's theme.ts
      ...(projectDir ? {
        '../theme': path.join(remotionSrc, 'theme.ts'),
        '../../theme': path.join(remotionSrc, 'theme.ts'),
        '@project/scenes': path.join(remotionSrc, 'scenes'),
        '@project/theme': path.join(remotionSrc, 'theme.ts'),
        '@project/src': remotionSrc,
      } : {}),
    },
    dedupe: ['remotion', 'react', 'react-dom', '@remotion/transitions', '@remotion/player'],
  },

  define: {
    'import.meta.env.PROJECT_DIR': JSON.stringify(projectDir),
    'import.meta.env.REMOX_PROJECT_DIR': JSON.stringify(projectDir),
  },

  optimizeDeps: {
    include: ['react', 'react-dom', '@remotion/player', 'remotion', '@remotion/transitions'],
  },
});
