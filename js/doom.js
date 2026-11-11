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
// - No keyboard (a touch screen): no PLAY, a line says why. No sound: the engine has none.
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

export default function doom(fig) {
  const stage = fig.querySelector('.stage'), still = stage.querySelector('img'), canvas = stage.querySelector('canvas');
  const pc = stage.querySelector('.pc'), boot = stage.querySelector('.pc-boot');
  const btn = fig.querySelector('[data-doom-play]'), note = fig.querySelector('[data-doom-note]');
  const keysRow = fig.querySelector('[data-doom-keys]'), status = fig.querySelector('[data-doom-status]');
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H);
  const keyboard = matchMedia('(hover: hover) and (pointer: fine)');
  const total = Number(btn.getAttribute('aria-label').match(/([\d.]+) MB/)[1]) * 1e6;
  const say = (s) => { status.textContent = s; };
  let state = 'idle'; // idle, loading, paused, playing, ended
  let M = null, bytes = null, onScreen = false, raf = 0, base = 0, since = null, lastTic = -1;
  const held = new Set();

  // The button's text; `more` is dropped on a narrow stage (css), the accessible name keeps it all.
  function setButton(text, label, more = '') {
    btn.innerHTML = `[ ${text}${more ? `<span class="dl">${more}</span>` : ''} ]`;
    btn.setAttribute('aria-label', label);
  }
  // The boot text: one line per real step, shown on the drawn screen while it loads.
  let bootLines = [];
  function bootSay(line, replaceLast = false) {
    if (replaceLast) bootLines[bootLines.length - 1] = line; else bootLines.push(line);
    boot.textContent = bootLines.join('\n');
  }
  function showDevice() {
    const ok = keyboard.matches;
    if (state === 'idle' || state === 'ended') btn.hidden = !ok;
    keysRow.hidden = !ok;
    note.hidden = ok;
    note.textContent = 'Freedoom needs a keyboard, so on this screen it is a still picture.';
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
      setButton('TRY AGAIN', 'Freedoom could not load. Power on again to try again.');
      say('Freedoom could not load.');
      return;
    }
    btn.removeAttribute('aria-disabled');
    boot.hidden = true; canvas.hidden = false;
    blit();
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
    setButton('POWER', 'Power on again and play Freedoom.');
    btn.hidden = !keyboard.matches;
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
    if (state !== 'playing') return;
    state = 'paused';
    give(false);
    setButton('<span class="dl">PAUSED: </span>PLAY', 'Freedoom is paused. Resume it.');
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
