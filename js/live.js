// /live/: the last 30 days of GitHub activity, from live/activity.json, which the hourly banner
// job writes (live-banner.py in the LinkedIn profile folder). Counts only. Same squares as the
// banner: Monday-first weeks down, weeks across, empty then greys then the link blue.
const weeks = document.querySelector('[data-live-weeks]');
const counts = document.querySelector('[data-live-counts]');
const stamp = document.querySelector('[data-live-stamp]');
const spanEl = document.querySelector('[data-live-span]');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

async function load() {
  let data;
  try {
    const r = await fetch('/live/activity.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) {
    weeks.setAttribute('aria-label', 'Activity could not be loaded.');
    counts.innerHTML = '<tr><th scope="row">Activity</th><td>could not be loaded, the banner below is the latest copy</td></tr>';
    return;
  }
  const days = data.days;
  const top = Math.max(1, ...days.map((d) => d.count));
  const lead = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  weeks.innerHTML = '<i style="visibility:hidden"></i>'.repeat(lead) + days.map((d) => {
    const l = d.count === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((d.count / top) * 4)));
    return `<i class="l${l}" title="${day(d.date)}: ${d.count}"></i>`;
  }).join('');
  const span = `${day(days[0].date)} to ${day(days[days.length - 1].date)}`;
  spanEl.textContent = `Last 30 days, ${span}.`;
  weeks.setAttribute('aria-label', `${data.total} contributions over ${days.length} days, ${span}, on ${data.active} of them.`);
  counts.innerHTML = [
    ['Contributions', data.total], ['Active days', `${data.active} of ${days.length}`],
    ['Longest streak', `${data.streak} days`], ['Busiest day', data.busiest],
  ].map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');
  const t = new Date(data.updated.replace('Z', ':00Z'));
  stamp.textContent = `Updated ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${String(t.getUTCHours()).padStart(2, '0')}:00 UTC.`;
  // main.js draws the ASCII table only when its width changes, so drop its cached width first.
  const pre = counts.closest('.ascii-wrap')?.querySelector('pre.ascii-pre');
  if (pre) delete pre.dataset.cols;
  window.dispatchEvent(new Event('resize'));
}
load();
