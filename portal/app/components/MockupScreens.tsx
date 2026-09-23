'use client';

import { useEffect, useRef, useState } from 'react';
import s from './landing.module.css';

// Corner-pin: each screen layer is stretched onto 4 corner points via a matrix3d homography.
// Calibration: /?calibrate=1, drag the dots to the screen corners, "Copy values", paste into SCREENS.

type Pt = { x: number; y: number }; // % of the square container
type Corners = { tl: Pt; tr: Pt; br: Pt; bl: Pt };
type Key = 'front' | 'back';

// Corner points in % of the container.
const SCREENS: Record<Key, Corners> = {
  front: {
    tl: { x: 61.6, y: 7.2 },
    tr: { x: 91.3, y: 4.2 },
    br: { x: 65.1, y: 60.9 },
    bl: { x: 35.6, y: 63.4 },
  },
  back: {
    tl: { x: 9.1, y: 30.7 },
    tr: { x: 38.2, y: 35.7 },
    br: { x: 60.7, y: 93.2 },
    bl: { x: 30.4, y: 89.0 },
  },
};

// Layers are laid out in this px box; matrix3d then stretches them onto the corner points.
const BASE = { w: 300, h: 640 };

// Homography: 4 points -> matrix3d (adjugate method).
function adj(m: number[]) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}
function multmm(a: number[], b: number[]) {
  const c = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) c[3 * i + j] += a[3 * i + k] * b[3 * k + j];
  return c;
}
function multmv(m: number[], v: number[]) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
function basisToPoints(p1: Pt, p2: Pt, p3: Pt, p4: Pt) {
  const m = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1];
  const v = multmv(adj(m), [p4.x, p4.y, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
function matrix3dFor(c: Corners, cw: number, ch: number): string {
  // source: the BASE rect; destination: the corners in container px
  const px = (p: Pt): Pt => ({ x: (p.x / 100) * cw, y: (p.y / 100) * ch });
  const src = basisToPoints({ x: 0, y: 0 }, { x: BASE.w, y: 0 }, { x: 0, y: BASE.h }, { x: BASE.w, y: BASE.h });
  const dst = basisToPoints(px(c.tl), px(c.tr), px(c.bl), px(c.br));
  const t = multmm(dst, adj(src)).map((x, _, arr) => x / arr[8]);
  // column-major matrix3d
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

const CORNER_KEYS: (keyof Corners)[] = ['tl', 'tr', 'br', 'bl'];
const round = (c: Corners): Corners =>
  Object.fromEntries(
    CORNER_KEYS.map((k) => [k, { x: +c[k].x.toFixed(1), y: +c[k].y.toFixed(1) }]),
  ) as Corners;

export default function MockupScreens() {
  const [calib, setCalib] = useState(false);
  const [q, setQ] = useState(SCREENS);
  const [size, setSize] = useState({ w: 620, h: 620 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: Key; corner: keyof Corners; rect: DOMRect } | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('calibrate')) setCalib(true);
    // re-derive the matrices when the mockup container resizes
    const parent = wrapRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  function downCorner(key: Key, corner: keyof Corners) {
    return (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = wrapRef.current?.parentElement;
      if (!parent) return;
      drag.current = { key, corner, rect: parent.getBoundingClientRect() };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const x = ((e.clientX - d.rect.left) / d.rect.width) * 100;
    const y = ((e.clientY - d.rect.top) / d.rect.height) * 100;
    setQ((prev) => ({
      ...prev,
      [d.key]: { ...prev[d.key], [d.corner]: { x: +x.toFixed(1), y: +y.toFixed(1) } },
    }));
  }
  const stop = () => (drag.current = null);

  const layerStyle = (key: Key): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: BASE.w,
    height: BASE.h,
    transformOrigin: '0 0',
    transform: matrix3dFor(q[key], size.w, size.h),
    fontSize: 15,
    pointerEvents: 'none',
    outline: calib ? '1.5px dashed rgba(0,82,255,0.7)' : undefined,
    zIndex: key === 'back' ? 1 : 3, // the back screen sits under the front-phone patch
  });

  // Patch: the original image clipped to the front phone, layered between back (z1) and front (z3) so the back screen goes under it.
  const patchStyle = ((): React.CSSProperties => {
    const c = q.front;
    const cx = (c.tl.x + c.tr.x + c.br.x + c.bl.x) / 4;
    const cy = (c.tl.y + c.tr.y + c.br.y + c.bl.y) / 4;
    // Margin = the bezel (~12%); a larger mask erases the back screen before the bezel.
    const f = 1.12;
    const ex = (p: Pt) => `${(cx + (p.x - cx) * f).toFixed(1)}% ${(cy + (p.y - cy) * f).toFixed(1)}%`;
    return {
      position: 'absolute',
      inset: 0,
      backgroundImage: "url('/mockups/iphones-isometric.svg')",
      backgroundSize: '100% 100%',
      clipPath: `polygon(${ex(c.tl)}, ${ex(c.tr)}, ${ex(c.br)}, ${ex(c.bl)})`,
      pointerEvents: 'none',
      zIndex: 2,
    };
  })();

  const dot = (key: Key, corner: keyof Corners, i: number) => (
    <span
      key={`${key}-${corner}`}
      onPointerDown={downCorner(key, corner)}
      onPointerMove={onMove}
      onPointerUp={stop}
      style={{
        position: 'absolute',
        left: `${q[key][corner].x}%`,
        top: `${q[key][corner].y}%`,
        transform: 'translate(-50%, -50%)',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: key === 'front' ? '#0052ff' : '#ff8a00',
        border: '2.5px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        color: '#fff',
        font: '700 11px/17px monospace',
        textAlign: 'center',
        cursor: 'grab',
        zIndex: 10,
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
    >
      {i + 1}
    </span>
  );

  return (
    <>
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* front phone: chat */}
        <div className={s.screenFront} style={layerStyle('front')}>
          <span className={s.scrPill}>gemini-pro</span>
          <div className={s.scrBubbleU}>Draft my launch plan. And keep it between us.</div>
          <div className={s.scrBubbleA}>Deal. Nothing here is stored. Week 1: quiet beta…</div>
          <div className={`${s.scrBubbleA} ${s.scrTypingWrap}`}>
            <span className={s.typing}>
              <span className={s.typingDot} />
              <span className={s.typingDot} />
              <span className={s.typingDot} />
            </span>
          </div>
          <div className={s.scrInput}>
            Message… <span className={s.scrSend}>↑</span>
          </div>
        </div>

        {/* back phone: splash */}
        <div className={s.screenBack} style={layerStyle('back')}>
          <span className={s.scrLogo}>
            Shadow<span>Router</span>
          </span>
          <span className={s.scrPrivate}>Private mode · history off</span>
        </div>

        {/* front-phone mask over the back layer */}
        <div style={patchStyle} aria-hidden />

        {calib && CORNER_KEYS.map((c, i) => dot('front', c, i))}
        {calib && CORNER_KEYS.map((c, i) => dot('back', c, i))}
      </div>

      {calib && (
        <div
          style={{
            position: 'fixed',
            left: 16,
            bottom: 16,
            zIndex: 99,
            background: '#0a0b0d',
            color: '#e9ebee',
            borderRadius: 12,
            padding: '14px 16px',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.7,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            maxWidth: 360,
          }}
        >
          <div style={{ opacity: 0.7, marginBottom: 6 }}>
            Drag the dots to the screen corners: 1=top-left · 2=top-right · 3=bottom-right · 4=bottom-left.
            Blue = front phone, orange = back phone.
          </div>
          <button
            style={{
              background: '#0052ff',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
              font: 'inherit',
            }}
            onClick={() =>
              navigator.clipboard.writeText(
                `front: ${JSON.stringify(round(q.front))},\nback: ${JSON.stringify(round(q.back))},`,
              )
            }
          >
            Copy values
          </button>
        </div>
      )}
    </>
  );
}
