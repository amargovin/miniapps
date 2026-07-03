// _kit.tsx — shared cinematic primitives for the PL-15 hybrid video.
// NOT a scene (not in project.json) so it is never registered/rendered directly.
// Import from './_kit' inside each Scene_XX.tsx.
import React from 'react';
import {
  AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig,
  spring, interpolate, Sequence, Audio,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// ── Film grain overlay (cinematic texture) ────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => (
  <div style={{
    position: 'absolute', inset: 0, opacity, pointerEvents: 'none',
    mixBlendMode: 'overlay', backgroundImage: GRAIN, backgroundSize: '170px 170px',
  }} />
);

// ── Spring / motion helpers (all use LOCAL frame — safe inside phases) ─────
export function useEnter(delay = 0, config: any = MOTION.springSnappy) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: Math.max(0, frame - delay), fps, config });
}

// Slam config for headlines (translateY + slight scale settle)
export const SLAM = { damping: 14, stiffness: 280, mass: 0.8 };

// Container drift (subtle Ken Burns on non-image phases). Vary per phase.
export function useDrift(dur: number, from = 1, to = 1.03) {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, dur], [from, to], { extrapolateRight: 'clamp' });
}

// Exit fade over the final `fadeFrames` of a phase (prevents freeze).
export function useExit(dur: number, fadeFrames = 14) {
  const frame = useCurrentFrame();
  return interpolate(frame, [dur - fadeFrames, dur], [1, 0], { extrapolateLeft: 'clamp' });
}

// ── Full-bleed dark cinematic backdrop (thriller scenes) ──────────────────
// Light-touch treatment per LEARNINGS §2 — keep the image alive, don't grey it out.
export const DarkBackdrop: React.FC<{
  src: string; dur: number; focus?: string; zoom?: [number, number]; scrim?: 'left' | 'center' | 'bottom' | 'none';
}> = ({ src, dur, focus = '50% 50%', zoom = [1.0, 1.08], scrim = 'bottom' }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, dur], zoom, { extrapolateRight: 'clamp' });
  const scrimBg =
    scrim === 'left' ? 'linear-gradient(90deg, rgba(6,12,20,0.82) 0%, rgba(6,12,20,0.35) 38%, transparent 65%)'
    : scrim === 'center' ? 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(6,12,20,0.72) 0%, transparent 70%)'
    : scrim === 'bottom' ? 'linear-gradient(0deg, rgba(6,12,20,0.85) 0%, rgba(6,12,20,0.15) 45%, transparent 70%)'
    : 'none';
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: PALETTE.dark }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus,
        transform: `scale(${scale})`, willChange: 'transform',
        filter: 'contrast(1.08) brightness(0.86) saturate(0.92)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: PALETTE.dark, mixBlendMode: 'multiply', opacity: 0.28 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 78% 74% at 50% 46%, transparent 34%, rgba(0,0,0,0.5) 100%)' }} />
      {scrim !== 'none' && <div style={{ position: 'absolute', inset: 0, background: scrimBg }} />}
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};

// ── 1:1 focal-offset image panel (cream or dark scenes) ───────────────────
// side: which side the IMAGE sits on. Text goes on the opposite side (LEARNINGS §26).
export const PanelImage: React.FC<{
  src: string; dur: number; side?: 'left' | 'right'; focus?: string; duotone?: boolean; onDark?: boolean; widthPct?: number;
}> = ({ src, dur, side = 'right', focus = '50% 45%', duotone = false, onDark = false, widthPct = 46 }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, dur], [1.0, 1.07], { extrapolateRight: 'clamp' });
  const reveal = useEnter(4, { damping: 22, stiffness: 90 });
  const tint = onDark ? PALETTE.dark : PALETTE.primary;
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, width: `${widthPct}%`,
      [side]: 0, overflow: 'hidden',
      clipPath: `inset(0 0 ${interpolate(reveal, [0, 1], [100, 0])}% 0)`,
    }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus,
        transform: `scale(${scale})`, willChange: 'transform',
        filter: duotone ? 'grayscale(0.55) contrast(1.18) brightness(0.95)' : 'contrast(1.06) brightness(0.94) saturate(0.95)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: tint, mixBlendMode: 'multiply', opacity: duotone ? 0.32 : 0.14 }} />
      {/* edge feather toward the text side */}
      <div style={{
        position: 'absolute', inset: 0,
        background: side === 'right'
          ? `linear-gradient(90deg, ${onDark ? '#0B1622' : '#F5F3EE'} 0%, transparent 22%)`
          : `linear-gradient(270deg, ${onDark ? '#0B1622' : '#F5F3EE'} 0%, transparent 22%)`,
      }} />
      <Grain opacity={0.05} />
    </div>
  );
};

// ── Editorial label + accent rule (label → rule → headline order) ─────────
export const LabelRule: React.FC<{ text: string; color?: string; delay?: number; align?: 'left' | 'center' }> = ({
  text, color = PALETTE.secondary, delay = 0, align = 'left',
}) => {
  const labelP = useEnter(delay);
  const ruleP = useEnter(delay + 8, { damping: 18, stiffness: 300 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <div style={{
        fontFamily: FONTS.body, fontSize: 24, fontWeight: 600, letterSpacing: '0.2em',
        textTransform: 'uppercase', color, opacity: labelP,
        transform: `translateY(${interpolate(labelP, [0, 1], [16, 0])}px)`,
      }}>{text}</div>
      <div style={{ width: 64, height: 3, background: color, transformOrigin: 'left', transform: `scaleX(${ruleP})`, margin: '14px 0' }} />
    </div>
  );
};

// ── Kinetic headline (spring slam + optional emphasis) ────────────────────
export const Kinetic: React.FC<{
  children: React.ReactNode; size?: number; color?: string; delay?: number;
  align?: 'left' | 'center'; weight?: number; lineHeight?: number; maxWidth?: number;
}> = ({ children, size = 84, color = PALETTE.onDark, delay = 0, align = 'center', weight = 800, lineHeight = 1.06, maxWidth }) => {
  const p = useEnter(delay, SLAM);
  const scaleP = useEnter(delay, { damping: 11, stiffness: 200 });
  const scale = interpolate(scaleP, [0, 1], [1.12, 1.0]);
  const y = interpolate(p, [0, 1], [42, 0]);
  return (
    <div style={{
      fontFamily: FONTS.heading, fontSize: size, fontWeight: weight, color,
      lineHeight, letterSpacing: '-0.02em', textAlign: align, maxWidth,
      opacity: p, transform: `translateY(${y}px) scale(${scale})`, transformOrigin: align === 'center' ? 'center' : 'left',
    }}>{children}</div>
  );
};

// ── One-shot SFX at a local frame ─────────────────────────────────────────
export const Sfx: React.FC<{ file: string; at: number; volume?: number; fade?: number }> = ({ file, at, volume = 0.5, fade = 14 }) => (
  <Sequence from={at}>
    <Audio src={staticFile(`sfx/${file}`)} volume={(f) => interpolate(f, [0, fade], [volume, 0], { extrapolateRight: 'clamp' })} />
  </Sequence>
);

// ── Backgrounds ───────────────────────────────────────────────────────────
export const SolidDark: React.FC<{ children?: React.ReactNode; drift?: number; grain?: boolean }> = ({ children, drift = 1, grain = true }) => (
  <AbsoluteFill style={{ background: PALETTE.dark, overflow: 'hidden' }}>
    {/* faint radial glow to lift near-black */}
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 50% 42%, rgba(90,169,255,0.06) 0%, transparent 62%)' }} />
    <AbsoluteFill style={{ transform: `scale(${drift})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </AbsoluteFill>
    {grain && <Grain opacity={0.05} />}
  </AbsoluteFill>
);

export const SolidCream: React.FC<{ children?: React.ReactNode; drift?: number; grain?: boolean }> = ({ children, drift = 1, grain = true }) => (
  <AbsoluteFill style={{ background: PALETTE.bg, overflow: 'hidden' }}>
    <AbsoluteFill style={{ transform: `scale(${drift})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </AbsoluteFill>
    {grain && <Grain opacity={0.04} />}
  </AbsoluteFill>
);

export const SolidNavy: React.FC<{ children?: React.ReactNode; drift?: number }> = ({ children, drift = 1 }) => (
  <AbsoluteFill style={{ background: PALETTE.primary, overflow: 'hidden' }}>
    <AbsoluteFill style={{ transform: `scale(${drift})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </AbsoluteFill>
    <Grain opacity={0.05} />
  </AbsoluteFill>
);

// Safe content wrapper — keeps text out of logo (top-right) & subtitle (bottom 20%) zones.
export const SafeContent: React.FC<{ children: React.ReactNode; align?: 'left' | 'center'; justify?: string; pad?: string }> = ({
  children, align = 'center', justify = 'center', pad,
}) => (
  <AbsoluteFill style={{
    display: 'flex', flexDirection: 'column',
    alignItems: align === 'center' ? 'center' : 'flex-start', justifyContent: justify as any,
    padding: pad ?? '150px 200px 240px 200px', boxSizing: 'border-box',
  }}>{children}</AbsoluteFill>
);

export { PALETTE, FONTS, MOTION };
