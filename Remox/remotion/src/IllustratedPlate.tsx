// IllustratedPlate — cinematic camera over a high-res illustrated plate.
//
// The plate is a 4K textless illustration (Nano Banana Pro). The camera is a
// list of keyframes in NORMALIZED plate coordinates (cx, cy ∈ 0..1, zoom ≥ 1).
// Between keyframes the camera moves with EASING.inOut; at rest it never
// freezes — a slow breathe/drift keeps the frame alive. Velocity-proportional
// blur fires during fast moves.
//
//   <IllustratedPlate
//     src="images/plates/plate_s05_rings.png"
//     cam={[
//       { frame: 0,   cx: 0.5, cy: 0.47, zoom: 1.0 },   // wide — outer ring
//       { frame: 150, cx: 0.5, cy: 0.47, zoom: 1.45 },  // push — amber ring
//       { frame: 300, cx: 0.5, cy: 0.47, zoom: 2.1 },   // tight — red ring
//     ]}
//   />
//
// Text overlays are the PHASE's job — layer them above this component.

import React from 'react';
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { EASING } from './theme';
import { breathe, driftY, velocityBlur } from './motion-utils';

export type CamKeyframe = { frame: number; cx: number; cy: number; zoom: number };

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const track = (frame: number, cam: CamKeyframe[], key: 'cx' | 'cy' | 'zoom') => {
  if (cam.length === 1) return cam[0][key];
  return interpolate(
    frame,
    cam.map(k => k.frame),
    cam.map(k => k[key]),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.inOut },
  );
};


// ── World-pinning helpers ──────────────────────────────────────────────────
// Compute the camera state and project plate/image coordinates (0..1 normalised)
// to screen pixels. Lets text/callouts PIN to subjects in the imagery so they
// move with the camera instead of floating screen-fixed. Works for plates AND
// any full-bleed photo driven by the same cam keyframes.
//
//   const cam = [{frame:0,cx:.5,cy:.5,zoom:1.2}, {frame:200,cx:.3,cy:.4,zoom:1.5}];
//   const st = plateCameraState(frame, cam, ambient);
//   const p = plateToScreen(0.62, 0.55, st);   // subject at 62%/55% of the image
//   <div style={{ position:'absolute', left:p.x, top:p.y }}>…label…</div>

export const plateCameraState = (
  frame: number,
  cam: CamKeyframe[],
  ambient = 1,
): { left: number; top: number; zoom: number } => {
  const zoom = track(frame, cam, 'zoom') * breathe(frame, { period: 200, amp: 0.003 * ambient });
  const cx = track(frame, cam, 'cx');
  const cy = track(frame, cam, 'cy') + driftY(frame, { amp: 0.002 * ambient, period: 280 });
  const imgW = CANVAS_W * zoom;
  const imgH = CANVAS_H * zoom;
  const left = Math.min(0, Math.max(CANVAS_W - imgW, CANVAS_W / 2 - cx * imgW));
  const top = Math.min(0, Math.max(CANVAS_H - imgH, CANVAS_H / 2 - cy * imgH));
  return { left, top, zoom };
};

export const plateToScreen = (
  px: number,
  py: number,
  st: { left: number; top: number; zoom: number },
): { x: number; y: number } => ({
  x: st.left + px * CANVAS_W * st.zoom,
  y: st.top + py * CANVAS_H * st.zoom,
});

export const IllustratedPlate: React.FC<{
  src: string;
  cam: CamKeyframe[];
  /** ambient intensity: 0 = off, 1 = default */
  ambient?: number;
  style?: React.CSSProperties;
}> = ({ src, cam, ambient = 1, style }) => {
  const frame = useCurrentFrame();

  // Shared with plateCameraState so world-pinned labels never drift from the render.
  const { left, top, zoom } = plateCameraState(frame, cam, ambient);
  const imgW = CANVAS_W * zoom;
  const imgH = CANVAS_H * zoom;

  // Motion blur from camera translation speed
  const leftAt = (f: number) => {
    const z = track(f, cam, 'zoom');
    return Math.min(0, Math.max(CANVAS_W - CANVAS_W * z, CANVAS_W / 2 - track(f, cam, 'cx') * CANVAS_W * z));
  };
  const blur = velocityBlur(leftAt, frame, 0.25, 10);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0B1622', ...style }}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left,
          top,
          width: imgW,
          height: imgH,
          filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        }}
      />
    </AbsoluteFill>
  );
};

export default IllustratedPlate;
