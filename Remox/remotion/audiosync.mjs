#!/usr/bin/env node
/**
 * AudioSync v2 — Unified AV Sync Tool for Remox
 *
 * Three-layer algorithm for phase boundary detection:
 *
 *   Layer 1: Gap Detection (primary anchors)
 *     - Major gaps (1200ms+) = definite phase boundaries
 *     - Minor gaps (350ms+)  = candidate boundaries
 *
 *   Layer 2: Brief-Text Confirmation
 *     - Read briefs/SceneXX_brief.yml for text_overlay per phase
 *     - Fuzzy token overlap (40%+ non-stopword match) confirms candidate
 *     - Sliding window ±1.5s if initial match fails
 *
 *   Layer 3: Sequential Fallback
 *     - Phases with no confirmed anchor inherit previous end time
 *     - Minimum phase duration: 60 frames (2 seconds)
 *
 * Anchor confidence: gap-major > text-confirmed > gap-minor > sequential
 *
 * Usage:
 *   node audiosync.mjs <project.json> --scene SceneXX [--fix] [--map "1-2,3,4,+"] [--tolerance N] [--verbose]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const FPS = 30;
const TRANSITION = 18;
const DEFAULT_TOLERANCE = 5; // frames
const GAP_MAJOR_MS = 1200;   // definite phase boundary
const GAP_MINOR_MS = 350;    // candidate boundary
const MIN_PHASE_FRAMES = 60; // 2 seconds minimum
const FUZZY_THRESHOLD = 0.40; // 40% non-stopword token overlap to confirm
const WINDOW_SLIDE_MS = 1500; // ±1.5s sliding window

const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being',
  'and','or','but','in','on','at','to','for','of','with','by','from','as','into',
  'through','about','up','out','if','then','so','its','it','this','that','these',
  'those','i','we','you','he','she','they','what','which','who','how','when','where',
  'had','has','have','do','did','does','would','could','should','will','can','may',
  'just','not','no','more','most','some','any','all','both','each','few','many',
  'over','after','before','during','while','than','very','too','also','like','one']);

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const projectPath = args.find(a => !a.startsWith('--'));
const sceneFlag = args.indexOf('--scene');
const sceneId = sceneFlag >= 0 ? args[sceneFlag + 1] : null;
const fixMode = args.includes('--fix');
const verbose = args.includes('--verbose');
const tolFlag = args.indexOf('--tolerance');
const tolerance = tolFlag >= 0 ? parseInt(args[tolFlag + 1]) : DEFAULT_TOLERANCE;
const mapFlag = args.indexOf('--map');
const mapStr = mapFlag >= 0 ? args[mapFlag + 1] : null;

if (!projectPath || !sceneId) {
  console.error('Usage: node audiosync.mjs <project.json> --scene SceneXX [--fix] [--map "1-2,3,4,+"] [--tolerance N] [--verbose]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load project and scene
// ---------------------------------------------------------------------------
const project = JSON.parse(readFileSync(resolve(projectPath), 'utf-8'));
const scene = project.scenes.find(s => s.id === sceneId);
if (!scene) {
  console.error(`Scene ${sceneId} not found in project.json`);
  process.exit(1);
}

const totalFrames = scene.durationFrames;
const sceneNum = sceneId.replace('Scene', '');

// ---------------------------------------------------------------------------
// Load whisper
// ---------------------------------------------------------------------------
const whisperPath = resolve(dirname(resolve(projectPath)), `audio/scene_${sceneNum.toLowerCase()}_whisper.json`);
let whisper;
try {
  whisper = JSON.parse(readFileSync(whisperPath, 'utf-8'));
} catch (e) {
  console.error(`Cannot read whisper file: ${whisperPath}`);
  process.exit(1);
}

const words = whisper.words || [];

// ---------------------------------------------------------------------------
// Load brief (optional — falls back to gap-only if absent)
// ---------------------------------------------------------------------------
const briefPath = resolve(dirname(resolve(projectPath)), `briefs/Scene${sceneNum}_brief.yml`);
let briefYaml = null;
try {
  briefYaml = readFileSync(briefPath, 'utf-8');
} catch (e) {
  // No brief — gap-only mode
}

// ---------------------------------------------------------------------------
// Parse brief text_overlay entries (no YAML dependency — simple regex)
// Returns array of strings, one per phase, in order. Null for phases with
// no text or text_overlay: null.
// ---------------------------------------------------------------------------
function parseBriefTextOverlays(yaml) {
  if (!yaml) return [];
  const overlays = [];
  // Match text_overlay: "..." or text_overlay: null
  const re = /text_overlay:\s*(?:"([^"]*)"|(null))/g;
  let m;
  while ((m = re.exec(yaml)) !== null) {
    if (m[2] === 'null') {
      overlays.push(null);
    } else {
      overlays.push(m[1] || null);
    }
  }
  return overlays;
}

// ---------------------------------------------------------------------------
// Token utilities for fuzzy matching
// ---------------------------------------------------------------------------
function cleanToken(w) {
  return w.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function contentTokens(text) {
  if (!text) return [];
  return text.split(/\s+/)
    .map(cleanToken)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// ---------------------------------------------------------------------------
// Layer 1: Gap Detection
// Returns sorted array of gap events: { gapMs, atWordIndex, startMs, tier }
// tier: 'major' | 'minor'
// ---------------------------------------------------------------------------
function detectGaps(words) {
  const gaps = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startMs - words[i - 1].endMs;
    if (gap >= GAP_MAJOR_MS) {
      gaps.push({ gapMs: gap, atWordIndex: i, startMs: words[i].startMs, tier: 'major' });
    } else if (gap >= GAP_MINOR_MS) {
      gaps.push({ gapMs: gap, atWordIndex: i, startMs: words[i].startMs, tier: 'minor' });
    }
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Layer 2: Fuzzy brief-text confirmation
// Given a phrase from the brief and all whisper words, find the best matching
// window. Returns { startMs, endMs, score, matchedTokens } or null.
//
// Strategy:
//   - Extract content tokens from brief text
//   - Slide a window over whisper words looking for best token overlap ratio
//   - windowMs defines the span of whisper words to check at each position
// ---------------------------------------------------------------------------
function fuzzyFindInWhisper(briefText, words, windowMs = 3000) {
  const targetTokens = contentTokens(briefText);
  if (targetTokens.length === 0) return null;

  let best = null;

  // Slide start position through the whisper word list
  for (let wi = 0; wi < words.length; wi++) {
    const windowStart = words[wi].startMs;
    const windowEnd = windowStart + windowMs;

    // Collect whisper words in this window
    const windowWords = [];
    for (let j = wi; j < words.length && words[j].startMs <= windowEnd; j++) {
      windowWords.push(words[j]);
    }
    if (windowWords.length === 0) continue;

    const windowTokens = windowWords.map(w => cleanToken(w.word)).filter(t => t.length > 1);

    // Count how many target tokens appear in window tokens
    let matched = 0;
    for (const tok of targetTokens) {
      if (windowTokens.includes(tok)) matched++;
    }

    const score = targetTokens.length > 0 ? matched / targetTokens.length : 0;

    if (score >= FUZZY_THRESHOLD) {
      if (!best || score > best.score) {
        best = {
          startMs: windowWords[0].startMs,
          endMs: windowWords[windowWords.length - 1].endMs,
          score,
          matchedTokens: matched,
          totalTokens: targetTokens.length,
        };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Resolve TSX path
// ---------------------------------------------------------------------------
function resolveTsxPath(sceneNum) {
  const projectDir = dirname(resolve(projectPath));
  // Prefer the project's scaffolded remotion/ tree
  const p0 = resolve(projectDir, `remotion/src/scenes/Scene_${sceneNum}.tsx`);
  try { readFileSync(p0); return p0; } catch {}
  const p1 = resolve(projectDir, `../remotion/src/scenes/Scene_${sceneNum}.tsx`);
  try { readFileSync(p1); return p1; } catch {}
  const p2 = resolve(process.cwd(), `src/scenes/Scene_${sceneNum}.tsx`);
  try { readFileSync(p2); return p2; } catch {}
  const p3 = resolve(dirname(new URL(import.meta.url).pathname), `src/scenes/Scene_${sceneNum}.tsx`);
  try { readFileSync(p3); return p3; } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Extract durationInFrames from TSX
// ---------------------------------------------------------------------------
function extractDurations(tsx) {
  const durationRegex = /TransitionSeries\.Sequence\s+durationInFrames=\{(\d+)\}/g;
  const result = [];
  let match;
  while ((match = durationRegex.exec(tsx)) !== null) {
    result.push({ value: parseInt(match[1]), index: match.index, fullMatch: match[0] });
  }
  return result;
}

// ---------------------------------------------------------------------------
// TSM verification: sum(durations) - (N-1)*TRANSITION = totalFrames
// ---------------------------------------------------------------------------
function verifyTSM(durations, totalFrames) {
  const sum = durations.reduce((a, b) => a + b, 0);
  const tsm = sum - (durations.length - 1) * TRANSITION;
  return { sum, tsm, ok: tsm === totalFrames };
}

// ---------------------------------------------------------------------------
// --map override: same logic as original SentenceGate
// Uses gap-detected sentences (major+minor boundaries split word list into groups)
// Returns array of target frame starts, one per phase.
// ---------------------------------------------------------------------------
function applyMapOverride(mapStr, sentences, numPhases) {
  const groups = mapStr.split(',');
  if (groups.length !== numPhases) {
    console.error(`  --map has ${groups.length} entries but TSX has ${numPhases} phases`);
    process.exit(1);
  }

  const targets = [];
  const breathingPhases = [];

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i].trim();
    if (g === '+') {
      breathingPhases.push(i);
      targets.push(null);
    } else {
      const firstSentence = parseInt(g.split('-')[0]) - 1;
      if (firstSentence < 0 || firstSentence >= sentences.length) {
        console.error(`  Sentence ${firstSentence + 1} out of range (have ${sentences.length})`);
        process.exit(1);
      }
      const frame = Math.round(sentences[firstSentence][0].startMs / 1000 * FPS);
      targets.push(frame);
    }
  }

  if (breathingPhases.length > 0) {
    const lastContentIdx = targets.reduce((last, t, i) => t !== null ? i : last, 0);
    const lastContentFrame = targets[lastContentIdx];
    const remaining = totalFrames - lastContentFrame;
    const gap = Math.floor(remaining / (breathingPhases.length + 1));
    breathingPhases.forEach((idx, j) => {
      targets[idx] = lastContentFrame + gap * (j + 1);
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Detect sentences for --map compatibility (gap-based sentence splitting)
// Returns array of word arrays
// ---------------------------------------------------------------------------
function detectSentences(words, gapMs = 400) {
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

// ---------------------------------------------------------------------------
// THREE-LAYER ANCHOR COMPUTATION
// Returns array of anchor objects, one per phase:
//   { frameStart, anchorSource, briefText, confidence }
// anchorSource: 'gap-major' | 'text-confirmed' | 'gap-minor' | 'sequential'
// ---------------------------------------------------------------------------
function computeAnchors(numPhases, briefOverlays) {
  const gaps = detectGaps(words);
  const majorGaps = gaps.filter(g => g.tier === 'major');
  const minorGaps = gaps.filter(g => g.tier === 'minor');
  const allGapStarts = gaps.map(g => g.startMs);

  if (verbose) {
    console.log(`\n  Gap analysis:`);
    console.log(`    Major gaps (${GAP_MAJOR_MS}ms+): ${majorGaps.length}`);
    majorGaps.forEach(g => {
      const f = Math.round(g.startMs / 1000 * FPS);
      console.log(`      @${String(f).padStart(5)}f  ${String(g.startMs).padStart(7)}ms  gap=${g.gapMs}ms`);
    });
    console.log(`    Minor gaps (${GAP_MINOR_MS}ms+): ${minorGaps.length}`);
    minorGaps.forEach(g => {
      const f = Math.round(g.startMs / 1000 * FPS);
      console.log(`      @${String(f).padStart(5)}f  ${String(g.startMs).padStart(7)}ms  gap=${g.gapMs}ms`);
    });
  }

  // Collect all candidate anchor times sorted
  // Major gaps are definite; minor gaps + brief matches are candidates
  const anchors = [];

  // Anchor 0 is always frame 0
  anchors.push({ frameStart: 0, anchorSource: 'gap-major', briefText: null, startMs: 0 });

  // Use all major gaps as anchors first
  for (const g of majorGaps) {
    anchors.push({
      frameStart: Math.round(g.startMs / 1000 * FPS),
      anchorSource: 'gap-major',
      briefText: null,
      startMs: g.startMs,
    });
  }

  // Now try to match brief text for each phase to get text-confirmed anchors
  const briefTextAnchors = [];
  if (briefYaml) {
    for (let i = 0; i < numPhases; i++) {
      const text = briefOverlays[i] || null;
      if (!text) continue;

      let match = fuzzyFindInWhisper(text, words, 3000);

      // If no match found, try sliding window ±1.5s around each gap candidate
      if (!match) {
        for (const g of allGapStarts) {
          const nearbyWords = words.filter(w =>
            w.startMs >= g - WINDOW_SLIDE_MS && w.startMs <= g + WINDOW_SLIDE_MS
          );
          if (nearbyWords.length === 0) continue;
          const tryMatch = fuzzyFindInWhisper(text, nearbyWords, 3000);
          if (tryMatch && (!match || tryMatch.score > match.score)) {
            match = tryMatch;
          }
        }
      }

      if (match) {
        briefTextAnchors.push({
          phaseIndex: i,
          frameStart: Math.round(match.startMs / 1000 * FPS),
          anchorSource: 'text-confirmed',
          briefText: text,
          startMs: match.startMs,
          score: match.score,
        });

        if (verbose) {
          const tokens = contentTokens(text);
          console.log(`    P${String(i + 1).padStart(2)} text-match: @${Math.round(match.startMs/1000*FPS)}f  score=${(match.score*100).toFixed(0)}%  "${text.slice(0,40)}"`);
        }
      }
    }
  }

  // Now assign anchors to phases using priority:
  // 1. Phase 0 always starts at 0
  // 2. For each phase, check if there's a text-confirmed anchor
  // 3. If not, find the nearest gap (major first, then minor) within expected window
  // 4. Fall back to sequential

  // Build a timeline of all anchor candidates sorted by frame
  const allCandidates = [];
  for (const g of gaps) {
    allCandidates.push({
      frameStart: Math.round(g.startMs / 1000 * FPS),
      startMs: g.startMs,
      tier: g.tier,
      anchorSource: g.tier === 'major' ? 'gap-major' : 'gap-minor',
    });
  }

  // Assign one anchor per phase
  const phaseAnchors = new Array(numPhases).fill(null);
  phaseAnchors[0] = { frameStart: 0, anchorSource: 'gap-major', briefText: briefOverlays[0] || null, startMs: 0 };

  // For phases 1..N-1: try text-confirmed first, then gap-based, then sequential
  for (let i = 1; i < numPhases; i++) {
    const briefText = briefOverlays[i] || null;

    // Check text-confirmed
    const textAnchor = briefTextAnchors.find(a => a.phaseIndex === i);
    if (textAnchor) {
      phaseAnchors[i] = {
        frameStart: textAnchor.frameStart,
        anchorSource: 'text-confirmed',
        briefText: textAnchor.briefText,
        startMs: textAnchor.startMs,
        score: textAnchor.score,
      };
      continue;
    }

    // Estimate expected window for this phase from distribution
    // Split totalFrames evenly as fallback expectation
    const expectedStart = Math.round((i / numPhases) * totalFrames);
    const expectedMs = (expectedStart / FPS) * 1000;
    const searchWindowMs = (totalFrames / numPhases / FPS) * 1000 * 0.8;

    // Find nearest major gap in window
    const majorInWindow = allCandidates
      .filter(c => c.tier === 'major' && Math.abs(c.startMs - expectedMs) < searchWindowMs)
      .sort((a, b) => Math.abs(a.startMs - expectedMs) - Math.abs(b.startMs - expectedMs));

    if (majorInWindow.length > 0) {
      phaseAnchors[i] = {
        frameStart: majorInWindow[0].frameStart,
        anchorSource: 'gap-major',
        briefText,
        startMs: majorInWindow[0].startMs,
      };
      continue;
    }

    // Find nearest minor gap in window
    const minorInWindow = allCandidates
      .filter(c => c.tier === 'minor' && Math.abs(c.startMs - expectedMs) < searchWindowMs)
      .sort((a, b) => Math.abs(a.startMs - expectedMs) - Math.abs(b.startMs - expectedMs));

    if (minorInWindow.length > 0) {
      phaseAnchors[i] = {
        frameStart: minorInWindow[0].frameStart,
        anchorSource: 'gap-minor',
        briefText,
        startMs: minorInWindow[0].startMs,
      };
      continue;
    }

    // Layer 3: Sequential fallback — inherit prev anchor end
    phaseAnchors[i] = null; // mark for sequential pass
  }

  // Sequential pass: fill nulls
  let lastFrame = 0;
  for (let i = 1; i < numPhases; i++) {
    if (phaseAnchors[i] === null) {
      // Inherit from previous, with minimum phase duration
      const prevStart = phaseAnchors[i - 1] ? phaseAnchors[i - 1].frameStart : lastFrame;
      const inherited = prevStart + MIN_PHASE_FRAMES;
      phaseAnchors[i] = {
        frameStart: Math.min(inherited, totalFrames - MIN_PHASE_FRAMES * (numPhases - i)),
        anchorSource: 'sequential',
        briefText: briefOverlays[i] || null,
        startMs: null,
      };
    }
    if (phaseAnchors[i]) lastFrame = phaseAnchors[i].frameStart;
  }

  // Ensure anchors are monotonically increasing with min gap
  for (let i = 1; i < numPhases; i++) {
    const prevFrame = phaseAnchors[i - 1].frameStart;
    if (phaseAnchors[i].frameStart <= prevFrame) {
      phaseAnchors[i] = {
        ...phaseAnchors[i],
        frameStart: prevFrame + MIN_PHASE_FRAMES,
        anchorSource: phaseAnchors[i].anchorSource === 'gap-major' ? 'gap-minor' : phaseAnchors[i].anchorSource,
      };
    }
  }

  return phaseAnchors;
}

// ---------------------------------------------------------------------------
// Compute ideal durations from anchor starts
// ---------------------------------------------------------------------------
function anchorsToIdealDurations(phaseAnchors, numPhases) {
  const idealDurations = [];
  for (let i = 0; i < numPhases - 1; i++) {
    const dur = phaseAnchors[i + 1].frameStart - phaseAnchors[i].frameStart + TRANSITION;
    idealDurations.push(Math.max(dur, MIN_PHASE_FRAMES + TRANSITION));
  }
  // Last phase: remainder
  idealDurations.push(totalFrames - phaseAnchors[numPhases - 1].frameStart);

  // TSM fixup: adjust last phase to exactly hit totalFrames
  const { sum, tsm } = verifyTSM(idealDurations, totalFrames);
  if (tsm !== totalFrames) {
    const delta = totalFrames - tsm;
    idealDurations[idealDurations.length - 1] += delta;
  }

  return idealDurations;
}

// ---------------------------------------------------------------------------
// Confidence label for display
// ---------------------------------------------------------------------------
function confidenceIcon(source) {
  switch (source) {
    case 'gap-major':      return 'gap-major     ';
    case 'text-confirmed': return 'text-confirmed';
    case 'gap-minor':      return 'gap-minor     ';
    case 'sequential':     return 'sequential    ';
    default:               return source;
  }
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------
const tsxPath = resolveTsxPath(sceneNum);
if (!tsxPath) {
  console.error(`Cannot find TSX file for Scene_${sceneNum}.tsx`);
  process.exit(1);
}

const tsx = readFileSync(tsxPath, 'utf-8');
const currentDurations = extractDurations(tsx);

if (currentDurations.length === 0) {
  console.error('No TransitionSeries.Sequence found in TSX');
  process.exit(1);
}

const numPhases = currentDurations.length;
const briefOverlays = parseBriefTextOverlays(briefYaml);

if (verbose) {
  console.log(`\n  TSX: ${tsxPath}`);
  console.log(`  Whisper: ${whisperPath}`);
  console.log(`  Brief: ${briefYaml ? briefPath : '(none — gap-only mode)'}`);
  console.log(`  Phases: ${numPhases}  |  Words: ${words.length}  |  Total frames: ${totalFrames}`);
  console.log(`  Brief overlays found: ${briefOverlays.filter(Boolean).length}`);
}

console.log(`\nAudioSync v2 — ${sceneId}  (${totalFrames}f | ${words.length} words | ${numPhases} phases | ${briefYaml ? 'brief+gap' : 'gap-only'})\n`);

// ---------------------------------------------------------------------------
// Handle --map override (uses classic sentence-gate logic)
// ---------------------------------------------------------------------------
let targets;
let idealDurations;
let phaseAnchors;

if (mapStr) {
  const sentences = detectSentences(words);
  console.log(`  --map override: using sentence-gate logic (${sentences.length} sentences)\n`);
  targets = applyMapOverride(mapStr, sentences, numPhases);
  targets[0] = 0;
  idealDurations = [];
  for (let i = 0; i < numPhases - 1; i++) {
    idealDurations.push(targets[i + 1] - targets[i] + TRANSITION);
  }
  idealDurations.push(totalFrames - targets[numPhases - 1]);

  const { tsm } = verifyTSM(idealDurations, totalFrames);
  if (tsm !== totalFrames) {
    const delta = totalFrames - tsm;
    idealDurations[idealDurations.length - 1] += delta;
  }

  // Build phaseAnchors from targets for display
  phaseAnchors = targets.map((f, i) => ({
    frameStart: f,
    anchorSource: 'gap-major',
    briefText: briefOverlays[i] || null,
    startMs: Math.round(f / FPS * 1000),
  }));
} else {
  // Three-layer algorithm
  phaseAnchors = computeAnchors(numPhases, briefOverlays);
  idealDurations = anchorsToIdealDurations(phaseAnchors, numPhases);
}

// ---------------------------------------------------------------------------
// Verify TSM
// ---------------------------------------------------------------------------
const { sum, tsm, ok: tsmOk } = verifyTSM(idealDurations, totalFrames);
if (!tsmOk) {
  console.error(`  TSM mismatch: ${sum} - ${(numPhases - 1) * TRANSITION} = ${tsm} (target: ${totalFrames})`);
  process.exit(1);
}
if (verbose) {
  console.log(`  TSM check: ${sum} - ${(numPhases - 1) * TRANSITION} = ${tsm} (target: ${totalFrames})  OK`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
// Column headers
console.log(`  ${'P'.padEnd(4)} ${'St'.padEnd(3)} ${'Dur'.padStart(5)} ${'@Start'.padStart(7)}  ${'Anchor'.padEnd(14)}  Brief Text`);
console.log('  ' + '─'.repeat(85));

let currentStart = 0;
let misaligned = 0;

for (let i = 0; i < numPhases; i++) {
  const cur = currentDurations[i].value;
  const ideal = idealDurations[i];
  const anchorFrame = phaseAnchors[i].frameStart;
  const source = phaseAnchors[i].anchorSource;

  // Current start vs anchor — this is what we check for misalignment
  const startDelta = currentStart - anchorFrame;
  const flag = Math.abs(startDelta) > tolerance ? '!' : 'OK';
  if (Math.abs(startDelta) > tolerance) misaligned++;

  // Brief text snippet (first 35 chars)
  const rawText = phaseAnchors[i].briefText;
  const textSnippet = rawText
    ? `"${rawText.slice(0, 35)}${rawText.length > 35 ? '...' : ''}"`
    : '(no text)';

  // Score annotation for text-confirmed
  const scoreNote = source === 'text-confirmed' && phaseAnchors[i].score
    ? ` [${(phaseAnchors[i].score * 100).toFixed(0)}%]`
    : '';

  const deltaStr = (startDelta >= 0 ? '+' : '') + startDelta;
  const phaseLabel = `P${String(i + 1).padStart(2)}`;

  console.log(`  ${phaseLabel} ${flag}  ${String(ideal).padStart(4)}f  @${String(anchorFrame).padStart(5)}f  ${confidenceIcon(source)}  ${textSnippet}${scoreNote}`);

  if (verbose && Math.abs(startDelta) > tolerance) {
    console.log(`       current start: ${currentStart}f  anchor: ${anchorFrame}f  delta: ${deltaStr}f`);
  }

  currentStart += cur - (i < numPhases - 1 ? TRANSITION : 0);
}

console.log('');
console.log(`  TSM: ${sum} - ${(numPhases - 1) * TRANSITION} = ${tsm} (target: ${totalFrames})  ${tsmOk ? 'OK' : 'FAIL'}`);
console.log(`  Result: ${misaligned} phase(s) misaligned (tolerance: +-${tolerance}f)`);

if (misaligned === 0 && !fixMode) {
  console.log('  AudioSync v2 PASS\n');
  process.exit(0);
}

if (misaligned > 0 && !fixMode) {
  console.log('  AudioSync v2 FAIL -- run with --fix to auto-correct\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fix mode: rewrite durationInFrames in TSX (reverse-index approach)
// ---------------------------------------------------------------------------
if (fixMode) {
  console.log('\n  Applying fixes...');
  let newTsx = tsx;
  for (let i = numPhases - 1; i >= 0; i--) {
    const entry = currentDurations[i];
    const newStr = `TransitionSeries.Sequence durationInFrames={${idealDurations[i]}}`;
    newTsx = newTsx.substring(0, entry.index) + newStr + newTsx.substring(entry.index + entry.fullMatch.length);
  }
  writeFileSync(tsxPath, newTsx);
  console.log(`  Wrote ${numPhases} updated durations to ${tsxPath}\n`);
}
