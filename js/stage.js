// Shared runtime for the figures: one clock that only runs while the figure is
// on screen, the tab is visible and the system allows motion. Each figure is a
// pure function of time, so the reduced-motion version is simply one fixed frame.
// The system's reduced-motion setting is the only site-wide motion control; each
// moving figure also has its own pause button.

export const FONT = '"Commit Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export const motionOn = () => !reduce.matches;

export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return { bg: g('--bg'), fg: g('--fg'), grey: g('--grey'), line: g('--line'), accent: g('--link') };
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const ease = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const seg = (t, a, b) => clamp((t - a) / (b - a)); // progress of t through [a, b]

export function rng(seed) { // mulberry32
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// Watches visibility for a figure and reports whether it may animate.
export function watch(fig, onChange) {
  let visible = false;
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; onChange(); }, { rootMargin: '0px' });
  io.observe(fig);
  document.addEventListener('visibilitychange', onChange);
  reduce.addEventListener('change', onChange);
  return () => visible && !document.hidden && motionOn();
}

// Sizes a canvas to its box at up to 2x density and calls back on resize.
export function fit(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  const env = { ctx, w: 0, h: 0, dpr: 1 };
  const apply = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    env.dpr = Math.min(window.devicePixelRatio || 1, 2);
    env.w = r.width; env.h = r.height;
    canvas.width = Math.round(r.width * env.dpr); canvas.height = Math.round(r.height * env.dpr);
    ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    onResize(env);
  };
  new ResizeObserver(apply).observe(canvas);
  apply();
  return env;
}

// The label of a pause button follows its state.
export const pauseLabel = (btn, paused) => { if (btn) btn.textContent = paused ? '[ PLAY ]' : '[ PAUSE ]'; };

// A timeline. draw(t, run) is called with t in seconds from 0.
// It starts when the figure first scrolls into view and stops off screen or in a hidden tab.
// - Play once (the default): t stops at duration and the figure holds that frame. Its one
//   button [data-play] reads PAUSE while it plays, PLAY while paused, REPLAY once it is done.
// - loop: t keeps running after duration and draw decides what an idle figure does. Past
//   duration it redraws at most fps times a second, since idle motion is slow on purpose.
//   [data-pause] pauses and resumes it; [data-replay], if present, starts it over.
// - A play-once figure also starts over by itself when it comes back on screen, after it has
//   been fully out of view by a margin (AWAY), so a small scroll at its edge does not restart
//   it. A figure the reader paused stays paused until they press PLAY.
// Under reduced motion the figure is the single frame at `still` (default: duration).
// Returns { replay, extend, now, paint, resume }.
const AWAY = '15% 0px'; // how far past the viewport edge a figure must go to count as gone
export function timeline(fig, duration, draw, { loop = false, fps = 60, still = duration } = {}) {
  let t = 0, last = null, raf = 0, run = 0, dur = duration, paused = false, painted = 0, away = false;
  const playBtn = fig.querySelector('[data-play]'), pauseBtn = fig.querySelector('[data-pause]');
  const live = watch(fig, kick);
  if (!loop) {
    new IntersectionObserver((es) => {
      if (!es[es.length - 1].isIntersecting && t > 0 && !paused && motionOn()) away = true;
    }, { rootMargin: AWAY }).observe(fig);
  }
  const can = () => live() && !paused;
  const moving = () => loop || t < dur;
  function label() {
    if (playBtn) playBtn.textContent = !loop && t >= dur ? '[ REPLAY ]' : paused ? '[ PLAY ]' : '[ PAUSE ]';
    pauseLabel(pauseBtn, paused);
  }
  function paint() { draw(motionOn() ? t : still, run); }
  function frame(now) {
    raf = 0;
    if (!can()) { last = null; return; }
    if (last !== null) t += Math.min(0.05, (now - last) / 1000);
    if (!loop && t >= dur) t = dur;
    last = now;
    if (t <= dur || now - painted >= 1000 / fps - 4) { paint(); painted = now; }
    if (moving()) raf = requestAnimationFrame(frame);
    else { last = null; label(); }
  }
  function kick() {
    if (!motionOn()) { paint(); return; }
    if (away && live()) { away = false; if (!paused) { api.replay(); return; } }
    if (can() && !raf && moving()) { last = null; raf = requestAnimationFrame(frame); }
  }
  const setPaused = (p) => { paused = p; label(); kick(); };
  const api = {
    replay() { t = 0; run++; dur = duration; paused = false; label(); paint(); kick(); },
    extend(to) { dur = Math.max(dur, to); label(); kick(); },
    resume() { if (paused) setPaused(false); },
    now: () => t,
    paint,
  };
  playBtn?.addEventListener('click', () => (t >= dur ? api.replay() : setPaused(!paused)));
  pauseBtn?.addEventListener('click', () => setPaused(!paused));
  fig.querySelector('[data-replay]')?.addEventListener('click', api.replay);
  // The R key (js/main.js) asks a figure to start over, even one with no REPLAY button.
  fig.addEventListener('fig:replay', () => { if (motionOn()) api.replay(); });
  label();
  document.addEventListener('site:theme', paint);
  document.fonts?.ready.then(paint);
  paint();
  return api;
}

// Small canvas helpers shared by the figures.
export function text(ctx, s, x, y, color, align = 'center', weight = 400, size = 12) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
export function dotted(ctx, x1, y1, x2, y2, color, u = 1) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.setLineDash([0.1, 5]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, u), lerp(y1, y2, u)); ctx.stroke();
  ctx.restore();
}
