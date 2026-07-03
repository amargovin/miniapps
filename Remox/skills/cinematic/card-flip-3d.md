# Card Flip 3D

Spring-driven CSS 3D card flip with front/back faces and staggered montage timing.

## Key Patterns

- Parent container: `perspective: 1200px; transformStyle: 'preserve-3d'`
- Card wrapper: `transform: rotateY(deg)` animated via spring
- Front/back: `backfaceVisibility: 'hidden'`; back gets `rotateY(180deg)` pre-rotation
- Spring config: stiffness:160, damping:22 for natural flip with slight overshoot
- Stagger 3 cards by 12 frames each

## Complete Example

```tsx
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  spring, interpolate, Sequence,
} from 'remotion';
import { PALETTE, FONTS } from '../theme';

interface FlipCardProps {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  startFrame: number;
  width?: number;
  height?: number;
}

const FlipCard: React.FC<FlipCardProps> = ({
  frontContent,
  backContent,
  startFrame,
  width = 480,
  height = 300,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flip: 0deg = front, 180deg = back
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { stiffness: 160, damping: 22, mass: 1.2 },
  });
  const rotation = progress * 180;

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width, height,
    borderRadius: 16,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ width, height, perspective: 1200 }}>
      <div
        style={{
          width, height,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotation}deg)`,
          willChange: 'transform',
        }}
      >
        {/* Front face */}
        <div style={{ ...faceStyle, background: PALETTE.surface }}>
          {frontContent}
        </div>
        {/* Back face — pre-rotated 180deg */}
        <div
          style={{
            ...faceStyle,
            background: PALETTE.accent,
            transform: 'rotateY(180deg)',
          }}
        >
          {backContent}
        </div>
      </div>
    </div>
  );
};

const CARDS = [
  { front: '$4B PLI Scheme',   back: '0 cells produced'  },
  { front: 'Ola Electric IPO', back: '94% imports'       },
  { front: 'Made in India',    back: 'Assembled in India' },
];

export const CardFlipMontage: React.FC = () => {
  const CARD_W = 480;
  const CARD_H = 300;
  const totalW = CARDS.length * CARD_W + (CARDS.length - 1) * 40;
  const startX = (1920 - totalW) / 2;

  return (
    <AbsoluteFill style={{ background: PALETTE.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 40 }}>
        {CARDS.map((card, i) => (
          <FlipCard
            key={i}
            startFrame={20 + i * 12}
            width={CARD_W}
            height={CARD_H}
            frontContent={
              <span style={{ fontFamily: FONTS.headline, fontSize: 32, color: PALETTE.text }}>
                {card.front}
              </span>
            }
            backContent={
              <span style={{ fontFamily: FONTS.headline, fontSize: 32, color: '#000', fontWeight: 900 }}>
                {card.back}
              </span>
            }
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

## Notes

- Increase `perspective` value (1500–2000) for subtler 3D; decrease (600–800) for dramatic
- `mass: 1.2` adds a slight overshoot — reduce to 1.0 for crisp no-bounce flip
- For a deck effect: position cards with `zIndex` and apply slight scale + y-offset stagger
- Add `box-shadow` on the back face for depth separation
