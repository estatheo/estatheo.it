// Projects page, Ascolta: one day of sound is drawn as a line along a 24-hour axis,
// heard by the iPhone and AirPods for part of the day and by the Mac for the rest.
// The line then folds into six episodes, which link to one daily note and to each
// other: notes in an Obsidian vault, filed without anyone doing it. Canvas 2D, 96 dots.
import { palette, fit, timeline, text, dotted, lerp, ease, seg, rng } from './stage.js';

const EP = 6, PER = 16, M = EP * PER;
// Where each episode ends up, as [column, row], around the daily note.
const HOME = [[0.16, 0.6], [0.36, 0.52], [0.64, 0.52], [0.84, 0.6], [0.72, 0.86], [0.28, 0.86]];
const NAME = ['walk', 'call', 'idea', 'lunch', 'gym', 'note'];
const NOTE = [0.5, 0.72];
// Episodes that share a person or a topic link to each other too.
const LINKS = [[0, 1], [2, 3], [1, 2], [4, 5]];
// Which device hears which part of the day: [from, to, label], as fractions of the axis.
const DEVICES = [[0, 0.5, 'IPHONE + AIRPODS'], [0.5, 1, 'MAC']];

export default function ascolta(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const r = rng(41);
  const amp = Array.from({ length: EP }, () => 0.45 + r() * 0.55), freq = Array.from({ length: EP }, () => 0.9 + r() * 1.3);
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const baseY = h * 0.25, R = Math.min(12, w * 0.028);
    const x0 = w * 0.05, x1 = w * 0.95;
    const node = (e) => ({ x: w * HOME[e][0], y: h * HOME[e][1] });
    const note = { x: w * NOTE[0], y: h * NOTE[1] };

    // the day's axis, and which device was listening along it
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x1, baseY); ctx.stroke();
    text(ctx, '00:00', x0, baseY + 14, pal.grey, 'left', 400, 11);
    text(ctx, '24:00', x1, baseY + 14, pal.grey, 'right', 400, 11);
    const dev = seg(t, 0.2, 0.8);
    if (dev > 0) {
      ctx.globalAlpha = dev;
      DEVICES.forEach(([a, b, label], i) => {
        const ax = lerp(x0, x1, a) + (i ? 3 : 0), bx = lerp(x0, x1, b) - (i ? 0 : 3), y = baseY - h * 0.09;
        ctx.strokeStyle = pal.line; ctx.beginPath(); ctx.moveTo(ax, y + 6); ctx.lineTo(ax, y); ctx.lineTo(bx, y); ctx.lineTo(bx, y + 6); ctx.stroke();
        text(ctx, label, (ax + bx) / 2, y - 9, pal.grey, 'center', 700, 10);
      });
      ctx.globalAlpha = 1;
    }

    // the daily note, which every episode links to
    const noteIn = seg(t, 1.6, 2.1);
    if (noteIn > 0) {
      ctx.globalAlpha = noteIn;
      text(ctx, '[ daily note ]', note.x, note.y, pal.fg, 'center', 700, 11);
      ctx.globalAlpha = 1;
    }

    // links: each episode to the daily note, then episodes to each other
    const half = 50; // half the width of the daily note's label, so a link stops at it
    for (let e = 0; e < EP; e++) {
      const u = ease(seg(t, 3.3 + e * 0.07, 3.9 + e * 0.07));
      if (!u) continue;
      const p = node(e), dx = note.x - p.x, dy = note.y - p.y, d = Math.hypot(dx, dy);
      // stop at the edge of the note's label: where the line leaves a box half wide by 10 high
      const end = 1 - Math.min(dx ? half / Math.abs(dx) : 1, dy ? 10 / Math.abs(dy) : 1);
      const ax = p.x + dx / d * (R + 4), ay = p.y + dy / d * (R + 4);
      const bx = p.x + dx * end, by = p.y + dy * end;
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, u), lerp(ay, by, u)); ctx.stroke();
    }
    LINKS.forEach(([a, b], k) => {
      const u = ease(seg(t, 4.1 + k * 0.1, 4.7 + k * 0.1));
      if (!u) return;
      const p = node(a), q = node(b), d = Math.hypot(q.x - p.x, q.y - p.y), g = (R + 5) / d;
      dotted(ctx, lerp(p.x, q.x, g), lerp(p.y, q.y, g), lerp(p.x, q.x, 1 - g), lerp(p.y, q.y, 1 - g), pal.accent, u);
    });

    // the dots: on the line first, then each episode curls into a ring
    for (let j = 0; j < M; j++) {
      const e = Math.floor(j / PER), k = j % PER;
      if (t < (j / M) * 1.3) continue;
      const u = k / (PER - 1);
      const wx = lerp(x0, x1, j / (M - 1));
      const wy = baseY + Math.sin(u * Math.PI) * amp[e] * Math.sin(j * freq[e]) * h * 0.1;
      const f = ease(seg(t, 1.7 + e * 0.16, 2.9 + e * 0.16));
      const n = node(e), ang = (k / PER) * 6.2832 - 1.5708;
      const x = lerp(wx, n.x + Math.cos(ang) * R, f), y = lerp(wy, n.y + Math.sin(ang) * R, f);
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 6.2832); ctx.fillStyle = pal.fg; ctx.fill();
    }

    for (let e = 0; e < EP; e++) {
      const a = seg(t, 2.9 + e * 0.16, 3.3 + e * 0.16);
      if (!a) continue;
      const n = node(e), below = HOME[e][1] > NOTE[1] || e === 0 || e === 3;
      ctx.globalAlpha = a; text(ctx, NAME[e], n.x, n.y + (below ? R + 13 : -R - 11), pal.fg, 'center', 400, 11); ctx.globalAlpha = 1;
    }
  }

  tl = timeline(fig, 5.1, draw);
}
