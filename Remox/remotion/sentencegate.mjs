#!/usr/bin/env node
/**
 * SentenceGate — Derive phase durations from Whisper word timestamps
 *
 * Reads a whisper JSON and a scene's TSX to compute the correct
 * durationInFrames for each phase so that every phase start aligns
 * exactly with a sentence/phrase boundary in the audio.
 *
 * Usage:
 *   node sentencegate.mjs <project.json> --scene SceneXX [--fix] [--tolerance 5]
 *
 * Modes:
 *   (default)  Audit mode — reports misaligned phases
 *   --fix      Fix mode — rewrites durationInFrames in the TSX
 *
 * Algorithm:
 *   1. Parse whisper JSON for word-level timestamps
 *   2. Detect sentence boundaries (gaps > 400ms between words)
 *   3. Map N phases to N sentence groups (1:1 or merged)
 *   4. Compute duration[i] = sentenceStart[i+1] - sentenceStart[i] + transitionOverlap
 *   5. Last phase gets remaining frames to hit target TSM
 *   6. Verify TSM: sum(durations) - (N-1)*transition = totalFrames
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const FPS = 30;
const TRANSITION = 18;
const DEFAULT_TOLERANCE = 5; // frames
const SENTENCE_GAP_MS = 400; // minimum gap to detect sentence boundary

// --- Parse args ---
const args = process.argv.slice(2);
const projectPath = args.find(a => !a.startsWith('--'));
const sceneFlag = args.indexOf('--scene');
const sceneId = sceneFlag >= 0 ? args[sceneFlag + 1] : null;
const fixMode = args.includes('--fix');
const tolFlag = args.indexOf('--tolerance');
const tolerance = tolFlag >= 0 ? parseInt(args[tolFlag + 1]) : DEFAULT_TOLERANCE;

if (!projectPath || !sceneId) {
  console.error('Usage: node sentencegate.mjs <project.json> --scene SceneXX [--fix] [--tolerance N]');
  process.exit(1);
}

// --- Load project ---
const project = JSON.parse(readFileSync(resolve(projectPath), 'utf-8'));
const scene = project.scenes.find(s => s.id === sceneId);
if (!scene) {
  console.error(`Scene ${sceneId} not found in project.json`);
  process.exit(1);
}

const totalFrames = scene.durationFrames;
const sceneNum = sceneId.replace('Scene', '');

// --- Load whisper ---
const whisperPath = resolve(dirname(projectPath), `audio/scene_${sceneNum.toLowerCase()}_whisper.json`);
let whisper;
try {
  whisper = JSON.parse(readFileSync(whisperPath, 'utf-8'));
} catch (e) {
  console.error(`Cannot read whisper file: ${whisperPath}`);
  process.exit(1);
}

const words = whisper.words || [];

// --- Detect sentence boundaries ---
function detectSentences(words, gapMs = SENTENCE_GAP_MS) {
  const sentences = [];
  let current = [];
  let prevEnd = 0;

  for (const w of words) {
    const gap = w.startMs - prevEnd;
    if (gap > gapMs && current.length > 0) {
      sentences.push(current);
      current = [];
    }
    current.push(w);
    prevEnd = w.endMs;
  }
  if (current.length > 0) sentences.push(current);
  return sentences;
}

const sentences = detectSentences(words);
console.log(`\nSentenceGate — ${sceneId} (${totalFrames} frames, ${sentences.length} sentences detected)\n`);

// Show sentence map
sentences.forEach((s, i) => {
  const frame = Math.round(s[0].startMs / 1000 * FPS);
  const preview = s.slice(0, 8).map(w => w.word).join(' ');
  console.log(`  S${String(i + 1).padStart(2)}: ${String(frame).padStart(5)}f  ${String(s[0].startMs).padStart(6)}ms  "${preview}${s.length > 8 ? '...' : ''}"`);
});

// --- Load TSX and extract current durations ---
const tsxPath = resolve(dirname(projectPath), `../remotion/src/scenes/Scene_${sceneNum}.tsx`);
let tsxPathAlt;
try {
  readFileSync(tsxPath);
} catch {
  // Try Remox skill path
  tsxPathAlt = resolve(process.cwd(), `src/scenes/Scene_${sceneNum}.tsx`);
}
const actualTsxPath = tsxPathAlt || tsxPath;

let tsx;
try {
  tsx = readFileSync(actualTsxPath, 'utf-8');
} catch (e) {
  console.error(`Cannot read TSX: ${actualTsxPath}`);
  process.exit(1);
}

// Extract durationInFrames from TransitionSeries.Sequence lines
const durationRegex = /TransitionSeries\.Sequence\s+durationInFrames=\{(\d+)\}/g;
const currentDurations = [];
let match;
while ((match = durationRegex.exec(tsx)) !== null) {
  currentDurations.push({ value: parseInt(match[1]), index: match.index, fullMatch: match[0] });
}

const numPhases = currentDurations.length;
console.log(`\n  Phases in TSX: ${numPhases}`);
console.log(`  Sentences detected: ${sentences.length}`);

if (numPhases === 0) {
  console.error('No TransitionSeries.Sequence found in TSX');
  process.exit(1);
}

// --- Map phases to sentence starts ---
// --map flag: comma-separated groups, e.g. "1-2,3,4,5-6,7,8,9-10,11-12,13-15,16,17,18,+,+"
//   "1-2" = phase covers sentences 1 and 2 (use sentence 1's start)
//   "+"   = breathing/tail phase (evenly distributed after last sentence)
const mapFlag = args.indexOf('--map');
const mapStr = mapFlag >= 0 ? args[mapFlag + 1] : null;

let targets;
if (mapStr) {
  // Explicit mapping provided
  const groups = mapStr.split(',');
  if (groups.length !== numPhases) {
    console.error(`  ❌ --map has ${groups.length} entries but TSX has ${numPhases} phases`);
    process.exit(1);
  }

  targets = [];
  let lastSentenceFrame = 0;
  const breathingPhases = [];

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i].trim();
    if (g === '+') {
      breathingPhases.push(i);
      targets.push(null); // placeholder
    } else {
      // Parse "N" or "N-M" — use the first sentence's start
      const firstSentence = parseInt(g.split('-')[0]) - 1; // 0-indexed
      if (firstSentence < 0 || firstSentence >= sentences.length) {
        console.error(`  ❌ Sentence ${firstSentence + 1} out of range (have ${sentences.length})`);
        process.exit(1);
      }
      const frame = Math.round(sentences[firstSentence][0].startMs / 1000 * FPS);
      targets.push(frame);
      lastSentenceFrame = frame;
    }
  }

  // Fill in breathing phases — evenly distribute after last content
  if (breathingPhases.length > 0) {
    const lastContentIdx = targets.reduce((last, t, i) => t !== null ? i : last, 0);
    const lastContentFrame = targets[lastContentIdx];
    const remaining = totalFrames - lastContentFrame;
    const gap = Math.floor(remaining / (breathingPhases.length + 1));
    breathingPhases.forEach((idx, j) => {
      targets[idx] = lastContentFrame + gap * (j + 1);
    });
  }
} else if (sentences.length >= numPhases) {
  // Auto 1:1 mapping — take first N sentence starts
  targets = sentences.slice(0, numPhases).map(s => Math.round(s[0].startMs / 1000 * FPS));
} else {
  // Fewer sentences than phases — use all sentences, pad with evenly distributed
  targets = sentences.map(s => Math.round(s[0].startMs / 1000 * FPS));
  const lastSentenceFrame = targets[targets.length - 1];
  const remaining = numPhases - targets.length;
  const gap = Math.floor((totalFrames - lastSentenceFrame) / (remaining + 1));
  for (let i = 1; i <= remaining; i++) {
    targets.push(lastSentenceFrame + gap * i);
  }
}

// Ensure first target is 0
targets[0] = 0;

// --- Compute ideal durations ---
const idealDurations = [];
for (let i = 0; i < numPhases - 1; i++) {
  idealDurations.push(targets[i + 1] - targets[i] + TRANSITION);
}
idealDurations.push(totalFrames - targets[numPhases - 1]); // last phase

// Verify TSM
const sum = idealDurations.reduce((a, b) => a + b, 0);
const tsm = sum - (numPhases - 1) * TRANSITION;
console.log(`  TSM check: ${sum} - ${(numPhases - 1) * TRANSITION} = ${tsm} (target: ${totalFrames})`);

if (tsm !== totalFrames) {
  console.error(`  ❌ TSM mismatch! ${tsm} !== ${totalFrames}`);
  process.exit(1);
}

// --- Compare current vs ideal ---
console.log('\n  Phase  Current  Ideal  Delta  Sentence');
console.log('  ' + '─'.repeat(70));

let currentStart = 0;
let idealStart = 0;
let misaligned = 0;

for (let i = 0; i < numPhases; i++) {
  const cur = currentDurations[i].value;
  const ideal = idealDurations[i];
  const delta = cur - ideal;
  const startDelta = currentStart - targets[i];
  const preview = i < sentences.length
    ? sentences[i].slice(0, 5).map(w => w.word).join(' ')
    : '(breathing)';

  const flag = Math.abs(startDelta) > tolerance ? '❌' : '✅';
  if (Math.abs(startDelta) > tolerance) misaligned++;

  const deltaStr = (startDelta >= 0 ? '+' : '') + startDelta;
  console.log(`  P${String(i + 1).padStart(2)}  ${flag}  ${String(cur).padStart(4)}f → ${String(ideal).padStart(4)}f  ${deltaStr.padStart(5)}f  "${preview}"`);

  currentStart += cur - (i < numPhases - 1 ? TRANSITION : 0);
  idealStart += ideal - (i < numPhases - 1 ? TRANSITION : 0);
}

console.log(`\n  Result: ${misaligned} phase(s) misaligned (tolerance: ±${tolerance}f)`);

if (misaligned === 0 && !fixMode) {
  console.log('  ✅ SentenceGate PASS\n');
  process.exit(0);
}

if (misaligned > 0 && !fixMode) {
  console.log(`  🚫 SentenceGate FAIL — run with --fix to auto-correct\n`);
  process.exit(1);
}

// --- Fix mode: rewrite durations in TSX ---
if (fixMode) {
  console.log('\n  Applying fixes...');

  let newTsx = tsx;
  // Replace from last to first to preserve indices
  for (let i = numPhases - 1; i >= 0; i--) {
    const entry = currentDurations[i];
    const oldStr = entry.fullMatch;
    const newStr = `TransitionSeries.Sequence durationInFrames={${idealDurations[i]}}`;
    newTsx = newTsx.substring(0, entry.index) + newStr + newTsx.substring(entry.index + oldStr.length);
  }

  writeFileSync(actualTsxPath, newTsx);
  console.log(`  ✅ Wrote ${numPhases} updated durations to ${actualTsxPath}`);
  console.log(`  Run audit to verify: node audit.mjs ${projectPath} --scene ${sceneId}\n`);
}
