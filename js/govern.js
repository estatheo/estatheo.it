// Work, fig. 5: governance for agents. Three agents each send one action to a policy
// gate. One is allowed by a rule, one waits for a person to approve it, one is
// denied. Whatever happens is written to the audit trail under the diagram,
// which is the same idea as the ledger in fig. 3: nothing without a record.
// An illustration of the idea, not a drawing of any product.
import { palette, fit, timeline, text, dotted, lerp, ease, seg } from './stage.js';

// [starts at, action, outcome, trail text]
const ACTS = [
  [0.5, 'read', 'allow', 'allowed by rule'],
  [1.7, 'pay', 'approve', 'approved by a person'],
  [4.1, 'delete', 'deny', 'denied by rule'],
];

export default function govern(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const ys = [0.29, 0.43, 0.57].map((y) => h * y);
    const ax = w * 0.13, gate = { x: w * 0.5, y: ys[1] }, tools = { x: w * 0.88, y: ys[1] }, person = { x: w * 0.5, y: h * 0.18 };
    const half = Math.min(40, w * 0.09);

    ys.forEach((y) => dotted(ctx, ax + 34, y, gate.x - half, gate.y, pal.line));
    dotted(ctx, gate.x + half, gate.y, tools.x - 34, tools.y, pal.line);
    dotted(ctx, person.x, person.y + 10, gate.x, gate.y - 12, pal.line);

    const trail = [];
    let waiting = false, through = 0;
    ACTS.forEach(([s, name, outcome, line], k) => {
      const y = ys[k];
      text(ctx, '[ agent ]', ax, y, pal.fg);
      if (t < s) return;
      text(ctx, name, ax, y + 15, pal.grey, 'center', 400, 11);
      const go = ease(seg(t, s, s + 0.7));
      let x = lerp(ax + 34, gate.x - half, go), yy = lerp(y, gate.y, go), fill = pal.accent, hollow = false, done = false;
      if (go >= 1) {
        const hold = outcome === 'approve' ? 1.5 : 0.35, d = t - (s + 0.7);
        if (d < hold) { waiting = outcome === 'approve'; hollow = waiting; }
        else if (outcome === 'deny') { x = lerp(ax + 34, gate.x - half, 0.8); yy = lerp(y, gate.y, 0.8); done = true; }
        else {
          const on = ease(seg(d, hold, hold + 0.6));
          x = lerp(gate.x + half, tools.x - 42 - through * 13, on); yy = gate.y;
          if (on >= 1) { fill = pal.fg; done = true; }
          through++;
        }
      }
      if (outcome === 'deny' && done) { ctx.fillStyle = pal.bg; ctx.fillRect(x - 6, yy - 6, 12, 12); text(ctx, 'x', x, yy, pal.fg, 'center', 700, 13); }
      else {
        ctx.beginPath(); ctx.arc(x, yy, 4.5, 0, 6.2832);
        if (hollow) { ctx.fillStyle = pal.bg; ctx.fill(); ctx.strokeStyle = fill; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = fill; ctx.fill(); }
      }
      if (done) trail.push(`0${k + 1}  ${name.padEnd(6)}  ${line}`);
    });

    text(ctx, '[ policy ]', gate.x, gate.y, pal.fg, 'center', 700);
    text(ctx, '[ tools ]', tools.x, tools.y, pal.fg);
    text(ctx, '[ person ]', person.x, person.y, waiting ? pal.accent : pal.fg);
    if (waiting) text(ctx, 'asked to approve', person.x + 44, person.y, pal.grey, 'left', 400, 11);

    // the audit trail: one line per action, in the order they finished
    const ty = h * 0.74, tx = w * 0.06;
    text(ctx, 'AUDIT TRAIL', tx, ty, pal.grey, 'left', 700, 11);
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, ty + 11); ctx.lineTo(w * 0.94, ty + 11); ctx.stroke();
    trail.forEach((line, i) => text(ctx, line, tx, ty + 28 + i * 18, pal.fg, 'left', 400, 11));
    if (trail.length === ACTS.length && t >= 5.9) text(ctx, '3 actions, 3 records', w * 0.94, ty, pal.fg, 'right', 400, 11);
  }

  tl = timeline(fig, 6.1, draw);
}
