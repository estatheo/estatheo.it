// Projects, Optly: one opt-in, one campaign, and what comes back, drawn as a sender's table
// over three phones. From the Optly docs: a follower opts in through a link or the Get
// Started button (consent GRANTED); before every send, consent, an open 24-hour window and
// the template are checked again; a send that fails a check is skipped with its reason kept
// (SKIPPED_INELIGIBLE); Meta's webhooks then report delivered (Messenger only), read,
// replied, and STOP (consent REVOKED). The three followers are examples. Canvas 2D.
import { palette, fit, timeline, text, FONT, clamp } from './stage.js';

const END = 7.3;
// The sends: [row appears, checked, follower, consent, window, template, result]
const SENDS = [
  [2.2, 2.6, '1', 'yes', 'open', 'ok', 'sent'],
  [2.8, 3.2, '2', 'yes', 'open', 'ok', 'sent'],
  [3.4, 3.8, '3', 'yes', 'closed', 'ok', 'skipped'],
];
// Under each phone: [time, words, in flight?]. Delivered only on Messenger, as the docs say.
const PHONES = [
  ['1 msgr', [[1.2, 'granted'], [2.6, 'sent'], [4.8, 'delivered'], [5.2, 'read'], [6.0, 'replied', 1]]],
  ['2 ig', [[3.2, 'sent'], [5.6, 'read'], [6.4, '"STOP"'], [6.8, 'opted out', 1]]],
  ['3 ig', [[3.8, 'skipped', 1], [3.8, 'window closed'], [4.1, 'reason kept']]],
];
const COLS = [0, 0.08, 0.28, 0.52, 0.72]; // the table's columns, as fractions of the width

export default function optly(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  const stage = fig.querySelector('.stage');
  let tl = null;
  const pillH = () => (fig.querySelector('.pill')?.offsetHeight || 20) + 6;
  // The stage's height follows what it holds at this width.
  const size = ({ w, h }) => {
    if (!w) return false;
    const want = Math.ceil(layout(w).bottom);
    if (Math.abs(want - h) > 2) { stage.style.aspectRatio = `${Math.round(w)} / ${want}`; return true; }
    return false;
  };
  const env = fit(fig.querySelector('canvas'), (e) => { if (!size(e)) tl && tl.paint(); });
  document.fonts?.ready.then(() => size(env));

  function layout(w) {
    const fs = clamp(w / 32, 9, 11), lh = fs * 1.55, top = pillH();
    const y = (k) => top + lh * (k + 0.5);
    const cw = w / 3, pw = Math.min(cw * 0.78, 92), ph = pw * 1.4, py = top + lh * 7.9;
    return { fs, lh, y, cw, pw, ph, py, bottom: py + ph + lh * 6.6 };
  }
  const width = (ctx, s, fs, wt = 400) => { ctx.font = `${wt} ${fs}px ${FONT}`; return ctx.measureText(s).width; };
  // the first wording that fits the width
  const pick = (ctx, list, fs, max, wt) => list.find((s) => width(ctx, s, fs, wt) <= max) || list[list.length - 1];
  // a line made of runs of text: [[words, colour, weight]]
  function runs(ctx, parts, x, y, fs) {
    for (const [s, c, wt = 400] of parts) { text(ctx, s, x, y, c, 'left', wt, fs); x += width(ctx, s, fs, wt); }
  }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  // a bubble with two grey bars for words; mine sit right, the business's left
  function bubble(ctx, x, y, w, h, ink, bars, dashed = false) {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
    if (dashed) ctx.setLineDash([3, 3]);
    round(ctx, x, y, w, h, Math.min(6, h / 2)); ctx.stroke(); ctx.setLineDash([]);
    if (bars) { ctx.fillStyle = pal.line; ctx.fillRect(x + w * 0.15, y + h * 0.3, w * 0.7, 1.5); ctx.fillRect(x + w * 0.15, y + h * 0.62, w * 0.45, 1.5); }
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const { fs, lh, y, cw, pw, ph, py } = layout(w);

    // the sender's side: the opt-in, then the campaign, checked just before each send
    if (t >= 0.3) {
      const granted = t >= 1.2;
      const line = pick(ctx, ['follower 1 taps "Get Started"  granted', '1 taps "Get Started"  granted', '1 taps "Get Started" granted'], fs, w - width(ctx, 'OPT-IN  ', fs, 700));
      const [head] = line.split(/ {1,2}granted$/);
      runs(ctx, [['OPT-IN  ', pal.fg, 700], [head, pal.fg], ...(granted ? [[line.slice(head.length), pal.fg]] : [])], 0, y(0), fs);
    }
    if (t >= 1.6) {
      const rest = pick(ctx, ['to 3 followers, checked per send', 'to 3, checked per send', 'to 3, per send'], fs, w - width(ctx, 'CAMPAIGN  ', fs, 700));
      runs(ctx, [['CAMPAIGN  ', pal.fg, 700], [rest, pal.fg]], 0, y(1.4), fs);
    }
    if (t >= 1.9) ['to', 'consent', w >= 300 ? '24h window' : '24h', 'template', 'result'].forEach((s, i) => text(ctx, s, COLS[i] * w, y(2.4), pal.grey, 'left', 700, fs));
    SENDS.forEach(([a, b, ...cells], k) => {
      if (t < a) return;
      if (t < b) { text(ctx, cells[0], 0, y(3.4 + k), pal.fg, 'left', 400, fs); text(ctx, '...', COLS[1] * w, y(3.4 + k), pal.grey, 'left', 400, fs); return; }
      cells.forEach((s, i) => text(ctx, s, COLS[i] * w, y(3.4 + k), s === 'closed' || s === 'skipped' ? pal.accent : pal.fg, 'left', s === 'skipped' ? 700 : 400, fs));
    });
    if (t >= 4.4) {
      const rest = pick(ctx, [', as it happens', ''], fs, w - width(ctx, 'BACK FROM META', fs, 700));
      runs(ctx, [['BACK FROM META', pal.fg, 700], [rest, pal.fg]], 0, y(6.4), fs);
    }

    // the three phones: plain rounded rectangles with a chat on the screen
    PHONES.forEach(([label, items], i) => {
      const cx = cw * (i + 0.5), x = cx - pw / 2, r = pw * 0.16, pad = pw * 0.08;
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.3; round(ctx, x, py, pw, ph, r); ctx.stroke();
      ctx.strokeStyle = pal.line; ctx.beginPath(); ctx.moveTo(cx - pw * 0.12, py + pad * 0.9); ctx.lineTo(cx + pw * 0.12, py + pad * 0.9); ctx.stroke();
      const sx = x + pad, sw = pw - pad * 2, sy = py + pad * 1.8, bh = Math.max(12, ph * 0.13), gap = ph * 0.05;
      const inner = Math.max(7, Math.min(fs, 9));
      text(ctx, label.split(' ')[1], sx, sy + inner * 0.5, pal.grey, 'left', 400, inner);
      let cy = sy + inner * 1.4;
      const fly = (a) => (t < a + 0.4 ? pal.accent : pal.fg); // in flight for a moment, then settled
      if (i === 0 && t >= 0.3) { // the Get Started button, tapped
        const tapped = t >= 1.2, bw = sw * 0.9, bx = sx + (sw - bw) / 2;
        round(ctx, bx, cy, bw, bh, 3);
        if (tapped && t < 1.6) { ctx.fillStyle = pal.accent; ctx.fill(); }
        ctx.strokeStyle = tapped ? pal.fg : pal.accent; ctx.lineWidth = 1.2; ctx.stroke();
        if (width(ctx, 'Get Started', inner) <= bw - 4) text(ctx, 'Get Started', bx + bw / 2, cy + bh / 2, tapped && t < 1.6 ? pal.bg : pal.fg, 'center', 400, inner);
        cy += bh + gap;
      }
      const send = SENDS[i][1];
      if (t >= send) {
        if (i === 2) bubble(ctx, sx, cy, sw * 0.72, bh * 1.3, pal.line, false, true); // never sent
        else bubble(ctx, sx, cy, sw * 0.72, bh * 1.3, fly(send), true);
      }
      cy += bh * 1.3 + gap;
      const mine = i === 0 ? 6.0 : i === 1 ? 6.4 : null; // the follower answers
      if (mine !== null && t >= mine) {
        const bw = sw * 0.62, bx = sx + sw - bw;
        bubble(ctx, bx, cy, bw, bh, fly(mine), i === 0);
        if (i === 1) text(ctx, 'STOP', bx + bw / 2, cy + bh / 2, fly(mine), 'center', 700, inner);
      }

      // under the phone: the follower, then what happened, line by line
      text(ctx, label, cx, py + ph + lh * 0.8, pal.fg, 'center', 700, fs);
      let ly = py + ph + lh * 1.8;
      for (const [a, s, hot] of items) {
        if (t < a) break;
        // a phrase too wide for the column goes on two lines
        const lines = width(ctx, s, fs) <= cw - 4 ? [s] : s.split(' ');
        for (const l of lines) { text(ctx, l, cx, ly, hot ? pal.accent : pal.grey, 'center', hot ? 700 : 400, fs); ly += lh; }
      }
    });
  }

  tl = timeline(fig, END, draw);
}
