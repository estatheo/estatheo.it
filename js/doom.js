// Projects, claude-doom: Freedoom, playable on the screen of an old computer drawn in text
// (build.mjs, PC_ART). Until POWER is pressed the screen shows a still picture (doom/title.png)
// and nothing else is fetched. POWER lights the case LED, types a short boot text on the screen
// while it loads the engine (doomgeneric built with Emscripten, source in doom/src) and the
// unchanged Freedoom IWAD, counting the download, then runs the game in the screen and hands
// its canvas the keyboard.
// - The game has the keyboard only while its canvas has focus. Esc, Tab or a click elsewhere
//   gives it back. While it has focus <html data-game> is set and js/main.js ignores its
//   single-key shortcuts.
// - It runs only while it has the keyboard, is on screen and the tab is visible. Its clock
//   stops otherwise, so nothing happens in the game while you are not playing.
// - No keyboard (a touch screen): POWER turns the drawn keyboard into the controls. Its keys
//   clear away, all but the ones the game uses, the case grows to fit, and buttons take the
//   keys' place. The game runs while the screen is in view. No sound: the engine has none.
const TIC = 1000 / 35; // Doom runs 35 game tics a second
const W = 320, H = 200;
// Browser key (KeyboardEvent.code) to Doom key code, from doomgeneric's doomkeys.h.
const UP = 0xad, DOWN = 0xaf, LEFT = 0xac, RIGHT = 0xae, FIRE = 0xa3, USE = 0xa2, MENU = 27;
const KEYS = {
  ArrowUp: UP, KeyW: UP, ArrowDown: DOWN, KeyS: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
  KeyA: 0xa0, KeyD: 0xa1, ControlLeft: FIRE, ControlRight: FIRE, KeyF: FIRE, Space: USE, KeyE: USE,
  Enter: 13, NumpadEnter: 13, ShiftLeft: 0xb6, ShiftRight: 0xb6, AltLeft: 0xb8, AltRight: 0xb8,
  Backspace: 0x7f, KeyM: MENU, KeyQ: MENU, Minus: 0x2d, Equal: 0x3d,
};
const doomKey = (e) => KEYS[e.code] ?? (/^(Key[A-Z]|Digit[0-9])$/.test(e.code) ? e.code.slice(-1).toLowerCase().charCodeAt(0) : 0);
const mb = (n) => (n / 1e6).toFixed(1);
// The drawn keyboard (build.mjs, KB_ART): rows of text, keys at these columns inside the box,
// which starts 3 characters in. Kept while the rest clear: Enter, the arrows, Ctrl and Space.
const KB_IN = 3;
const KB_KEEP = [[2, 30, 33], [2, 38, 39], [3, 2, 6], [3, 7, 28], [3, 36, 41]];
const POWER_ICON = '<svg class="pw" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 3.8a5.5 5.5 0 1 0 6 0M8 1.5v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export default function doom(fig) {
  const stage = fig.querySelector('.stage'), still = stage.querySelector('img'), canvas = stage.querySelector('canvas');
  const pc = stage.querySelector('.pc'), boot = stage.querySelector('.pc-boot');
  const kb = stage.querySelector('.pc-kb'), kbArt = kb.querySelector('.pc-kb-art'), KB0 = kbArt.textContent;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const btn = fig.querySelector('[data-doom-play]'), note = fig.querySelector('[data-doom-note]');
  const keysRow = fig.querySelector('[data-doom-keys]'), status = fig.querySelector('[data-doom-status]');
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H);
  const keyboard = matchMedia('(hover: hover) and (pointer: fine)');
  const total = Number(btn.getAttribute('aria-label').match(/([\d.]+) MB/)[1]) * 1e6;
  const say = (s) => { status.textContent = s; };
  let state = 'idle'; // idle, loading, paused, playing, ended
  let M = null, bytes = null, onScreen = false, raf = 0, base = 0, since = null, lastTic = -1;
  const held = new Set();

  // The button's text, with the power sign when it switches the computer on.
  function setButton(text, label, icon = false) {
    btn.innerHTML = `${icon ? POWER_ICON : ''}${text}`;
    btn.setAttribute('aria-label', label);
  }
  // The boot text: one line per real step, shown on the drawn screen while it loads.
  let bootLines = [];
  function bootSay(line, replaceLast = false) {
    if (replaceLast) bootLines[bootLines.length - 1] = line; else bootLines.push(line);
    boot.textContent = bootLines.join('\n');
  }
  // Touch buttons for a screen without a keyboard: each holds its Doom key while pressed.
  const PAD = [['up', '\u2191', UP, 'forward'], ['left', '\u2190', LEFT, 'turn left'], ['right', '\u2192', RIGHT, 'turn right'],
    ['down', '\u2193', DOWN, 'back'], ['fire', 'FIRE', FIRE, 'fire'], ['use', 'USE', USE, 'use, open doors'],
    ['enter', 'OK', 13, 'pick a menu item'], ['menu', 'MENU', MENU, 'open the menu']];
  const pad = document.createElement('div');
  pad.className = 'doom-pad'; pad.hidden = true;
  pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Game controls');
  for (const [name, label, code, says] of PAD) {
    const b = document.createElement('button');
    b.type = 'button'; b.tabIndex = -1; b.className = `pad-${name}`; b.textContent = label; b.setAttribute('aria-label', says);
    const up = () => { delete b.dataset.on; if (held.delete(code)) M?._dg_key(0, code); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state !== 'playing' || held.has(code)) return;
      b.setPointerCapture?.(e.pointerId);
      b.dataset.on = ''; held.add(code); M._dg_key(1, code);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    pad.append(b);
  }
  kb.append(pad);

  // The keyboard turns into the controls (touch only). Each frame redraws the box's text: the
  // keys the game does not use clear away in a random order, the box grows a row at a time
  // until the buttons fit, then the buttons show. Under reduced motion it is the last frame.
  let morph = 0, morphed = false;
  const kbLines = KB0.split('\n');
  const kept = (r, c) => KB_KEEP.some(([kr, a, b]) => kr === r && c >= a && c <= b);
  const rowOf = (inner, r, keep) => {
    const line = kbLines[r] ?? kbLines[1];
    let out = line.slice(0, KB_IN);
    for (let c = 0; c < inner.length; c++) {
      const ch = inner[c];
      out += keep && kept(r, c) && ch !== ' ' ? `<b class="kb-keep">${ch}</b>` : ch;
    }
    return out + line.slice(KB_IN + inner.length);
  };
  const innerOf = (r) => kbLines[r].slice(KB_IN, KB_IN + 54);
  function rowsFor() { // inner rows that hold the buttons, with half a row above and below
    const lh = parseFloat(getComputedStyle(kbArt).lineHeight);
    return Math.max(3, Math.ceil(pad.offsetHeight / lh + 1));
  }
  function drawBox(inners, keep) {
    kbArt.innerHTML = [kbLines[0], ...inners.map((t, i) => rowOf(t, i + 1, keep)), kbLines[4]].join('\n');
  }
  function toControls() {
    if (morphed) return;
    morphed = true;
    pad.dataset.wait = ''; pad.style.visibility = 'hidden'; pad.hidden = false; kb.dataset.pad = '';
    const need = rowsFor(), blank = ' '.repeat(54);
    const finish = () => { morph = 0; drawBox(Array(need).fill(blank), false); pad.style.visibility = ''; };
    if (reduceMotion.matches) { finish(); return; }
    const inners = [1, 2, 3].map((r) => innerOf(r).split(''));
    const gone = [];
    inners.forEach((row, i) => row.forEach((ch, c) => { if (ch !== ' ' && !kept(i + 1, c)) gone.push([i, c]); }));
    for (let i = gone.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [gone[i], gone[j]] = [gone[j], gone[i]]; }
    const t0 = performance.now(), CLEAR = 420, GROW = 40, HOLD = 160;
    const step = () => {
      const t = performance.now() - t0;
      const n = Math.min(gone.length, Math.floor(gone.length * t / CLEAR));
      for (let k = 0; k < n; k++) { const [i, c] = gone[k]; inners[i][c] = ' '; }
      const rows = inners.map((r) => r.join(''));
      const extra = t < CLEAR ? 0 : Math.min(need - 3, Math.floor((t - CLEAR) / GROW));
      drawBox([...rows, ...Array(Math.max(0, extra)).fill(blank)], true);
      if (t < CLEAR + (need - 3) * GROW + HOLD) morph = requestAnimationFrame(step); else finish();
    };
    morph = requestAnimationFrame(step);
  }
  function toKeyboard() {
    cancelAnimationFrame(morph); morph = 0; morphed = false;
    pad.hidden = true; pad.style.visibility = ''; delete kb.dataset.pad;
    kbArt.textContent = KB0;
  }
  addEventListener('resize', () => { // a turned phone: refit the box to the buttons
    if (!morphed || morph) return;
    drawBox(Array(rowsFor()).fill(' '.repeat(54)), false);
  });

  function showDevice() {
    const ok = keyboard.matches;
    if (state === 'idle' || state === 'ended') btn.hidden = false;
    keysRow.hidden = !ok;
    if (ok) toKeyboard();
    note.hidden = ok;
    note.textContent = 'On a touch screen, POWER turns the keyboard into the controls. The download is big, so Wi-Fi is best.';
  }
  keyboard.addEventListener('change', showDevice);
  showDevice();

  // The game's clock: milliseconds of play, stopped while the game may not run.
  const now = () => (since === null ? base : base + performance.now() - since);
  const mayRun = () => state === 'playing' && onScreen && !document.hidden;
  function update() {
    if (mayRun()) {
      if (since === null) since = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (since !== null) { base = now(); since = null; }
  }
  function frame() {
    raf = 0;
    if (!mayRun()) return;
    const tic = Math.floor(now() / TIC);
    if (tic > lastTic) {
      lastTic = tic;
      try { M._dg_tick(); } catch (err) { end(err); return; }
      blit();
    }
    raf = requestAnimationFrame(frame);
  }
  function blit() { // 32-bit XRGB, little-endian, to RGBA
    const src = new Uint8Array(M.HEAPU8.buffer, M._dg_screen(), W * H * 4), d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = src[i + 2]; d[i + 1] = src[i + 1]; d[i + 2] = src[i]; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; update(); }).observe(stage);
  document.addEventListener('visibilitychange', update);

  // Downloads with a running count on the button.
  async function fetchAll() {
    let got = 0;
    setButton('BOOTING', `Loading Freedoom: 0 of ${mb(total)} MB.`); // the count is on the screen
    bootSay('> fetch engine.js, engine.wasm'); bootSay('> fetch freedoom1.wad'); bootSay(`  0.0 of ${mb(total)} MB`);
    const tick = (n) => {
      got += n;
      setButton('BOOTING', `Loading Freedoom: ${mb(got)} of ${mb(total)} MB.`);
      bootSay(`  ${mb(got)} of ${mb(total)} MB`, true);
    };
    const get = async (url) => {
      const r = await fetch(url);
      if (!r.ok || !r.body) throw new Error(`${url}: ${r.status}`);
      const reader = r.body.getReader(), parts = [];
      let n = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; tick(value.length); }
      const out = new Uint8Array(n);
      let at = 0;
      for (const p of parts) { out.set(p, at); at += p.length; }
      return out;
    };
    const glue = new URL('/doom/engine.js', location.href).href;
    const [engine, wasm, wad] = await Promise.all([
      import(glue).then((m) => { tick(performance.getEntriesByName(glue)[0]?.encodedBodySize || 0); return m.default; }),
      get('/doom/engine.wasm'), get('/doom/freedoom1.wad'),
    ]);
    return { engine, wasm, wad };
  }

  async function start() {
    state = 'loading'; btn.setAttribute('aria-disabled', 'true');
    say(`The computer is on. Loading Freedoom, ${mb(total)} MB.`);
    pc.dataset.on = '';
    if (!keyboard.matches) toControls();
    bootLines = []; bootSay('> power on');
    still.hidden = true; canvas.hidden = true; boot.hidden = false;
    try {
      if (bytes) bootSay('> engine and freedoom1.wad already here');
      bytes = bytes || await fetchAll();
      bootSay('> doomgeneric -iwad freedoom1.wad');
      // a moment to read the last line; nothing moves, so this holds under reduced motion too
      await new Promise((r) => setTimeout(r, 450));
      let lastErr = '';
      let fail;
      const failed = new Promise((_, reject) => { fail = reject; });
      M = await Promise.race([failed, bytes.engine({
        // the WebAssembly is already here (fetched above, with the count), so it is not fetched twice
        instantiateWasm: (imports, done) => { WebAssembly.instantiate(bytes.wasm, imports).then((r) => done(r.instance, r.module), fail); return {}; },
        dgNow: now, print: () => {}, printErr: (s) => { lastErr = s; },
      })]);
      M.FS.writeFile('/freedoom1.wad', bytes.wad);
      // Setting up waits on the clock in places, so it runs while main() does.
      base = 0; since = performance.now(); lastTic = -1;
      try { M.callMain(['-iwad', '/freedoom1.wad']); } catch (err) { if (err !== 'unwind') throw new Error(lastErr || String(err)); }
      finally { base = now(); since = null; }
    } catch (err) {
      console.error('Freedoom could not start', err);
      state = 'ended'; btn.removeAttribute('aria-disabled');
      delete pc.dataset.on;
      bootSay('> could not load. Press POWER to try again.');
      toKeyboard();
      setButton('TRY AGAIN', 'Freedoom could not load. Power on again to try again.', true);
      say('Freedoom could not load.');
      return;
    }
    btn.removeAttribute('aria-disabled');
    boot.hidden = true; canvas.hidden = false;
    blit();
    if (!keyboard.matches) { // touch: no focus to give, it runs while the screen is in view
      state = 'playing'; btn.hidden = true; delete pad.dataset.wait; note.hidden = true;
      say('Freedoom is running. The keyboard under the screen is now the controls.');
      update();
      return;
    }
    state = 'paused';
    take();
  }

  // The game quit (its own menu) or stopped with an error: back to the still picture.
  function end(err) {
    if (err && err.name !== 'ExitStatus') console.error('Freedoom stopped', err);
    state = 'ended'; M = null;
    const had = document.activeElement === canvas;
    canvas.hidden = true; boot.hidden = true; still.hidden = false;
    delete pc.dataset.on;
    setButton('POWER', 'Power on again and play Freedoom.', true);
    btn.hidden = false; toKeyboard(); showDevice();
    if (had) btn.focus();
    give(false);
    say('Freedoom has ended.');
  }

  function take() { canvas.focus({ preventScroll: true }); }
  function give(focusButton) {
    for (const k of held) M?._dg_key(0, k);
    held.clear();
    if (focusButton && !btn.hidden) btn.focus({ preventScroll: true });
  }

  canvas.addEventListener('focus', () => {
    if (state !== 'paused') return;
    state = 'playing'; btn.hidden = true;
    document.documentElement.dataset.game = '';
    say('Freedoom has the keyboard. Escape gives it back.');
    update();
  });
  canvas.addEventListener('blur', () => {
    delete document.documentElement.dataset.game;
    if (state !== 'playing' || !keyboard.matches) return;
    state = 'paused';
    give(false);
    setButton('PLAY', 'Freedoom is paused. Resume it.');
    btn.hidden = false;
    say('Freedoom paused. The keyboard is the page\'s again.');
    update();
  });
  canvas.addEventListener('keydown', (e) => {
    if (state !== 'playing') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); btn.hidden = false; btn.focus({ preventScroll: true }); return; }
    if (e.key === 'Tab' || e.metaKey) return; // Tab leaves; Cmd shortcuts stay the browser's
    e.stopPropagation(); // the page's single-key shortcuts never see a key meant for the game
    const k = doomKey(e);
    if (!k) return;
    e.preventDefault();
    if (e.repeat || held.has(k)) return;
    held.add(k); M._dg_key(1, k);
  });
  canvas.addEventListener('keyup', (e) => {
    const k = doomKey(e);
    if (!k || !held.has(k)) return;
    e.preventDefault(); held.delete(k); M._dg_key(0, k);
  });
  canvas.addEventListener('mousedown', () => { if (state === 'paused') take(); });
  btn.addEventListener('click', () => {
    if (state === 'idle' || state === 'ended') start();
    else if (state === 'paused') take();
  });
}
