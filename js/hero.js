// Home, fig. 1: a stack of ledger pages, drawn in text characters, that comes
// apart into a graph of agents. Once the graph has formed it keeps turning,
// slowly, as a running system would: a full turn takes about 80 seconds. A drag
// turns it by hand and the slow turn picks up again after. Canvas 2D, no library.
// While it only turns it redraws 20 times a second; it stops off screen, in a
// hidden tab, when paused, and under reduced motion (the finished graph, still).
import { FONT, palette, motionOn, watch, fit, clamp, lerp, ease, rng, pauseLabel } from './stage.js';

export default function hero(fig) {
  const canvas = fig.querySelector('canvas');
  const pill = fig.querySelector('[data-hero-pill]');
  const small = matchMedia('(max-width: 44rem)').matches;
  const rand = rng(7);
  const CW = 6.6, CH = 11, YAW0 = -0.42;
  let N = 0, A, B, S, delay, U, GA, GB;

  // Every point has two homes and two glyphs: A on a ledger page, B in the graph.
  // The pages are built to the canvas's own character grid, so each mark lands in
  // its own cell and the ledger reads as text: a frame, dashes for the description,
  // 0.00 for the amount (zeros on purpose: no figure here is a real one).
  function build(scale) {
    const sx = (CW / scale) * 0.82, sy = (CH / scale) * 0.82, pts = [];
    const SHEETS = small ? 2 : 3, ROWS = small ? 9 : 12;
    for (let s = 0; s < SHEETS; s++) {
      const ox = (s - (SHEETS - 1) / 2) * 0.22, oy = (s - (SHEETS - 1) / 2) * 0.08, z = 0.3 - s * 0.36;
      // A mark that a nearer page would cover at the resting angle is left out,
      // so the front page reads cleanly and the others show only where they peek out.
      const px = (x, zz) => x * Math.cos(YAW0) + zz * Math.sin(YAW0);
      const covered = (x, y) => {
        for (let n = 0; n < s; n++) {
          const nx = (n - (SHEETS - 1) / 2) * 0.22, ny = (n - (SHEETS - 1) / 2) * 0.08, nz = 0.3 - n * 0.36, q = px(x, z);
          if (q > px(-0.8 + nx, nz) && q < px(0.8 + nx, nz) && y > -1 + ny && y < 1 + ny) return true;
        }
        return false;
      };
      const add = (x, y, g) => { if (!covered(x + ox, y + oy)) pts.push([x + ox, y + oy, z, g, (s / SHEETS) * 0.55 + (1 - (y + 1) / 2) * 0.3 + rand() * 0.15]); };
      for (let x = -0.76; x <= 0.76; x += sx) { add(x, 0.98, '-'); add(x, -0.98, '-'); }
      for (let y = -0.98 + sy; y < 0.98; y += sy) { add(-0.78, y, '|'); add(0.78, y, '|'); }
      for (let r = 0; r < ROWS; r++) {
        if (r > 0 && rand() < 0.1) continue; // a blank line now and then
        const y = 0.82 - (r / (ROWS - 1)) * 1.64, len = 0.35 + rand() * 0.6;
        for (let x = -0.66; x < -0.66 + len; x += sx) if (rand() > 0.13) add(x, y, r === 0 ? '=' : '-');
        const amt = r === 0 ? '======' : rand() < 0.5 ? '00.00' : '000.00';
        for (let k = 0; k < amt.length; k++) add(0.66 - (amt.length - 1 - k) * sx, y, amt[k]);
      }
    }
    N = pts.length;
    A = new Float32Array(N * 3); B = new Float32Array(N * 3); S = new Float32Array(N * 3);
    delay = new Float32Array(N); U = new Float32Array(N); GA = new Array(N); GB = new Array(N);
    // Graph: one hub (the mayor) and nine nodes around it, with edges between them.
    const K = 9, nodes = [[0, 0, 0]];
    for (let k = 0; k < K; k++) {
      const yy = 1 - (k + 0.5) / K * 2, r = Math.sqrt(1 - yy * yy), th = k * 2.39996;
      nodes.push([Math.cos(th) * r * 0.95, yy * 0.8, Math.sin(th) * r * 0.95]);
    }
    const edges = [];
    for (let k = 1; k <= K; k++) { edges.push([0, k]); if (k % 2) edges.push([k, (k % K) + 1]); }
    pts.forEach((pt, i) => {
      A.set(pt.slice(0, 3), i * 3); GA[i] = pt[3]; delay[i] = pt[4];
      S.set([(rand() * 2 - 1) * 1.5, (rand() * 2 - 1) * 1.2, (rand() * 2 - 1) * 1.5], i * 3);
      let q;
      if (rand() < 0.45) {
        const ni = Math.floor(rand() * nodes.length), n = nodes[ni], rr = ni === 0 ? 0.14 : 0.09;
        const a = rand() * 6.283, b = Math.acos(rand() * 2 - 1), d = rr * Math.cbrt(rand());
        q = [n[0] + d * Math.sin(b) * Math.cos(a), n[1] + d * Math.cos(b), n[2] + d * Math.sin(b) * Math.sin(a)];
        GB[i] = ni === 0 ? '#' : d < rr * 0.6 ? '@' : 'o';
      } else {
        const e = edges[Math.floor(rand() * edges.length)], u = 0.12 + rand() * 0.76, n1 = nodes[e[0]], n2 = nodes[e[1]];
        q = [lerp(n1[0], n2[0], u), lerp(n1[1], n2[1], u), lerp(n1[2], n2[2], u)];
        GB[i] = e[0] === 0 ? ':' : '.';
      }
      B.set(q, i * 3);
    });
  }

  let pal = palette();
  // Seconds: the marks fly in, the ledger rests, then it comes apart.
  const T_IN = 1.6, T_REST = 1.5, T_MORPH = 3.2, T_END = T_IN + T_REST + T_MORPH;
  // The slow turn, in radians a second. It eases in over RAMP seconds after the graph forms.
  const DRIFT = 0.08, RAMP = 2.5, IDLE_FPS = 20;
  let clock = 0, intro = 0, morph = 0, turn = 0, spin = 0, raf = 0, last = 0, painted = 0, dragging = false, lastX = 0, paused = false;
  const pauseBtn = fig.querySelector('[data-pause]');
  let depth = null, owner = null, cols = 0, rows = 0;
  const scaleOf = (e) => Math.min(e.w * 0.4, e.h * 0.43);

  let env = null;
  fit(canvas, (e) => {
    env = e;
    cols = Math.floor(env.w / CW); rows = Math.floor(env.h / CH);
    owner = new Int32Array(cols * rows); depth = new Float32Array(cols * rows);
    if (!N) build(scaleOf(e));
    draw();
  });

  function draw() {
    if (!env || !env.w || !owner) return;
    const { ctx, w, h } = env;
    ctx.clearRect(0, 0, w, h);
    owner.fill(-1); depth.fill(-9);
    const on = motionOn();
    // With motion off the figure is its own last frame: the finished graph.
    const m = on ? morph : 1, inn = on ? ease(intro) : 1;
    const yawNow = YAW0 + m * 0.55 + turn;
    const cy = Math.cos(yawNow), sy = Math.sin(yawNow), pitch = lerp(0, 0.22, m), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = scaleOf(env);
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      const u = ease(clamp(m * 1.6 - delay[i] * 0.6)); U[i] = u;
      let x = lerp(A[j], B[j], u), y = lerp(A[j + 1], B[j + 1], u), z = lerp(A[j + 2], B[j + 2], u);
      if (inn < 1) { x = lerp(S[j], x, inn); y = lerp(S[j + 1], y, inn); z = lerp(S[j + 2], z, inn); }
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const k = 1 + z2 * 0.18 * m; // flat while it is a ledger, so the lines stay level
      const c = Math.floor((w / 2 + x1 * scale * k) / CW), r = Math.floor((h * 0.47 - y2 * scale * k) / CH);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const q = r * cols + c;
      if (z2 > depth[q]) { depth[q] = z2; owner[q] = i; }
    }
    ctx.font = `400 11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = pal.fg;
    for (let pass = 0; pass < 3; pass++) { // three depth bands, far to near
      ctx.globalAlpha = [0.42, 0.7, 1][pass];
      for (let q = 0; q < owner.length; q++) {
        const i = owner[q];
        if (i < 0) continue;
        const d = clamp((depth[q] + 1.1) / 2.2), band = d < 0.42 ? 0 : d < 0.56 ? 1 : 2;
        if (band !== pass) continue;
        ctx.fillText(U[i] < 0.5 ? GA[i] : GB[i], (q % cols) * CW, Math.floor(q / cols) * CH);
      }
    }
    ctx.globalAlpha = 1;
    if (pill) pill.textContent = m > 0.55 ? 'NOW: A GRAPH OF AGENTS' : 'THEN: A LEDGER';
  }

  const visible = watch(fig, kick);
  // Paused, it still follows a drag, but nothing moves on its own.
  const can = () => visible() && (!paused || dragging);
  function frame(now) {
    raf = 0;
    if (!can()) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    let quick = dragging; // something is changing fast, so draw every frame
    if (!paused) {
      if (clock < T_END) quick = true;
      clock += dt;
      intro = clamp(clock / T_IN);
      morph = ease(clamp((clock - T_IN - T_REST) / T_MORPH));
      turn += DRIFT * clamp((clock - T_END) / RAMP) * dt;
      if (Math.abs(spin) > 0.02 && !dragging) { turn += spin * dt; spin *= Math.pow(0.04, dt); quick = true; }
    }
    if (quick || now - painted >= 1000 / IDLE_FPS - 4) { draw(); painted = now; }
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!motionOn()) { draw(); return; }
    if (can() && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!motionOn()) return;
    dragging = true; lastX = e.clientX; spin = 0; canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId); kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    turn += dx * 0.008; spin = paused ? 0 : dx * 0.5;
  });
  const drop = () => { if (!dragging) return; dragging = false; canvas.classList.remove('dragging'); kick(); };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  pauseBtn?.addEventListener('click', () => { paused = !paused; spin = 0; pauseLabel(pauseBtn, paused); kick(); });
  // Replay starts from the assembled ledger, facing the way it first did.
  fig.querySelector('[data-replay]')?.addEventListener('click', () => {
    clock = T_IN; turn = 0; spin = 0; morph = 0; paused = false; pauseLabel(pauseBtn, false); draw(); kick();
  });
  document.addEventListener('site:theme', () => { pal = palette(); draw(); });
  document.fonts?.ready.then(draw);
  kick();
}
