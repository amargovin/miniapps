import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Typewriter Glow: text types out character by character with blinking cursor.
// After typing completes, key words get highlight glow crossfade.
// Typing speed: ~3 chars per frame. Cursor blinks at 2Hz.

const FULL_TEXT = 'India imports 77% of its battery cells from China, making every electric vehicle an extension of Chinese manufacturing.';

// Words to highlight after typing completes (zero-indexed positions in FULL_TEXT.split(' '))
const HIGHLIGHT_WORDS = new Set(['77%', 'China,', 'Chinese']);

const CHARS_PER_FRAME = 3;
const TYPING_START    = 8;  // frame when typing begins

// Frame at which typing completes
const TYPING_DONE_FRAME = TYPING_START + Math.ceil(FULL_TEXT.length / CHARS_PER_FRAME);

// Highlight animation starts after a short pause post-typing
const HIGHLIGHT_START = TYPING_DONE_FRAME + 15;

// Cursor blink: 2Hz = 1 cycle per 15 frames at 30fps
function getCursorOpacity(frame: number, typingDone: boolean): number {
  // After typing is done, cursor blinks 3 times then disappears
  if (typingDone) {
    const blinkFrame = frame - TYPING_DONE_FRAME;
    if (blinkFrame > 90) return 0; // disappears after 3 seconds
    return blinkFrame % 15 < 8 ? 1 : 0;
  }
  // While typing: cursor is always visible
  return 1;
}

export default function TypewriterGlow() {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // How many characters are visible
  const charsVisible = Math.min(
    Math.max(0, (frame - TYPING_START) * CHARS_PER_FRAME),
    FULL_TEXT.length
  );

  const typingDone = charsVisible >= FULL_TEXT.length;

  // Cursor visibility
  const cursorOpacity = getCursorOpacity(frame, typingDone);

  // Highlight fade-in progress (0 → 1)
  const highlightProgress = interpolate(
    frame,
    [HIGHLIGHT_START, HIGHLIGHT_START + 25],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Split visible text into words for rendering
  // We need to track cumulative char position to respect charsVisible
  const words     = FULL_TEXT.split(' ');
  let charCount   = 0;
  const renderedWords: { word: string; visible: boolean; partial: string; isHighlight: boolean }[] = [];

  for (const word of words) {
    const wordWithSpace = word + ' ';
    const startPos      = charCount;
    const endPos        = charCount + wordWithSpace.length;

    if (startPos >= charsVisible) {
      // Word hasn't appeared yet
      renderedWords.push({ word, visible: false, partial: '', isHighlight: false });
    } else if (endPos <= charsVisible) {
      // Full word visible
      renderedWords.push({ word, visible: true, partial: word, isHighlight: HIGHLIGHT_WORDS.has(word) });
    } else {
      // Partial word
      const visibleChars = charsVisible - startPos;
      renderedWords.push({ word, visible: true, partial: wordWithSpace.slice(0, visibleChars), isHighlight: false });
    }

    charCount += wordWithSpace.length;
  }

  // Global fade-in
  const sceneOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  const highlightColor = PALETTE.accent?.[0] ?? '#4fc3f7';

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.background ?? '#0a0a14',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '0 120px',
        opacity:    sceneOpacity,
      }}
    >
      <div
        style={{
          maxWidth:   900,
          fontFamily: FONTS?.body ?? 'serif',
          fontSize:   44,
          fontWeight: 400,
          color:      PALETTE.primary ?? '#ffffff',
          lineHeight: 1.55,
          letterSpacing: '0.3px',
        }}
      >
        {renderedWords.map(({ word, visible, partial, isHighlight }, wi) => {
          if (!visible) return null;

          // Highlight effect: background glow crossfade on key words
          const showHighlight = isHighlight && typingDone;
          const glowOpacity   = showHighlight ? highlightProgress : 0;

          return (
            <span
              key={wi}
              style={{
                position:        'relative',
                display:         'inline',
                // Background glow effect using box-shadow on a pseudo via inline style trick
                background:      showHighlight
                  ? `rgba(${hexToRgb(highlightColor)}, ${glowOpacity * 0.22})`
                  : 'transparent',
                color:           showHighlight
                  ? `rgba(${hexToRgb(highlightColor)}, ${0.6 + glowOpacity * 0.4})`
                  : (PALETTE.primary ?? '#ffffff'),
                fontWeight:      showHighlight ? 700 : 400,
                padding:         showHighlight ? '2px 4px' : undefined,
                borderRadius:    showHighlight ? 4 : undefined,
                // Text shadow for glow
                textShadow:      showHighlight
                  ? `0 0 20px rgba(${hexToRgb(highlightColor)}, ${glowOpacity * 0.7})`
                  : 'none',
                transition:      'none',
              }}
            >
              {partial}{' '}
            </span>
          );
        })}

        {/* Blinking cursor */}
        <span
          style={{
            display:         'inline-block',
            width:           3,
            height:          '0.85em',
            background:      PALETTE.accent?.[0] ?? '#4fc3f7',
            verticalAlign:   'middle',
            opacity:         cursorOpacity,
            marginLeft:      2,
            borderRadius:    1,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// Helper: convert hex color to RGB string for use in rgba()
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
