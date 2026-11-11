// Projects, Lookaway: a desk, seen from the side. From the Lookaway docs: when my face has not
// been seen for a grace period (default 5 s) the keyboard and mouse are blocked with an event
// tap; when a face comes back it is compared with my enrolled face, and only a match unblocks
// them. Frames are analysed in memory and never saved. A screen with a camera on top sits on
// the desk with a keyboard and a mouse; I sit in front of it. I get up and walk out of the
// picture, the screen counts the grace period down (drawn faster than real time), the keyboard
// and mouse are blocked. I come back and sit down; the camera finds a face and checks it, it
// is mine, and they work again. Canvas 2D.
import { palette, fit, timeline, text, lerp, ease, seg } from './stage.js';

const OUT = [1.2, 2.0], BACK = [4.9, 5.7], CHECK = [5.8, 6.9], GRACE = [2.0, 4.3], END = 7.8;

export default function lookaway(fig) {
  let pal = palette();
  document.addEventListener('site:theme', () => { pal = palette(); });
  let tl = null;
  const env = fit(fig.querySelector('canvas'), () => tl && tl.paint());

  // A line of text that fits width mw: one line, or two if it would be under 7px.
  function fitText(ctx, s, x, y, mw, color, weight, max) {
    let size = Math.min(max, mw / (s.length * 0.62));
    if (size >= 7 || !s.includes(' ')) { text(ctx, s, x, y, color, 'center', weight, Math.max(7, size)); return; }
    const words = s.split(' '), mid = Math.ceil(words.length / 2), a = words.slice(0, mid).join(' '), b = words.slice(mid).join(' ');
    size = Math.max(7, Math.min(max, mw / (Math.max(a.length, b.length) * 0.62)));
    text(ctx, a, x, y - size * 0.6, color, 'center', weight, size);
    text(ctx, b, x, y + size * 0.6, color, 'center', weight, size);
  }

  function draw(t) {
    const { ctx, w, h } = env;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const blocked = t >= GRACE[1] && t < CHECK[1];
    const here = t < OUT[0] || t >= CHECK[1];
    const pill = (fig.querySelector('.pill')?.offsetHeight || 20) + 6;
    const fs = Math.max(7, Math.min(11, w / 40));
    const footY = h - fs * 0.9, stateY = footY - fs * 1.6, floor = stateY - fs * 1.4;
    const u = Math.min(w / 8.5, (floor - pill) / 5.4); // the scene's unit: a head is about 0.8u

    // the floor
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(w, floor); ctx.stroke();

    // the desk: a top and two legs
    const deskY = floor - 2.4 * u, dx0 = w * 0.03, dx1 = w * 0.56;
    ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(dx0, deskY); ctx.lineTo(dx1, deskY);
    ctx.moveTo(dx0 + u * 0.2, deskY); ctx.lineTo(dx0 + u * 0.2, floor); ctx.moveTo(dx1 - u * 0.2, deskY); ctx.lineTo(dx1 - u * 0.2, floor); ctx.stroke();

    // the screen on its stand, a camera dot on top
    const mw = Math.min(w * 0.36, (deskY - u * 0.45 - pill - 6) / 0.62), mh = mw * 0.62;
    const mx = w * 0.05, my = deskY - u * 0.45 - mh;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.beginPath(); ctx.moveTo(mx + mw / 2, my + mh); ctx.lineTo(mx + mw / 2, deskY - 1); ctx.moveTo(mx + mw * 0.36, deskY - 1); ctx.lineTo(mx + mw * 0.64, deskY - 1); ctx.stroke();
    const cam = [mx + mw / 2, my + Math.max(3, mh * 0.06)];
    ctx.beginPath(); ctx.arc(cam[0], cam[1], Math.max(1.6, u * 0.06), 0, 6.2832); ctx.fillStyle = pal.fg; ctx.fill();
    // what the app shows, in the middle of the screen
    let state;
    if (here) state = 'you are here';
    else if (t < GRACE[0]) state = 'away';
    else if (t < GRACE[1]) state = `away ${Math.max(1, 5 - Math.floor(((t - GRACE[0]) / (GRACE[1] - GRACE[0])) * 5))}s`;
    else if (t < BACK[1]) state = 'blocked';
    else state = 'checking the face';
    fitText(ctx, state, mx + mw / 2, my + mh * 0.56, mw * 0.86, blocked || here ? pal.fg : pal.accent, 700, 11);

    // the keyboard and the mouse, on the desk in front of the screen
    const kx0 = mx + mw * 0.12, kx1 = Math.min(dx1 - u * 0.9, mx + mw * 1.05), kh = Math.max(3, u * 0.14);
    const kc = blocked ? pal.line : pal.fg;
    ctx.strokeStyle = kc; ctx.lineWidth = 1.1;
    ctx.strokeRect(kx0, deskY - kh, kx1 - kx0, kh);
    for (let k = 1; k < 8; k++) { const x = lerp(kx0, kx1, k / 8); ctx.beginPath(); ctx.moveTo(x, deskY - kh); ctx.lineTo(x, deskY - kh * 0.4); ctx.stroke(); }
    const ox = kx1 + u * 0.25, ow = u * 0.32;
    ctx.beginPath(); ctx.ellipse(ox + ow / 2, deskY - kh * 0.7, ow / 2, kh * 0.7, 0, Math.PI, 0); ctx.closePath(); ctx.stroke();
    if (blocked) { // a line through both: every key press and click is swallowed
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(kx0 - 3, deskY + 3); ctx.lineTo(ox + ow + 3, deskY - kh - 5); ctx.stroke();
    }

    // the chair, which stays
    const cx = w * 0.74, seatY = floor - 1.15 * u;
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - u * 0.55, seatY); ctx.lineTo(cx + u * 0.45, seatY); ctx.lineTo(cx + u * 0.55, seatY - u * 1.4);
    ctx.moveTo(cx, seatY); ctx.lineTo(cx, floor - u * 0.1); ctx.moveTo(cx - u * 0.4, floor - 1); ctx.lineTo(cx + u * 0.4, floor - 1); ctx.stroke();

    // me: sitting, or standing and walking off to the right, and back
    const go = ease(seg(t, OUT[0], OUT[1])), come = ease(seg(t, BACK[0], BACK[1]));
    // I stand up, then walk; coming back, I walk in, then sit down
    const stand = t < BACK[0] ? seg(go, 0, 0.45) : 1 - seg(come, 0.55, 1);
    const off = t < BACK[0] ? seg(go, 0.45, 1) : 1 - seg(come, 0, 0.55);
    const px = cx + off * w * 0.5;
    const hip = [px - u * 0.05, lerp(seatY - u * 0.08, floor - 1.75 * u, stand)];
    const neck = [hip[0] - u * 0.12 * (1 - stand), hip[1] - u * 1.3];
    const head = [neck[0] - u * 0.08, neck[1] - u * 0.48], hr = u * 0.38;
    const knee = [lerp(hip[0] - u * 0.85, hip[0] - u * 0.1, stand), lerp(hip[1], hip[1] + u * 0.85, stand)];
    const foot = [knee[0] - u * 0.05, floor - 1];
    const hand = stand > 0.5 ? [neck[0] - u * 0.15, hip[1] - u * 0.1] : [Math.min(kx1 + u * 0.1, neck[0] - u * 1.2), deskY - kh - 1];
    const elbow = [lerp(neck[0], hand[0], 0.45), lerp(neck[1], hand[1], 0.45) + u * 0.25];
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(head[0], head[1], hr, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1]);
    ctx.moveTo(neck[0], neck[1] + u * 0.15); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.restore(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

    // what the camera sees: a sight line to the face, and a box that is solid while I am
    // recognised and dashed while a face is being checked
    const seen = t < OUT[0] || t >= BACK[1];
    if (seen) {
      const checking = t >= BACK[1] && t < CHECK[1];
      const b = hr * 1.45;
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = pal.accent; ctx.lineWidth = 1; ctx.setLineDash([1, 4]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cam[0] + 3, cam[1]); ctx.lineTo(head[0] - b, head[1]); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.4;
      if (checking) ctx.setLineDash([3, 3]);
      ctx.strokeRect(head[0] - b, head[1] - b, b * 2, b * 2);
      ctx.setLineDash([]);
      const tag = checking ? (t < BACK[1] + 0.25 ? 'face' : 'is it me?') : 'me';
      const tx = Math.min(head[0] - b, w - tag.length * fs * 0.62);
      text(ctx, tag, tx, Math.max(pill + fs * 0.2, head[1] - b - fs * 0.8), pal.accent, 'left', 700, fs);
    }

    // the input's state, and a short account of the moment
    const input = blocked ? 'keyboard and mouse: blocked' : 'keyboard and mouse: on';
    text(ctx, input, 0, stateY, blocked ? pal.fg : pal.grey, 'left', blocked ? 700 : 400, Math.min(fs, w / (input.length * 0.62)));
    const fade = (a, b) => seg(t, a, b);
    let line = 'I am at the Mac', a = 1;
    if (t >= OUT[0]) { line = 'I walk away: a grace period'; a = fade(OUT[0], OUT[0] + 0.3); }
    if (t >= GRACE[1]) { line = 'gone too long: input blocked'; a = fade(GRACE[1], GRACE[1] + 0.3); }
    if (t >= BACK[1]) { line = 'a face: compared with mine'; a = fade(BACK[1], BACK[1] + 0.3); }
    if (t >= CHECK[1]) { line = 'it matches: unblocked'; a = fade(CHECK[1], CHECK[1] + 0.3); }
    ctx.globalAlpha = lerp(0.3, 1, a); text(ctx, line, 0, footY, pal.fg, 'left', 400, Math.min(fs, w / (line.length * 0.62))); ctx.globalAlpha = 1;
  }

  tl = timeline(fig, END, draw);
}
