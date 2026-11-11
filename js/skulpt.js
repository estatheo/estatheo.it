// Projects, Skulpt: an architecture diagram becomes a desk model. From the venture's docs:
// the diagram is parsed into a graph of typed resources and the links between them, printed
// as a model with the nodes on a base, and each node holds one light that is green when the
// resource is healthy and red when it is not. The five resources here are an example, named
// in plain text (no AWS icons). A scene on a desk: a laptop shows the diagram, it goes off to
// be printed (a dotted path), and the model appears on the desk beside it, base first, then
// the blocks rise. The lights come on and one goes red. On a tall narrow stage the laptop
// sits above the model. Canvas 2D.
import { palette, fit, timeline, text, dotted, lerp, ease, seg } from './stage.js';

// [label, u, v] on the diagram, 0 to 1 each way
const NODES = [['ALB', 0.1, 0.5], ['EC2', 0.42, 0.18], ['EC2', 0.42, 0.82], ['SQS', 0.8, 0.18], ['RDS', 0.8, 0.82]];
const LINKS = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4]];
const BAD = 4; // the database is the one that is not healthy
const END = 6.2;

export default function skulpt(fig) {
  let pal = palette(), ok = '', bad = '';
  const lights = () => { const cs = getComputedStyle(document.documentElement); ok = cs.getPropertyValue('--ok').trim(); bad = cs.getPropertyValue('--bad').trim(); };
  lights();
  document.addEventListener('site:theme', () => { pal = palette(); lights(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  const poly = (ctx, pts, fill, stroke) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const tall = h > w * 0.9; // a square stage on a very narrow screen
    const pill = (fig.querySelector('.pill')?.offsetHeight || 20) + 6;
    const fs = Math.max(7, Math.min(11, w / 40));
    const footY = h - fs * 0.9, deskY = h - fs * 2.6; // the desk top, and a line of text under it

    // the laptop: a screen with the diagram on it, and its base on the desk
    const lw = tall ? w * 0.5 : w * 0.36, lh = lw * 0.62;
    const lx = tall ? (w - lw) / 2 : w * 0.03, ly = tall ? pill + 2 : deskY - lh - lw * 0.08;
    ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.2;
    ctx.strokeRect(lx, ly, lw, lh);
    const by = ly + lh, bd = lw * 0.07; // the base, seen a little from above
    poly(ctx, [[lx, by], [lx + lw, by], [lx + lw + lw * 0.06, by + bd], [lx - lw * 0.06, by + bd]], pal.bg, pal.fg);
    // the diagram inside the screen
    const sx = lx + lw * 0.1, sy = ly + lh * 0.14, sw = lw * 0.8, sh = lh * 0.72;
    const dat = (n) => [sx + NODES[n][1] * sw, sy + NODES[n][2] * sh];
    LINKS.forEach(([a, b], k) => {
      const u = ease(seg(t, 0.5 + k * 0.1, 1.0 + k * 0.1));
      if (!u) return;
      const [ax, ay] = dat(a), [bx, by2] = dat(b);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, u), lerp(ay, by2, u)); ctx.stroke();
    });
    const nb = Math.min(sw * 0.2, 30), nfs = nb * 0.42;
    NODES.forEach(([label], i) => {
      const a = seg(t, 0.1 + i * 0.08, 0.4 + i * 0.08);
      if (!a) return;
      ctx.globalAlpha = a;
      const [x, y] = dat(i);
      ctx.fillStyle = pal.bg; ctx.fillRect(x - nb / 2, y - nb * 0.32, nb, nb * 0.64);
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1; ctx.strokeRect(x - nb / 2, y - nb * 0.32, nb, nb * 0.64);
      if (nfs >= 7) text(ctx, label, x, y + 0.5, pal.fg, 'center', 700, Math.min(11, nfs));
      ctx.globalAlpha = 1;
    });

    // the model's place on the desk
    const mx0 = tall ? w * 0.04 : w * 0.41, mx1 = w * 0.97, mTop = tall ? by + bd + fs * 1.6 : pill + fs * 0.6;
    const cx = (mx0 + mx1) / 2, mw = mx1 - mx0;
    const W = mw / (1.2 + 0.4 * 0.72 * 2 * 0.9), S = Math.min(W * 0.2, 46);
    const H = Math.min(W * 0.9, (deskY - mTop - 9 - S * 0.6) / 0.8);
    const cy = deskY - H * 0.72 * 0.55 - 9; // the base's front edge sits on the desk
    const rise = ease(seg(t, 2.6, 3.4)), Z = S * 0.55 * rise;
    const lfs = Math.max(7, Math.min(11, S * 0.42));
    const P = (px, py, z = 0) => [cx + px + py * 0.4, cy + py * 0.55 - z];
    const at = (n) => [(NODES[n][1] - 0.5) * W, (NODES[n][2] - 0.5) * H];

    // the desk
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, deskY); ctx.lineTo(w, deskY); ctx.stroke();

    // from the laptop to the printer and onto the desk: a dotted path
    const send = seg(t, 1.2, 1.7);
    if (send > 0) {
      const ax = tall ? lx + lw + 4 : lx + lw + 4, ay = tall ? ly + lh * 0.5 : ly + lh * 0.5;
      const bx = tall ? lx + lw + 4 : cx - W * 0.5, by3 = tall ? mTop + 2 : cy - H * 0.3;
      if (tall) dotted(ctx, lx + lw / 2, by + bd + 3, lx + lw / 2, mTop - 2, t < 3.4 ? pal.accent : pal.line, send);
      else dotted(ctx, ax, ay, bx, by3, t < 3.4 ? pal.accent : pal.line, send);
    }

    // the base the model stands on, printed first
    const f = ease(seg(t, 1.7, 2.2));
    if (f > 0) {
      ctx.globalAlpha = f;
      const bx = W * 0.6, bby = H * 0.72, d = 9;
      const c = [P(-bx, -bby), P(bx, -bby), P(bx, bby), P(-bx, bby)];
      poly(ctx, [c[3], c[2], [c[2][0], c[2][1] + d], [c[3][0], c[3][1] + d]], pal.bg, pal.line);
      poly(ctx, [c[1], c[2], [c[2][0], c[2][1] + d], [c[1][0], c[1][1] + d]], pal.bg, pal.line);
      poly(ctx, c, pal.bg, pal.line);
      ctx.globalAlpha = 1;
    }
    // links, printed on the base
    LINKS.forEach(([a, b], k) => {
      const u = ease(seg(t, 2.0 + k * 0.06, 2.4 + k * 0.06));
      if (!u) return;
      const [ax, ay] = at(a), [bx, by4] = at(b);
      const p = P(ax, ay), q = P(lerp(ax, bx, u), lerp(ay, by4, u));
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
    });
    // the blocks, back to front
    const order = NODES.map((_, i) => i).sort((a, b) => NODES[a][2] - NODES[b][2] || NODES[a][1] - NODES[b][1]);
    for (const i of order) {
      const a = seg(t, 2.2 + i * 0.06, 2.5 + i * 0.06);
      if (!a) continue;
      ctx.globalAlpha = a;
      const [x, y] = at(i), s = S / 2;
      const top = [P(x - s, y - s, Z), P(x + s, y - s, Z), P(x + s, y + s, Z), P(x - s, y + s, Z)];
      if (Z > 0.5) {
        const bot = [P(x - s, y - s), P(x + s, y - s), P(x + s, y + s), P(x - s, y + s)];
        poly(ctx, [top[3], top[2], bot[2], bot[3]], pal.bg, pal.fg);
        poly(ctx, [top[1], top[2], bot[2], bot[1]], pal.bg, pal.fg);
      }
      poly(ctx, top, pal.bg, pal.fg);
      const [tx, ty] = P(x, y - s * 0.15, Z);
      text(ctx, NODES[i][0], tx, ty, pal.fg, 'center', 700, lfs);
      const on = seg(t, 3.6 + i * 0.15, 3.75 + i * 0.15);
      if (on) {
        const red = i === BAD && t >= 5.0;
        const [ex, ey] = P(x, y + s * 0.55, Z);
        ctx.globalAlpha = a * on;
        ctx.beginPath(); ctx.arc(ex, ey, Math.max(2, Math.min(3.2, S * 0.07)), 0, 6.2832); ctx.fillStyle = red ? bad : ok; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // what the figure is showing, in one line at the foot
    const line = t < 1.7 ? 'a diagram: five resources' : t < 3.6 ? 'printed: a block per resource' : t < 5.0 ? 'every light green: all healthy' : 'RDS is red: not healthy';
    text(ctx, line, 0, footY, t >= 5.0 ? pal.fg : pal.grey, 'left', 400, Math.min(fs, w / 18.6));
  }

  tl = timeline(fig, END, draw);
}
