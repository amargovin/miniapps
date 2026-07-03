import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Headline Flip: 3 cards that flip in sequence using 3D CSS transforms.
// Each card has a front (teaser) and back (reveal). Spring-timed flips.

const CARD_WIDTH  = 680;
const CARD_HEIGHT = 220;
const FLIP_START  = [10, 45, 80]; // frame when each card begins its flip

const cards = [
  {
    front: '"India Will Be The Next EV Hub"',
    back:  '77% of battery cells still imported from China.',
    frontColor: PALETTE.accent?.[0] ?? '#4fc3f7',
    backColor:  '#ee4266',
  },
  {
    front: '"PLI Scheme Will Build 50 GWh Capacity"',
    back:  'Only 3 GWh operational after 3 years.',
    frontColor: PALETTE.accent?.[1] ?? '#ce93d8',
    backColor:  '#ff6b35',
  },
  {
    front: '"Domestic Manufacturers Are Ready"',
    back:  'Zero patents filed in solid-state battery tech.',
    frontColor: PALETTE.accent?.[2] ?? '#a5d6a7',
    backColor:  '#ffd23f',
  },
];

export default function HeadlineFlip() {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Card layout: stacked vertically with small gap
  const totalHeight = cards.length * CARD_HEIGHT + (cards.length - 1) * 32;
  const startY      = (height - totalHeight) / 2;

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.background ?? '#0d0d1a',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1200px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {cards.map((card, ci) => {
          // Card slides in from left before its flip starts
          const slideIn = spring({
            frame: frame - (FLIP_START[ci] - 20),
            fps,
            config: MOTION.snappy,
            from: -120,
            to: 0,
          });
          const slideOpacity = interpolate(
            frame,
            [FLIP_START[ci] - 20, FLIP_START[ci] - 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // 3D flip: 0° = front visible, 180° = back visible
          const flipProgress = spring({
            frame: frame - FLIP_START[ci],
            fps,
            config: { damping: 14, stiffness: 120 },
            from: 0,
            to: 180,
          });

          const rotateY = flipProgress;

          // Front face is visible when rotateY < 90, back when > 90
          const frontOpacity = rotateY < 90 ? 1 : 0;
          const backOpacity  = rotateY >= 90 ? 1 : 0;

          // Slight scale punch at the moment of full flip completion
          const flipComplete = interpolate(flipProgress, [170, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const punchScale = 1 + 0.04 * Math.max(0, 1 - (flipProgress - 175) * 2);

          return (
            <div
              key={ci}
              style={{
                width:           CARD_WIDTH,
                height:          CARD_HEIGHT,
                position:        'relative',
                transformStyle:  'preserve-3d',
                transform:       `translateX(${slideIn}px) rotateY(${rotateY}deg) scale(${punchScale})`,
                transformOrigin: 'center center',
                opacity:         slideOpacity,
              }}
            >
              {/* Front face */}
              <div
                style={{
                  position:          'absolute',
                  inset:             0,
                  backfaceVisibility: 'hidden',
                  background:        card.frontColor + '22',
                  border:            `2px solid ${card.frontColor}60`,
                  borderRadius:      16,
                  display:           'flex',
                  alignItems:        'center',
                  justifyContent:    'center',
                  padding:           '0 48px',
                  opacity:           frontOpacity,
                }}
              >
                <p
                  style={{
                    fontFamily:  FONTS?.body ?? 'sans-serif',
                    fontSize:    28,
                    fontWeight:  600,
                    color:       card.frontColor,
                    textAlign:   'center',
                    fontStyle:   'italic',
                    lineHeight:  1.4,
                    margin:      0,
                  }}
                >
                  {card.front}
                </p>
              </div>

              {/* Back face — pre-rotated so it appears correctly after flip */}
              <div
                style={{
                  position:          'absolute',
                  inset:             0,
                  backfaceVisibility: 'hidden',
                  transform:         'rotateY(180deg)',
                  background:        card.backColor + '22',
                  border:            `2px solid ${card.backColor}80`,
                  borderRadius:      16,
                  display:           'flex',
                  alignItems:        'center',
                  justifyContent:    'center',
                  padding:           '0 48px',
                  opacity:           backOpacity,
                }}
              >
                {/* Reality label */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontFamily:    FONTS?.mono ?? 'monospace',
                      fontSize:      13,
                      letterSpacing: '3px',
                      color:         card.backColor,
                      textTransform: 'uppercase',
                      marginBottom:  12,
                      opacity:       0.7,
                    }}
                  >
                    Reality
                  </div>
                  <p
                    style={{
                      fontFamily:  FONTS?.display ?? 'sans-serif',
                      fontSize:    32,
                      fontWeight:  700,
                      color:       PALETTE.primary ?? '#ffffff',
                      margin:      0,
                      lineHeight:  1.3,
                    }}
                  >
                    {card.back}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
