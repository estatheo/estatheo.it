// Projects, venture factory: one idea goes through the factory's launch formula
// (factory/formulas/mol-venture-launch.formula.toml). Only steps that exist there are
// shown, in its order: intake, research, owner gate 1, brand direction, claims plan,
// estimate, owner gate 2, kit content, kit build, drafts, quality, owner gate 3.
// "load" and "close" are left out: one is setup, the other comes after the last gate.
// A step is typed in, works for a moment, then reads done. A gate waits for me, then
// reads signed. The last gate stays waiting, because the formula never publishes:
// only the owner does. Plain text in a <pre>, rewritten only when the text changes.
import { timeline } from './stage.js';

// [step, who does it, what it makes, gate?]
const ROWS = [
  ['intake', 'agent', 'claims, budget', false],
  ['research', '3 agents', 'market, supply, names', false],
  ['GATE 1', 'me', 'name, market, budget', true],
  ['brand', 'agent', 'two directions', false],
  ['claims', 'agents', 'claims, funnel plan', false],
  ['estimate', 'script', 'cost of the drafts', false],
  ['GATE 2', 'me', 'pick a direction', true],
  ['content', '2 agents', 'site and channels', false],
  ['build', 'scripts', 'site, ads, stills', false],
  ['drafts', 'agents', 'copy per channel', false],
  ['quality', 'checker', 'copy against claims', false],
  ['GATE 3', 'me', 'approve to publish', true],
];
const START = 0.6, ROW = 0.36, WORK = 0.22, WAIT = 0.55;
// When each row appears: a gate takes longer, since it waits for a person.
const AT = [];
{ let t = START; for (const r of ROWS) { AT.push(t); t += ROW + (r[3] ? WAIT : 0); } }
const LAST = AT[AT.length - 1], END = LAST + 0.9;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const BRIEF = 'a one-page brief';

export default function factory(fig) {
  const pre = fig.querySelector('pre');
  let shown = '';

  function draw(t) {
    const n = Math.floor(BRIEF.length * Math.min(1, t / 0.5));
    const lines = [` <b>IDEA</b>  ${esc(BRIEF.slice(0, n))}${n < BRIEF.length ? '<span class="hit">&#9608;</span>' : ''}`, ''];
    lines.push(t >= START ? ' <b>STEP     WHO      MAKES</b>' : '');
    ROWS.forEach(([step, who, makes, gate], i) => {
      const at = AT[i];
      if (t < at) { lines.push(''); return; }
      const last = i === ROWS.length - 1;
      const done = !last && t >= at + (gate ? WAIT : WORK);
      const name = step.padEnd(9), cols = `${who.padEnd(9)}${makes.padEnd(22)}`;
      if (gate) {
        const state = done ? 'signed' : '<span class="hit">waiting</span>';
        lines.push(` ${done ? `<b>${name}</b>` : `<span class="hit"><b>${name}</b></span>`}${esc(cols)}${state}`);
      } else {
        lines.push(` ${esc(name)}${esc(cols)}${done ? 'done' : '<span class="dim">...</span>'}`);
      }
    });
    lines.push('', t >= LAST + 0.6 ? '<span class="dim"> nothing goes out until I sign gate 3.</span>' : '');
    const html = lines.join('\n');
    if (html !== shown) { pre.innerHTML = html; shown = html; }
  }

  timeline(fig, END, draw);
}
