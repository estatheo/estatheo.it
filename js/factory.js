// Projects, venture factory: one idea goes down the factory's line, the steps of its launch
// formula (factory/formulas/mol-venture-launch.formula.toml) in its order: intake, research,
// owner gate 1, brand direction, claims plan, estimate, owner gate 2, kit content, kit build,
// drafts, quality, owner gate 3. "load" and "close" are left out: one is setup, the other
// comes after the last gate. A brief rides a belt from station to station. At each one the
// workers the formula names (agents, scripts, a checker) work on it, then it reads done. A
// gate is a barrier with me beside it: it lifts when I sign. The last gate stays down,
// because the formula never publishes: only the owner does. Canvas 2D.
import { palette, fit, timeline, text, lerp, ease, seg } from './stage.js';

// [step, workers: 'a' agent, 's' script, 'c' checker, 'm' me; what it makes]
const STEPS = [
  ['intake', 'a', 'claims and budget'],
  ['research', 'aaa', 'market, supply, names'],
  ['GATE 1', 'm', 'name, market, budget'],
  ['brand', 'a', 'two brand directions'],
  ['claims', 'aa', 'claims and funnel plan'],
  ['estimate', 's', 'cost of the drafts'],
  ['GATE 2', 'm', 'pick a direction'],
  ['content', 'aa', 'site and channel content'],
  ['build', 'ss', 'site, ads, stills'],
  ['drafts', 'aa', 'copy for each channel'],
  ['quality', 'c', 'copy read against claims'],
  ['GATE 3', 'm', 'approve to publish'],
];
const WHO = { a: 'agent', s: 'script', c: 'checker', m: 'me' };
const PER = 4; // stations to a row; the belt snakes down three rows
const START = 0.7, ROW = 0.38, WORK = 0.24, WAIT = 0.55, MOVE = 0.3;
const AT = [];
{ let t = START; for (const s of STEPS) { AT.push(t); t += ROW + (s[1] === 'm' ? WAIT : 0); } }
const LAST = AT[AT.length - 1], END = LAST + 1.0;
const gate = (i) => STEPS[i][1] === 'm';

export default function factory(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  // The stage's height follows what three rows of stations need at this width.
  const stage = fig.querySelector('.stage');
  const env = fit(fig.querySelector('canvas'), ({ w, h }) => {
    const want = Math.ceil(layout(w).height);
    if (Math.abs(want - h) > 2) { stage.style.aspectRatio = `${Math.round(w)} / ${want}`; return; }
    tl && tl.paint();
  });
  function layout(w) {
    const fs = Math.max(9, Math.min(11, w / 32)), cw = w / PER, s = Math.min(24, cw * 0.3);
    const pill = (fig.querySelector('.pill')?.offsetHeight || 20) + 4; // the label over the canvas
    const top = pill + fs * 2.2 + s * 0.6, rowH = s * 1.6 + fs * 3.6;
    return { fs, cw, s, pill, top, rowH, height: top + rowH * 3 + fs * 3.2 };
  }

  function worker(ctx, kind, x, y, s, ink) {
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.2;
    if (kind === 'm') { // me: head and shoulders
      ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * 0.22, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.4, s * 0.32, 0, Math.PI, 0); ctx.stroke();
    } else if (kind === 's') { // a script: a terminal with a prompt
      ctx.strokeRect(x - s * 0.36, y - s * 0.62, s * 0.72, s * 0.56);
      ctx.beginPath(); ctx.moveTo(x - s * 0.24, y - s * 0.48); ctx.lineTo(x - s * 0.12, y - s * 0.36); ctx.lineTo(x - s * 0.24, y - s * 0.24); ctx.stroke();
      ctx.fillRect(x - s * 0.06, y - s * 0.26, s * 0.2, s * 0.05);
    } else { // an agent: a square head with eyes and an aerial; the checker holds a lens
      ctx.strokeRect(x - s * 0.3, y - s * 0.6, s * 0.6, s * 0.48);
      ctx.fillRect(x - s * 0.16, y - s * 0.45, s * 0.09, s * 0.12); ctx.fillRect(x + s * 0.07, y - s * 0.45, s * 0.09, s * 0.12);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y - s * 0.76); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - s * 0.8, s * 0.05, 0, 6.2832); ctx.fill();
      if (kind === 'c') { ctx.beginPath(); ctx.arc(x + s * 0.48, y - s * 0.28, s * 0.13, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + s * 0.57, y - s * 0.19); ctx.lineTo(x + s * 0.68, y - s * 0.06); ctx.stroke(); }
    }
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const { fs, cw, s, pill, top, rowH } = layout(w);
    const beltY = (r) => top + r * rowH + s * 1.1;
    // station i: its row, and its column (rows run left to right, then back)
    const pos = (i) => { const r = Math.floor(i / PER), c = i % PER; return { r, x: cw * ((r % 2 ? PER - 1 - c : c) + 0.5), y: beltY(r) }; };

    // the idea, typed in as a brief
    const brief = 'a one-page brief', n = Math.floor(brief.length * Math.min(1, t / 0.5));
    text(ctx, 'IDEA', 0, pill + fs * 0.7, pal.fg, 'left', 700, fs);
    text(ctx, brief.slice(0, n) + (n < brief.length ? '_' : ''), fs * 3.6, pill + fs * 0.7, pal.fg, 'left', 400, fs);

    // the belt: a line along each row with rollers, joined by a turn at alternate ends
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      const y = beltY(r), x0 = cw * 0.25, x1 = w - cw * 0.25;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y + 4); ctx.lineTo(x1, y + 4); ctx.stroke();
      for (let x = x0 + 6; x < x1 - 2; x += Math.max(10, cw / 4)) { ctx.beginPath(); ctx.arc(x, y + 2, 1.2, 0, 6.2832); ctx.stroke(); }
      if (r < 2) {
        // a flattened turn, so it stays inside the canvas on a narrow screen
        const right = r % 2 === 0, ex = right ? x1 : x0, rad = (beltY(r + 1) - y) / 2 + 2, rx = Math.min(rad, cw * 0.22);
        ctx.beginPath(); ctx.ellipse(ex, y + rad, rx, rad, 0, right ? -Math.PI / 2 : Math.PI / 2, right ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
      }
    }

    // the stations
    STEPS.forEach(([step, who], i) => {
      const { x, y } = pos(i), at = AT[i], last = i === STEPS.length - 1;
      const reached = t >= at, done = reached && !last && t >= at + (gate(i) ? WAIT : WORK);
      const busy = reached && !done;
      const ink = busy ? pal.accent : done ? pal.fg : pal.line;
      const wy = y - s * 0.75;
      if (gate(i)) {
        // the barrier just past the brief: a post and an arm along the belt, raised once I sign.
        // I stand behind it. dir is the way the belt runs on this row.
        const dir = pos(i).r % 2 ? -1 : 1, lift = done ? ease(seg(t, at + WAIT - 0.15, at + WAIT + 0.1)) : 0;
        const px = x + dir * s * 0.4, a = lift * Math.PI * 0.47, len = s * 1.1, ay = y - s * 0.22;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px, ay - s * 0.08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, ay); ctx.lineTo(px + dir * Math.cos(a) * len, ay - Math.sin(a) * len); ctx.stroke();
        worker(ctx, 'm', Math.max(s * 0.5, Math.min(w - s * 0.5, x + dir * s * 1.3)), wy, s, ink);
      } else {
        const k = who.length, sp = s * 0.62;
        for (let j = 0; j < k; j++) worker(ctx, who[j], x + (j - (k - 1) / 2) * sp, wy, k > 1 ? s * 0.8 : s, ink);
      }
      text(ctx, step, x, y + fs * 1.5, reached ? pal.fg : pal.grey, 'center', gate(i) ? 700 : 400, fs);
      const state = gate(i) ? (done ? 'signed' : reached ? 'waiting' : '') : done ? 'done' : busy ? '...' : '';
      if (state) text(ctx, state, x, y + fs * 2.6, busy && gate(i) ? pal.accent : pal.grey, 'center', busy && gate(i) ? 700 : 400, fs);
    });

    // the brief on the belt: a small page that rides from station to station
    if (t >= START - MOVE) {
      let i = 0;
      while (i < STEPS.length - 1 && t >= AT[i + 1] - MOVE) i++;
      const a = pos(i), b = pos(Math.min(i + 1, STEPS.length - 1));
      const u = i + 1 < STEPS.length ? ease(seg(t, AT[i + 1] - MOVE, AT[i + 1])) : 0;
      let px, py;
      if (a.r === b.r) { px = lerp(a.x, b.x, u); py = a.y; }
      else { // round the turn at the end of the row
        const ex = a.r % 2 === 0 ? w - cw * 0.25 : cw * 0.25, legs = [Math.abs(ex - a.x), b.y - a.y, Math.abs(ex - b.x)];
        const total = legs[0] + legs[1] + legs[2]; let d = u * total;
        if (d <= legs[0]) { px = lerp(a.x, ex, d / legs[0]); py = a.y; }
        else if ((d -= legs[0]) <= legs[1]) { px = ex; py = a.y + d; }
        else { d -= legs[1]; px = lerp(ex, b.x, d / legs[2]); py = b.y; }
      }
      const appear = seg(t, START - MOVE, START);
      if (i === 0 && t < START) { px = pos(0).x - (1 - appear) * cw * 0.5; py = pos(0).y; }
      const pw = Math.max(7, s * 0.42), ph = pw * 1.3, x0 = px - pw / 2, y0 = py - ph - 1;
      ctx.globalAlpha = appear;
      ctx.fillStyle = pal.bg; ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + pw * 0.65, y0); ctx.lineTo(x0 + pw, y0 + pw * 0.35); ctx.lineTo(x0 + pw, y0 + ph); ctx.lineTo(x0, y0 + ph); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x0 + pw * 0.2, y0 + ph * (0.25 + k * 0.17)); ctx.lineTo(x0 + pw * 0.8, y0 + ph * (0.25 + k * 0.17)); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // the foot: who is at the station now and what it makes; at the end, the rule
    let line = '';
    for (let i = 0; i < STEPS.length; i++) if (t >= AT[i]) { const [step, who, makes] = STEPS[i]; line = `${step}: ${who.length > 1 ? `${who.length} ${WHO[who[0]]}s` : WHO[who]}, ${makes}`; }
    if (t >= LAST + 0.6) line = 'nothing goes out until I sign gate 3.';
    if (line) text(ctx, line, 0, h - fs * 0.9, t >= LAST + 0.6 ? pal.fg : pal.grey, 'left', 400, Math.min(fs, (w / line.length) / 0.62));
  }

  tl = timeline(fig, END, draw);
}
