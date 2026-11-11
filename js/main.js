// Page behaviour: theme button, ASCII tables, lazy figures. Motion has no switch of
// its own: the figures follow the system's reduced-motion setting (js/stage.js).
const root = document.documentElement;
const save = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode: the choice lasts for this visit */ } };
try { localStorage.removeItem('motion'); } catch (e) { /* the old motion switch's key, no longer read */ }

// Theme: AUTO follows the system, then LIGHT, then DARK. The button sits in the
// bottom-right corner; its name says the current theme and what a press does.
const themeBtn = document.getElementById('theme-toggle');
const themes = ['auto', 'light', 'dark'];
const current = () => root.dataset.theme || 'auto';
const nextOf = (t) => themes[(themes.indexOf(t) + 1) % 3];
function showTheme() {
  const now = current();
  themeBtn.textContent = `THEME: ${now.toUpperCase()}`;
  themeBtn.setAttribute('aria-label', `Theme: ${now}. Switch to ${nextOf(now)}.`);
}
themeBtn.addEventListener('click', () => {
  const next = nextOf(current());
  if (next === 'auto') { delete root.dataset.theme; save('theme', null); } else { root.dataset.theme = next; save('theme', next); }
  showTheme();
  document.dispatchEvent(new Event('site:theme'));
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => document.dispatchEvent(new Event('site:theme')));
showTheme();

// ASCII tables. Each real <table class="ascii"> gets a +---+ drawing sized to
// the columns that fit; the real table stays for screen readers.
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function wrap(s, width) {
  const out = []; let line = '';
  for (let word of s.split(/\s+/)) {
    while (word.length > width) { // a word longer than the cell is cut
      const room = width - (line ? line.length + 1 : 0);
      if (room < 4) { out.push(line); line = ''; continue; }
      line = line ? `${line} ${word.slice(0, room)}` : word.slice(0, room);
      word = word.slice(room); out.push(line); line = '';
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
function drawTable(table, pre, cols) {
  const rows = [...table.rows].map((tr) => [...tr.cells].map((cell) => ({ s: cell.textContent.trim(), todo: cell.hasAttribute('data-todo'), head: tr.parentElement.tagName === 'THEAD' })));
  const n = rows[0].length;
  // A table with a header row is too cramped as columns on a phone, so there each
  // row becomes a short record: the first cell in bold, the rest under it.
  if (rows[0][0].head && cols < 64) {
    const sep = `<span class="rule">${'-'.repeat(Math.min(cols, 40))}</span>`;
    pre.innerHTML = [sep, ...rows.slice(1).flatMap((r) => [...r.flatMap((cell, i) => wrap(cell.s, cols).map((l) => (i === 0 ? `<b>${escHtml(l)}</b>` : escHtml(l)))), sep])].join('\n');
    return;
  }
  const avail = Math.max(n * 6, cols - (3 * n + 1));
  const widths = Array.from({ length: n }, (_, i) => Math.max(...rows.map((r) => r[i].s.length)));
  // Shrink the widest column until the table fits; short label columns keep their width.
  // Shrink the widest column until the table fits. A column is not taken below its
  // longest word while another column still has room to give.
  const word = Array.from({ length: n }, (_, i) => Math.max(...rows.map((r) => Math.max(...r[i].s.split(/\s+/).map((x) => x.length)))));
  while (widths.reduce((a, b) => a + b, 0) > avail) {
    const soft = widths.map((w, i) => (w > word[i] ? w : 0));
    const pool = Math.max(...soft) > 0 ? soft : widths;
    const i = pool.indexOf(Math.max(...pool));
    if (widths[i] <= 6) break;
    widths[i]--;
  }
  const rule = `<span class="rule">+${widths.map((w) => '-'.repeat(w + 2)).join('+')}+</span>`;
  const bar = '<span class="rule">|</span>';
  const lines = [rule];
  rows.forEach((r, ri) => {
    const cells = r.map((cell, i) => wrap(cell.s, widths[i]));
    const height = Math.max(...cells.map((x) => x.length));
    for (let k = 0; k < height; k++) {
      lines.push(bar + r.map((cell, i) => {
        const raw = (cells[i][k] || '').padEnd(widths[i]);
        const body = escHtml(raw);
        return ` ${cell.todo ? `<span class="todo">${body}</span>` : cell.head ? `<b>${body}</b>` : body} `;
      }).join(bar) + bar);
    }
    if (r[0].head || ri === rows.length - 1) lines.push(rule);
  });
  pre.innerHTML = lines.join('\n');
}
function asciiTables() {
  const probe = document.createElement('span');
  probe.textContent = '0'.repeat(50); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  for (const table of document.querySelectorAll('table.ascii')) {
    const holder = table.closest('.ascii-wrap');
    let pre = holder.querySelector('pre.ascii-pre');
    if (!pre) { pre = document.createElement('pre'); pre.className = 'ascii-pre'; pre.setAttribute('aria-hidden', 'true'); holder.append(pre); const box = document.createElement('div'); box.className = 'vh'; table.replaceWith(box); box.append(table); }
    holder.append(probe);
    const ch = probe.getBoundingClientRect().width / 50;
    probe.remove();
    const cols = Math.min(104, Math.floor(holder.clientWidth / ch));
    if (pre.dataset.cols !== String(cols)) { pre.dataset.cols = cols; drawTable(table, pre, cols); }
  }
}
asciiTables();
document.fonts?.ready.then(asciiTables);
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(asciiTables, 120); });

// Keyboard shortcuts, desktop only (a fine pointer that can hover). Single keys, no
// modifiers, ignored while typing. H turns them off, not just their hints (WCAG 2.1.4);
// the KEYS button in the footer turns them back on. The choice is saved.
const keysBox = document.getElementById('keys');
const desktop = matchMedia('(hover: hover) and (pointer: fine)');
const announce = (s) => { const a = document.getElementById('announce'); if (a) { a.textContent = ''; setTimeout(() => { a.textContent = s; }, 30); } };
let keysOn = (() => { try { return localStorage.getItem('keys') !== 'off'; } catch (e) { return true; } })();
// Sections: each section of main with an id, and any h2 with its own id (Education).
// Focus goes to the section's heading, so a screen reader reads where it landed.
const sections = [...document.querySelectorAll('main > section[id], main h2[id]')];
const headingOf = (s) => (/^H[1-6]$/.test(s.tagName) ? s : s.querySelector('h1, h2, h3') || s);
function showKeys() {
  if (!keysBox) return;
  keysBox.hidden = !desktop.matches;
  const n = Math.min(9, sections.length);
  const k = (s) => `<kbd>${s}</kbd>`;
  const btn = `<button type="button" id="keys-toggle" aria-pressed="${keysOn}" aria-label="Keyboard shortcuts: ${keysOn ? 'on. Turn them off.' : 'off. Turn them on.'}">KEYS: ${keysOn ? 'ON' : 'OFF'}</button>`;
  keysBox.innerHTML = keysOn
    ? `<p>${[
      `${k(n > 1 ? `1-${n}` : '1')} section`, `${k('&larr;')} ${k('&rarr;')} previous, next`,
      `${k('&uarr;')} ${k('&darr;')} ${k('W')} ${k('S')} scroll`, `${k('M')} light/dark`,
      `${k('SPACE')} pause, play`, `${k('R')} replay`, `${k('H')} keys off`, btn,
    ].map((x) => `<span class="k">${x}</span>`).join(' ')}</p>`
    : `<p>${btn}</p>`;
  keysBox.querySelector('#keys-toggle').addEventListener('click', () => setKeys(!keysOn, true));
}
function setKeys(on, fromButton) {
  keysOn = on; save('keys', on ? null : 'off');
  showKeys();
  if (fromButton) keysBox.querySelector('#keys-toggle').focus();
  announce(on ? 'Keyboard shortcuts on.' : 'Keyboard shortcuts off. The KEYS button at the end of the page turns them back on.');
}
desktop.addEventListener('change', showKeys);
showKeys();

function goTo(i) {
  const s = sections[i];
  if (!s) return;
  const h = headingOf(s);
  if (!h.hasAttribute('tabindex') && !h.matches('a, button')) h.setAttribute('tabindex', '-1');
  s.scrollIntoView({ block: 'start' }); // smooth unless the system asks for less motion (css)
  h.classList.add('kfocus'); // the focus ring shows even where the browser would not draw one
  h.addEventListener('blur', () => h.classList.remove('kfocus'), { once: true });
  h.focus({ focusVisible: true, preventScroll: true });
}
// The section the reader is in: the last one whose top has passed a third of the window.
function currentSection() {
  let at = 0;
  sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= innerHeight / 3) at = i; });
  return at;
}
// The figure in view: the one whose drawing crosses the middle of the window, or else the
// one with the most of itself on screen (a tall figure must not win over a short one in the middle).
function figureInView() {
  let best = null, most = 0;
  const mid = innerHeight / 2;
  for (const f of document.querySelectorAll('.fig[data-fig]')) {
    const r = f.querySelector('.stage')?.getBoundingClientRect();
    if (!r) continue;
    if (r.top <= mid && r.bottom >= mid && r.width) return f;
    const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (seen > most) { most = seen; best = f; }
  }
  return best;
}
const shown = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
const figName = (f) => f.querySelector('figcaption span')?.textContent.split(':')[0] || 'Figure';
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

addEventListener('keydown', (e) => {
  // While a game has the keyboard (js/doom.js sets data-game) every key is the game's.
  if (!keysOn || !desktop.matches || e.defaultPrevented || 'game' in root.dataset) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
  const el = document.activeElement;
  if (typing(el)) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  let done = true;
  if (/^[1-9]$/.test(key)) { if (Number(key) <= sections.length && !e.repeat) goTo(Number(key) - 1); else done = false; }
  else if (key === 'ArrowRight' || key === 'ArrowLeft') {
    if (el && el.closest && el.closest('input, select, [role=slider]')) return;
    const i = currentSection(), top = sections[i].getBoundingClientRect().top;
    // Left inside a section goes back to its own start first.
    goTo(key === 'ArrowRight' ? Math.min(sections.length - 1, i + 1) : top < -8 ? i : Math.max(0, i - 1));
  } else if (key === 'w' || key === 's') scrollBy({ top: (key === 's' ? 1 : -1) * Math.round(innerHeight * 0.2) });
  else if (key === 'm' && !e.repeat) {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next; save('theme', next); showTheme();
    document.dispatchEvent(new Event('site:theme'));
    announce(`Theme: ${next}.`);
  } else if ((key === ' ' || key === 'r') && !e.repeat) {
    // Space on a focused button or link presses it, as usual.
    if (key === ' ' && el && el.closest && el.closest('a, button, summary, [role=button]')) return;
    const f = figureInView();
    const pause = f && (f.querySelector('[data-pause]') || f.querySelector('[data-play]'));
    if (!f || !shown(pause)) { done = false; } // no moving figure in view, or motion is off
    else if (key === ' ') { pause.click(); announce(`${figName(f)} ${/PLAY/.test(pause.textContent) ? 'paused' : 'playing'}.`); }
    else {
      const rb = f.querySelector('[data-replay]');
      if (rb) rb.click(); else f.dispatchEvent(new Event('fig:replay'));
      announce(`${figName(f)} playing from the start.`);
    }
  } else if (key === 'h' && !e.repeat) setKeys(false, false);
  else done = false;
  if (done) e.preventDefault();
});

// Figures load their code only when they come near the viewport.
const loader = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    loader.unobserve(e.target);
    const fig = e.target, name = fig.dataset.fig;
    import(`./${name}.js`).then((m) => m.default(fig)).catch((err) => {
      console.error(`figure ${name} failed`, err);
      const stage = fig.querySelector('.stage');
      const msg = document.createElement('p');
      msg.className = 'fig-error';
      msg.textContent = '[ This figure could not load. The text beside it covers the same ground; reloading the page may bring it back. ]';
      stage.replaceWith(msg);
      fig.querySelector('.ctl')?.remove();
    });
  }
}, { rootMargin: '300px 0px' });
document.querySelectorAll('.fig[data-fig]').forEach((f) => loader.observe(f));
