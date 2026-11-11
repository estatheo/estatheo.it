// Work, fig. 2: the NewDay OCR tool. Eighty marks are the eighty operators who handled
// CCI requests by hand. A scan line passes and seventy-five drop out; five stay.
// Beside them, the fourteen days a request took shrink to one or two.
// The figures (80, 5, two weeks, one or two days) are the owner's own.
import { palette, fit, timeline, text, lerp, ease, seg, clamp } from './stage.js';

const COLS = 10, ROWS = 8, N = COLS * ROWS, DAYS = 14;
const KEEP = new Set([12, 27, 41, 56, 73]); // the five who remain, spread over the grid

export default function ocr(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const gx0 = w * 0.06, gx1 = w * 0.46, gy0 = h * 0.3, gy1 = h * 0.72;
    const cx = (c) => lerp(gx0, gx1, c / (COLS - 1)), cy = (r) => lerp(gy0, gy1, r / (ROWS - 1));
    const r = Math.min(4.5, w * 0.011);

    // the scan line crosses the grid from left to right
    const scan = seg(t, 1.6, 3.4), sx = lerp(gx0 - 14, gx1 + 14, ease(scan));
    let left = 0;
    for (let i = 0; i < N; i++) {
      const c = i % COLS, row = Math.floor(i / COLS);
      if (t < 0.2 + (i / N) * 1.0) continue; // the operators arrive in reading order
      const passed = scan > 0 && cx(c) < sx, kept = KEEP.has(i);
      ctx.beginPath(); ctx.arc(cx(c), cy(row), r, 0, 6.2832);
      if (!passed || kept) { ctx.fillStyle = passed && scan < 1 ? pal.accent : pal.fg; ctx.fill(); left++; }
      else { ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.stroke(); }
    }
    text(ctx, 'OPERATORS', gx0 - r, h * 0.2, pal.grey, 'left', 700, 11);
    text(ctx, t < 0.2 ? '' : `${left}`, gx0 - r, h * 0.83, pal.fg, 'left', 700, 14);
    if (t >= 0.2) text(ctx, scan >= 1 ? 'operators, after' : 'operators, before', gx0 - r + (left > 9 ? 24 : 16), h * 0.83 + 1, pal.grey, 'left', 400, 11);
    if (scan > 0 && scan < 1) {
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, gy0 - 14); ctx.lineTo(sx, gy1 + 14); ctx.stroke();
      text(ctx, 'OCR', sx, gy0 - 24, pal.fg, 'center', 700, 11);
    }

    // one request, in days: fourteen before, one or two after
    const bx0 = w * 0.58, bx1 = w * 0.94, cell = (bx1 - bx0) / DAYS, s = Math.min(cell - 3, 12);
    text(ctx, 'ONE REQUEST, IN DAYS', bx0, h * 0.2, pal.grey, 'left', 700, 11);
    const bar = (y, n, grow, hollowFrom) => {
      for (let d = 0; d < n; d++) {
        if (d / n >= grow) break;
        const x = bx0 + d * cell;
        if (d >= hollowFrom) { ctx.save(); ctx.strokeStyle = pal.fg; ctx.setLineDash([2, 2]); ctx.strokeRect(x + 0.5, y - s / 2 + 0.5, s - 1, s - 1); ctx.restore(); }
        else { ctx.fillStyle = pal.fg; ctx.fillRect(x, y - s / 2, s, s); }
      }
    };
    const before = seg(t, 0.4, 1.4), after = seg(t, 3.5, 4.1);
    if (before > 0) { text(ctx, 'before', bx0, h * 0.33, pal.grey, 'left', 400, 11); bar(h * 0.41, DAYS, before, DAYS); }
    if (before >= 1) text(ctx, 'two weeks', bx0, h * 0.49, pal.fg, 'left', 400, 11);
    if (after > 0) { text(ctx, 'after', bx0, h * 0.62, pal.grey, 'left', 400, 11); bar(h * 0.7, 2, clamp(after * 1.01), 1); }
    if (after >= 1) text(ctx, 'one or two days', bx0, h * 0.78, pal.fg, 'left', 400, 11);
  }

  tl = timeline(fig, 4.5, draw);
}
