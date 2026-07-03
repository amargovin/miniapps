// SolarPhases.tsx — reusable phase composition components for the solar video.
// Each component reads useCurrentFrame() locally (LEARNINGS §32 — never pass parent frame).
// Components implement the 8 composition templates with editorial-clean aesthetics.

import React from 'react';
import {
  AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// Convert literal backslash-n strings to real newlines (defensive — handles
// TSX generation cases where the prop arrived as escaped string).
const unesc = (s: string | undefined): string => (s ?? '').replace(/\\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// Backgrounds
// ─────────────────────────────────────────────────────────────────────────────
export const bgForType = (bg: string): React.CSSProperties => {
  switch (bg) {
    case 'solid-cream': return { background: PALETTE.bg };
    case 'solid-navy':  return { background: PALETTE.primary };
    case 'solid-dark':  return { background: '#0d1520' };
    default:            return { background: PALETTE.bg };
  }
};

export const textColorFor = (bg: string) =>
  bg === 'solid-navy' || bg === 'solid-dark' ? '#FFFFFF' : PALETTE.text;
export const labelColorFor = (bg: string) =>
  bg === 'solid-navy' || bg === 'solid-dark' ? PALETTE.accent : PALETTE.secondary;
export const mutedColorFor = (bg: string) =>
  bg === 'solid-navy' || bg === 'solid-dark' ? 'rgba(255,255,255,0.72)' : PALETTE.textMuted;

// ─────────────────────────────────────────────────────────────────────────────
// Image backdrop with Ken Burns + editorial treatment (LEARNINGS §2)
// ─────────────────────────────────────────────────────────────────────────────
export const ImageBackdrop: React.FC<{ asset: string; duration: number; kenBurns?: 'in' | 'out' | 'none' }> = ({
  asset, duration, kenBurns = 'in',
}) => {
  const frame = useCurrentFrame();
  const zoomFrom = kenBurns === 'out' ? 1.06 : 1.0;
  const zoomTo = kenBurns === 'out' ? 1.0 : (kenBurns === 'none' ? 1.0 : 1.06);
  const zoom = interpolate(frame, [0, duration], [zoomFrom, zoomTo], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(`images/${asset}`)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          filter: 'contrast(1.08) brightness(0.92) saturate(0.95)',
          transform: `scale(${zoom})`,
          willChange: 'transform',
        }}
      />
      {/* Editorial tint — primary multiply at 0.18 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: PALETTE.primary,
        mixBlendMode: 'multiply',
        opacity: 0.22,
      }} />
      {/* Light vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.32) 100%)',
      }} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Animated text helpers
// ─────────────────────────────────────────────────────────────────────────────
export function useFadeIn(delay = 6, dur = 18) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: MOTION.springSnappy,
    durationInFrames: dur,
  });
}

// Spring entrance for stagger: returns opacity[0..1] and translateY
export function useStagger(idx: number, baseDelay = 4, step = 8) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: Math.max(0, frame - (baseDelay + idx * step)),
    fps,
    config: MOTION.springSnappy,
  });
  return { opacity: interpolate(t, [0, 1], [0, 1]), translateY: interpolate(t, [0, 1], [22, 0]) };
}

// Exit fade — only fade out near end of phase
export function useExitFade(duration: number, fadeStart = 18) {
  const frame = useCurrentFrame();
  return interpolate(frame, [duration - fadeStart, duration], [1, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EYEBROW LABEL  — small uppercase label, secondary color
// ─────────────────────────────────────────────────────────────────────────────
export const Eyebrow: React.FC<{
  text: string;
  bg: string;
  delay?: number;
  align?: 'left' | 'center';
}> = ({ text, bg, delay = 0, align = 'center' }) => {
  const t = useFadeIn(delay, 18);
  const clean = unesc(text);
  if (!clean) return null;
  return (
    <div style={{
      fontFamily: FONTS.body,
      fontSize: 24,
      fontWeight: 600,
      color: labelColorFor(bg),
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      opacity: t,
      transform: `translateY(${interpolate(t, [0, 1], [12, 0])}px)`,
      marginBottom: 22,
      textAlign: align,
    }}>
      {clean}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADLINE — multi-line, large
// ─────────────────────────────────────────────────────────────────────────────
export const Headline: React.FC<{
  text: string;
  bg: string;
  size?: number;
  delay?: number;
  weight?: number;
  align?: 'left' | 'center';
  color?: string;
  shadow?: boolean;
}> = ({ text, bg, size = 72, delay = 12, weight = 700, align = 'center', color, shadow = false }) => {
  const t = useFadeIn(delay, 22);
  const lines = unesc(text).split('\n');
  return (
    <div style={{
      fontFamily: FONTS.heading,
      fontSize: size,
      fontWeight: weight,
      color: color ?? textColorFor(bg),
      lineHeight: 1.12,
      letterSpacing: '-0.015em',
      textAlign: align,
      opacity: t,
      transform: `translateY(${interpolate(t, [0, 1], [20, 0])}px)`,
      textShadow: shadow ? '0 2px 24px rgba(0,0,0,0.35)' : undefined,
    }}>
      {lines.map((ln, i) => (<div key={i}>{ln}</div>))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Big stat — for centered-hero stat reveals
// ─────────────────────────────────────────────────────────────────────────────
export const HeroStat: React.FC<{
  text: string;
  bg: string;
  label?: string;
  size?: number;
  color?: string;
}> = ({ text, bg, label, size = 196, color }) => {
  const eyebrow = label && <Eyebrow text={label} bg={bg} delay={4} />;
  const t = useFadeIn(14, 20);
  return (
    <>
      {eyebrow}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: size,
        fontWeight: 700,
        color: color ?? (bg === 'solid-navy' || bg === 'solid-dark' ? '#FFFFFF' : PALETTE.primary),
        lineHeight: 1.0,
        letterSpacing: '-0.04em',
        opacity: t,
        transform: `scale(${interpolate(t, [0, 1], [0.82, 1])})`,
        textAlign: 'center',
      }}>{unesc(text)}</div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Centered-hero template
// ─────────────────────────────────────────────────────────────────────────────
export const CenteredHero: React.FC<{
  bg: string;
  label?: string;
  text: string;
  headlineSize?: number;
  isStat?: boolean;
}> = ({ bg, label, text, headlineSize = 80, isStat = false }) => {
  return (
    <AbsoluteFill style={{
      ...bgForType(bg),
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '120px 192px 220px',
    }}>
      <div style={{ maxWidth: 1280, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {label && <Eyebrow text={label} bg={bg} delay={4} />}
        {isStat
          ? <HeroStat text={text} bg={bg} size={196} />
          : <Headline text={text} bg={bg} size={headlineSize} delay={12} align="center" />
        }
        {/* Accent rule */}
        <AccentRule bg={bg} delay={28} width={120} />
      </div>
    </AbsoluteFill>
  );
};

// Animated horizontal rule
export const AccentRule: React.FC<{ bg: string; delay?: number; width?: number }> = ({
  bg, delay = 24, width = 120,
}) => {
  const t = useFadeIn(delay, 18);
  return (
    <div style={{
      width: width * t,
      height: 3,
      background: labelColorFor(bg),
      borderRadius: 2,
      marginTop: 8,
    }} />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Focal-offset template — image on right, text-left or vice versa
// ─────────────────────────────────────────────────────────────────────────────
export const FocalOffset: React.FC<{
  bg: string;
  label?: string;
  text: string;
  asset?: string;
  duration: number;
  kenBurns?: 'in' | 'out' | 'none';
  textSide?: 'left' | 'right';
}> = ({ bg, label, text, asset, duration, kenBurns = 'in', textSide = 'left' }) => {
  const useImage = bg === 'image' && asset;
  return (
    <AbsoluteFill style={useImage ? {} : bgForType(bg)}>
      {useImage && <ImageBackdrop asset={asset!} duration={duration} kenBurns={kenBurns} />}
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: textSide === 'left' ? 'flex-start' : 'flex-end',
        padding: '120px 192px 220px',
      }}>
        <div style={{
          maxWidth: 880,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: useImage ? '32px 36px' : 0,
          background: useImage ? 'rgba(13,21,32,0.62)' : undefined,
          borderLeft: useImage ? `4px solid ${PALETTE.accent}` : undefined,
          backdropFilter: useImage ? 'blur(4px)' : undefined,
        }}>
          {label && <Eyebrow text={label} bg={useImage ? 'solid-dark' : bg} delay={4} align="left" />}
          <Headline text={text} bg={useImage ? 'solid-dark' : bg} size={68} delay={14} align="left" shadow={false} color={useImage ? '#FFFFFF' : undefined} />
          <div style={{ marginTop: 16 }}>
            <AccentRule bg={useImage ? 'solid-dark' : bg} delay={28} width={92} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Split-compare — two panels with divider
// ─────────────────────────────────────────────────────────────────────────────
export const SplitCompare: React.FC<{
  bg: string;
  label?: string;
  text: string;  // expect two segments separated by '\n\n———\n\n'
  asset?: string;
  duration: number;
}> = ({ bg, label, text, asset, duration }) => {
  const useImage = bg === 'image' && asset;
  // Split text into left and right
  const segments = unesc(text).split(/\n\n[—-]+\n\n/);
  const left = segments[0] ?? text;
  const right = segments[1] ?? '';
  // If there's no right side, render as a single centered block instead
  if (!right.trim()) {
    return (
      <StackedReveal bg={bg} label={label} text={text} asset={asset} duration={duration} />
    );
  }

  return (
    <AbsoluteFill style={useImage ? {} : bgForType(bg)}>
      {useImage && <ImageBackdrop asset={asset!} duration={duration} kenBurns="none" />}
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '120px 192px 220px',
      }}>
        {label && <Eyebrow text={label} bg={useImage ? 'solid-dark' : bg} delay={4} />}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 80,
          width: '100%',
          maxWidth: 1500,
          marginTop: 18,
        }}>
          <SplitPanel text={left} bg={useImage ? 'solid-dark' : bg} delay={14} />
          <div style={{ width: 2, background: `${useImage ? 'rgba(255,255,255,0.32)' : PALETTE.textMuted}` }} />
          <SplitPanel text={right} bg={useImage ? 'solid-dark' : bg} delay={22} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SplitPanel: React.FC<{ text: string; bg: string; delay: number }> = ({ text, bg, delay }) => {
  const t = useFadeIn(delay, 22);
  const lines = unesc(text).split('\n');
  const isDark = bg === 'solid-dark' || bg === 'solid-navy';
  // First line: heading style, rest: body
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      gap: 12,
      opacity: t,
      transform: `translateY(${interpolate(t, [0, 1], [18, 0])}px)`,
      textAlign: 'center',
      padding: isDark ? '36px 28px' : '24px 28px',
      background: isDark ? 'rgba(13,21,32,0.55)' : undefined,
      backdropFilter: isDark ? 'blur(2px)' : undefined,
    }}>
      {lines.map((ln, i) => {
        if (i === 0) {
          return (
            <div key={i} style={{
              fontFamily: FONTS.body, fontSize: 26, fontWeight: 600,
              color: labelColorFor(bg), letterSpacing: '0.2em', textTransform: 'uppercase',
              marginBottom: 4,
            }}>{ln}</div>
          );
        }
        return (
          <div key={i} style={{
            fontFamily: FONTS.heading,
            fontSize: ln.length < 12 ? 64 : 40,
            fontWeight: 700,
            color: textColorFor(bg),
            lineHeight: 1.18,
            textShadow: isDark ? '0 2px 18px rgba(0,0,0,0.45)' : undefined,
          }}>{ln}</div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stacked-reveal — vertical list with staggered reveal
// ─────────────────────────────────────────────────────────────────────────────
export const StackedReveal: React.FC<{
  bg: string;
  label?: string;
  text: string;  // newline-separated items
  asset?: string;
  duration: number;
}> = ({ bg, label, text, asset, duration }) => {
  const useImage = bg === 'image' && asset;
  const lines = unesc(text).split('\n');
  return (
    <AbsoluteFill style={useImage ? {} : bgForType(bg)}>
      {useImage && <ImageBackdrop asset={asset!} duration={duration} kenBurns="in" />}
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '120px 192px 220px',
      }}>
        {label && <Eyebrow text={label} bg={useImage ? 'solid-dark' : bg} delay={4} />}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 26,
          marginTop: 20,
          maxWidth: 1100,
        }}>
          {lines.map((ln, i) => (
            <StackedLine key={i} text={ln} bg={useImage ? 'solid-dark' : bg} idx={i} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StackedLine: React.FC<{ text: string; bg: string; idx: number }> = ({ text, bg, idx }) => {
  const { opacity, translateY } = useStagger(idx, 8, 10);
  // Empty line = spacer
  if (!text.trim()) return <div style={{ height: 12 }} />;
  // Lines beginning with — are emphasis
  const isLabel = text.startsWith('—') || /^[A-Z\s·]+$/.test(text.trim()) && text.trim().length < 24;
  return (
    <div style={{
      fontFamily: FONTS.heading,
      fontSize: isLabel ? 32 : 56,
      fontWeight: isLabel ? 500 : 700,
      color: isLabel ? labelColorFor(bg) : textColorFor(bg),
      letterSpacing: isLabel ? '0.12em' : '-0.01em',
      textTransform: isLabel ? 'uppercase' : 'none',
      lineHeight: 1.18,
      textAlign: 'center',
      opacity,
      transform: `translateY(${translateY}px)`,
      textShadow: bg === 'solid-dark' ? '0 2px 20px rgba(0,0,0,0.45)' : undefined,
    }}>
      {text}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Panoramic-flow — horizontal flow with separators
// ─────────────────────────────────────────────────────────────────────────────
export const PanoramicFlow: React.FC<{
  bg: string;
  label?: string;
  text: string;  // items separated by '→' or '·'
}> = ({ bg, label, text }) => {
  const clean = unesc(text);
  // Split by → first; fallback to ·
  const sep = clean.includes('→') ? '→' : '·';
  const items = clean.split(sep).map(s => s.trim()).filter(Boolean);
  return (
    <AbsoluteFill style={{
      ...bgForType(bg),
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '120px 192px 220px',
    }}>
      {label && <Eyebrow text={label} bg={bg} delay={4} />}
      <div style={{
        display: 'flex', flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: 28, flexWrap: 'wrap', maxWidth: 1600, marginTop: 36,
      }}>
        {items.map((it, i) => {
          const { opacity, translateY } = useStagger(i, 6, 10);
          return (
            <React.Fragment key={i}>
              <div style={{
                fontFamily: FONTS.heading, fontSize: 42, fontWeight: 700,
                color: textColorFor(bg),
                opacity, transform: `translateY(${translateY}px)`,
                letterSpacing: '-0.005em', whiteSpace: 'nowrap',
              }}>{it}</div>
              {i < items.length - 1 && (
                <FlowSeparator bg={bg} sep={sep} idx={i} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const FlowSeparator: React.FC<{ bg: string; sep: string; idx: number }> = ({ bg, sep, idx }) => {
  const { opacity } = useStagger(idx, 6, 10);
  return (
    <div style={{
      fontFamily: FONTS.heading, fontSize: 36, fontWeight: 400,
      color: labelColorFor(bg),
      opacity: opacity * 0.7,
    }}>
      {sep === '→' ? '→' : '·'}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Grid — 2x2 or 2x3
// ─────────────────────────────────────────────────────────────────────────────
export const Grid: React.FC<{
  bg: string;
  label?: string;
  text: string;
  asset?: string;
  duration: number;
}> = ({ bg, label, text, asset, duration }) => {
  const useImage = bg === 'image' && asset;
  const items = unesc(text).split('\n').map(s => s.trim()).filter(Boolean);
  // Decide grid: ≤4 → 2x2, ≤6 → 2x3, fallback 1x
  const cols = items.length <= 4 ? 2 : 3;
  return (
    <AbsoluteFill style={useImage ? {} : bgForType(bg)}>
      {useImage && <ImageBackdrop asset={asset!} duration={duration} kenBurns="in" />}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '120px 192px 220px',
      }}>
        {label && <Eyebrow text={label} bg={useImage ? 'solid-dark' : bg} delay={4} />}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 32,
          marginTop: 28,
          maxWidth: 1500,
        }}>
          {items.map((it, i) => {
            const { opacity, translateY } = useStagger(i, 8, 9);
            return (
              <div key={i} style={{
                padding: '24px 40px',
                background: useImage ? 'rgba(0,0,0,0.42)' : `${PALETTE.primary}10`,
                borderLeft: `4px solid ${labelColorFor(useImage ? 'solid-dark' : bg)}`,
                fontFamily: FONTS.heading, fontSize: 36, fontWeight: 700,
                color: useImage ? '#FFFFFF' : textColorFor(bg),
                opacity, transform: `translateY(${translateY}px)`,
                textShadow: useImage ? '0 2px 16px rgba(0,0,0,0.45)' : undefined,
                lineHeight: 1.25,
              }}>
                {it}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher — picks template based on string id
// ─────────────────────────────────────────────────────────────────────────────
export interface PhaseConfig {
  template: string;
  background: string;  // 'image' | 'solid-cream' | 'solid-navy' | 'solid-dark'
  text: string;
  label?: string;
  asset?: string;
  duration: number;
  isStat?: boolean;
  headlineSize?: number;
  kenBurns?: 'in' | 'out' | 'none';
  textSide?: 'left' | 'right';
}

export const PhaseRender: React.FC<PhaseConfig> = (cfg) => {
  switch (cfg.template) {
    case 'centered-hero':
      return <CenteredHero bg={cfg.background} label={cfg.label} text={cfg.text} headlineSize={cfg.headlineSize} isStat={cfg.isStat} />;
    case 'focal-offset':
      return <FocalOffset bg={cfg.background} label={cfg.label} text={cfg.text} asset={cfg.asset} duration={cfg.duration} kenBurns={cfg.kenBurns} textSide={cfg.textSide} />;
    case 'split-compare':
      return <SplitCompare bg={cfg.background} label={cfg.label} text={cfg.text} asset={cfg.asset} duration={cfg.duration} />;
    case 'stacked-reveal':
      return <StackedReveal bg={cfg.background} label={cfg.label} text={cfg.text} asset={cfg.asset} duration={cfg.duration} />;
    case 'panoramic-flow':
      return <PanoramicFlow bg={cfg.background} label={cfg.label} text={cfg.text} />;
    case 'grid':
      return <Grid bg={cfg.background} label={cfg.label} text={cfg.text} asset={cfg.asset} duration={cfg.duration} />;
    default:
      return <CenteredHero bg={cfg.background} label={cfg.label} text={cfg.text} />;
  }
};
