// Work, fig. 4: what a DeFi aggregator does. One swap is quoted against three pools,
// split across them, and the parts arrive together. The transaction then lands
// in a block, which is proposed, attested and at last final.
// Nothing here is real chain data: the split is drawn as dots, with no figures.
import { palette, fit, timeline, text, dotted, lerp, ease, seg } from './stage.js';

const SPLIT = [5, 3, 1]; // dots sent through each pool
const STATE = ['proposed', 'attested', 'final'];

export default function route(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const a = { x: w * 0.1, y: h * 0.37 }, b = { x: w * 0.9, y: h * 0.37 };
    const pools = [0.19, 0.37, 0.55].map((y) => ({ x: w * 0.5, y: h * y }));
    const pad = Math.min(34, w * 0.075);

    // quotes: a dotted line out to each pool and on to the other side
    pools.forEach((p, k) => {
      const u = ease(seg(t, 0.3 + k * 0.25, 0.9 + k * 0.25));
      if (!u) return;
      dotted(ctx, a.x + 22, a.y, p.x - pad, p.y, pal.line, u);
      if (u >= 1) dotted(ctx, p.x + pad, p.y, b.x - 22, b.y, pal.line, ease(seg(t, 0.9 + k * 0.25, 1.3 + k * 0.25)));
    });
    text(ctx, 'A', a.x, a.y, pal.fg, 'center', 700, 14);
    text(ctx, 'B', b.x, b.y, pal.fg, 'center', 700, 14);
    text(ctx, 'token in', a.x, a.y + 20, pal.grey, 'center', 400, 11);
    text(ctx, 'token out', b.x, b.y + 20, pal.grey, 'center', 400, 11);
    pools.forEach((p, k) => {
      if (t < 0.3 + k * 0.25) return;
      text(ctx, `[ pool ${k + 1} ]`, p.x, p.y, pal.fg);
    });

    // the split: dots travel A to pool to B, more through the better pool
    let arrived = 0, n = 0;
    SPLIT.forEach((count, k) => {
      for (let j = 0; j < count; j++, n++) {
        const s = 1.9 + n * 0.09, u = seg(t, s, s + 1.3);
        if (u <= 0) continue;
        if (u >= 1) { arrived++; continue; }
        const p = pools[k], off = (j - (count - 1) / 2) * 3;
        const first = u < 0.5, v = ease(first ? u * 2 : u * 2 - 1);
        const x = first ? lerp(a.x + 22, p.x - pad, v) : lerp(p.x + pad, b.x - 22, v);
        const y = (first ? lerp(a.y, p.y, v) : lerp(p.y, b.y, v)) + off;
        if (Math.abs(u - 0.5) < 0.04) continue; // inside the pool
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.2832); ctx.fillStyle = pal.accent; ctx.fill();
      }
    });
    const total = SPLIT.reduce((x, y) => x + y, 0);
    if (arrived === total) text(ctx, 'one swap, three pools', w * 0.5, h * 0.68, pal.fg, 'center', 400, 11);

    // the chain: four blocks, and the one that carries the swap
    const by = h * 0.84, size = Math.min(26, w * 0.06), gap = size * 2.1, x0 = w * 0.5 - gap * 2;
    const landed = seg(t, 3.9, 4.3), stage = t >= 5.7 ? 2 : t >= 5.0 ? 1 : 0;
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * gap, mine = i === 3, next = i === 4;
      if (mine && landed <= 0) continue;
      if (next && stage < 2) continue;
      if (i > 0 && !(mine && landed < 1)) { ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - gap + size / 2, by); ctx.lineTo(x - size / 2, by); ctx.stroke(); }
      ctx.save();
      ctx.lineWidth = 1.5;
      if (mine && stage < 2) { ctx.globalAlpha = landed; ctx.strokeStyle = pal.accent; if (stage === 0) ctx.setLineDash([3, 3]); }
      else if (next) { ctx.strokeStyle = pal.line; ctx.setLineDash([3, 3]); }
      else ctx.strokeStyle = pal.fg;
      ctx.strokeRect(x - size / 2, by - size / 2, size, size);
      if (!next && !(mine && stage < 2)) { ctx.fillStyle = pal.fg; ctx.fillRect(x - size / 2 + 4, by - size / 2 + 4, size - 8, size - 8); }
      if (mine && stage === 1) { ctx.fillStyle = pal.accent; ctx.fillRect(x - size / 2 + 4, by - size / 2 + 4, size - 8, size - 8); }
      ctx.restore();
    }
    text(ctx, 'chain', x0 - size / 2, by - size / 2 - 12, pal.grey, 'left', 400, 11);
    if (landed >= 1) text(ctx, `block with the swap: ${STATE[stage]}`, w * 0.5, by + size / 2 + 14, stage === 2 ? pal.fg : pal.grey, 'center', 400, 11);
  }

  tl = timeline(fig, 6.1, draw);
}
