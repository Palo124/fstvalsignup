/* ──────────────────── CONSTANTS & STATE ──────────────────── */
const backend =
'https://script.google.com/macros/s/AKfycby8Ikg95Fn4AKbKzHOdEBaNPNrISll8Z_PfrZs7hR5alJbMVkHybvguZY6d_tmSthA9bg/exec';

let me = '';
let currentDay = '';
let latestData = [];
let overlapIds = [];

/* Map visible day labels → real ISO dates */
const dayToDate = {
'Streda 2.7.': '2025-06-28',
'Štvrtok 3.7.': '2025-07-03',
'Piatok 4.7.': '2025-07-04',
'Sobota 5.7.': '2025-07-05'
};

/* ──────────────────── DOM HOOKS ──────────────────── */
const tabsEl      = document.getElementById('tabs');
const nickEl      = document.getElementById('nickname');
const filterEl    = document.getElementById('filterSelect');  // multiselect
const stageEl     = document.getElementById('stageSelect');   // multiselect
const scheduleEl  = document.getElementById('schedule');
const themeToggle = document.getElementById('themeToggle');
const collisionToggle = document.getElementById('collisionToggle');
const pinToggle       = document.getElementById('pinToggle');

/* ──────────────────── LOCAL-STORAGE HELPERS ──────────────────── */
function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function loadJSON(key, def) {
try { return JSON.parse(localStorage.getItem(key)) ?? def; }
catch { return def; }
}

/* Multiselect persistence */
function restoreMultiSelect(selectEl, storageKey) {
const saved = loadJSON(storageKey, []);
Array.from(selectEl.options).forEach(o => (o.selected = saved.includes(o.value)));
}
function persistMultiSelect(selectEl, storageKey) {
const vals = Array.from(selectEl.selectedOptions).map(o => o.value);
saveJSON(storageKey, vals);
}

/* ──────────────────── NICKNAME SETUP ──────────────────── */
me = localStorage.getItem('nickname') || '';
nickEl.value = me;
nickEl.addEventListener('input', () => {
me = nickEl.value.trim();
localStorage.setItem('nickname', me);
});

/* ──────────────────── INIT ──────────────────── */
function init() {
/* restore UI state */
themeToggle.checked     = loadJSON('themeDark', true);
document.body.classList.toggle('dark', themeToggle.checked);

collisionToggle.checked = loadJSON('filterOverlaps', false);
pinToggle.checked       = loadJSON('pinNowPlaying',   false);
restoreMultiSelect(filterEl, 'filterAttendees');
restoreMultiSelect(stageEl,  'filterStages');

/* fetch days + first data */
initTabs();
}

/* ──────────────────── TABS ──────────────────── */
function initTabs() {
const s = document.createElement('script');
s.src = `${backend}?action=listDays&callback=renderTabs&nocache=${Date.now()}`;
document.body.appendChild(s);
}
function renderTabs(days) {
tabsEl.innerHTML = '';
days.forEach((day, idx) => {
    const btn = document.createElement('button');
    btn.textContent = day;
    btn.dataset.day = day;
    if (idx === 0) {
    btn.classList.add('active');
    currentDay = day;
    }
    btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDay = day;
    loadSchedule();
    });
    tabsEl.appendChild(btn);
});
loadSchedule();
}

/* ──────────────────── DATA FETCH ──────────────────── */
function loadSchedule() {
scheduleEl.innerHTML = '<div class="loading">Loading…</div>';
const s = document.createElement('script');
s.src = `${backend}?day=${encodeURIComponent(currentDay)}&callback=gotData&nocache=${Date.now()}`;
document.body.appendChild(s);
}

/* ──────────────────── CALLBACKS / PREP ──────────────────── */
function gotData(data) {
latestData = data;
computeOverlaps();
populateFilters(data);
render(data);
}

/* Overlap detection for current user */
function computeOverlaps() {
overlapIds = [];
if (!me) return;
const mine = latestData.filter(it =>
    (it.Attendees || '').split(',').map(s => s.trim()).includes(me)
);

const ranges = mine
    .map(it => {
    const [st, en] = it.Time.split('–').map(t => t.trim());
    const [sh, sm] = st.split(':').map(Number);
    const [eh, em] = en.split(':').map(Number);
    return {
        id: it.rowIndex,
        start: sh * 60 + sm,
        end: eh * 60 + em + (eh < sh || (eh === sh && em < sm) ? 24 * 60 : 0)
    };
    })
    .sort((a, b) => a.start - b.start);

for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
    if (ranges[j].start < ranges[i].end) overlapIds.push(ranges[i].id, ranges[j].id);
    }
}
overlapIds = [...new Set(overlapIds)];
}

/* Fill multiselects and keep previous choices */
function populateFilters(data) {
const names  = new Set();
const stages = new Set();

data.forEach(it => {
    (it.Attendees || '').split(',').map(s => s.trim()).forEach(n => n && names.add(n));
    stages.add(it.Stage);
});

function fill(selectEl, set, key) {
    const saved = loadJSON(key, []);
    selectEl.innerHTML = '';
    Array.from(set)
    .sort()
    .forEach(v => selectEl.appendChild(new Option(v, v, false, saved.includes(v))));
}

fill(filterEl, names,  'filterAttendees');
fill(stageEl,  stages, 'filterStages');
}

/* ──────────────────── RENDER ──────────────────── */
function render(data) {
scheduleEl.innerHTML = '';

/* gather selections */
const selNames  = Array.from(filterEl.selectedOptions).map(o => o.value);
const selStages = Array.from(stageEl.selectedOptions).map(o => o.value);
const overlapsOnly = collisionToggle.checked;
const pinNow       = pinToggle.checked;

/* persist */
saveJSON('filterAttendees', selNames);
saveJSON('filterStages',    selStages);
saveJSON('filterOverlaps',  overlapsOnly);
saveJSON('pinNowPlaying',   pinNow);
saveJSON('themeDark',       themeToggle.checked);

/* helper */
const mins = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

/* sort purely by start-time */
const sorted = [...data].sort((a, b) => {
const aStart = mins(a.Time.split('–')[0]);
const bStart = mins(b.Time.split('–')[0]);

const aAdjusted = aStart < 300 ? aStart + 1440 : aStart; // before 5am → push to next day block
const bAdjusted = bStart < 300 ? bStart + 1440 : bStart;

return aAdjusted - bAdjusted;
});

const nowMs = Date.now();
const first = [];
const rest  = [];

sorted.forEach(it => {
    const list = (it.Attendees || '').split(',').map(s => s.trim()).filter(Boolean);

    /* filters */
    if (selNames.length  && !selNames.some(n => list.includes(n))) return;
    if (selStages.length && !selStages.includes(it.Stage))          return;
    if (overlapsOnly     && !overlapIds.includes(it.rowIndex))      return;

    /* times to detect now-playing */
    const base = new Date(`${dayToDate[currentDay]}T00:00:00+02:00`);
    const [st, en] = it.Time.split('–').map(t => t.trim());
    const [sh, sm] = st.split(':').map(Number);
    const [eh, em] = en.split(':').map(Number);
    const start = new Date(base);
    start.setHours(sh, sm, 0, 0);
    const end   = new Date(base);
    end.setHours(eh, em, 0, 0);
    if (eh < sh || (eh === sh && em < sm)) end.setDate(end.getDate() + 1);

    const isNow = nowMs >= start && nowMs < end;
    const isCol = overlapIds.includes(it.rowIndex);

    (pinNow && isNow ? first : rest).push({ it, list, isNow, isCol, start, end });
});

const rows = [...first, ...rest];
if (!rows.length) {
    scheduleEl.innerHTML = '<div class="loading">No performances match your filters.</div>';
    return;
}

if (pinNow && first.length) {
  rows.splice(first.length, 0, { isDivider: true });
}

/* helper for attendee‐tag colour */
const palette = [
    '#e57373', '#81c784', '#64b5f6', '#ffd54f', '#ba68c8', '#4db6ac',
    '#f06292', '#7986cb', '#4fc3f7', '#ff8a65', '#a1887f', '#7f85c7'
];
const colorCache = {};
const col = name => {
    if (!colorCache[name]) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    colorCache[name] = palette[Math.abs(h) % palette.length];
    }
    return colorCache[name];
};
const progress = (s, e) => Math.min(100, Math.max(0, ((e - Date.now()) / (e - s)) * 100));

/* build cards */
rows.forEach(row => {
  if (row.isDivider) {
    const divider = document.createElement('hr');
    divider.className = 'divider-line';
    scheduleEl.appendChild(divider);
    return;
  }

  const { it, list, isNow, isCol, start, end } = row;
    const card = document.createElement('div');
    card.className = 'card';
    if (isNow) {
    card.classList.add('now-playing');
    card.style.borderColor = '#f1c40f';
    if (pinNow) {
        card.dataset.ends = end.getTime();
    }
    }else if (it.Color) {
    card.style.borderColor = it.Color;
    }
    if (isCol) card.classList.add('has-collision');

    /* tags */
    card.innerHTML = `
    <div class="tag-container">
        ${isNow ? '<div class="now-playing-tag">Now Playing</div>' : ''}
        ${isCol ? '<div class="collision-tag">⚠️ Collision</div>' : ''}
    </div>
    <div class="stage-tag">${it.Stage}</div>
    <div class="artist">
        <span class="artist-name">${it.Artist}</span>
        <span class="time">${it.Time}</span>
        <a href="https://open.spotify.com/search/${encodeURIComponent(it.Artist.replace(/\\s*\\([^)]+\\)/, ''))}"
        target="_blank" class="spotify-link" title="Search on Spotify">
        <svg class="spotify-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 168">
            <path fill="#1ED760"
            d="M84 0a84 84 0 1 0 .001 168.001A84 84 0 0 0 84 0zm38.4 121.1a5.25 5.25 0 0 1-7.2 1.6c-19.8-12.1-44.8-14.8-74.4-8.1a5.27 5.27 0 0 1-2.4-10.2c32.6-7.7 60.7-4.6 83.6 9.3a5.23 5.23 0 0 1 .7 7.4zm10.2-20.4a6.6 6.6 0 0 1-9 2.1c-22.7-14-57.3-18.1-84-9.9a6.6 6.6 0 1 1-3.6-12.7c31.4-8.8 69.3-4.3 95.5 11.1a6.6 6.6 0 0 1 2.1 9.4zm.9-20.9c-27.1-16.2-72.1-17.6-98-9.7a7.88 7.88 0 1 1-4.5-15.1c29.6-8.7 79.2-7.1 110.5 11.3a7.9 7.9 0 0 1-8 13.5z"/>
        </svg>
        </a>
    </div>
    ${isNow ? `<div class="progress-container"><div class="progress-bar" style="width:${progress(start, end)}%"></div></div>` : ''}
    <div class="attendees">
        ${list.length ? list.map(n => `<span class="attendee-tag" style="border-color:${col(n)}">${n}</span>`).join('')
                    : '⭕ No one yet'}
    </div>
    <button class="${me && list.includes(me) ? 'leave' : 'join'}"
            onclick="toggle(${it.rowIndex}, event)">
        ${me && list.includes(me) ? 'Leave' : 'Join'}
    </button>
    `;
    scheduleEl.appendChild(card);
});
}

/* ──────────────────── JOIN / LEAVE ──────────────────── */
function toggle(row, ev) {
if (!me) {
    alert('Enter your nickname first in ☰ → Your nickname');
    return;
}
const btn = ev.currentTarget;
const orig = btn.textContent;
btn.disabled = true;
btn.textContent = '⏳';
const s = document.createElement('script');
s.src =
    `${backend}?action=toggle&day=${encodeURIComponent(currentDay)}&rowIndex=${row}` +
    `&nickname=${encodeURIComponent(me)}&callback=gotData`;
document.body.appendChild(s);
setTimeout(() => {
    if (btn.disabled) {
    btn.disabled = false;
    btn.textContent = orig;
    }
}, 5000);
}

/* ──────────────────── EVENT LISTENERS ──────────────────── */
/* filters */
[filterEl, stageEl].forEach(el =>
el.addEventListener('change', () => {
    persistMultiSelect(el, el === filterEl ? 'filterAttendees' : 'filterStages');
    render(latestData);
})
);
collisionToggle.addEventListener('change', () => render(latestData));
pinToggle      .addEventListener('change', () => render(latestData));

/* theme */
themeToggle.addEventListener('change', () => {
document.body.classList.toggle('dark', themeToggle.checked);
saveJSON('themeDark', themeToggle.checked);
});

/* hamburger */
document.getElementById('menu-toggle').addEventListener('click', () => {
document.getElementById('controls').classList.toggle('collapsed');
});

function updateNowPlayingCountdowns() {
  const shrink = window.scrollY > 100;

  document.querySelectorAll('.now-playing').forEach(el => {
    // compute countdown label
    const endMs = parseInt(el.dataset.ends, 10);
    const secs  = Math.max(0, Math.floor((endMs - Date.now())/1000));
    const label = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;

    if (shrink) {
      // on first shrink, stash full markup
      if (!el.dataset.full) {
        el.dataset.full = el.innerHTML;
      }
      // apply shrink class
      el.classList.add('pinned-shrink');
      // render only artist + countdown
      const artist = el.querySelector('.artist-name')?.textContent || '';
      el.innerHTML = `
        <div class="artist-name">${artist}</div>
        <div class="countdown">${label}</div>
      `;
    } else {
      // expand back
      if (el.dataset.full) {
        el.innerHTML = el.dataset.full;
        delete el.dataset.full;
      }
      el.classList.remove('pinned-shrink');
    }
  });
}

// wire up
window.addEventListener('scroll', updateNowPlayingCountdowns);
setInterval(updateNowPlayingCountdowns, 1000);
/* ──────────────────── GO ──────────────────── */
init();