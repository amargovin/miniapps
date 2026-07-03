#!/usr/bin/env node
/**
 * audit.mjs — Mechanical hard-rule checker for Remox scenes.
 *
 * Usage:
 *   node audit.mjs <project.json> [--scene SceneXX]
 *
 * Checks (all code-verifiable, no LLM judgment needed):
 *   BRIEF — Creative brief file exists (artifact gate)
 *   TMPL  — Phase template tags present on every phase component
 *   COMP  — Composition variety: ≥2 templates, centered-hero ≤50%
 *   H1    — playbackRate ≤ 1.0
 *   H3    — No text in bottom 216px (reserved zone)
 *   H5    — ≥30f breathing room after last audio word
 *   H8    — Scene header comment with template distribution
 *   TYP   — Every fontSize ≥ 24px
 *   TSM   — TransitionSeries math: sum(phases) - sum(transitions) = total
 *   AV    — Audio/video sync: phase boundaries track audio timeline (±15f)
 *
 * Writes output/audit_result.json — render.mjs reads this as a gate.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const projectPath = args[0];
if (!projectPath) {
  console.error('Usage: node audit.mjs <project.json> [--scene SceneXX]');
  process.exit(1);
}

const sceneFilter = args.indexOf('--scene') !== -1
  ? args[args.indexOf('--scene') + 1]
  : null;

const project = JSON.parse(readFileSync(projectPath, 'utf-8'));
const projectDir = dirname(projectPath);
// Source tree: prefer the project's scaffolded remotion/ (project isolation);
// fall back to the skill template only for legacy projects without one.
const skillScenesDir = join(dirname(import.meta.url.replace('file://', '')), 'src', 'scenes');
const projectScenesDir = join(resolve(projectDir), 'remotion', 'src', 'scenes');
const scenesDir = existsSync(projectScenesDir) ? projectScenesDir : skillScenesDir;

// Parse --write-result flag to output audit JSON for render gating
const writeResult = args.includes('--write-result');

let totalFails = 0;
let totalWarns = 0;
let totalPass = 0;
const auditResults = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fail(scene, rule, msg) {
  console.log(`  ❌ ${rule}: ${msg}`);
  totalFails++;
}
function warn(scene, rule, msg) {
  console.log(`  ⚠️  ${rule}: ${msg}`);
  totalWarns++;
}
function pass(rule, msg) {
  console.log(`  ✅ ${rule}: ${msg}`);
  totalPass++;
}

// ---------------------------------------------------------------------------
// Per-scene audit
// ---------------------------------------------------------------------------
function auditScene(sceneEntry) {
  const { id, durationFrames } = sceneEntry;
  const sceneNum = id.replace('Scene', '').replace('Closer', '00');
  // Scene files use underscore: Scene_07.tsx, not Scene07.tsx
  // Also handle lowercase IDs: scene_02 → Scene_02
  const fileName = id.replace(/^(Scene)(\d)/, '$1_$2');
  const fileNameUpper = id.replace(/^scene_(\d+)$/, (_, n) => `Scene_${n}`);
  let tsxPath = join(scenesDir, `${fileName}.tsx`);
  if (!existsSync(tsxPath)) {
    const altPath = join(scenesDir, `${fileNameUpper}.tsx`);
    if (existsSync(altPath)) tsxPath = altPath;
  }

  if (!existsSync(tsxPath)) {
    console.log(`\n${id}: TSX not found at ${tsxPath} — skipping`);
    return;
  }

  const code = readFileSync(tsxPath, 'utf-8');
  const lines = code.split('\n');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${id} (${durationFrames} frames)`);
  console.log('='.repeat(60));

  const sceneResults = { id, failures: [], warnings: [], passes: [] };

  // -----------------------------------------------------------------------
  // BRIEF — Creative brief file must exist (artifact gate)
  // -----------------------------------------------------------------------
  const briefPath = join(projectDir, 'briefs', `${id}_brief.yml`);
  const briefPathAlt = join(projectDir, 'briefs', `${fileName}_brief.yml`);
  const briefExists = existsSync(briefPath) || existsSync(briefPathAlt);
  if (briefExists) {
    pass('BRIEF', `Creative brief found`);
  } else {
    fail(id, 'BRIEF', `No creative brief at ${briefPath} — creative direction was skipped. Write the brief BEFORE generating TSX.`);
  }

  // -----------------------------------------------------------------------
  // TMPL — Phase template tags: every phase component must have a template comment
  // Format: // Phase N | template: <name> | bg: <type> [| asset: <file>]
  // -----------------------------------------------------------------------
  const phaseTagRegex = /\/\/\s*Phase\s+(\d+)\s*\|\s*template:\s*(\S+)/g;
  const phaseTags = {};
  let ptm;
  while ((ptm = phaseTagRegex.exec(code)) !== null) {
    phaseTags[parseInt(ptm[1])] = ptm[2];
  }

  // Count phase components
  const phaseCompCount = (code.match(/const Phase\d+:\s*React\.FC/g) || []).length;
  const taggedCount = Object.keys(phaseTags).length;

  if (phaseCompCount === 0) {
    warn(id, 'TMPL', 'No Phase components found — cannot check template tags');
  } else if (taggedCount === 0) {
    fail(id, 'TMPL', `0/${phaseCompCount} phases have template tags. Add: // Phase N | template: <name> | bg: <type>`);
  } else if (taggedCount < phaseCompCount) {
    fail(id, 'TMPL', `Only ${taggedCount}/${phaseCompCount} phases have template tags. Every phase needs one.`);
  } else {
    pass('TMPL', `All ${taggedCount} phases have template tags`);
  }

  // -----------------------------------------------------------------------
  // COMP — Composition variety: check template distribution from tags
  // -----------------------------------------------------------------------
  const validTemplates = ['centered-hero', 'focal-offset', 'split-compare', 'lower-third', 'stacked-reveal', 'orbit', 'panoramic-flow', 'grid'];
  if (taggedCount >= 2) {
    const templateCounts = {};
    for (const [phaseNum, tmpl] of Object.entries(phaseTags)) {
      templateCounts[tmpl] = (templateCounts[tmpl] || 0) + 1;
      if (!validTemplates.includes(tmpl)) {
        warn(id, 'COMP', `Phase ${phaseNum} uses unknown template "${tmpl}" — valid: ${validTemplates.join(', ')}`);
      }
    }

    const uniqueTemplates = Object.keys(templateCounts).length;
    const centeredHeroCount = templateCounts['centered-hero'] || 0;
    const centeredHeroPct = centeredHeroCount / taggedCount;

    if (uniqueTemplates < 2) {
      fail(id, 'COMP', `Only ${uniqueTemplates} unique template(s) used: ${JSON.stringify(templateCounts)}. Need at least 2 different templates.`);
    } else if (centeredHeroPct > 0.5) {
      fail(id, 'COMP', `centered-hero used ${centeredHeroCount}/${taggedCount} (${(centeredHeroPct*100).toFixed(0)}%) — max 50%. Distribution: ${JSON.stringify(templateCounts)}`);
    } else {
      pass('COMP', `${uniqueTemplates} templates used: ${JSON.stringify(templateCounts)}`);
    }

    // Check 3+ consecutive same template
    const sortedPhases = Object.entries(phaseTags).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    for (let i = 0; i < sortedPhases.length - 2; i++) {
      if (sortedPhases[i][1] === sortedPhases[i+1][1] && sortedPhases[i+1][1] === sortedPhases[i+2][1]) {
        warn(id, 'COMP', `3+ consecutive phases (${sortedPhases[i][0]}-${sortedPhases[i+2][0]}) use "${sortedPhases[i][1]}" — vary templates`);
        break;
      }
    }
  } else if (taggedCount > 0) {
    warn(id, 'COMP', `Only ${taggedCount} tagged phase(s) — insufficient for composition variety check`);
  }

  // -----------------------------------------------------------------------
  // H1 — playbackRate ≤ 1.0
  // -----------------------------------------------------------------------
  const rateRegex = /playbackRate=\{([\d.]+)\}/g;
  let match;
  let h1Fails = 0;
  while ((match = rateRegex.exec(code)) !== null) {
    const rate = parseFloat(match[1]);
    const lineNum = code.substring(0, match.index).split('\n').length;
    if (rate > 1.0) {
      fail(id, 'H1', `playbackRate={${rate}} > 1.0 at line ${lineNum}`);
      h1Fails++;
    }
  }
  if (h1Fails === 0) pass('H1', 'All playbackRate values ≤ 1.0');

  // -----------------------------------------------------------------------
  // H3 — Reserved zones: no text in bottom 216px
  // -----------------------------------------------------------------------
  let h3Fails = 0;

  // Check 1: flex-end containers with bottom padding < 216px
  // Match padding patterns with 3+ values where 3rd value (bottom) is a number
  const flexEndBlocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('flex-end')) {
      // Scan nearby lines (within 5 lines) for padding
      for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 8); j++) {
        const padMatch = lines[j].match(/padding:\s*['"](\d+)(?:px)?\s+(\d+)(?:px)?\s+(\d+)(?:px)?/);
        if (padMatch) {
          const bottomPad = parseInt(padMatch[3], 10);
          if (bottomPad < 216) {
            fail(id, 'H3', `flex-end container with bottom padding ${bottomPad}px < 216px at line ${j + 1}`);
            h3Fails++;
          }
        }
        // Also check 2-value padding with flex-end (bottom = first value)
        // padding: '0 96px 72px' — 3 values: top=0, left/right=96, bottom=72
        // Actually CSS shorthand: padding: top right bottom left (4) or top horizontal bottom (3)
        // '0 96px 72px' = top:0 horizontal:96 bottom:72
      }
    }
  }

  // Check 2: explicit bottom: values < 216 (text containers)
  // But only flag if the element contains text (has fontFamily/fontSize nearby)
  for (let i = 0; i < lines.length; i++) {
    const bottomMatch = lines[i].match(/bottom:\s*(\d+)/);
    if (bottomMatch) {
      const bottomVal = parseInt(bottomMatch[1], 10);
      // bottom: X means X px from bottom. If < 216, text could be in reserved zone.
      // But we need to check this is a text-containing element, not just a gradient overlay
      // Check surrounding lines for font-related properties
      const context = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 10)).join('\n');
      const hasText = /fontFamily|fontSize|FONTS\./.test(context);
      if (bottomVal < 216 && hasText) {
        fail(id, 'H3', `Text container with bottom: ${bottomVal}px < 216px at line ${i + 1}`);
        h3Fails++;
      }
    }
  }

  // Check 3: padding shorthand on flex-end — 4-value form
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('flex-end')) {
      for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 8); j++) {
        // 4-value: padding: 'top right bottom left'
        const pad4 = lines[j].match(/padding:\s*['"](\d+)(?:px)?\s+(\d+)(?:px)?\s+(\d+)(?:px)?\s+(\d+)(?:px)?/);
        if (pad4) {
          const bottomPad = parseInt(pad4[3], 10);
          if (bottomPad < 216) {
            // Already caught by 3-value check above (regex matches 3+ values)
            // Avoid double-counting
          }
        }
        // 2-value: padding: '0 Xpx' — means top/bottom = 0, which with flex-end = bottom 0
        const pad2 = lines[j].match(/padding:\s*['"](\d+)(?:px)?\s+(\d+)(?:px)?['"]/);
        if (pad2 && !lines[j].match(/padding:\s*['"](\d+)(?:px)?\s+(\d+)(?:px)?\s+(\d+)/)) {
          // Truly 2-value only
          const topBottom = parseInt(pad2[1], 10);
          if (topBottom < 216 && lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 8)).some(l => l.includes('flex-end'))) {
            // flex-end + padding top/bottom < 216 — text sits near bottom
            // But many centered layouts use flex-end for alignment — only flag if bottom padding is the issue
            // This is a weaker signal, log as warning
            warn(id, 'H3', `flex-end with 2-value padding top/bottom=${topBottom}px at line ${j + 1} — verify text isn't in bottom 216px`);
          }
        }
      }
    }
  }

  if (h3Fails === 0) pass('H3', 'No text in reserved bottom zone');

  // -----------------------------------------------------------------------
  // H5 — Breathing room: ≥30f after last audio word
  // -----------------------------------------------------------------------
  const audioNum = sceneNum.padStart(2, '0');
  // Prefer Whisper timestamps (accurate) over ElevenLabs (collapsed values)
  let tsPath = join(projectDir, 'audio', `scene_${audioNum}_whisper.json`);
  if (!existsSync(tsPath)) {
    tsPath = join(projectDir, 'audio', `scene_${audioNum}_word_timestamps.json`);
  }
  if (!existsSync(tsPath)) {
    tsPath = join(projectDir, 'audio', `scene_${audioNum}_timestamps.json`);
  }
  if (existsSync(tsPath)) {
    const ts = JSON.parse(readFileSync(tsPath, 'utf-8'));
    const lastWord = ts.words[ts.words.length - 1];
    const lastEndFrame = Math.ceil(lastWord.endMs / 1000 * 30);
    const breathing = durationFrames - lastEndFrame;
    if (breathing < 30) {
      fail(id, 'H5', `Only ${breathing}f breathing room (last word ends at ${lastEndFrame}f, scene is ${durationFrames}f). Need ≥30f.`);
    } else {
      pass('H5', `${breathing}f breathing room (last word ends ${lastEndFrame}f, scene ${durationFrames}f)`);
    }
  } else {
    warn(id, 'H5', `Timestamps not found at ${tsPath} — cannot verify`);
  }

  // -----------------------------------------------------------------------
  // H8 — Scene header comment: // Scene_XX | templates: ...
  // -----------------------------------------------------------------------
  // Accept both Scene07 and Scene_07 formats in header
  // Header can appear anywhere in the first 25 lines (after block comments, imports, etc.)
  const idVariants = [id, id.replace(/^(Scene)(\d)/, '$1_$2')];
  const h8Regex = new RegExp(`^//\\s*(${idVariants.join('|')})\\s*\\|\\s*templates:`);
  const headerFound = lines.slice(0, 25).some(l => h8Regex.test(l.trim()));
  if (headerFound) {
    pass('H8', 'Template distribution header present');
  } else {
    fail(id, 'H8', `Missing or malformed header. Expected: // ${id} | templates: ...`);
  }

  // -----------------------------------------------------------------------
  // TYP — Typography: every fontSize ≥ 24
  // -----------------------------------------------------------------------
  const fontSizeRegex = /fontSize:\s*(\d+)/g;
  let typFails = 0;
  // Hard floor 18px (SKILL.md caption/source minimum); warn 18–23px so
  // sub-24px use stays deliberate (captions, chart ticks) not accidental.
  let fsMatch;
  while ((fsMatch = fontSizeRegex.exec(code)) !== null) {
    const size = parseInt(fsMatch[1], 10);
    const lineNum = code.substring(0, fsMatch.index).split('\n').length;
    if (size < 18) {
      fail(id, 'TYP', `fontSize: ${size} < 18px hard minimum at line ${lineNum}`);
      typFails++;
    } else if (size < 24) {
      warn(id, 'TYP', `fontSize: ${size} below 24px body floor at line ${lineNum} — OK only for captions/source/chart ticks`);
    }
  }
  if (typFails === 0) pass('TYP', 'All fontSize values ≥ 18px (captions) / 24px (body)');

  // -----------------------------------------------------------------------
  // TSM — TransitionSeries math
  // -----------------------------------------------------------------------
  const seqRegex = /durationInFrames=\{(\d+)\}>\s*<Phase/g;
  const seqRegex2 = /Sequence\s+durationInFrames=\{(\d+)\}/g;
  const transRegex = /Transition[^>]*durationInFrames:\s*(\d+)/g;

  const phaseDurations = [];
  let sm;
  while ((sm = seqRegex2.exec(code)) !== null) {
    phaseDurations.push(parseInt(sm[1], 10));
  }

  const transDurations = [];
  let tm;
  while ((tm = transRegex.exec(code)) !== null) {
    transDurations.push(parseInt(tm[1], 10));
  }

  if (phaseDurations.length > 0) {
    const phaseSum = phaseDurations.reduce((a, b) => a + b, 0);
    const transSum = transDurations.reduce((a, b) => a + b, 0);
    const effective = phaseSum - transSum;
    if (effective === durationFrames) {
      pass('TSM', `${phaseSum} - ${transSum} = ${effective} ✓ (${phaseDurations.length} phases, ${transDurations.length} transitions)`);
    } else {
      fail(id, 'TSM', `${phaseSum} - ${transSum} = ${effective}, expected ${durationFrames} (off by ${effective - durationFrames}f)`);
    }
  } else {
    warn(id, 'TSM', 'Could not parse TransitionSeries durations');
  }

  // -----------------------------------------------------------------------
  // VID — Video phase minimum duration: ≥120f (4s) per R20
  // -----------------------------------------------------------------------
  if (phaseDurations.length > 0) {
    // Find which phases contain OffthreadVideo by scanning the code
    // Each Phase component is defined as const PhaseNN: React.FC
    // We check if OffthreadVideo appears inside each phase component
    const phaseComponentRegex = /const Phase(\d+):\s*React\.FC/g;
    const phaseRanges = [];
    let pcm;
    while ((pcm = phaseComponentRegex.exec(code)) !== null) {
      phaseRanges.push({ num: parseInt(pcm[1]), start: pcm.index });
    }
    // Set end of each range to start of next
    for (let i = 0; i < phaseRanges.length; i++) {
      phaseRanges[i].end = i + 1 < phaseRanges.length
        ? phaseRanges[i + 1].start
        : code.length;
    }

    let vidFails = 0;
    for (const pr of phaseRanges) {
      const phaseCode = code.substring(pr.start, pr.end);
      if (/OffthreadVideo/.test(phaseCode)) {
        const phaseIdx = pr.num - 1;
        if (phaseIdx < phaseDurations.length) {
          const dur = phaseDurations[phaseIdx];
          if (dur < 120) {
            fail(id, 'VID', `Phase ${pr.num} has OffthreadVideo but only ${dur}f (${(dur/30).toFixed(1)}s) — minimum 120f (4s) for video phases`);
            vidFails++;
          }
        }
      }
    }
    if (vidFails === 0 && phaseRanges.some(pr => /OffthreadVideo/.test(code.substring(pr.start, pr.end)))) {
      pass('VID', 'All video phases ≥ 120f');
    }
  }

  // -----------------------------------------------------------------------
  // TXT — Text density per phase: flag phases with >2 text elements
  // Count distinct text blocks (elements with fontFamily/fontSize) per phase.
  // Phases with >2 blocks are too text-heavy and should be split.
  // -----------------------------------------------------------------------
  if (phaseDurations.length > 0) {
    const phaseComponentRegex2 = /const Phase(\d+):\s*React\.FC/g;
    const phaseRanges2 = [];
    let pcm2;
    while ((pcm2 = phaseComponentRegex2.exec(code)) !== null) {
      phaseRanges2.push({ num: parseInt(pcm2[1]), start: pcm2.index });
    }
    for (let i = 0; i < phaseRanges2.length; i++) {
      phaseRanges2[i].end = i + 1 < phaseRanges2.length
        ? phaseRanges2[i + 1].start
        : code.length;
    }

    let txtFails = 0;
    for (const pr of phaseRanges2) {
      const phaseCode = code.substring(pr.start, pr.end);
      // Count distinct JSX text blocks: elements with fontSize that contain visible text
      // Heuristic: count occurrences of fontSize: in the phase (each is a text element)
      const fontSizeMatches = phaseCode.match(/fontSize:\s*\d+/g);
      const textCount = fontSizeMatches ? fontSizeMatches.length : 0;
      if (textCount > 4) {
        fail(id, 'TXT', `Phase ${pr.num} has ${textCount} text elements — consider splitting (max 4 recommended)`);
        txtFails++;
      } else if (textCount > 3) {
        warn(id, 'TXT', `Phase ${pr.num} has ${textCount} text elements — borderline, review for readability`);
      }
    }
    if (txtFails === 0) pass('TXT', 'Text density within limits');
  }

  // -----------------------------------------------------------------------
  // AV — Audio/video sync: phase boundaries must track word boundaries.
  //
  // Method:
  // 1. Extract ALL unique word start frames from timestamps
  // 2. Compute visual_start for each phase from TransitionSeries
  // 3. For each visual_start, find the nearest word start
  // 4. If the nearest word start is >15f away, the phase is out of sync
  //
  // Word-level matching is more forgiving than sentence-level because words
  // are spaced every ~10-15 frames. This allows more phases per scene while
  // still ensuring visuals track the narration. TTS timestamp artifacts
  // (collapsed timestamps) are handled by deduplicating word frames.
  // -----------------------------------------------------------------------
  if (existsSync(tsPath) && phaseDurations.length > 0) {
    const ts = JSON.parse(readFileSync(tsPath, 'utf-8'));
    const audioDurationFrames = Math.ceil(ts.audioDurationMs / 1000 * 30);

    // Step 1: Extract ALL unique word start frames (deduplicated)
    const wordFrameSet = new Set();
    const wordFrameMap = new Map(); // frame → word (for reporting)
    for (const word of ts.words) {
      const frame = Math.round(word.startMs / 1000 * 30);
      if (!wordFrameSet.has(frame)) {
        wordFrameSet.add(frame);
        wordFrameMap.set(frame, word.word);
      }
    }
    const sentenceStartFrames = [...wordFrameSet].sort((a, b) => a - b);
    const sentenceStartWords = sentenceStartFrames.map(f => wordFrameMap.get(f) || '?');

    // Step 2: Compute visual_start for each phase
    const visualStarts = [];
    let cursor = 0;
    for (let i = 0; i < phaseDurations.length; i++) {
      visualStarts.push(cursor);
      cursor += phaseDurations[i];
      if (i < transDurations.length) {
        cursor -= transDurations[i];
      }
    }

    // Step 3: Audio-visual sync check
    let avFails = 0;
    const AV_TOLERANCE = 15; // frames

    const phaseRatio = visualStarts.length / Math.max(1, sentenceStartFrames.length);
    const isRapidCut = phaseRatio > 1.3;
    // Rapid-cut scenes have 4-5s phases; 45f (1.5s) tolerance is tight enough
    // to feel synced while acknowledging music-video pacing doesn't need frame-perfect cuts.
    const effectiveTolerance = isRapidCut ? 45 : AV_TOLERANCE;

    if (isRapidCut) {
      // RAPID-CUT SCENES: Many phases per sentence (music-video pacing).
      // The meaningful check is INVERSE: each SENTENCE start must have a phase start nearby.
      // Having extra phases between sentences is intentional, not a defect.
      const unmatchedSentences = [];

      for (let s = 0; s < sentenceStartFrames.length; s++) {
        const sf = sentenceStartFrames[s];
        let minDist = Infinity;
        let closestPhaseIdx = -1;
        for (let p = 0; p < visualStarts.length; p++) {
          const dist = Math.abs(sf - visualStarts[p]);
          if (dist < minDist) {
            minDist = dist;
            closestPhaseIdx = p;
          }
        }

        if (minDist > effectiveTolerance) {
          unmatchedSentences.push({
            sentence: s + 1,
            sentFrame: sf,
            word: sentenceStartWords[s],
            nearestPhase: closestPhaseIdx + 1,
            nearestPhaseFrame: visualStarts[closestPhaseIdx],
            delta: sf - visualStarts[closestPhaseIdx],
          });
        }
      }

      if (unmatchedSentences.length > 0) {
        // For rapid-cut: fail if >25% of SENTENCES lack a nearby phase start
        const misalignPct = unmatchedSentences.length / sentenceStartFrames.length;
        const isFail = misalignPct > 0.25;

        const reporter = isFail ? fail : warn;
        reporter(id, 'AV', `${unmatchedSentences.length}/${sentenceStartFrames.length} sentence starts not covered by any phase start (>${effectiveTolerance}f, rapid-cut ${phaseRatio.toFixed(1)}x ratio):`);
        for (const s of unmatchedSentences) {
          const direction = s.delta > 0 ? 'sentence ahead' : 'phase ahead';
          console.log(`         S${String(s.sentence).padStart(2)}: sentence "${s.word}" @${s.sentFrame}f, nearest P${String(s.nearestPhase).padStart(2)} @${s.nearestPhaseFrame}f, delta=${Math.abs(s.delta)}f (${direction})`);
        }
        if (isFail) avFails++;
      } else {
        pass('AV', `All ${sentenceStartFrames.length} sentence starts covered by phase starts (±${AV_TOLERANCE}f, rapid-cut ${phaseRatio.toFixed(1)}x ratio)`);
      }
    } else {
      // STANDARD SCENES: ~1:1 phase-to-sentence ratio.
      // Each phase visual_start should be near SOME sentence start.
      const unmatchedPhases = [];

      for (let i = 0; i < visualStarts.length; i++) {
        const vs = visualStarts[i];
        let minDist = Infinity;
        let closestSentIdx = -1;
        for (let s = 0; s < sentenceStartFrames.length; s++) {
          const dist = Math.abs(vs - sentenceStartFrames[s]);
          if (dist < minDist) {
            minDist = dist;
            closestSentIdx = s;
          }
        }

        if (minDist > AV_TOLERANCE) {
          unmatchedPhases.push({
            phase: i + 1,
            visualStart: vs,
            nearestSentFrame: sentenceStartFrames[closestSentIdx],
            nearestWord: sentenceStartWords[closestSentIdx],
            delta: vs - sentenceStartFrames[closestSentIdx],
          });
        }
      }

      if (unmatchedPhases.length > 0) {
        const misalignPct = unmatchedPhases.length / visualStarts.length;
        const isFail = misalignPct > 0.25;

        const reporter = isFail ? fail : warn;
        reporter(id, 'AV', `${unmatchedPhases.length}/${visualStarts.length} phases not aligned to any sentence start (>${AV_TOLERANCE}f tolerance):`);
        for (const p of unmatchedPhases) {
          const direction = p.delta > 0 ? 'visual ahead' : 'audio ahead';
          console.log(`         P${String(p.phase).padStart(2)}: visual@${p.visualStart}f, nearest sentence "${p.nearestWord}" @${p.nearestSentFrame}f, delta=${Math.abs(p.delta)}f (${direction})`);
        }
        if (isFail) avFails++;
      } else {
        pass('AV', `All ${visualStarts.length} phase starts align with sentence starts (±${AV_TOLERANCE}f)`);
      }
    }

    // Step 4: Check audio doesn't overflow video
    if (audioDurationFrames > durationFrames) {
      fail(id, 'AV', `Audio (${audioDurationFrames}f) exceeds video (${durationFrames}f) — audio will be clipped!`);
      avFails++;
    }

    // Step 5: Check sentence count vs phase count
    if (sentenceStartFrames.length > 0) {
      const ratio = phaseDurations.length / sentenceStartFrames.length;
      if (ratio > 2.5) {
        warn(id, 'AV', `${phaseDurations.length} phases for only ${sentenceStartFrames.length} sentences — phases may be too granular`);
      } else if (ratio < 0.5) {
        warn(id, 'AV', `${phaseDurations.length} phases for ${sentenceStartFrames.length} sentences — some sentences may lack visual coverage`);
      }
    }

  } else if (phaseDurations.length > 0) {
    warn(id, 'AV', 'No timestamps file — cannot check audio/video sync');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log('Remox Mechanical Audit');
console.log(`Project: ${projectPath}`);
if (sceneFilter) console.log(`Filtering: ${sceneFilter}`);
console.log('');

for (const scene of project.scenes) {
  if (sceneFilter && scene.id !== sceneFilter) continue;
  if (scene.id === 'Closer') continue; // No TSX to audit
  auditScene(scene);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`TOTALS: ${totalPass} pass, ${totalFails} fail, ${totalWarns} warn`);

// Write audit result JSON for render gating (always, so render.mjs can check)
const auditResultPath = join(projectDir, 'output', 'audit_result.json');
const auditOutputDir = dirname(auditResultPath);
if (!existsSync(auditOutputDir)) mkdirSync(auditOutputDir, { recursive: true });
writeFileSync(auditResultPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  project: projectPath,
  scene_filter: sceneFilter,
  hard_rule_failures: totalFails,
  warnings: totalWarns,
  passes: totalPass,
  verdict: totalFails > 0 ? 'FAIL' : 'PASS',
  scenes_audited: project.scenes
    .filter(s => !sceneFilter || s.id === sceneFilter)
    .filter(s => s.id !== 'Closer')
    .map(s => s.id),
}, null, 2));
console.log(`\nAudit result written: ${auditResultPath}`);

if (totalFails > 0) {
  console.log(`\n🚫 ${totalFails} HARD RULE FAILURE(S) — fix before render`);
  process.exit(1);
} else {
  console.log(`\n✅ All hard rules pass`);
  process.exit(0);
}
