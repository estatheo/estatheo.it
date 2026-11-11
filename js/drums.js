// Projects page, Bacchette: two sticks play one bar over four zones. Each tip leaves a dotted
// trail; a hit draws a ring and a note-on. The state line follows the firmware:
// idle, armed, fire (while the stick is still braking), refractory.
// The bar repeats, with a rest between bars, because a drum kit is played, not shown
// once. The pad buttons under the figure add a hit of your own.
import { palette, fit, timeline, text, lerp, clamp, seg } from './stage.js';

const ZONES = [['HI-HAT', 0.14], ['SNARE', 0.38], ['TOM', 0.62], ['RIDE', 0.86]];
const SWING = 0.42; // seconds from lift to hit
const BAR = [ // [time, zone, velocity] per stick. Left stick first.
  [[1.15, 1, 96], [2.15, 1, 104], [2.65, 2, 88], [2.9, 2, 112]],
  [[0.65, 0, 72], [1.15, 0, 64], [1.65, 0, 72], [2.15, 0, 64], [3.3, 3, 120]],
];
const STATES = ['IDLE', 'ARMED', 'FIRE', 'REFRACTORY 25 ms'];
const BAR_END = 3.9, PERIOD = 5.6; // one bar, then the sticks rest until the next

export default function drums(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const mine = [[], []]; // hits from the pads, in timeline seconds
  let tl = null, hits = [[], []], hitsFor = '', padVer = 0;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  // The hits near time t: the bar before, this bar and the next, plus any pad hits.
  function hitsAt(t) {
    const k = Math.floor(t / PERIOD), key = `${k}:${padVer}`;
    if (hitsFor === key) return;
    hits = BAR.map((list, stick) => [k - 1, k, k + 1].filter((c) => c >= 0)
      .flatMap((c) => list.map(([at, z, v]) => [at + c * PERIOD, z, v]))
      .concat(mine[stick]).sort((a, b) => a[0] - b[0]));
    hitsFor = key;
  }

  // Where a stick tip is at time t: resting just above its last zone, or swinging to the next.
  function tip(stick, t, w, h) {
    const list = hits[stick], zy = h * 0.6, rest = 16, home = stick ? 0.7 : 0.3;
    let prevX = w * home, next = null, since = 9;
    for (const hit of list) {
      if (t >= hit[0]) { prevX = w * ZONES[hit[1]][1]; since = t - hit[0]; } else { next = hit; break; }
    }
    if (next && t > next[0] - SWING) {
      const u = (t - (next[0] - SWING)) / SWING, nx = w * ZONES[next[1]][1];
      return { x: lerp(prevX, nx, u * u * (3 - 2 * u)), y: zy - rest * (1 - u) - h * 0.34 * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - u * 0.15) * (u < 1 ? 1 : 0), u };
    }
    const bounce = since < 0.22 ? Math.sin((since / 0.22) * Math.PI * 0.5) : 1;
    return { x: prevX, y: zy - rest * bounce, u: -1 };
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    hitsAt(t);
    const zy = h * 0.6, rx = Math.min(46, w * 0.095), ry = rx * 0.32;

    let state = 0;
    ZONES.forEach(([name, zx], z) => {
      ctx.save(); ctx.strokeStyle = pal.line; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(w * zx, zy, rx, ry, 0, 0, 6.2832); ctx.stroke(); ctx.restore();
      text(ctx, name, w * zx, zy + ry + 16, pal.grey, 'center', 400, 11);
    });

    hits.forEach((list, stick) => {
      for (const [at, z, vel] of list) {
        const d = t - at;
        if (d > -0.3 && d < -0.035) state = Math.max(state, 1);
        if (d >= -0.035 && d < 0.05) state = 2;
        if (d >= 0.05 && d < 0.2 && state < 2) state = 3;
        if (d < 0 || d > 0.5) continue;
        const u = d / 0.5, zx = w * ZONES[z][1];
        ctx.globalAlpha = 1 - u; ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(zx, zy, rx * (1 + u * 0.7), ry * (1 + u * 0.7), 0, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = clamp(1.6 - u * 1.6);
        text(ctx, `note-on v=${vel}`, zx, zy - ry - 16 - u * 10 - stick * 14, pal.fg, 'center', 400, 11);
        ctx.globalAlpha = 1;
      }
      // trail: where the tip was over the last 0.3 s
      for (let k = 18; k >= 1; k--) {
        const p = tip(stick, t - k * 0.017, w, h);
        if (p.u < 0) continue;
        ctx.globalAlpha = (1 - k / 19) * 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, 6.2832); ctx.fillStyle = pal.fg; ctx.fill();
      }
      ctx.globalAlpha = 1;
      const p = tip(stick, t, w, h), hand = { x: w * (stick ? 0.62 : 0.38), y: h * 1.2 };
      const len = Math.hypot(hand.x - p.x, hand.y - p.y), k = Math.min(1, (h * 0.36) / len);
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, hand.x, k), lerp(p.y, hand.y, k)); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.2832); ctx.fillStyle = pal.fg; ctx.fill();
    });

    // firmware state line
    let x = w * 0.03;
    STATES.forEach((s, i) => {
      text(ctx, s, x, h * 0.08, i === state ? pal.fg : pal.grey, 'left', i === state ? 700 : 400, 11);
      x += ctx.measureText(s).width + 8;
      if (i < STATES.length - 1) { text(ctx, '>', x, h * 0.08, pal.grey, 'left', 400, 11); x += 14; }
    });
  }

  // Under reduced motion the figure is the end of the first bar: sticks at rest over the zones.
  tl = timeline(fig, BAR_END, draw, { loop: true, fps: 30, still: BAR_END });
  fig.querySelectorAll('[data-hit]').forEach((btn) => btn.addEventListener('click', () => {
    const z = Number(btn.dataset.hit), stick = z < 2 ? (z === 0 ? 1 : 0) : (z === 3 ? 1 : 0);
    const now = tl.now(), own = mine[stick];
    const at = Math.max(now + SWING * 0.8, own.length ? own[own.length - 1][0] + 0.16 : 0);
    while (own.length && own[0][0] < now - 2) own.shift(); // forget hits long gone
    own.push([at, z, 100]); padVer++;
    tl.resume(); // playing a drum is asking for sound, so a paused figure starts again
    tl.paint();
  }));
}
