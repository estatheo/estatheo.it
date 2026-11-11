// Projects page, Ascolta: the devices that listen, then the notes they make. Over a 24-hour
// axis, an iPhone and two AirPods hear one half of the day and a Mac the other (drawn as
// plain shapes, no logos). The day's sound runs along the axis as a line of dots, which folds
// into six episodes; each becomes a small note page in an Obsidian vault, linked to one daily
// note and some to each other, filed without anyone doing it. Canvas 2D, 96 dots.
import { palette, fit, timeline, text, dotted, lerp, ease, seg, rng } from './stage.js';

const EP = 6, PER = 16, M = EP * PER;
// Where each episode ends up in the vault, as [column, row], around the daily note.
const HOME = [[0.16, 0.6], [0.36, 0.52], [0.64, 0.52], [0.84, 0.6], [0.72, 0.86], [0.28, 0.86]];
const NAME = ['walk', 'call', 'idea', 'lunch', 'gym', 'note'];
const NOTE = [0.5, 0.72];
// Episodes that share a person or a topic link to each other too.
const LINKS = [[0, 1], [2, 3], [1, 2], [4, 5]];
// Which device hears which part of the day: [from, to, label], as fractions of the axis.
const DEVICES = [[0, 0.5, 'iPhone + AirPods'], [0.5, 1, 'Mac']];

export default function ascolta(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const r = rng(41);
  const amp = Array.from({ length: EP }, () => 0.45 + r() * 0.55), freq = Array.from({ length: EP }, () => 0.9 + r() * 1.3);
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  // the devices, as line drawings standing on a baseline y, centred on x, about d tall
  function phone(ctx, x, y, d) {
    const pw = d * 0.5, ph = d, rr = pw * 0.22;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - pw / 2, y - ph, pw, ph, rr) : ctx.rect(x - pw / 2, y - ph, pw, ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - pw * 0.15, y - ph * 0.9); ctx.lineTo(x + pw * 0.15, y - ph * 0.9); ctx.stroke();
  }
  function earbud(ctx, x, y, d, flip) {
    const hr = d * 0.16;
    ctx.beginPath(); ctx.arc(x, y - d * 0.62, hr, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + flip * hr * 0.4, y - d * 0.62 + hr * 0.9); ctx.lineTo(x + flip * hr * 0.4, y - d * 0.12); ctx.stroke();
  }
  function laptop(ctx, x, y, d) {
    const sw = d * 1.35, sh = d * 0.78;
    ctx.strokeRect(x - sw / 2, y - sh - d * 0.12, sw, sh);
    ctx.beginPath(); ctx.moveTo(x - sw / 2, y - d * 0.12); ctx.lineTo(x + sw / 2, y - d * 0.12); ctx.lineTo(x + sw * 0.58, y); ctx.lineTo(x - sw * 0.58, y); ctx.closePath(); ctx.stroke();
  }
  // a note page with a folded corner, centred on (x, y), half width a, half height b
  function page(ctx, x, y, a, b, ink, lines) {
    const f = a * 0.55;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.fillStyle = pal.bg;
    ctx.beginPath(); ctx.moveTo(x - a, y - b); ctx.lineTo(x + a - f, y - b); ctx.lineTo(x + a, y - b + f); ctx.lineTo(x + a, y + b); ctx.lineTo(x - a, y + b); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + a - f, y - b); ctx.lineTo(x + a - f, y - b + f); ctx.lineTo(x + a, y - b + f); ctx.stroke();
    if (lines) { ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const ly = y - b * 0.25 + k * b * 0.38; ctx.beginPath(); ctx.moveTo(x - a * 0.6, ly); ctx.lineTo(x + a * (k === 2 ? 0.1 : 0.6), ly); ctx.stroke(); } }
  }
  // a point on the outline of a page, k of n, going round from the top left
  function rim(x, y, a, b, k, n) {
    const P = 4 * (a + b), d = (k / n) * P;
    if (d < 2 * a) return [x - a + d, y - b];
    if (d < 2 * a + 2 * b) return [x + a, y - b + (d - 2 * a)];
    if (d < 4 * a + 2 * b) return [x + a - (d - 2 * a - 2 * b), y + b];
    return [x - a, y + b - (d - 4 * a - 2 * b)];
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const pill = (fig.querySelector('.pill')?.offsetHeight || 20) + 6;
    const fs = Math.max(7, Math.min(11, w / 40));
    const x0 = w * 0.05, x1 = w * 0.95;
    const d = Math.max(14, Math.min(28, h * 0.09)); // device size
    const devY = pill + d + 2, labY = devY + fs * 0.9, brY = labY + fs * 0.9;
    const baseY = brY + Math.max(12, h * 0.1) + 6;
    const amH = Math.max(12, h * 0.1); // room for the sound above and below the axis
    const vy0 = baseY + amH + 6, vy1 = h - 1; // the vault's frame
    const R = Math.max(5, Math.min(11, w * 0.026)), A = R * 0.78; // a page: half height R, half width A
    const iy0 = vy0 + fs * 2.9 + R, iy1 = vy1 - R - fs * 1.6;
    const vmap = (v) => lerp(iy0, iy1, (v - 0.52) / (0.86 - 0.52));
    const node = (e) => ({ x: w * HOME[e][0], y: vmap(HOME[e][1]) });
    const note = { x: w * NOTE[0], y: vmap(NOTE[1]) };

    // the devices over each half of the day, and a bracket for the half they hear
    const dev = seg(t, 0.2, 0.8);
    if (dev > 0) {
      ctx.globalAlpha = dev;
      DEVICES.forEach(([a, b, label], i) => {
        const ax = lerp(x0, x1, a) + (i ? 3 : 0), bx = lerp(x0, x1, b) - (i ? 0 : 3), mx = (ax + bx) / 2;
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.2;
        if (i === 0) { phone(ctx, mx - d * 0.3, devY, d); earbud(ctx, mx + d * 0.25, devY, d, -1); earbud(ctx, mx + d * 0.6, devY, d, 1); }
        else laptop(ctx, mx, devY, d);
        text(ctx, label, mx, labY, pal.grey, 'center', 400, Math.min(fs, (bx - ax) / (label.length * 0.62)));
        ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, brY + 5); ctx.lineTo(ax, brY); ctx.lineTo(bx, brY); ctx.lineTo(bx, brY + 5); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // the day's axis
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x1, baseY); ctx.stroke();
    text(ctx, '00:00', x0, baseY + fs * 0.9, pal.grey, 'left', 400, fs);
    text(ctx, '24:00', x1, baseY + fs * 0.9, pal.grey, 'right', 400, fs);

    // the vault: a frame with its name, where the notes end up
    const vin = seg(t, 1.4, 1.9);
    if (vin > 0) {
      ctx.globalAlpha = vin;
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(0.5, vy0, w - 1, vy1 - vy0);
      text(ctx, 'Obsidian vault', 6, vy0 + fs * 0.95, pal.grey, 'left', 700, fs);
      ctx.globalAlpha = 1;
    }
    // the daily note, which every episode links to
    const noteIn = seg(t, 1.6, 2.1);
    const nlabel = 'daily note', nhw = nlabel.length * fs * 0.31 + 6;
    if (noteIn > 0) {
      ctx.globalAlpha = noteIn;
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.2; ctx.strokeRect(note.x - nhw, note.y - fs * 0.85, nhw * 2, fs * 1.7);
      text(ctx, nlabel, note.x, note.y, pal.fg, 'center', 700, fs);
      ctx.globalAlpha = 1;
    }

    // links: each episode to the daily note, then episodes to each other
    const hh = fs * 0.85 + 2;
    for (let e = 0; e < EP; e++) {
      const u = ease(seg(t, 3.3 + e * 0.07, 3.9 + e * 0.07));
      if (!u) continue;
      const p = node(e), dx = note.x - p.x, dy = note.y - p.y, dd = Math.hypot(dx, dy);
      const end = 1 - Math.min(dx ? (nhw + 2) / Math.abs(dx) : 1, dy ? hh / Math.abs(dy) : 1);
      const ax = p.x + dx / dd * (R + 3), ay = p.y + dy / dd * (R + 3);
      const bx = p.x + dx * end, by = p.y + dy * end;
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, u), lerp(ay, by, u)); ctx.stroke();
    }
    LINKS.forEach(([a, b], k) => {
      const u = ease(seg(t, 4.1 + k * 0.1, 4.7 + k * 0.1));
      if (!u) return;
      const p = node(a), q = node(b), dd = Math.hypot(q.x - p.x, q.y - p.y), g = (R + 4) / dd;
      dotted(ctx, lerp(p.x, q.x, g), lerp(p.y, q.y, g), lerp(p.x, q.x, 1 - g), lerp(p.y, q.y, 1 - g), pal.accent, u);
    });

    // the pages, once their dots have folded in
    for (let e = 0; e < EP; e++) {
      const a = seg(t, 2.9 + e * 0.16, 3.3 + e * 0.16);
      if (!a) continue;
      const n = node(e);
      ctx.globalAlpha = a; page(ctx, n.x, n.y, A, R, pal.fg, R >= 7); ctx.globalAlpha = 1;
    }
    // the dots: on the line first, then each episode folds onto the outline of its page
    for (let j = 0; j < M; j++) {
      const e = Math.floor(j / PER), k = j % PER;
      if (t < (j / M) * 1.3) continue;
      const u = k / (PER - 1);
      const wx = lerp(x0, x1, j / (M - 1));
      const wy = baseY + Math.sin(u * Math.PI) * amp[e] * Math.sin(j * freq[e]) * amH;
      const f = ease(seg(t, 1.7 + e * 0.16, 2.9 + e * 0.16));
      const n = node(e), [rx, ry] = rim(n.x, n.y, A, R, k, PER);
      const gone = seg(t, 2.9 + e * 0.16, 3.3 + e * 0.16); // the page takes over from its dots
      if (gone >= 1) continue;
      ctx.globalAlpha = 1 - gone;
      ctx.beginPath(); ctx.arc(lerp(wx, rx, f), lerp(wy, ry, f), 1.4, 0, 6.2832); ctx.fillStyle = pal.fg; ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (let e = 0; e < EP; e++) {
      const a = seg(t, 2.9 + e * 0.16, 3.3 + e * 0.16);
      if (!a) continue;
      const n = node(e), below = HOME[e][1] > NOTE[1] || e === 0 || e === 3;
      ctx.globalAlpha = a; text(ctx, NAME[e], n.x, n.y + (below ? R + fs * 0.95 : -R - fs * 0.8), pal.fg, 'center', 400, fs); ctx.globalAlpha = 1;
    }
  }

  tl = timeline(fig, 5.1, draw);
}
