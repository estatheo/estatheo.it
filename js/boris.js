// Projects, Boris: one Mac from first boot to a report, drawn as a laptop beside the admin
// panel. From the Boris plan: a Mac registered in Apple Business Manager enrols in Boris's
// own device management on first boot and sets itself up to policy with no admin action
// (R9); the agent scans regularly against policy (R13); on drift it fixes it if policy
// allows, the admin is alerted and the result is logged (F3); a fix counts only after a
// rescan passes, and drift is reported even once fixed (R50); reports are signed (R38) and
// made for a chosen framework and period (R18). The checks named are the plan's (R11). The
// Mac, the framework and the period are examples. Canvas 2D.
import { palette, fit, timeline, text, FONT, clamp, lerp, ease, seg } from './stage.js';

const END = 7.0;
const CHECKS = [['disk encryption', 1.9], ['firewall', 2.1], ['screen lock', 2.3]];
// The panel's log after the first setup: [time, step, what, then (time, what)]
const LOG = [
  [3.3, 'drift', 'firewall off'],
  [3.8, 'alert', 'to the admin, sent'],
  [4.3, 'fix', 'agent, policy allows', 4.8, 'agent, policy allows: on'],
  [5.1, 'rescan', 'firewall, pass'],
];
// When the Mac talks to Boris: [from, to]
const LINKS = [[0.7, 1.1], [2.9, 3.3], [5.0, 5.1]];

export default function boris(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const stage = fig.querySelector('.stage');
  let tl = null;
  const pillH = () => (fig.querySelector('.pill')?.offsetHeight || 20) + 8;
  const size = ({ w, h }) => {
    if (!w) return false;
    const want = Math.ceil(layout(w).bottom);
    if (Math.abs(want - h) > 2) { stage.style.aspectRatio = `${Math.round(w)} / ${want}`; return true; }
    return false;
  };
  const env = fit(fig.querySelector('canvas'), (e) => { if (!size(e)) tl && tl.paint(); });
  document.fonts?.ready.then(() => size(env));

  // Side by side, or on a narrow stage the laptop above the panel and the report under it.
  function layout(w) {
    const side = w >= 300, top = pillH();
    const lw = side ? w * 0.4 : Math.min(w * 0.85, 220), lx = side ? 0 : (w - lw) / 2;
    const sw = lw * 0.86, sh = sw * 0.64, sx = lx + (lw - sw) / 2, sy = top + 4;
    const lbottom = sy + sh + lw * 0.07;
    const px = side ? w * 0.46 : 0, pw = w - px, py = side ? top : lbottom + 22;
    const fs = clamp((pw - 12) / 34 / 0.6, 7, 11), lh = fs * 1.6; // the widest line is 33 characters
    const PH = 14, pbottom = py + lh * PH;
    const dw = side ? Math.min(lw * 0.62, 110) : Math.min(w * 0.5, 110), dh = dw * 0.95;
    const dx = side ? lx + (lw - dw) / 2 : 0, dy = side ? lbottom + 26 : pbottom + 14;
    return { PH, side, lw, lx, sw, sh, sx, sy, lbottom, px, pw, py, fs, lh, pbottom, dx, dy, dw, dh, bottom: Math.max(pbottom, dy + dh) + 6 };
  }
  const width = (ctx, s, fs, wt = 400) => { ctx.font = `${wt} ${fs}px ${FONT}`; return ctx.measureText(s).width; };

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const L = layout(w), { side, lw, lx, sw, sh, sx, sy, lbottom, px, pw, py, fs, lh, dx, dy, dw, dh } = L;
    const drift = t >= 3.3 && t < 4.8;

    // the laptop: a screen with a menu bar, and the base under it
    ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.3;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.beginPath(); ctx.moveTo(lx, lbottom); ctx.lineTo(lx + lw, lbottom); ctx.lineTo(lx + lw * 0.95, sy + sh); ctx.lineTo(lx + lw * 0.05, sy + sh); ctx.closePath(); ctx.stroke();
    const mb = sy + sh * 0.13;
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, mb); ctx.lineTo(sx + sw, mb); ctx.stroke();
    if (t >= 1.1) { // Boris's menu-bar app, once enrolled
      ctx.strokeStyle = drift ? pal.accent : pal.fg; ctx.beginPath(); ctx.arc(sx + sw - sh * 0.08, sy + sh * 0.065, sh * 0.035, 0, 6.2832); ctx.stroke();
    }
    const fl = clamp((sw * 0.9) / 22 / 0.6, 7, fs), cx = sx + sw / 2, my = mb + (sh - (mb - sy)) / 2;
    const say = (lines) => lines.forEach(([s, c, wt], k) => text(ctx, s, cx, my + (k - (lines.length - 1) / 2) * fl * 1.5, c, 'center', wt || 400, fl));
    if (t < 0.3) { /* the screen is still dark */ } else if (t < 0.7) say([['first boot', pal.fg]]);
    else if (t < 1.3) {
      const u = ease(seg(t, 0.7, 1.1));
      say([[t < 1.1 ? 'enrolling' : 'enrolled', pal.fg, 700], ['Apple Business Manager', pal.grey]]);
      const bw = sw * 0.6, by = my + fl * 1.9;
      ctx.strokeStyle = pal.line; ctx.strokeRect(cx - bw / 2, by, bw, 4);
      ctx.fillStyle = t < 1.1 ? pal.accent : pal.fg; ctx.fillRect(cx - bw / 2, by, bw * u, 4);
    } else if (t < 3.3) say(t < 1.7 ? [['setting up', pal.fg], ['to policy', pal.grey]] : [['set up', pal.fg, 700], ['to policy', pal.grey]]);
    else if (t < 4.8) say([['firewall', pal.fg], ['off', pal.accent, 700]]);
    else say([['firewall', pal.fg], ['on', pal.fg, 700]]);
    if (side) text(ctx, 'NEW MAC', lx, lbottom + 12, pal.grey, 'left', 700, Math.min(fs, 10));

    // the Mac and Boris talking: a dot runs along a dotted line while they do
    const ax = side ? lx + lw + 4 : w / 2, ay = side ? sy + sh / 2 : lbottom + 4, bx = side ? px - 4 : w / 2, by = side ? ay : py - 4;
    ctx.save(); ctx.strokeStyle = pal.line; ctx.setLineDash([0.1, 4]); ctx.lineCap = 'round'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
    for (const [a, b] of LINKS) if (t >= a && t < b + 0.15) {
      const u = ease(seg(t, a, b));
      ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(lerp(ax, bx, u), lerp(ay, by, u), 2.5, 0, 6.2832); ctx.fill();
    }

    // the admin panel
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, lh * L.PH - 1);
    const x0 = px + 6, x1 = px + pw - 6, row = (k) => py + lh * (k + 0.8);
    text(ctx, 'ADMIN PANEL', x0, row(0), pal.fg, 'left', 700, fs);
    // a marker per line: hollow while waiting, filled once done, blue while in flight
    const mark = (k, state) => {
      const r = fs * 0.28, y = row(k);
      ctx.beginPath(); ctx.arc(x0 + r, y, r, 0, 6.2832);
      if (state === 2) { ctx.fillStyle = pal.fg; ctx.fill(); }
      else { ctx.strokeStyle = state === 1 ? pal.accent : pal.line; ctx.lineWidth = 1.2; ctx.stroke(); }
    };
    const tx = x0 + fs * 1.1;
    if (t >= 0.7) { mark(1, t < 1.1 ? 1 : 2); text(ctx, 'enrol, Apple Business Manager', tx, row(1), pal.fg, 'left', 400, fs); }
    if (t >= 1.3) { mark(2, t < 1.7 ? 1 : 2); text(ctx, 'policy: SOC 2, mid tier', tx, row(2), pal.fg, 'left', 400, fs); }
    CHECKS.forEach(([name, at], i) => {
      if (t < at) return;
      const k = 3 + i, fw = name === 'firewall';
      const res = fw && t >= 3.3 ? (t < 4.8 ? 'off' : t < 5.1 ? 'on' : 'pass') : 'pass';
      mark(k, fw && t >= 3.3 && t < 5.1 ? 1 : 2);
      text(ctx, name, tx, row(k), pal.fg, 'left', 400, fs);
      text(ctx, res, x1, row(k), res === 'off' ? pal.accent : pal.fg, 'right', res === 'off' ? 700 : 400, fs);
    });
    if (t >= 2.5 && t < 2.9) text(ctx, 'no admin action needed', tx, row(6.3), pal.grey, 'left', 400, fs);
    if (t >= 2.9) {
      text(ctx, 'LATER', x0, row(6.3), pal.fg, 'left', 700, fs);
      text(ctx, 'a regular scan', x0 + width(ctx, 'LATER  ', fs, 700), row(6.3), pal.fg, 'left', 400, fs);
    }
    LOG.forEach(([a, step, what, b, then], i) => {
      if (t < a) return;
      const s = b !== undefined && t >= b ? then : what, k = 7.3 + i;
      text(ctx, step, x0, row(k), step === 'drift' ? pal.accent : pal.grey, 'left', step === 'drift' ? 700 : 400, fs);
      text(ctx, s, x0 + fs * 0.6 * 7, row(k), b !== undefined && t < b ? pal.accent : pal.fg, 'left', 400, fs);
    });
    if (t >= 5.4) {
      // the record: the drift stays on it, a mark on a line
      const ry = row(12.5), rx0 = x0, rx1 = x1;
      ctx.strokeStyle = pal.line; ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke();
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.6; const mx = lerp(rx0, rx1, 0.55);
      ctx.beginPath(); ctx.moveTo(mx, ry - fs * 0.5); ctx.lineTo(mx, ry + fs * 0.5); ctx.stroke();
      text(ctx, 'the drift stays on the record', x0, row(11.5), pal.grey, 'left', 400, fs);
    }

    // the report, signed
    if (t >= 5.8) {
      ctx.globalAlpha = seg(t, 5.8, 6.1);
      const c = dw * 0.18;
      ctx.fillStyle = pal.bg; ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + dw - c, dy); ctx.lineTo(dx + dw, dy + c); ctx.lineTo(dx + dw, dy + dh); ctx.lineTo(dx, dy + dh); ctx.closePath(); ctx.fill(); ctx.stroke();
      const df = clamp(dw / 12 / 0.6, 7, Math.min(fs, 10));
      text(ctx, 'REPORT', dx + dw * 0.1, dy + dh * 0.18, pal.fg, 'left', 700, df);
      text(ctx, 'SOC 2', dx + dw * 0.1, dy + dh * 0.36, pal.fg, 'left', 400, df);
      text(ctx, 'this quarter', dx + dw * 0.1, dy + dh * 0.52, pal.grey, 'left', 400, df);
      const signed = t >= 6.5;
      const sx2 = dx + dw * 0.1, sy2 = dy + dh * 0.68, sw2 = Math.min(dw * 0.8, width(ctx, 'signed', df, 700) + 10);
      ctx.strokeStyle = signed ? pal.accent : pal.line; ctx.lineWidth = 1.3;
      if (!signed) ctx.setLineDash([3, 3]);
      ctx.strokeRect(sx2, sy2, sw2, df * 1.8); ctx.setLineDash([]);
      text(ctx, signed ? 'signed' : '...', sx2 + sw2 / 2, sy2 + df * 0.9, signed ? pal.accent : pal.grey, 'center', 700, df);
      ctx.globalAlpha = 1;
    }
  }

  tl = timeline(fig, END, draw);
}
