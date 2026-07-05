// BroadcastCard — TV-news style text card for image+text phases (LEARNINGS §53).
//
// The anti-PPT text treatment: a two-part strap in the broadcast grammar —
//   • KICKER tab: short accent band (~20% of card height), mono caps
//   • MAIN bar: dominant text area (~80%), 56-84px heading type
//   • spans 70-80% of screen width, anchored above the subtitle floor
//   • text SWAPS inside the phase on narration beats (news-strap updates)
//
//   <BroadcastCard
//     enterAt={105}
//     items={[
//       { at: 105, kicker: 'DEFENCE DEAL', main: '$1.2 BN — 300 R-37M MISSILES' },
//       { at: 210, kicker: 'DEFENCE DEAL', main: 'AN INTERIM ANSWER TO THE PL-15' },
//     ]}
//   />
//
// Swap = outgoing main slides up & out, incoming rises in (12f), kicker
// crossfades only when its text changes. Card holds to phase end by default
// (exitAt optional) — the phase transition takes it out (§51.3).

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { PALETTE, FONTS, EASING } from './theme';

export type BroadcastItem = { at: number; kicker: string; main: string };

export const BroadcastCard: React.FC<{
  items: BroadcastItem[];
  enterAt?: number;
  exitAt?: number;
  /** fraction of screen width, 0.70-0.80 per broadcast grammar */
  width?: number;
  left?: number;
  /** px from frame bottom to card bottom — keep ≥300 (subtitle floor) */
  bottom?: number;
  mainSize?: number;
  kickerBg?: string;
  dark?: boolean;
}> = ({
  items,
  enterAt,
  exitAt,
  width = 0.74,
  left = 96,
  bottom = 300,
  mainSize = 64,
  kickerBg = PALETTE.secondary,
  dark = false,
}) => {
  const frame = useCurrentFrame();
  const start = enterAt ?? items[0].at;

  // card entrance: kicker wipes on, main bar follows with a slide
  const kickerWipe = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const mainIn = interpolate(frame, [start + 6, start + 22], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
  });
  const exitO =
    exitAt !== undefined
      ? interpolate(frame, [exitAt, exitAt + 14], [1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.in,
        })
      : 1;
  if (frame < start || exitO <= 0) return null;

  // active item + swap choreography (12f news-strap update)
  let idx = 0;
  for (let i = 0; i < items.length; i++) if (frame >= items[i].at) idx = i;
  const cur = items[idx];
  const prev = idx > 0 ? items[idx - 1] : null;
  const SWAP = 12;
  const swapP =
    idx > 0
      ? interpolate(frame, [cur.at, cur.at + SWAP], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.out,
        })
      : 1;

  const mainBg = dark ? 'rgba(14,30,46,0.92)' : 'rgba(255,255,255,0.94)';
  const mainColor = dark ? PALETTE.onDark : PALETTE.primary;
  const kickerChanged = prev !== null && prev.kicker !== cur.kicker;
  const kickerO = kickerChanged ? swapP : 1;

  const mainLineHeight = mainSize * 1.18;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        bottom,
        width: 1920 * width,
        opacity: exitO,
      }}
    >
      {/* KICKER tab (~20% of card height) */}
      <div
        style={{
          display: 'inline-block',
          background: kickerBg,
          padding: '10px 26px',
          transform: `scaleX(${kickerWipe})`,
          transformOrigin: 'left center',
          opacity: kickerO,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          {cur.kicker}
        </span>
      </div>

      {/* MAIN bar (~80% of card height) — text swaps clip inside */}
      <div
        style={{
          background: mainBg,
          padding: '24px 36px',
          boxShadow: '0 10px 40px rgba(18,40,63,0.18)',
          opacity: mainIn,
          transform: `translateX(${(1 - mainIn) * -46}px)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', minHeight: mainLineHeight }}>
          {/* outgoing text slides up & away */}
          {prev !== null && swapP < 1 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                fontFamily: FONTS.heading,
                fontSize: mainSize,
                fontWeight: 800,
                lineHeight: 1.18,
                color: mainColor,
                transform: `translateY(${-swapP * mainLineHeight}px)`,
                opacity: 1 - swapP,
              }}
            >
              {prev.main}
            </div>
          )}
          {/* incoming text rises in */}
          <div
            style={{
              fontFamily: FONTS.heading,
              fontSize: mainSize,
              fontWeight: 800,
              lineHeight: 1.18,
              color: mainColor,
              transform: `translateY(${(1 - swapP) * mainLineHeight * 0.7}px)`,
              opacity: swapP,
            }}
          >
            {cur.main}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastCard;
