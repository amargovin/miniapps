# Font Morphing

Dot-grid text morph: render two words to offscreen canvas, sample pixel positions, spring-interpolate between them.

## Key Patterns

- Render source/target words to `<canvas>` at build time, sample filled pixels as dot coords
- Each dot lerps from source position to target position driven by `spring()`
- Stagger dot animation by index for a wave-like dissolve
- Spring config: low stiffness for organic motion (stiffness:80, damping:20)
- Grid sampling: every Nth pixel to keep dot count manageable (~400 dots)

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate,
} from 'remotion';
import { PALETTE, FONTS } from '../theme';

interface Dot { x: number; y: number }

function sampleTextToDots(
  text: string,
  fontSize: number,
  canvasW: number,
  canvasH: number,
  sampleStep = 8,
): Dot[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW; canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${fontSize}px ${FONTS.headline ?? 'sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasW / 2, canvasH / 2);
  const { data } = ctx.getImageData(0, 0, canvasW, canvasH);
  const dots: Dot[] = [];
  for (let y = 0; y < canvasH; y += sampleStep) {
    for (let x = 0; x < canvasW; x += sampleStep) {
      const alpha = data[(y * canvasW + x) * 4 + 3];
      if (alpha > 128) dots.push({ x, y });
    }
  }
  return dots;
}

const W = 1920; const H = 1080;

// Compute once at module level (runs in browser context during render)
let FROM_DOTS: Dot[] = [];
let TO_DOTS: Dot[] = [];
if (typeof document !== 'undefined') {
  FROM_DOTS = sampleTextToDots('CHINA', 280, W, H);
  TO_DOTS   = sampleTextToDots('INDIA', 280, W, H);
}

// Pad shorter array by repeating last element
function padDots(a: Dot[], b: Dot[]): [Dot[], Dot[]] {
  const len = Math.max(a.length, b.length);
  const pad = (arr: Dot[]) =>
    arr.length < len
      ? [...arr, ...Array(len - arr.length).fill(arr[arr.length - 1])]
      : arr;
  return [pad(a), pad(b)];
}

export const FontMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [from, to] = padDots(FROM_DOTS, TO_DOTS);

  // Morph triggers at frame 30
  const MORPH_START = 30;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg }}>
      {from.map((src, i) => {
        const dst = to[i];
        // Stagger: each dot starts 0–20 frames after MORPH_START
        const stagger = (i / from.length) * 20;
        const progress = spring({
          frame: frame - MORPH_START - stagger,
          fps,
          config: { stiffness: 80, damping: 20, mass: 1 },
        });
        const x = src.x + (dst.x - src.x) * progress;
        const y = src.y + (dst.y - src.y) * progress;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x, top: y,
              width: 4, height: 4,
              borderRadius: '50%',
              background: PALETTE.accent,
              opacity: 0.9,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
```

## Notes

- `sampleStep = 8` gives ~400–600 dots at 280px font — tune for density
- For > 2 words, pre-compute all states and interpolate between consecutive pairs
- Add `scale: 1 + (1 - progress) * 0.3` to dots for a "gather" explosion feel
