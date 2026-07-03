// Motion utilities — v2 pilot upgrade.
// Doctrine: no frame is ever fully static. Every phase has entrance → ambient
// idle → exit. Exits accelerate (EASING.in) and finish before the transition
// window opens. Fast moves carry velocity-proportional motion blur.

import { interpolate } from 'remotion';
import { EASING } from './theme';

// ── Ambient idle (mandatory on any hold > 90 frames) ─────────────────────────

/** Slow continuous scale drift for a whole phase canvas. 1 → `to` over `over` frames. */
export const ambientScale = (
  frame: number,
  { from = 1, to = 1.035, over = 300 }: { from?: number; to?: number; over?: number } = {},
): number =>
  interpolate(frame, [0, over], [from, to], {
    extrapolateRight: 'clamp',
    easing: EASING.drift,
  });

/** Breathing scale for individual elements. Subtle: ±0.4% by default. */
export const breathe = (
  frame: number,
  { period = 120, amp = 0.004, phase = 0 }: { period?: number; amp?: number; phase?: number } = {},
): number => 1 + amp * Math.sin(((frame + phase) / period) * Math.PI * 2);

/** Slow sinusoidal vertical drift in px, for floating elements/backgrounds. */
export const driftY = (
  frame: number,
  { amp = 8, period = 260, phase = 0 }: { amp?: number; period?: number; phase?: number } = {},
): number => amp * Math.sin(((frame + phase) / period) * Math.PI * 2);

// ── Entrances / exits ─────────────────────────────────────────────────────────

/** Keynote-style entrance: 0→1 with a long-tail ease-out. */
export const enterP = (frame: number, start: number, dur = 24): number =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.out,
  });

/**
 * Exit progress 0→1 starting at `exitStart`, accelerating away.
 * Exits run ~60% of entrance duration. Schedule so exitStart + dur
 * lands BEFORE the phase's transition window (last 18 frames).
 */
export const exitP = (frame: number, exitStart: number, dur = 14): number =>
  interpolate(frame, [exitStart, exitStart + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.in,
  });

/** Compose entrance + exit into one opacity value. */
export const holdOpacity = (
  frame: number,
  { enterStart = 0, enterDur = 18, exitStart, exitDur = 12 }: { enterStart?: number; enterDur?: number; exitStart: number; exitDur?: number },
): number => enterP(frame, enterStart, enterDur) * (1 - exitP(frame, exitStart, exitDur));

// ── Motion blur ───────────────────────────────────────────────────────────────

/**
 * Velocity-proportional blur for fast moves. Evaluate your position function
 * at frame and frame-1; blur px = |velocity| * k. Apply as
 * `filter: blur(...)` only while > 0.5px to avoid softening settled text.
 *
 *   const y = (f: number) => interpolate(...);
 *   const blur = velocityBlur(y, frame);          // px
 *   style={{ filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}
 */
export const velocityBlur = (
  positionAtFrame: (f: number) => number,
  frame: number,
  k = 0.4,
  max = 18,
): number => {
  if (frame <= 0) return 0;
  const v = Math.abs(positionAtFrame(frame) - positionAtFrame(frame - 1));
  return Math.min(v * k, max);
};

// ── Modern vector language (v3) ──────────────────────────────────────────────
// Diagram/chart elements are never hairlines. Primary strokes are a bright
// core inside a soft halo; bars are gradient fills with an inner highlight.
// Use these presets — do not hand-roll thin flat SVG.

/** Dual-stroke glow: render the SAME path twice — halo under, core over. */
export const strokeGlow = (color: string) => ({
  halo: { stroke: color, strokeWidth: 22, opacity: 0.22, filter: 'blur(6px)' },
  core: { stroke: color, strokeWidth: 6, opacity: 0.95 },
});

/** Modern chart bar fill: vertical gradient + inner top highlight. */
export const barFill = (color: string) => ({
  background: `linear-gradient(180deg, ${color} 0%, ${color}CC 78%, ${color}99 100%)`,
  boxShadow: `inset 0 2px 0 rgba(255,255,255,0.35), 0 8px 28px ${color}44`,
  borderRadius: 6,
});

/** Gridline: the ONLY sanctioned thin line — and always ≥ 2px on video. */
export const gridline = (color: string) => ({
  background: color,
  height: 2,
  opacity: 0.18,
});
