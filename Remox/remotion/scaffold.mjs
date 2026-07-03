#!/usr/bin/env node
/**
 * scaffold.mjs — Copy the Remox remotion project skeleton into a target directory.
 *
 * Copies the reusable remotion project structure (package.json, tsconfig,
 * remotion config, base source files, components, utils) into the user's
 * project directory, then runs npm install if node_modules is absent.
 *
 * Does NOT copy src/scenes/ — those are generated fresh per project.
 * Is idempotent: skips files that already exist unless --force is given.
 *
 * Usage:
 *   node scaffold.mjs <target-dir> [--force]
 *
 * Exit codes: 0 = success, 1 = error
 */

import {
  existsSync, mkdirSync, cpSync, readdirSync, statSync, copyFileSync,
} from 'fs';
import { resolve, join, dirname, relative, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const force = args.includes('--force');
const targetArg = args.find(a => !a.startsWith('--'));

if (!targetArg) {
  console.error('Usage: node scaffold.mjs <target-dir> [--force]');
  process.exit(1);
}

const targetDir = resolve(targetArg);
const sourceDir = __dirname;  // The skill's remotion/ directory

const TICK  = '\u2705';
const SKIP  = '\u23ED ';
const CROSS = '\u274C';

function hr() { return '\u2550'.repeat(51); }

console.log('');
console.log(hr());
console.log('REMOX SCAFFOLD');
console.log(`Target: ${targetDir}`);
console.log(hr());
console.log('');

// ---------------------------------------------------------------------------
// Create target directory
// ---------------------------------------------------------------------------
mkdirSync(targetDir, { recursive: true });
const remotionTarget = join(targetDir, 'remotion');
mkdirSync(remotionTarget, { recursive: true });

// ---------------------------------------------------------------------------
// Files and directories to copy (relative to sourceDir)
// Excludes: node_modules, output, src/scenes, *.mjs scripts, production_log.json
// ---------------------------------------------------------------------------
const FILE_COPIES = [
  'package.json',
  'tsconfig.json',
  'remotion.config.ts',
];

const DIR_COPIES = [
  // src sub-dirs — everything EXCEPT scenes/
  { src: 'src/components', dest: 'src/components' },
  { src: 'src/utils',      dest: 'src/utils' },
  { src: 'public',         dest: 'public' },
];

// Individual src files (not the scenes/ directory)
const SRC_FILES = [
  'src/index.ts',
  'src/Root.tsx',
  'src/RemoxScene.tsx',
  'src/RemoxFull.tsx',
  'src/theme.ts',
  'src/motion-utils.ts',
  'src/IllustratedPlate.tsx',
  'src/StandpointEndcard.tsx',
];

let copied = 0;
let skipped = 0;
let errors = 0;

// ---------------------------------------------------------------------------
// Copy a single file
// ---------------------------------------------------------------------------
function copyFile(srcRel, destRel) {
  const srcPath  = join(sourceDir, srcRel);
  const destPath = join(remotionTarget, destRel || srcRel);

  if (!existsSync(srcPath)) {
    console.log(`  ${SKIP} SKIP  ${srcRel} (not found in template)`);
    return;
  }

  if (existsSync(destPath) && !force) {
    console.log(`  ${SKIP} SKIP  ${srcRel} (already exists)`);
    skipped++;
    return;
  }

  try {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    console.log(`  ${TICK}  COPY  ${srcRel}`);
    copied++;
  } catch (e) {
    console.error(`  ${CROSS}  FAIL  ${srcRel}: ${e.message}`);
    errors++;
  }
}

// ---------------------------------------------------------------------------
// Copy a directory recursively (skipping existing files unless --force)
// ---------------------------------------------------------------------------
function copyDir(srcRel, destRel) {
  const srcPath  = join(sourceDir, srcRel);
  const destPath = join(remotionTarget, destRel || srcRel);

  if (!existsSync(srcPath)) {
    console.log(`  ${SKIP} SKIP  ${srcRel}/ (not found in template)`);
    return;
  }

  if (existsSync(destPath) && !force) {
    console.log(`  ${SKIP} SKIP  ${srcRel}/ (already exists)`);
    skipped++;
    return;
  }

  try {
    cpSync(srcPath, destPath, { recursive: true, force });
    console.log(`  ${TICK}  COPY  ${srcRel}/`);
    copied++;
  } catch (e) {
    console.error(`  ${CROSS}  FAIL  ${srcRel}/: ${e.message}`);
    errors++;
  }
}

// ---------------------------------------------------------------------------
// Create empty scenes/ directory
// ---------------------------------------------------------------------------
function ensureScenesDir() {
  const scenesDir = join(remotionTarget, 'src', 'scenes');
  if (!existsSync(scenesDir)) {
    mkdirSync(scenesDir, { recursive: true });
    console.log(`  ${TICK}  MKDIR src/scenes/ (empty — generated per project)`);
    copied++;
  } else {
    console.log(`  ${SKIP} SKIP  src/scenes/ (already exists)`);
    skipped++;
  }
}

// Execute copies
for (const f of FILE_COPIES) {
  copyFile(f, f);
}
for (const f of SRC_FILES) {
  copyFile(f, f);
}
for (const { src, dest } of DIR_COPIES) {
  copyDir(src, dest);
}
ensureScenesDir();

// ---------------------------------------------------------------------------
// npm install (only if node_modules is absent)
// ---------------------------------------------------------------------------
console.log('');
const nodeModules = join(remotionTarget, 'node_modules');
if (!existsSync(nodeModules)) {
  console.log('  Installing npm dependencies (this takes a minute)...');
  try {
    execSync('npm install', {
      cwd: remotionTarget,
      stdio: 'inherit',
      timeout: 300000,
    });
    console.log(`  ${TICK}  npm install complete`);
  } catch (e) {
    console.error(`  ${CROSS}  npm install failed: ${e.message}`);
    errors++;
  }
} else {
  console.log(`  ${SKIP} SKIP  npm install (node_modules already exists)`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log(hr());
if (errors > 0) {
  console.error(`SCAFFOLD INCOMPLETE — ${errors} error(s). Check messages above.`);
  console.log(hr());
  process.exit(1);
} else {
  console.log(`SCAFFOLD DONE — ${copied} copied, ${skipped} skipped.`);
  console.log(`Remotion project at: ${remotionTarget}`);
  console.log(hr());
  process.exit(0);
}
