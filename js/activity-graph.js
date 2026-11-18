// <activity-graph src="activity.json" refresh="300"></activity-graph>
//
// The activity JSON written by the Python side as a GitHub-style grid: weekdays down, weeks
// across, today outlined. Every square is a button. Click or tap one, or move with the arrow keys
// and press Enter or Space, to show that day's numbers in the panel beside the grid. Escape goes
// back to today. With `refresh` (seconds) the file is fetched again on that interval and when
// the tab comes back into view, so a fresh JSON shows up without a reload.
//
// Colours come from CSS custom properties (--ag-bg, --ag-fg, --ag-grey, --ag-line, --ag-link,
// --ag-q0 .. --ag-qN), which the Python side writes to activity-graph.css from the config.
// Dates are YYYY-MM-DD strings in the configured timezone, so they are formatted as UTC dates
// here, never shifted by the viewer's own timezone.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Per-day rows in the panel: field, singular, plural.
const ROWS = [
    ['commits', 'commit', 'commits'],
    ['prs_opened', 'PR opened', 'PRs opened'],
    ['prs_merged', 'PR merged', 'PRs merged'],
    ['reviews', 'review', 'reviews'],
    ['lines', 'line delivered', 'lines delivered'],
];
const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const short = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const long = (d) => `${WEEKDAYS[d.getUTCDay()]} ${short(d)} ${d.getUTCFullYear()}`;
// The same rule as the Python side, used only when the JSON has no levels.
function levels(days, quantiles = [0.08, 0.2, 0.4], todayMin = 3) {
    const nz = days.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
    if (!nz.length)
        return days.map(() => 0);
    const q = quantiles.map((f) => nz[Math.min(nz.length - 1, Math.floor(nz.length * f))]);
    const lv = days.map((d) => (d.count ? 1 + q.filter((t) => d.count > t).length : 0));
    if (days.length && days[days.length - 1].count && todayMin) {
        lv[lv.length - 1] = Math.max(lv[lv.length - 1], Math.min(todayMin, quantiles.length + 1));
    }
    return lv;
}
const CSS = `
:host { display: block; font: inherit; color: var(--ag-fg, #1a1a1c);
  --cell: 2rem; --gap: 6px; }
@media (pointer: coarse) { :host { --cell: 2.75rem; --gap: 4px; } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.act { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1.5rem 2rem; }
/* Both columns may shrink below their content on a very narrow screen; the grid then scrolls in .scroll. */
.act > div { min-width: 0; max-width: 100%; }
/* Room for the focus and today outlines, so a long window scrolls inside, never the page. */
.scroll { max-width: 100%; overflow-x: auto; padding: 5px; }
.grid { display: grid; width: max-content; grid-template-columns: auto repeat(var(--weeks, 5), var(--cell));
  grid-auto-rows: var(--cell); gap: var(--gap); font-size: 0.75rem; color: var(--ag-grey, #62616a); }
.mo { grid-row: 1; line-height: 1; align-self: end; white-space: nowrap; }
.wd { grid-column: 1; line-height: var(--cell); padding-right: 0.6rem; }
button { font: inherit; color: inherit; cursor: pointer; }
.sq { position: relative; width: var(--cell); height: var(--cell); padding: 0; border: 0; border-radius: 4px;
  background: var(--ag-q0, #e6e6e9); }
.sq:hover { outline: 2px solid var(--ag-line, #8a8990); outline-offset: 2px; }
.sq.today { outline: 2px solid var(--ag-fg, #1a1a1c); outline-offset: 2px; }
.sq:focus-visible { outline: 3px solid var(--ag-link, #1f6fc4); outline-offset: 2px; }
.sq:active { transform: scale(0.94); }
@media (prefers-reduced-motion: reduce) { .sq:active { transform: none; } }
/* The selected day: a dot ringed in the background colour, readable on every level. */
.sq[aria-pressed="true"]::after { content: ""; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px;
  margin: -4px 0 0 -4px; border-radius: 50%; background: var(--ag-fg, #1a1a1c);
  box-shadow: 0 0 0 2px var(--ag-bg, #f7f7f8); }
@media (forced-colors: active) { .sq { border: 1px solid CanvasText; }
  .sq[aria-pressed="true"]::after { background: Highlight; } }
.legend { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--ag-grey, #62616a);
  margin: 0.75rem 0 0; }
.legend i { width: 0.75rem; height: 0.75rem; border-radius: 2px; display: inline-block; }
.panel { min-width: min(15rem, 100%); flex: 0 1 22rem; margin: 0; }
.panel .day { font-weight: 700; margin: 0 0 0.5rem; }
.panel dl { display: grid; grid-template-columns: auto 1fr; gap: 0.15rem 1rem; margin: 0; }
.panel dt { color: var(--ag-grey, #62616a); }
.panel dd { margin: 0; font-variant-numeric: tabular-nums; }
.note, .totals, .stamp { color: var(--ag-grey, #62616a); font-size: var(--ag-small, 0.875rem); margin: 0.75rem 0 0; }
.status { margin: 0 0 0.75rem; }
.retry { margin-left: 0.5rem; padding: 0.6rem 0.9rem; min-height: 44px; border: 1px solid var(--ag-line, #8a8990);
  border-radius: 4px; background: transparent; }
.retry:hover { border-color: var(--ag-fg, #1a1a1c); }
.retry:focus-visible { outline: 3px solid var(--ag-link, #1f6fc4); outline-offset: 2px; }
`;
export class ActivityGraph extends HTMLElement {
    constructor() {
        super();
        this.data = null;
        this.selected = -1; // index into data.days
        this.timer = 0;
        this.loading = false;
        this.nf = new Intl.NumberFormat(document.documentElement.lang || 'en-GB');
        this.onVisible = () => {
            if (document.visibilityState === 'visible' && this.getAttribute('refresh'))
                this.load();
        };
        this.root = this.attachShadow({ mode: 'open' });
        this.root.innerHTML = `<style>${CSS}</style>
      <p class="status" role="status" aria-live="polite"></p>
      <div class="act" hidden>
        <div>
          <div class="scroll"><div class="grid" role="group"></div></div>
          <p class="legend" aria-hidden="true"></p>
          <p class="vh" id="help">Arrow keys move between days, Enter or Space shows a day, Escape goes back to today.</p>
        </div>
        <div class="panel" aria-live="polite"></div>
      </div>
      <p class="totals" hidden></p>
      <p class="stamp" hidden></p>`;
        this.root.addEventListener('click', (e) => this.onClick(e));
        this.root.addEventListener('keydown', (e) => this.onKey(e));
    }
    connectedCallback() {
        this.load();
        document.addEventListener('visibilitychange', this.onVisible);
    }
    disconnectedCallback() {
        clearInterval(this.timer);
        document.removeEventListener('visibilitychange', this.onVisible);
    }
    attributeChangedCallback(name, old, value) {
        if (!this.isConnected || old === value)
            return;
        if (name === 'src')
            this.load();
        if (name === 'refresh')
            this.schedule();
    }
    schedule() {
        clearInterval(this.timer);
        const s = Number(this.getAttribute('refresh'));
        if (s >= 30)
            this.timer = window.setInterval(() => this.load(), s * 1000);
    }
    $(sel) {
        return this.root.querySelector(sel);
    }
    async load() {
        const src = this.getAttribute('src') || 'activity.json';
        if (this.loading)
            return;
        this.loading = true;
        const status = this.$('.status');
        if (!this.data)
            status.textContent = 'Loading activity.';
        try {
            const r = await fetch(src, { cache: 'no-cache' });
            if (!r.ok)
                throw new Error(String(r.status));
            const data = (await r.json());
            if (!Array.isArray(data.days) || !data.days.length)
                throw new Error('no days');
            const keep = this.data && this.selected >= 0 ? this.data.days[this.selected].date : null;
            this.data = data;
            const i = keep ? data.days.findIndex((d) => d.date === keep) : -1;
            this.selected = i >= 0 ? i : data.days.length - 1;
            this.render();
            this.schedule();
        }
        catch {
            // A failed refresh keeps the last good grid on screen and says so.
            status.hidden = false;
            status.innerHTML = this.data
                ? 'Could not refresh the activity. These are the last numbers loaded.'
                : 'Activity could not be loaded.';
            if (!this.data)
                status.innerHTML += ' <button type="button" class="retry">Try again</button>';
        }
        finally {
            this.loading = false;
        }
    }
    render() {
        const data = this.data;
        const days = data.days;
        const lv = data.levels && data.levels.length === days.length ? data.levels : levels(days);
        const nLevels = Math.max(5, ...lv.map((x) => x + 1));
        const first = utc(days[0].date);
        const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
        const weeks = Math.ceil((lead + days.length) / 7);
        const grid = this.$('.grid');
        grid.style.setProperty('--weeks', String(weeks));
        const parts = [];
        let prev = -1;
        for (let c = 0; c < weeks; c++) {
            const k = Math.max(0, c * 7 - lead);
            if (k >= days.length)
                break;
            const m = utc(days[k].date).getUTCMonth();
            if (m !== prev)
                parts.push(`<span class="mo" aria-hidden="true" style="grid-column:${c + 2}">${MONTHS[m]}</span>`);
            prev = m;
        }
        [['Mon', 0], ['Wed', 2], ['Fri', 4]].forEach(([d, r]) => parts.push(`<span class="wd" aria-hidden="true" style="grid-row:${r + 2}">${d}</span>`));
        days.forEach((d, i) => {
            const k = lead + i;
            const today = d.date === data.today;
            const label = `${long(utc(d.date))}${today ? ', today' : ''}: ${this.count(d.count, 'commit', 'commits')}`;
            parts.push(`<button type="button" class="sq${today ? ' today' : ''}" data-i="${i}"
        style="grid-column:${Math.floor(k / 7) + 2};grid-row:${(k % 7) + 2};background:var(--ag-q${lv[i]})"
        aria-label="${label}" aria-pressed="${i === this.selected}" aria-describedby="help"
        tabindex="${i === this.selected ? 0 : -1}"></button>`);
        });
        grid.innerHTML = parts.join('');
        const active = days.filter((d) => d.count).length;
        grid.setAttribute('aria-label', `Activity by day, ${short(first)} to ${short(utc(data.today))}: active on ${active} of ${days.length} days`);
        this.$('.legend').innerHTML = 'Less ' +
            Array.from({ length: nLevels }, (_, i) => `<i style="background:var(--ag-q${i})"></i>`).join('') + ' More';
        const status = this.$('.status');
        status.textContent = active ? '' : `No activity in these ${days.length} days.`;
        status.hidden = !!active;
        this.$('.act').hidden = false;
        const st = data.stats, tot = [];
        if (st.commit)
            tot.push(this.count(st.commit.month, 'commit', 'commits'));
        if (st.pr)
            tot.push(this.count(st.pr.month, 'PR opened', 'PRs opened'));
        if (st.merged)
            tot.push(this.count(st.merged.month, 'PR merged', 'PRs merged'));
        if (st.review)
            tot.push(this.count(st.review.month, 'review', 'reviews'));
        if (st.lines)
            tot.push(this.count(st.lines.month, 'line delivered', 'lines delivered'));
        const totals = this.$('.totals');
        totals.textContent = `Last ${days.length} days: ${tot.join(', ')}.`;
        totals.hidden = !tot.length;
        const u = new Date(data.updated.replace('Z', ':00Z'));
        const stamp = this.$('.stamp');
        stamp.textContent = `Counted every hour. Last counted ${short(u)} ${u.getUTCFullYear()}, ${String(u.getUTCHours()).padStart(2, '0')}:` +
            `${String(u.getUTCMinutes()).padStart(2, '0')} UTC.`;
        stamp.hidden = false;
        this.showDetail();
    }
    count(v, one, many) {
        return `${this.nf.format(v)} ${v === 1 ? one : many}`;
    }
    // The panel for the selected day. Older files carry only a commit count per day; for today,
    // the stats block fills in the rest.
    showDetail() {
        const data = this.data;
        const d = data.days[this.selected];
        const today = d.date === data.today;
        const detailed = ROWS.some(([k]) => k !== 'commits' && d[k] !== undefined);
        const rows = [];
        for (const [k, one, many] of ROWS) {
            let v = d[k];
            if (k === 'commits' && v === undefined)
                v = d.count;
            if (v === undefined && today) {
                const s = { prs_opened: 'pr', prs_merged: 'merged', reviews: 'review', lines: 'lines' }[k];
                v = s && data.stats[s] ? data.stats[s].today : undefined;
            }
            if (v !== undefined && v !== null)
                rows.push([v === 1 ? one : many, v]);
        }
        const label = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        const html = `<p class="day">${long(utc(d.date))}${today ? ' (today)' : ''}</p>
      <dl>${rows.map(([name, v]) => `<dt>${label(name)}</dt><dd>${this.nf.format(v)}</dd>`).join('')}</dl>
      ${!detailed && !today ? '<p class="note">For past days, only the commit count is kept.</p>' : ''}`;
        const panel = this.$('.panel');
        if (panel.innerHTML !== html)
            panel.innerHTML = html;
    }
    select(i, focus) {
        const data = this.data;
        this.selected = Math.max(0, Math.min(data.days.length - 1, i));
        this.root.querySelectorAll('.sq').forEach((b) => {
            const on = Number(b.dataset.i) === this.selected;
            b.setAttribute('aria-pressed', String(on));
            b.tabIndex = on ? 0 : -1;
            if (on && focus)
                b.focus();
        });
        this.showDetail();
    }
    onClick(e) {
        const t = e.target;
        if (t.closest('.retry')) {
            this.load();
            return;
        }
        const b = t.closest('.sq');
        if (b)
            this.select(Number(b.dataset.i), true);
    }
    // Arrow keys move focus only; Enter and Space (the button's own click) show the day.
    onKey(e) {
        const b = e.target.closest('.sq');
        if (!b || !this.data)
            return;
        const i = Number(b.dataset.i), last = this.data.days.length - 1;
        const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
        let to = null;
        if (e.key in step)
            to = i + step[e.key];
        else if (e.key === 'Home')
            to = 0;
        else if (e.key === 'End')
            to = last;
        else if (e.key === 'Escape') {
            e.preventDefault();
            this.select(last, true);
            return;
        }
        if (to === null)
            return;
        e.preventDefault();
        to = Math.max(0, Math.min(last, to));
        const next = this.root.querySelector(`.sq[data-i="${to}"]`);
        if (!next)
            return;
        b.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
    }
}
ActivityGraph.observedAttributes = ['src', 'refresh'];
if (!customElements.get('activity-graph'))
    customElements.define('activity-graph', ActivityGraph);
// The site's figure loader (js/main.js) imports a figure's script and calls its default export.
// Importing this file defines the element, so there is nothing more to start.
export default function () { }
