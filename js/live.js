// /live/: the last 30 days of GitHub activity as squares, and counters in the form
// TODAY / LAST 30 DAYS, from live/activity.json, which the hourly banner job writes
// (live-banner.py in the LinkedIn profile folder). Dates and counts only. "Today" is the UTC day.
// The counters roll up from 0 on load; under reduced motion they show the final number at once.
const cal = document.querySelector('[data-live-cal]');
const counters = document.querySelector('[data-live-counters]');
const stamp = document.querySelector('[data-live-stamp]');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATS = [['commit', 'Commits'], ['merged', 'PRs merged'], ['lines', 'Lines delivered'],
  ['pr', 'PRs opened'], ['review', 'PRs reviewed']];
// 412,345 -> '412K' (rounded down), as on the banner. Below 100,000 the full number.
const compact = (v) => (v >= 100000 ? `${Math.floor(v / 1000)}K` : String(v));
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// GitHub-style levels: quartiles of the active days' counts.
function levels(days) {
  const nz = days.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
  if (!nz.length) return days.map(() => 0);
  const q = [0.25, 0.5, 0.75].map((f) => nz[Math.min(nz.length - 1, Math.floor(nz.length * f))]);
  return days.map((d) => (d.count ? 1 + q.filter((t) => d.count > t).length : 0));
}

function odometer(el, value, digits) {
  const cells = Array.from({ length: digits }, () => { const c = document.createElement('span'); el.append(c); return c; });
  const paint = (v) => {
    const c = compact(v), s = c.padStart(digits, '0'), lead = digits - c.length;
    cells.forEach((c, i) => { c.textContent = s[i]; c.classList.toggle('z', i < lead); });
  };
  if (still || !value) { paint(value); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const u = Math.min(1, (now - t0) / dur);
    paint(Math.round(value * (1 - Math.pow(1 - u, 3))));
    if (u < 1) requestAnimationFrame(step);
  };
  paint(0); requestAnimationFrame(step);
}

async function load() {
  let data;
  try {
    const r = await fetch('/live/activity.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) {
    cal.setAttribute('aria-label', 'Activity could not be loaded.');
    counters.innerHTML = '<li class="meta">Activity could not be loaded. The banner below is the latest copy.</li>';
    return;
  }
  const days = data.days, lv = levels(days);
  cal.innerHTML = days.map((d, i) => `<i class="l${lv[i]}"></i>`).join('');
  const total = days.reduce((s, d) => s + d.count, 0), active = days.filter((d) => d.count).length;
  cal.setAttribute('aria-label', `${total} contributions over the last ${days.length} days, on ${active} of them.`);
  const st = data.stats;
  // The counters the banner shows, from the JSON; a stat without a source (null) is left out.
  const shown = (data.counters || STATS).map(([k]) => STATS.find(([s]) => s === k) || [k, k]).filter(([k]) => st[k]);
  counters.innerHTML = '';
  for (const [k, label] of shown) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="odo" aria-hidden="true"><span class="t"></span><span class="sl">/</span><span class="m"></span></span>`
      + `<span class="meta" aria-hidden="true">${label.toUpperCase()}*</span>`
      + `<span class="vh">${label}: ${st[k].today.toLocaleString('en-GB')} today, ${st[k].month.toLocaleString('en-GB')} in the last ${data.month_days} days.</span>`;
    counters.append(li);
    // Each counter is as wide as its own number: at least 2 cells for today, 3 for the month.
    odometer(li.querySelector('.t'), st[k].today, Math.max(2, compact(st[k].today).length));
    odometer(li.querySelector('.m'), st[k].month, Math.max(3, compact(st[k].month).length));
  }
  const t = new Date(data.updated.replace('Z', ':00Z'));
  stamp.textContent = `* today (UTC) / overall last ${data.month_days} days. Updated ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${String(t.getUTCHours()).padStart(2, '0')}:00 UTC.`;
}
load();
