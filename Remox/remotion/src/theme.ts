// Theme: editorial-clean — "India's National Quantum Mission"
// Style: editorial-clean | Palette: editorial (cream bg, deep blue, red, bronze)
// 1920×1080 landscape | 30fps

import { Easing } from 'remotion';

// ── Palette ──────────────────────────────────────────────────────────────────
export const PALETTE = {
  bg: '#F5F3EE',
  primary: '#1B3A5F',      // deep editorial blue
  secondary: '#C4373B',    // crimson — crisis / China / disruption
  accent: '#C4873B',       // bronze — capital, R&D, premium
  text: '#1A1A1A',
  textMuted: 'rgba(26,26,26,0.55)',
} as const;

// ── Tonal Ramps ───────────────────────────────────────────────────────────────
// Backgrounds are never one flat hex. Layer these for depth: base fill +
// 2–5% luminance radial/linear ramp + grain. Shadows are tinted, never #000.
export const RAMP = {
  navy: ['#081019', '#0B1622', '#0E1E2E', '#132A40', '#1B3A5F'] as const,
  cream: ['#ECE8DE', '#F1EEE7', '#F5F3EE', '#FAF8F3'] as const,
  shadowOnCream: 'rgba(27, 58, 95, 0.14)',   // navy-tinted shadow for cream scenes
  shadowOnDark: 'rgba(0, 8, 16, 0.5)',        // deep blue-black for dark scenes
} as const;

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Helvetica per Swarajya brand guide (LEARNINGS §6)
export const FONTS = {
  heading: 'Helvetica, Arial, sans-serif',
  body: 'Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

// ── Easing Palette ────────────────────────────────────────────────────────────
// Springs are for impact beats only. Editorial/elegant beats use long-tail
// bezier ease-outs (keynote-style settles). Exits ACCELERATE (ease-in).
export const EASING = {
  out: Easing.bezier(0.16, 1, 0.3, 1),      // easeOutExpo — default entrance settle
  outSoft: Easing.bezier(0.22, 1, 0.36, 1), // easeOutQuint — gentle editorial entrance
  inOut: Easing.bezier(0.83, 0, 0.17, 1),   // easeInOutQuint — camera moves, morphs
  in: Easing.bezier(0.64, 0, 0.78, 0),      // easeInQuint — exits accelerate away
  drift: Easing.bezier(0.33, 0, 0.67, 1),   // near-linear — ambient drift over holds
} as const;

// ── Motion Springs ────────────────────────────────────────────────────────────
export const MOTION = {
  springSnappy: { damping: 20, stiffness: 300, mass: 0.8 },
  springBouncy: { damping: 8, stiffness: 200, mass: 1.0 },
  springHeavy: { damping: 30, stiffness: 120, mass: 1.5 },
  springOverdamped: { damping: 40, stiffness: 200, mass: 1.0 },
} as const;

// ── Typography Scale ──────────────────────────────────────────────────────────
export const TYPE_SCALE = {
  heroStat:      { size: 156, weight: 700, tracking: '-0.03em' },
  heroHeadline:  { size: 88,  weight: 700, tracking: '-0.02em' },
  headline:      { size: 64,  weight: 700, tracking: '-0.01em' },
  headlineMd:    { size: 56,  weight: 700, tracking: '-0.01em' },
  headlineSm:    { size: 48,  weight: 700, tracking: '0' },
  subheading:    { size: 36,  weight: 600, tracking: '0' },
  bodyLg:        { size: 32,  weight: 400, tracking: '0.01em' },
  body:          { size: 28,  weight: 400, tracking: '0.01em' },
  label:         { size: 24,  weight: 500, tracking: '0.18em' },
  citation:      { size: 20,  weight: 400, tracking: '0.02em' },
} as const;

// ── Layout Constants ──────────────────────────────────────────────────────────
export const LAYOUT = {
  width: 1920,
  height: 1080,
  safeH: 96,
  safeV: 192,
  focalSplit: 0.45,
  accentRuleWidth: 60,
  accentRuleHeight: 3,
  gapSm: 24,
  gapMd: 48,
  gapLg: 96,
} as const;

// Film grain (used at 4% opacity for editorial texture)
export const FILM_GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` as const;
