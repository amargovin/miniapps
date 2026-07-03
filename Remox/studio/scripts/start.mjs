#!/usr/bin/env node
/**
 * Remox Studio startup script.
 * Parses --project arg and launches the Express server + Vite dev server.
 *
 * Usage:
 *   npm run dev -- --project /path/to/project
 *   node scripts/start.mjs --project /path/to/project
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const studioDir = join(__dirname, '..');

// Parse --project
let projectDir = '';
const args = process.argv.slice(2);
const projectIdx = args.indexOf('--project');
if (projectIdx !== -1 && args[projectIdx + 1]) {
  projectDir = resolve(args[projectIdx + 1]);
} else {
  const flag = args.find(a => a.startsWith('--project='));
  if (flag) projectDir = resolve(flag.split('=')[1]);
}

if (!projectDir) {
  console.error('\n[Remox Studio] ERROR: --project argument is required\n');
  console.error('Usage: npm run dev -- --project /path/to/project\n');
  process.exit(1);
}

if (!existsSync(projectDir)) {
  console.error(`\n[Remox Studio] ERROR: Project directory not found: ${projectDir}\n`);
  process.exit(1);
}

const projectJson = join(projectDir, 'project.json');
if (!existsSync(projectJson)) {
  console.warn(`\n[Remox Studio] WARNING: project.json not found at ${projectJson}`);
  console.warn('The Studio will start but project data will not load.\n');
}

console.log(`\n[Remox Studio] Starting...`);
console.log(`[Remox Studio] Project: ${projectDir}`);
console.log(`[Remox Studio] Backend:  http://localhost:3847`);
console.log(`[Remox Studio] Frontend: http://localhost:3848\n`);

const env = {
  ...process.env,
  PROJECT_DIR: projectDir,
  REMOX_PROJECT_DIR: projectDir,
  VITE_PROJECT_DIR: projectDir,
};

// Use local node_modules/.bin for tsx and vite
const tsxBin = join(studioDir, 'node_modules/.bin/tsx');
const viteBin = join(studioDir, 'node_modules/.bin/vite');

// Start Express backend
const serverArgs = ['--tsconfig', join(studioDir, 'tsconfig.server.json'), join(studioDir, 'server.ts'), '--project', projectDir];
const server = spawn(tsxBin, serverArgs, {
  cwd: studioDir,
  env,
  stdio: 'inherit',
});

server.on('error', err => {
  console.error('[Remox Studio] Server start error:', err.message);
  console.error('Make sure tsx is installed: npm install in', studioDir);
});

// Start Vite frontend (short delay to let server bind)
await new Promise(r => setTimeout(r, 1500));

const vite = spawn(viteBin, ['--port', '3848'], {
  cwd: studioDir,
  env,
  stdio: 'inherit',
});

vite.on('error', err => {
  console.error('[Remox Studio] Vite start error:', err.message);
});

// Auto-open browser
setTimeout(() => {
  const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(openCmd, ['http://localhost:3848'], { stdio: 'ignore' });
}, 3000);

// Cleanup on exit
const cleanup = () => {
  server.kill();
  vite.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Keep alive
await new Promise(() => {});
