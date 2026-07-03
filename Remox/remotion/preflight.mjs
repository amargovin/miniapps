#!/usr/bin/env node
/**
 * preflight.mjs — Environment and project readiness checks for Remox.
 *
 * Validates that all external tools, environment variables, and project
 * prerequisites are in place BEFORE any production work begins. Exits
 * immediately with a clear human-readable error if any check fails.
 *
 * Usage:
 *   node preflight.mjs <project-dir>
 *
 * Exit codes: 0 = all checks pass, 1 = a check failed
 */

import { existsSync, accessSync, readdirSync, constants } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TICK  = '\u2705';
const CROSS = '\u274C';

function pass(label, detail = '') {
  console.log(`  ${TICK}  ${label}${detail ? '  \u2014  ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.error(`  ${CROSS}  ${label}${detail ? '\n       ' + detail : ''}`);
}

function hr() {
  return '\u2550'.repeat(51);
}

// Run a shell command and return stdout, or null on failure.
function tryRun(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

// Parse a semver string and return [major, minor, patch] integers.
function parseSemver(s) {
  const m = String(s || '').match(/(\d+)\.(\d+)\.?(\d+)?/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3] || '0')];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const projectDir = args.find(a => !a.startsWith('--')) || process.cwd();
const resolvedProjectDir = resolve(projectDir);

console.log('');
console.log(hr());
console.log('REMOX PREFLIGHT CHECKS');
console.log(hr());
console.log('');

let anyFailed = false;

// ---------------------------------------------------------------------------
// CHECK 1: OPENAI_API_KEY
// ---------------------------------------------------------------------------
{
  const key = process.env.OPENAI_API_KEY;
  if (key && key.length > 10) {
    pass('OPENAI_API_KEY', `set (sk-...${key.slice(-4)})`);
  } else {
    fail(
      'OPENAI_API_KEY is not set',
      'The Whisper timestamp step calls the OpenAI API.\n' +
      '       Set it with: export OPENAI_API_KEY="sk-..."'
    );
    anyFailed = true;
  }
}

// ---------------------------------------------------------------------------
// CHECK 2: node version >= 18
// ---------------------------------------------------------------------------
{
  const out = tryRun('node --version');
  if (!out) {
    fail(
      'node is not available',
      'Install Node.js 18+ from https://nodejs.org'
    );
    anyFailed = true;
  } else {
    const [major] = parseSemver(out);
    if (major >= 18) {
      pass('node', `${out} (>= 18 required)`);
    } else {
      fail(
        `node version too old: ${out}`,
        'Remotion requires Node.js 18+. Install from https://nodejs.org'
      );
      anyFailed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 3: ffprobe (part of FFmpeg)
// ---------------------------------------------------------------------------
{
  const out = tryRun('ffprobe -version');
  if (out) {
    const versionLine = out.split('\n')[0] || '';
    pass('ffprobe', versionLine.slice(0, 60));
  } else {
    fail(
      'ffprobe is not available',
      'Install FFmpeg (includes ffprobe):\n' +
      '       macOS:  brew install ffmpeg\n' +
      '       Ubuntu: sudo apt install ffmpeg\n' +
      '       Or download from https://ffmpeg.org/download.html'
    );
    anyFailed = true;
  }
}

// ---------------------------------------------------------------------------
// CHECK 4: python3
// ---------------------------------------------------------------------------
{
  const out = tryRun('python3 --version');
  if (out) {
    pass('python3', out);
  } else {
    fail(
      'python3 is not available',
      'The Whisper timestamp script requires Python 3.\n' +
      '       macOS:  brew install python3\n' +
      '       Ubuntu: sudo apt install python3'
    );
    anyFailed = true;
  }
}

// ---------------------------------------------------------------------------
// CHECK 5: audio files in project audio/ directory
// ---------------------------------------------------------------------------
{
  const audioDir = join(resolvedProjectDir, 'audio');
  if (!existsSync(audioDir)) {
    fail(
      `audio/ directory not found in project dir`,
      `Expected: ${audioDir}\n` +
      '       Create it and add scene audio files (scene_01.mp3, scene_02.mp3, ...)'
    );
    anyFailed = true;
  } else {
    let audioFiles;
    try {
      audioFiles = readdirSync(audioDir).filter(f => /\.(mp3|wav|m4a|aac|ogg)$/i.test(f));
    } catch (e) {
      fail(`audio/ directory is not readable`, e.message);
      anyFailed = true;
      audioFiles = null;
    }

    if (audioFiles !== null) {
      if (audioFiles.length === 0) {
        fail(
          'No audio files found in audio/',
          `Directory exists at ${audioDir} but contains no audio files.\n` +
          '       Add scene audio files: scene_01.mp3, scene_02.mp3, ...'
        );
        anyFailed = true;
      } else {
        // Check each file is readable
        const unreadable = audioFiles.filter(f => {
          try {
            accessSync(join(audioDir, f), constants.R_OK);
            return false;
          } catch {
            return true;
          }
        });

        if (unreadable.length > 0) {
          fail(
            `${unreadable.length} audio file(s) are not readable`,
            `Files: ${unreadable.join(', ')}`
          );
          anyFailed = true;
        } else {
          pass('audio files', `${audioFiles.length} file(s) readable in audio/`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 6: project directory is writable
// ---------------------------------------------------------------------------
{
  try {
    accessSync(resolvedProjectDir, constants.W_OK);
    pass('project directory writable', resolvedProjectDir);
  } catch {
    fail(
      `Project directory is not writable: ${resolvedProjectDir}`,
      'Check file permissions: ls -la ' + resolvedProjectDir
    );
    anyFailed = true;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log(hr());
if (anyFailed) {
  console.error('PREFLIGHT FAILED — fix the issues above before producing.');
  console.log(hr());
  process.exit(1);
} else {
  console.log('PREFLIGHT PASSED — all checks OK.');
  console.log(hr());
  process.exit(0);
}
