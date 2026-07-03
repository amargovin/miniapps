import type { WhisperJson, WhisperWord } from '../types/project';

export function extractWords(whisperData: WhisperJson): WhisperWord[] {
  if (whisperData.words && whisperData.words.length > 0) {
    return whisperData.words;
  }
  const words: WhisperWord[] = [];
  if (whisperData.segments) {
    for (const seg of whisperData.segments) {
      if (seg.words) words.push(...seg.words);
    }
  }
  return words;
}

/**
 * Get the time range for narration text in a Whisper JSON.
 * Returns { startSeconds, endSeconds } or null if not found.
 */
export function getNarrationTimeRange(
  narrationText: string,
  whisperData: WhisperJson,
): { startSeconds: number; endSeconds: number } | null {
  const words = extractWords(whisperData);
  if (words.length === 0) return null;

  const narrationWords = narrationText
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (narrationWords.length === 0) return null;

  // Find first word match
  let startIdx = -1;
  for (let i = 0; i < Math.min(5, narrationWords.length); i++) {
    const target = narrationWords[i];
    const idx = words.findIndex(w => w.word.toLowerCase().replace(/[^\w]/g, '') === target);
    if (idx !== -1) {
      startIdx = idx;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find last word match
  let endIdx = startIdx;
  for (let i = narrationWords.length - 1; i >= 0; i--) {
    const target = narrationWords[i];
    for (let j = startIdx; j < words.length; j++) {
      if (words[j].word.toLowerCase().replace(/[^\w]/g, '') === target) {
        endIdx = j;
        break;
      }
    }
    if (endIdx > startIdx) break;
  }

  return {
    startSeconds: words[startIdx].start,
    endSeconds: words[endIdx].end + 0.5, // 500ms buffer
  };
}

/**
 * Get audio start time for a phase in seconds.
 * Returns 0 as fallback if Whisper data is unavailable.
 */
export function getPhaseAudioStartSeconds(
  phaseStartFrame: number,
  fps: number,
): number {
  return phaseStartFrame / fps;
}

/**
 * Format seconds as MM:SS.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format frames as "NNN f / N.Ns".
 */
export function formatFrames(frames: number, fps: number): string {
  const secs = (frames / fps).toFixed(1);
  return `${frames}f / ${secs}s`;
}
