// Work, fig. 3: Playter as bookkeeping. One invoice is paid in full, which the buyer
// now owes; equal monthly instalments then collect it back until nothing is
// owed. Every entry is a debit line and its credit line. Plain text in a <pre>,
// rewritten only when the text changes. The amounts are generated here on each
// run and are illustrative; the caption says so.
import { timeline, rng } from './stage.js';

const RULE = '+----------------+---------+---------+---------+';
const MONTHS = [6, 3, 4]; // the first run, and so the still frame, is six months
const MAX = 2 + 2 * 6;    // rows reserved, so the table keeps its height on every run
const money = (n) => n.toFixed(2);
const DIGITS = '0123456789';
const GAP = 0.2, LOCK = 0.4;

export default function ledger(fig) {
  const pre = fig.querySelector('pre');
  let months = 6, part = 0, shown = '', seeded = -1;

  function seed(run) {
    const r = rng(run * 977 + 13);
    months = MONTHS[run % MONTHS.length];
    part = 100 + 50 * Math.floor(r() * 15); // one instalment
    seeded = run;
  }

  function draw(t, run) {
    if (run !== seeded) seed(run);
    const total = part * months;
    // entries: the invoice first, then one per month. [debit name, credit name, amount]
    const entries = [['buyer owes', 'to supplier', total]];
    for (let m = 1; m <= months; m++) entries.push([`instalment ${m}/${months}`, 'buyer owes', part]);
    const rows = entries.length * 2, settleAt = 0.3 + rows * GAP + LOCK + 0.3;

    const head = t >= 0.1 ? `<b>INVOICE ${money(total)}</b>  ${months} MONTHS  INTEREST 0.00` : '';
    const lines = [head, '', `<span class="dim">${RULE}</span>`, row('<b>ENTRY</b>         ', '  <b>DEBIT</b>', ' <b>CREDIT</b>', '<b>STATUS</b> '), `<span class="dim">${RULE}</span>`];
    let debit = 0, credit = 0, owed = 0, settled = 0;
    entries.forEach(([dr, cr, amount], k) => {
      for (let side = 0; side < 2; side++) {
        const i = k * 2 + side, at = 0.3 + i * GAP;
        if (t < at) { lines.push(row(' '.repeat(14), ' '.repeat(7), ' '.repeat(7), ' '.repeat(7))); continue; }
        const locked = t >= at + LOCK;
        let amt = money(amount).padStart(7);
        if (!locked) amt = amt.replace(/\d/g, (d, p) => DIGITS[(Math.floor(t * 30) + p * 7 + i) % 10]);
        else if (side === 0) debit += amount; else { credit += amount; owed += k === 0 ? amount : -amount; }
        const isSettled = t >= settleAt + k * 0.18;
        if (isSettled && side === 0) settled++;
        const name = ((side ? '  ' : '') + (side ? cr : dr)).padEnd(14);
        const status = isSettled ? '<b>settled</b>' : '<span class="dim">pending</span>';
        lines.push(row(name, side ? ' '.repeat(7) : amt, side ? amt : ' '.repeat(7), status));
      }
    });
    for (let i = rows; i < MAX; i++) lines.push(row(' '.repeat(14), ' '.repeat(7), ' '.repeat(7), ' '.repeat(7)));
    lines.push(`<span class="dim">${RULE}</span>`);
    const even = settled === entries.length && t >= settleAt + entries.length * 0.18 + 0.3;
    lines.push(row('<b>TOTAL</b>         ', money(debit).padStart(7), money(credit).padStart(7), even ? '<span class="hit">=</span>      ' : '       '));
    lines.push(`<span class="dim">${RULE}</span>`, '');
    if (even) lines.push(`<span class="hit">buyer owes 0.00.</span> paid back in ${months} months.`);
    else lines.push(`<span class="dim">${t >= settleAt ? 'settling' : owed > 0 && owed < total ? `collecting. buyer owes ${money(owed)}` : 'posting'} ...</span>`);
    const html = lines.join('\n');
    if (html !== shown) { pre.innerHTML = html; shown = html; }
  }
  const bar = '<span class="dim">|</span>';
  function row(a, b, c, d) { return `${bar} ${a} ${bar} ${b} ${bar} ${c} ${bar} ${d} ${bar}`; }

  // long enough for the six-month run: 14 rows, then 7 entries settling
  timeline(fig, 0.3 + MAX * GAP + LOCK + 0.3 + 7 * 0.18 + 0.6, draw);
}
