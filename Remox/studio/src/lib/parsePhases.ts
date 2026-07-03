import type { PhaseRange } from '../types/project';

/**
 * Parse phase frame ranges from a scene TSX source.
 * First tries the standardized header comment format:
 *   // Phase durations: 248+210+228  transitions: 18  total: 1103
 * Falls back to parsing durationInFrames props from TransitionSeries.Sequence elements.
 */
export function parsePhaseRanges(tsxSource: string): PhaseRange[] {
  const durations = parsePhaseDurations(tsxSource);
  if (durations.length === 0) return [];

  const transitionFrames = parseTransitionFrames(tsxSource);
  let startFrame = 0;

  return durations.map((duration, index) => {
    const range: PhaseRange = {
      id: index + 1,
      startFrame,
      endFrame: startFrame + duration - 1,
      duration,
      status: 'pending',
      notes: null,
      reviewedAt: null,
      thumbnailPath: null,
    };
    // Each phase overlaps with the next by transitionFrames
    startFrame += Math.max(duration - transitionFrames, 1);
    return range;
  });
}

export function parsePhaseDurations(tsxSource: string): number[] {
  // Try header comment: // Phase durations: 248+210+228
  const headerMatch = tsxSource.match(/\/\/ Phase durations: ([\d+]+)/);
  if (headerMatch) {
    const durations = headerMatch[1].split('+').map(Number).filter(n => n > 0);
    if (durations.length > 0) return durations;
  }

  // Fallback: parse durationInFrames={NNN} from TransitionSeries.Sequence elements
  const seqMatches = [...tsxSource.matchAll(/durationInFrames=\{(\d+)\}/g)];
  if (seqMatches.length > 0) {
    return seqMatches.map(m => parseInt(m[1])).filter(n => n > 0);
  }

  // Second fallback: count Phase components
  const phaseMatches = [...tsxSource.matchAll(/const Phase(\d+)/g)];
  if (phaseMatches.length > 0) {
    // Can't determine durations without durationInFrames, return zeros
    return phaseMatches.map(() => 0);
  }

  return [];
}

export function parseTransitionFrames(tsxSource: string): number {
  // Try header: // Phase durations: 248+210  transitions: 18
  const match = tsxSource.match(/transitions:\s*(\d+)/);
  if (match) return parseInt(match[1]);

  // Try TransitionSeries timing props
  const timingMatch = tsxSource.match(/linearTiming\(\{[^}]*durationInFrames:\s*(\d+)/);
  if (timingMatch) return parseInt(timingMatch[1]);

  return 18; // Default from LEARNINGS.md
}

export function getPhaseCount(tsxSource: string): number {
  return parsePhaseDurations(tsxSource).length;
}

/**
 * Extract narration text for a phase by finding the Phase component comment
 * and the text content following the phase start marker.
 */
export function extractPhaseNarration(tsxSource: string, phaseId: number): string {
  // Find the Phase N section by looking for the comment marker
  const phasePattern = new RegExp(
    `// Phase ${phaseId}[^\\n]*\\n[\\s\\S]*?(?=// Phase ${phaseId + 1}|$)`,
    'g'
  );
  const match = phasePattern.exec(tsxSource);
  if (!match) return '';

  const phaseBlock = match[0];

  // Find narration text in comments (the quoted text in phase header comments)
  const narrationMatch = phaseBlock.match(/[""]([^""]+)[""]/);
  if (narrationMatch) return narrationMatch[1];

  // Find text content from JSX string children
  const textMatches = [...phaseBlock.matchAll(/>\s*([A-Z][^<>{}\n]{10,})\s*</g)];
  if (textMatches.length > 0) {
    return textMatches.map(m => m[1].trim()).filter(Boolean).join(' ').slice(0, 200);
  }

  return '';
}
