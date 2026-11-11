// Work, fig. 1: a batch job on a mainframe. The cards are entered under a column
// ruler, the job is submitted, and the three steps (compile, link, run) come
// back one at a time with their return codes. Plain text in a <pre>, rewritten
// only when the text changes. The job is an illustration, not the bank's code.
import { timeline } from './stage.js';

const RULER = '----+----1----+----2----+----3----+----4';
const CARDS = [
  '//HELLO    JOB CLASS=A,MSGCLASS=X',
  '//RUN      EXEC IGYWCLG',
  '//COBOL.SYSIN DD *',
  '       IDENTIFICATION DIVISION.',
  '       PROGRAM-ID. HELLO.',
  '       PROCEDURE DIVISION.',
  "           DISPLAY 'CIAO DA PADOVA'.",
  '           STOP RUN.',
  '/*',
];
const STEPS = [['COBOL', 'IGYCRCTL', 'compiled'], ['LKED', 'IEWL', 'linked'], ['GO', 'HELLO', 'ran']];
const CARD = 0.22, SUBMIT = 0.3 + CARDS.length * CARD + 0.3, STEP = 0.75, END = SUBMIT + 0.5 + STEPS.length * STEP;
const DIGITS = '0123456789';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export default function job(fig) {
  const pre = fig.querySelector('pre');
  let shown = '';

  function draw(t) {
    const lines = [`<span class="dim">${RULER}</span>`];
    CARDS.forEach((card, i) => {
      const at = 0.3 + i * CARD;
      if (t < at) { lines.push(''); return; }
      // a card is typed left to right, with a block cursor while it is being entered
      const n = Math.floor(((t - at) / CARD) * card.length);
      lines.push(n >= card.length ? esc(card) : `${esc(card.slice(0, n))}<span class="hit">&#9608;</span>`);
    });
    lines.push('');
    lines.push(t >= SUBMIT ? ' <b>STEP     PROGRAM   RC</b>' : t >= SUBMIT - 0.3 ? '<span class="dim"> submitting ...</span>' : '');
    let done = 0;
    STEPS.forEach(([step, prog, word], k) => {
      const at = SUBMIT + 0.5 + k * STEP;
      if (t < at) { lines.push(''); return; }
      const locked = t >= at + STEP * 0.7;
      const rc = locked ? '0000' : '0000'.replace(/0/g, (d, p) => DIGITS[(Math.floor(t * 30) + p * 7 + k) % 10]);
      if (locked) done++;
      lines.push(` ${step.padEnd(8)} ${prog.padEnd(9)} ${locked ? `<b>${rc}</b>   ${word}` : `<span class="dim">${rc}   running</span>`}`);
    });
    const ended = done === STEPS.length && t >= END + 0.2;
    lines.push('', done === STEPS.length ? ' CIAO DA PADOVA' : '');
    lines.push(ended ? ' JOB ENDED. <span class="hit">MAXCC=0000</span>' : '');
    const html = lines.join('\n');
    if (html !== shown) { pre.innerHTML = html; shown = html; }
  }

  timeline(fig, END + 0.4, draw);
}
