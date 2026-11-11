// Projects, Loafy: agents run the small business, and the concept render is one job among
// theirs, made in passes. Top: a desk per job the factory really has for this venture
// (research, brand, claims, site, copy, ads, email, outreach, deck, the weekly loop), each
// with an agent, and the three owner gates, which wait for me. Bottom: the render in passes,
// scene, draft, a check against the brief and the claims list, a revised pass, then the
// final render, which is the real image under the canvas with its required caption.
// The earlier passes are drawn here from the final render (a grey clay version, a coarse
// noisy one, a sharper one with the caption added): they show the idea, not saved files.
// Canvas 2D; the image is the page's own <img>, so nothing extra is fetched.
import { palette, fit, timeline, text, dotted, lerp, ease, seg, rng } from './stage.js';

// [label, time it starts]. Gates: [name, time the work reaches it]. None is signed: the venture's
// own folder has gate 1 (name, market, budget) still open, so all three wait for me.
const DESKS = [['research', 0.4], ['brand', 1.15], ['claims', 1.4], ['site', 2.05], ['copy', 2.25],
  ['ads', 2.45], ['email', 2.65], ['outreach', 2.85], ['deck', 3.05], ['weekly', 3.25]];
const GATES = [['gate 1', 0.95], ['gate 2', 1.8], ['gate 3', 3.5]];
const WORK = 0.35; // how long a desk shows as busy
// The render: [label, appears at]
const PASSES = [['scene', 3.8], ['draft', 4.6], ['check', 5.4], ['revised', 6.3]];
const FINAL = 7.2, END = 8.2;

export default function loafy(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const img = fig.querySelector('.render img'), render = fig.querySelector('.render');
  let tl = null, frames = null;
  // The stage's height follows what it holds at this width (css sets a close guess first).
  const stage = fig.querySelector('.stage');
  const env = fit(fig.querySelector('canvas'), ({ w, h }) => {
    const want = Math.ceil(layout(w).bottom);
    if (Math.abs(want - h) > 2) { stage.style.aspectRatio = `${Math.round(w)} / ${want}`; return; }
    tl && tl.paint();
  });

  // The passes, made once from the final image when it has loaded.
  function makeFrames() {
    const at = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return [c, x]; };
    // scene: untextured grey clay where the shoes are, on a plain floor
    const [clay, cx] = at(160, 90), d = cx.getImageData(0, 0, 160, 90);
    for (let i = 0; i < d.data.length; i += 4) {
      const [r, g, b] = d.data.slice(i, i + 3), lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const shoe = r > 45 && r > b * 1.5; // the leather is red and brown, the room grey
      const v = shoe ? 95 + lum * 0.9 : 26 + (i / 4 / 160 > 30 ? 10 : 0);
      d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.min(225, v);
    }
    cx.putImageData(d, 0, 0);
    // draft: few samples, small, grainy
    const [draft, dx] = at(48, 27), dd = dx.getImageData(0, 0, 48, 27), r = rng(7);
    for (let i = 0; i < dd.data.length; i += 4) { const n = (r() - 0.5) * 70; for (let k = 0; k < 3; k++) dd.data[i + k] = Math.max(0, Math.min(255, dd.data[i + k] * 0.85 + n)); }
    dx.putImageData(dd, 0, 0);
    // revised: sharper, with the caption burned in along the bottom
    const [rev, rx] = at(240, 135), rr = rng(9), rd = rx.getImageData(0, 0, 240, 135);
    for (let i = 0; i < rd.data.length; i += 4) { const n = (rr() - 0.5) * 22; for (let k = 0; k < 3; k++) rd.data[i + k] = Math.max(0, Math.min(255, rd.data[i + k] + n)); }
    rx.putImageData(rd, 0, 0);
    rx.fillStyle = 'rgba(0,0,0,0.6)'; rx.fillRect(0, 122, 240, 13);
    rx.fillStyle = '#e8e8ea'; rx.fillRect(132, 127, 100, 3);
    frames = { clay, draft, rev };
    tl && tl.paint();
  }
  if (img.complete && img.naturalWidth) makeFrames(); else img.addEventListener('load', makeFrames, { once: true });

  // A small agent at a desk: a head with two eyes behind a screen on a desk line.
  function desk(ctx, x, y, s, state) { // state 0 waiting, 1 busy, 2 done
    const ink = state === 1 ? pal.accent : state === 2 ? pal.fg : pal.line;
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.2;
    ctx.strokeRect(x - s * 0.32, y - s * 0.95, s * 0.64, s * 0.5); // the agent's head
    ctx.fillRect(x - s * 0.17, y - s * 0.78, s * 0.09, s * 0.12); ctx.fillRect(x + s * 0.08, y - s * 0.78, s * 0.09, s * 0.12);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.95); ctx.lineTo(x, y - s * 1.12); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - s * 1.17, s * 0.05, 0, 6.2832); ctx.fill();
    ctx.fillStyle = pal.bg; ctx.fillRect(x - s * 0.5, y - s * 0.42, s, s * 0.42); // screen, seen from behind
    ctx.strokeRect(x - s * 0.5, y - s * 0.42, s, s * 0.42);
    ctx.beginPath(); ctx.moveTo(x - s * 0.85, y); ctx.lineTo(x + s * 0.85, y); ctx.stroke(); // desk top
    if (state === 2) { ctx.beginPath(); ctx.moveTo(x - s * 0.18, y - s * 0.21); ctx.lineTo(x - s * 0.04, y - s * 0.08); ctx.lineTo(x + s * 0.2, y - s * 0.33); ctx.stroke(); }
    if (state === 1) for (let k = 0; k < 3; k++) ctx.fillRect(x - s * 0.25 + k * s * 0.2, y - s * 0.22, s * 0.08, s * 0.08);
  }
  // me: a round head and shoulders
  function me(ctx, x, y, s, ink) {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y - s * 0.75, s * 0.25, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.45, s * 0.38, 0, Math.PI, 0); ctx.stroke();
  }

  // Where everything goes at width w.
  function layout(w) {
    const narrow = w < 300, cols = narrow ? 3 : 5, rows = Math.ceil(DESKS.length / cols);
    const fs = Math.max(7, Math.min(11, w / 40)), s = Math.min(26, (w / cols) * 0.36);
    const top = fs * 2.2 + s * 1.2, rowH = s * 1.2 + fs * 2.4, cw = w / cols;
    const gy = top + rows * rowH - s * 0.2, gl = fs * 1.5;
    const ry = gy + fs * 2.8 + (narrow ? gl : 0);
    const gap = w * 0.025, fw = (w - gap * (PASSES.length - 1)) / PASSES.length, fh = fw * 9 / 16, fy = ry + fs * 1.2;
    return { narrow, fs, s, top, rowH, cw, cols, gy, gl, ry, gap, fw, fh, fy, bottom: fy + fh + fs * 4.2 };
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const { narrow, fs, s, top, rowH, cw, cols, gy, gl, ry, gap, fw, fh, fy } = layout(w);
    const head = (s, y) => text(ctx, s, 0, y, pal.grey, 'left', 700, fs);

    // THE BUSINESS: a desk per job
    head('THE BUSINESS, RUN BY AGENTS', fs);
    DESKS.forEach(([label, at], i) => {
      const x = cw * (i % cols + 0.5), y = top + Math.floor(i / cols) * rowH;
      const state = t < at ? 0 : t < at + WORK ? 1 : 2;
      desk(ctx, x, y, s, state);
      text(ctx, label, x, y + fs * 1.05, state ? pal.fg : pal.grey, 'center', 400, fs);
    });
    // the gates: me, then three gates that wait for me
    me(ctx, s * 0.5, gy + fs * 0.5, s * 0.8, pal.fg);
    // side by side, or on a narrow stage one under the other
    const gx0 = s * 1.3, gw = (w - gx0) / 3;
    GATES.forEach(([label, reached], i) => {
      const x = narrow ? gx0 : gx0 + gw * i, yy = narrow ? gy - gl + i * gl : gy, waiting = t >= reached;
      text(ctx, `${label}: ${waiting ? 'waiting' : '...'}`, x, yy + fs * 0.25, waiting ? pal.accent : pal.grey, 'left', waiting ? 700 : 400, fs);
    });

    // THE RENDER, IN PASSES
    head('THE CONCEPT RENDER, PASS BY PASS', ry);
    PASSES.forEach(([label, at], i) => {
      const x = i * (fw + gap), a = seg(t, at, at + 0.35);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, fy + 0.5, fw - 1, fh - 1);
      if (a > 0) {
        ctx.globalAlpha = a;
        if (frames) {
          ctx.imageSmoothingEnabled = i !== 1 && i !== 2; // the draft stays blocky
          const src = i === 0 ? frames.clay : i === 3 ? frames.rev : frames.draft;
          ctx.drawImage(src, x + 1, fy + 1, fw - 2, fh - 2);
          ctx.imageSmoothingEnabled = true;
        } else { ctx.fillStyle = '#222'; ctx.fillRect(x + 1, fy + 1, fw - 2, fh - 2); }
        if (i === 2) { // the check: the draft, dimmed, read against the brief and the claims list
          ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(x + 1, fy + 1, fw - 2, fh - 2);
          const cs = Math.max(6, Math.min(9, fw / 11)), lines = [['brief', 'ok'], ['claims', 'ok'], ['caption', 'add']];
          lines.forEach(([k, v], j) => {
            if (t < at + 0.25 + j * 0.2) return;
            const ly = fy + fh * (0.25 + j * 0.25), ink = v === 'ok' ? '#d6d6d8' : '#4f95e0';
            if (fw < 70) { text(ctx, k, x + fw / 2, ly, ink, 'center', v === 'ok' ? 400 : 700, cs); return; } // too small for two columns
            text(ctx, k, x + fw * 0.08, ly, '#d6d6d8', 'left', 400, cs);
            text(ctx, v, x + fw * 0.92, ly, ink, 'right', 700, cs);
          });
        }
        ctx.globalAlpha = 1;
      }
      text(ctx, fw > 60 ? `${i + 1} ${label}` : label, x, fy + fh + fs * 0.95, a > 0 ? pal.fg : pal.grey, 'left', 400, fs);
      if (i < PASSES.length - 1) dotted(ctx, x + fw + 2, fy + fh / 2, x + fw + gap - 2, fy + fh / 2, pal.line, 1);
    });
    // the last pass hands down to the final render, under the canvas
    const f = seg(t, FINAL - 0.4, FINAL);
    if (f > 0) {
      const x = w - fw / 2;
      dotted(ctx, x, fy + fh + fs * 1.8, x, h - 2, pal.accent, ease(f));
      text(ctx, fw > 60 ? '5 final' : 'final', x - 6, h - fs * 0.6, pal.fg, 'right', 700, fs);
    }
    const r = ease(seg(t, FINAL, FINAL + 0.5));
    render.classList.toggle('off', r === 0);
    render.style.opacity = String(lerp(0, 1, r));
  }

  tl = timeline(fig, END, draw);
}
