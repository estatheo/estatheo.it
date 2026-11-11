// Projects page, Eddy: the desk pet levels up with how the day goes. A task is
// finished and he eats, a review is done and he celebrates, the
// experience bar fills and he reaches the next level. No amounts are shown for
// the events; the xp count is an example. A level costs 100 xp times the level,
// as on the device. The sprite is Eddy's own pixel art, reduced to
// the page's inks by tools/eddy-art.mjs. Canvas 2D. The day plays once; after it
// he idles, as the pet on the desk does: he stands and blinks every few seconds.
import { palette, fit, timeline, text, clamp, lerp, seg } from './stage.js';
import { SIZE, FRAMES } from './eddy-art.js';

const D = 6.2, IDLE = 8.2, BLINK = 4.5; // the day ends at D; he goes back to idle at IDLE
const NEEDS = ['FOOD', 'DRINK', 'FUN', 'REST'];
const LOG = [
  [0.9, '> task finished   food up, xp up'],
  [2.8, '> review done     fun up, xp up'],
  [4.3, '> level 8'],
];

// Which frame of the sprite is showing at time t.
function pose(t) {
  if (t >= 1.1 && t < 2.3) return Math.floor((t - 1.1) / 0.2) % 2 ? 'eat2' : 'eat1';
  if (t >= 3.0 && t < 4.0) return Math.floor((t - 3.0) / 0.18) % 2 ? 'fight2' : 'fight1';
  if (t >= 4.3 && t < 5.1) return Math.floor((t - 4.3) / 0.2) % 2 ? 'cheer' : 'levelup';
  if (t >= 5.1 && t < 5.6) return 'cheer';
  if (t >= 5.6 && t < IDLE) return 'happy';
  // Idle: a blink every BLINK seconds, and every third one a double blink.
  const u = t >= IDLE ? (t - IDLE) % (BLINK * 3) : t - 0.62 + BLINK - 0.12;
  const b = u % BLINK, double = u >= BLINK * 2;
  return (b > BLINK - 0.12) || (double && b > BLINK - 0.42 && b < BLINK - 0.3) ? 'blink' : 'idle';
}

export default function eddy(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const s = Math.max(2, Math.floor(Math.min(w * 0.36, h * 0.62) / SIZE));
    const x0 = Math.round(w * 0.06), y0 = Math.round(h * 0.2), side = SIZE * s;

    // The sprite, drawn top to bottom as it first appears.
    const rows = Math.ceil(SIZE * seg(t, 0, 0.5)), frame = FRAMES[pose(t)];
    for (const [ch, color] of [['-', pal.line], ['+', pal.grey], ['#', pal.fg], ['*', pal.accent]]) {
      ctx.fillStyle = color;
      for (let r = 0; r < rows; r++) for (let c = 0; c < SIZE; c++) if (frame[r][c] === ch) ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    }

    // What the event gave him, rising from his head.
    for (const [at, label] of [[1.3, '+ FOOD'], [3.15, '+ FUN']]) {
      const u = seg(t, at, at + 1);
      if (u <= 0 || u >= 1) continue;
      ctx.globalAlpha = clamp(2 - u * 2);
      text(ctx, label, x0 + side / 2, y0 - 8 - u * 10, pal.fg, 'center', 700, 11);
      ctx.globalAlpha = 1;
    }

    // Status, to the right of the sprite.
    const x = x0 + side + Math.round(w * 0.07), step = h * 0.085, room = w - x - 8;
    let y = h * 0.24;
    const level = t < 4.3 ? 7 : 8, up = t >= 4.3 && t < 5.1;
    text(ctx, 'EDDY', x, y, pal.fg, 'left', 700, 11);
    text(ctx, `LEVEL ${level}`, x + 40, y, up ? pal.accent : pal.fg, 'left', up ? 700 : 400, 11);
    y += step;
    const xp = level === 8 ? 0 : Math.round(lerp(lerp(680, 695, seg(t, 1.7, 2.1)), 700, seg(t, 3.7, 4.0)));
    const next = level * 100;
    text(ctx, `XP ${xp} / ${next}`, x, y, pal.grey, 'left', 400, 11);
    y += step * 0.62;
    const bw = Math.min(room, 190);
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, Math.round(y - 3) + 0.5, bw, 6);
    ctx.fillStyle = pal.fg; ctx.fillRect(x + 1, Math.round(y - 3) + 1, Math.max(0, (bw - 1) * (level === 8 ? 0 : (xp - 600) / 100)), 5);
    y += step * 1.05;
    const filled = [t < 1.7 ? 2 : 3, 3, t < 3.5 ? 2 : 3, 3], q = Math.max(7, Math.min(10, s * 1.7));
    NEEDS.forEach((name, i) => {
      text(ctx, name, x, y, pal.grey, 'left', 400, 11);
      for (let k = 0; k < 4; k++) {
        const bx = Math.round(x + 46 + k * (q + 4)), by = Math.round(y - q / 2);
        if (k < filled[i]) { ctx.fillStyle = pal.fg; ctx.fillRect(bx, by, q, q); } else { ctx.strokeStyle = pal.line; ctx.strokeRect(bx + 0.5, by + 0.5, q - 1, q - 1); }
      }
      y += step * 0.82;
    });

    // The log under him: one line per event, typed as it happens.
    LOG.forEach(([at, line], i) => {
      const n = Math.floor(line.length * seg(t, at, at + 0.35));
      if (n > 0) text(ctx, line.slice(0, n), x0, h * (0.8 + i * 0.07), i === 2 ? pal.accent : pal.fg, 'left', 400, 11);
    });
  }

  // Idle frames change only on a blink, so ten redraws a second is plenty.
  tl = timeline(fig, D, draw, { loop: true, fps: 10 });
}
