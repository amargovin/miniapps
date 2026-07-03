import type { PhaseChecklist, WhisperJson, WhisperWord } from '../types/project';

// ─── AV Sync Check ────────────────────────────────────────────────────────

export function checkAvSync(
  phaseStartFrame: number,
  narrationText: string,
  whisperData: WhisperJson | null,
  fps: number,
): { status: 'pass' | 'warn' | 'fail' | 'unknown'; driftFrames: number; tooltip: string } {
  if (!whisperData || !narrationText) {
    return { status: 'unknown', driftFrames: 0, tooltip: 'Cannot verify — no Whisper data or narration text' };
  }

  const words = extractWords(whisperData);
  if (words.length === 0) {
    return { status: 'unknown', driftFrames: 0, tooltip: 'Cannot verify — Whisper data has no words' };
  }

  // Find first significant word of narration in Whisper output
  const firstWord = findFirstNarrationWord(narrationText, words);
  if (!firstWord) {
    return { status: 'unknown', driftFrames: 0, tooltip: 'Cannot verify — narration text not found in Whisper timestamps' };
  }

  const whisperStartFrame = Math.round((firstWord.start * 1000) / 1000 * fps);
  const drift = Math.abs(phaseStartFrame - whisperStartFrame);

  if (drift <= 15) {
    return { status: 'pass', driftFrames: drift, tooltip: `AV sync: ${drift} frame drift (${Math.round(drift / fps * 1000)}ms)` };
  } else if (drift <= 30) {
    return { status: 'warn', driftFrames: drift, tooltip: `AV sync: ${drift} frame drift — moderate (${Math.round(drift / fps * 1000)}ms)` };
  } else {
    return { status: 'fail', driftFrames: drift, tooltip: `AV sync: ${drift} frame drift — too large (${Math.round(drift / fps * 1000)}ms)` };
  }
}

function extractWords(whisperData: WhisperJson): WhisperWord[] {
  if (whisperData.words && whisperData.words.length > 0) return whisperData.words;
  const words: WhisperWord[] = [];
  if (whisperData.segments) {
    for (const seg of whisperData.segments) {
      if (seg.words) words.push(...seg.words);
    }
  }
  return words;
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^\w]/g, '');
}

function findFirstNarrationWord(narration: string, words: WhisperWord[]): WhisperWord | null {
  const narrationWords = narration.split(/\s+/).map(normalizeWord).filter(w => w.length > 2);
  if (narrationWords.length === 0) return null;

  for (let i = 0; i < Math.min(3, narrationWords.length); i++) {
    const target = narrationWords[i];
    const match = words.find(w => normalizeWord(w.word) === target);
    if (match) return match;
  }
  return null;
}

// ─── Text Placement Check ─────────────────────────────────────────────────

export function checkTextPlacement(tsxSource: string): {
  status: 'pass' | 'fail';
  violations: string[];
  tooltip: string;
} {
  const violations: string[] = [];

  // Pattern 1: bottom values in subtitle zone (bottom < 216 = bottom 20% of 1080px)
  const bottomMatches = [...tsxSource.matchAll(/bottom:\s*['"]?(\d+(?:\.\d+)?)/g)];
  for (const m of bottomMatches) {
    const val = parseFloat(m[1]);
    if (val < 216) {
      violations.push(`bottom: ${val} (subtitle zone — must be > 216)`);
    }
  }

  // Pattern 2: top+right combination (logo zone: top < 200 AND right < 300)
  const positionMatches = [...tsxSource.matchAll(/top:\s*['"]?(\d+)['"']?[^}]*right:\s*['"]?(\d+)/g)];
  for (const m of positionMatches) {
    if (parseInt(m[1]) < 200 && parseInt(m[2]) < 300) {
      violations.push(`Logo zone violation: top:${m[1]} right:${m[2]}`);
    }
  }

  // Pattern 3: alignItems flex-end (LEARNINGS §9 CSS trap)
  if (/alignItems:\s*['"]flex-end['"]/.test(tsxSource)) {
    violations.push('alignItems: flex-end — text will render at bottom of container');
  }

  if (violations.length === 0) {
    return { status: 'pass', violations: [], tooltip: 'Text placement OK' };
  }
  return {
    status: 'fail',
    violations,
    tooltip: `Text placement violations:\n${violations.join('\n')}`,
  };
}

// ─── Show-Don't-Tell Check ────────────────────────────────────────────────

const TEXT_ONLY_TREATMENTS = new Set(['KT-navy', 'NAVY-SLAM', 'STAT-cream', 'KT-cream']);

export function checkShowDontTell(
  tsxSource: string,
  phaseId: number,
  treatmentType: string | null,
): { status: 'pass' | 'warn'; tooltip: string } {
  if (treatmentType && TEXT_ONLY_TREATMENTS.has(treatmentType)) {
    return { status: 'pass', tooltip: 'Text-only treatment — show-don\'t-tell check skipped' };
  }

  // Extract phase block
  const phaseBlock = extractPhaseBlock(tsxSource, phaseId);

  // Count text content
  const textMatches = [...phaseBlock.matchAll(/>\s*([A-Za-z][^<>{}\n]{5,})\s*</g)];
  const totalWords = textMatches.reduce((sum, m) => sum + m[1].trim().split(/\s+/).length, 0);

  // Check for media assets
  const hasMedia = /staticFile\(['"][^'"]+\.(png|jpg|jpeg|mp4|webm)/.test(phaseBlock) ||
    /OffthreadVideo/.test(phaseBlock) ||
    /<Img/.test(phaseBlock);

  if (totalWords > 20 && !hasMedia) {
    return {
      status: 'warn',
      tooltip: `High word count (${totalWords} words) without image/video asset — verify this is intentional`,
    };
  }
  return { status: 'pass', tooltip: `Show-don't-tell OK (${totalWords} words, hasMedia: ${hasMedia})` };
}

// ─── Font Size Check ──────────────────────────────────────────────────────

export function checkFontSize(tsxSource: string): {
  status: 'pass' | 'warn' | 'fail';
  violations: string[];
  tooltip: string;
} {
  const violations: string[] = [];
  const fontSizeMatches = [...tsxSource.matchAll(/fontSize:\s*(\d+)/g)];

  for (const m of fontSizeMatches) {
    const size = parseInt(m[1]);
    // Find context (5 lines before/after)
    const idx = m.index || 0;
    const context = tsxSource.slice(Math.max(0, idx - 200), idx + 200);
    const isCaption = /[Ss]ource:|caption|credit/i.test(context);

    if (!isCaption) {
      if (size < 18) {
        violations.push(`fontSize: ${size} — too small (minimum 18px for captions, 28px for content)`);
      } else if (size < 28) {
        violations.push(`fontSize: ${size} — below 28px minimum for content text`);
      }
    }
  }

  if (violations.length === 0) {
    return { status: 'pass', violations: [], tooltip: 'Font sizes OK' };
  }
  const worst = violations.some(v => v.includes('too small')) ? 'fail' : 'warn';
  return { status: worst, violations, tooltip: violations.join('\n') };
}

// ─── Variety Check ────────────────────────────────────────────────────────

export function checkVariety(treatments: (string | null)[]): {
  hasViolation: boolean;
  violatingRanges: Array<{ start: number; end: number; type: string }>;
  tooltip: string;
} {
  const violatingRanges: Array<{ start: number; end: number; type: string }> = [];
  let runStart = 0;
  let runType = treatments[0];
  let runLength = 1;

  for (let i = 1; i < treatments.length; i++) {
    if (treatments[i] === runType) {
      runLength++;
    } else {
      if (runLength >= 3 && runType) {
        violatingRanges.push({ start: runStart, end: i - 1, type: runType });
      }
      runStart = i;
      runType = treatments[i];
      runLength = 1;
    }
  }
  if (runLength >= 3 && runType) {
    violatingRanges.push({ start: runStart, end: treatments.length - 1, type: runType });
  }

  return {
    hasViolation: violatingRanges.length > 0,
    violatingRanges,
    tooltip: violatingRanges.length > 0
      ? `Treatment variety violation: ${violatingRanges.map(r => `${r.type} repeated at phases ${r.start + 1}-${r.end + 1}`).join(', ')}`
      : 'Treatment variety OK',
  };
}

// ─── Run All Checks ───────────────────────────────────────────────────────

export function runPhaseChecks(
  tsxSource: string,
  phaseId: number,
  phaseStartFrame: number,
  narrationText: string,
  treatmentType: string | null,
  whisperData: WhisperJson | null,
  fps: number,
): PhaseChecklist {
  const avSync = checkAvSync(phaseStartFrame, narrationText, whisperData, fps);
  const textPlacement = checkTextPlacement(tsxSource);
  const showDontTell = checkShowDontTell(tsxSource, phaseId, treatmentType);
  const fontSize = checkFontSize(tsxSource);

  return {
    avSync: avSync.status,
    textPlacement: textPlacement.status === 'pass' ? 'pass' : 'fail',
    showDontTell: showDontTell.status,
    fontSize: fontSize.status,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractPhaseBlock(tsxSource: string, phaseId: number): string {
  const start = tsxSource.indexOf(`const Phase${phaseId}:`);
  if (start === -1) return tsxSource; // Can't isolate — check full source

  const nextPhase = tsxSource.indexOf(`const Phase${phaseId + 1}:`, start + 1);
  return nextPhase === -1 ? tsxSource.slice(start) : tsxSource.slice(start, nextPhase);
}

export function getCheckIcon(status: string): { icon: string; color: string } {
  switch (status) {
    case 'pass': return { icon: '✓', color: 'text-green-400' };
    case 'warn': return { icon: '!', color: 'text-yellow-400' };
    case 'fail': return { icon: '✗', color: 'text-red-400' };
    default: return { icon: '?', color: 'text-gray-400' };
  }
}
