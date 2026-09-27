'use strict';

/* =====================================================================
   Gruppen-Zufall – zufällige Gruppen und Einzelauswahl für den Unterricht
   Alle Daten bleiben lokal auf dem Gerät (localStorage).
   ===================================================================== */

const STORE_KEY = 'gruppenzufall.v1';
const DEFAULT_ROLES = ['Sprecher', 'Schreiber', 'Zeitwächter', 'Regelwächter', 'Materialwart'];
const TAG_SUGGESTIONS = ['Förderbedarf', 'DaZ', 'Helferkind', 'Unruhig'];
const HISTORY_LIMIT = 40;
const GROUP_COLORS = 9;

/* ---------- Helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const app = document.getElementById('app');
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// kryptografisch guter Zufall, damit die Verteilung wirklich fair ist
const rndBuf = new Uint32Array(4096);
let rndPos = rndBuf.length;
function rnd() {
  if (rndPos >= rndBuf.length) { crypto.getRandomValues(rndBuf); rndPos = 0; }
  return rndBuf[rndPos++] / 4294967296;
}
const randInt = n => Math.floor(rnd() * n);
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Icons ---------- */

const ICONS = {
  logo: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  shuffle: '<path d="M3 7h3.5a4 4 0 0 1 3.4 1.9l4.2 6.2a4 4 0 0 0 3.4 1.9H21"/><path d="M18 14l3 3-3 3"/><path d="M3 17h3.5a4 4 0 0 0 3-1.4M14.5 8.4A4 4 0 0 1 17.5 7H21"/><path d="M18 4l3 3-3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-.5A5.5 5.5 0 0 1 8 14h2a5.5 5.5 0 0 1 5.5 5.5v.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 5.1v.9"/>',
  print: '<path d="M7 9V3h10v6"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="13" width="10" height="8" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  badge: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 9h3M15 13h3M6.5 16h5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
};
const ic = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- Datenmodell & Speicherung ---------- */

let S = null;
S = load();

function freshState() {
  return { version: 2, roleSets: [defaultRoleSet()], settings: defaultSettings(), classes: [] };
}
function defaultRoleSet(name = 'Standard') {
  return { id: uid(), name, roles: DEFAULT_ROLES.map(n => ({ id: uid(), name: n })) };
}
// anim: 'standard' = Namen wirbeln sofort durcheinander,
//       'preview'  = Namen erst ca. 2 s geordnet zeigen, dann wie 'standard'
function defaultSettings() {
  return { anim: 'preview' };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { console.warn(e); }
  return freshState();
}
function normalizeState(st) {
  if (!st || typeof st !== 'object') return freshState();
  // Version 1 hatte eine einzige Rollenliste – sie wird zum Rollenset „Standard“
  if (!Array.isArray(st.roleSets)) {
    st.roleSets = Array.isArray(st.roles) ? [{ id: uid(), name: 'Standard', roles: st.roles }] : [defaultRoleSet()];
  }
  if (!st.roleSets.length) st.roleSets.push(defaultRoleSet());
  st.roleSets.forEach(set => { set.roles ??= []; });
  delete st.roles;
  st.settings = { ...defaultSettings(), ...(st.settings || {}) };
  st.version = 2;
  if (!Array.isArray(st.classes)) st.classes = [];
  S = st; // damit neue Vorlagen die Rollenliste kennen
  st.classes.forEach(normalizeClass);
  return st;
}
function normalizeClass(c) {
  c.subjects ??= []; c.tags ??= []; c.students ??= []; c.rules ??= [];
  c.templates ??= []; c.history ??= []; c.picked ??= []; c.absent ??= []; c.absentDate ??= '';
  c.students.forEach(s => { s.perf ??= {}; s.tags ??= []; s.g ??= ''; });
  if (!c.templates.length) c.templates.push(newTemplate('Standard'));
  c.templates.forEach(t => {
    Object.assign(t, { ...templateDefaults(), ...t });
    if (Array.isArray(t.roles)) {
      // alte Auswahl (gewählte Rollen) in „abgewählte Rollen“ des Standard-Sets umrechnen
      const set = S.roleSets.find(s => s.id === t.roleSetId) || S.roleSets[0];
      t.roleSetId = set.id;
      t.rolesOff = set.roles.filter(r => !t.roles.includes(r.id)).map(r => r.id);
      delete t.roles;
    }
    if (!S.roleSets.some(s => s.id === t.roleSetId)) { t.roleSetId = S.roleSets[0].id; t.rolesOff = []; }
  });
  return c;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern nicht möglich – bitte Sicherung exportieren'); }
}

function templateDefaults() {
  return {
    sizeMode: 'size', size: 4, count: 5, remainder: 'larger',
    gender: false, subjects: {}, tags: {},
    applyApart: true, applyTogether: true, avoidHistory: true,
    rolesOn: false, roleSetId: S?.roleSets?.[0]?.id || null, rolesOff: [],
    noRepeatPick: true,
  };
}
function newTemplate(name) { return { id: uid(), name, ...templateDefaults() }; }
function newClass(name) {
  return normalizeClass({ id: uid(), name, templates: [newTemplate('Standard')] });
}
const getClass = id => S.classes.find(c => c.id === id);
const getTpl = (cls, id) => cls.templates.find(t => t.id === id) || cls.templates[0];
const stuById = (cls, id) => cls.students.find(s => s.id === id);
const stuName = (cls, id) => stuById(cls, id)?.name || '?';

function absentToday(cls) {
  if (cls.absentDate !== localDate()) { cls.absent = []; cls.absentDate = localDate(); }
  return cls.absent;
}
function presentIds(cls) {
  const abs = new Set(absentToday(cls));
  return cls.students.filter(s => s.name.trim() && !abs.has(s.id)).map(s => s.id);
}

/* ---------- Gruppengrößen ---------- */

function computeSizes(n, mode, value, remainder) {
  if (n <= 0) return [];
  let g;
  if (mode === 'count') {
    g = Math.max(1, Math.min(value, n));
  } else {
    const s = Math.max(1, value);
    g = remainder === 'smaller' ? Math.ceil(n / s) : Math.max(1, Math.floor(n / s));
  }
  const base = Math.floor(n / g), extra = n % g;
  return Array.from({ length: g }, (_, i) => base + (i < extra ? 1 : 0));
}
function describeSizes(sizes) {
  if (!sizes.length) return 'Keine Kinder anwesend';
  const counts = {};
  sizes.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  const parts = Object.keys(counts).map(Number).sort((a, b) => b - a)
    .map(s => `${counts[s]} × ${s}`);
  return `${sizes.length} ${sizes.length === 1 ? 'Gruppe' : 'Gruppen'} · ${parts.join(' und ')} Kinder`;
}

/* ---------- Verteilungs-Algorithmus ----------
   Viele zufällige Startverteilungen werden durch Tauschen von Kindern
   verbessert. Bewertet wird mit einer Kostenfunktion aus
   - Paar-Kosten (nicht zusammen, zusammen, frühere Gruppen)
   - Merkmalen, die gleichmäßig verteilt werden sollen
   - Merkmalen, nach denen möglichst homogen gruppiert werden soll
   Unter gleich guten Lösungen entscheidet der Zufall.            */

const W_RULE = 1000;

function buildModel(cls, tpl, ids) {
  const n = ids.length;
  const pos = new Map(ids.map((id, i) => [id, i]));
  const stu = ids.map(id => stuById(cls, id));
  const M = Array.from({ length: n }, () => new Float64Array(n));
  const addPair = (a, b, w) => { if (a !== b) { M[a][b] += w; M[b][a] += w; } };
  const eachPair = (idList, fn) => {
    const ix = idList.map(id => pos.get(id)).filter(x => x !== undefined);
    for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++) fn(ix[a], ix[b]);
  };

  for (const r of cls.rules) {
    if (!r.on) continue;
    if (r.type === 'apart' && tpl.applyApart) eachPair(r.ids, (a, b) => addPair(a, b, W_RULE));
    if (r.type === 'together' && tpl.applyTogether) eachPair(r.ids, (a, b) => addPair(a, b, -W_RULE));
  }
  if (tpl.avoidHistory) {
    cls.history.slice(-6).reverse().forEach((h, k) => {
      const w = 2 / (k + 1);
      h.groups.forEach(g => eachPair(g, (a, b) => addPair(a, b, w)));
    });
  }

  const feats = [];
  const avg = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  if (tpl.gender) {
    const known = stu.filter(s => s.g === 'w' || s.g === 'm').map(s => s.g === 'w' ? 1 : 0);
    const mean = known.length ? avg(known) : 0.5;
    feats.push({ v: stu.map(s => s.g === 'w' ? 1 : s.g === 'm' ? 0 : mean), w: 4, type: 'spread' });
  }
  for (const sub of cls.subjects) {
    const mode = tpl.subjects[sub.id];
    if (!mode || mode === 'none') continue;
    if (sub.mode === 'strong') {
      feats.push({ v: stu.map(s => s.perf[sub.id] ? 1 : 0), w: 4, type: mode === 'spread' ? 'spread' : 'homog' });
    } else {
      const raw = stu.map(s => +s.perf[sub.id] || 0);
      const known = raw.filter(x => x > 0);
      const mean = known.length ? avg(known) : 2;
      const lv = raw.map(x => x || mean);
      if (mode === 'spread') {
        feats.push({ v: lv.map(x => x >= 3 ? 1 : 0), w: 4, type: 'spread' });
        feats.push({ v: lv.map(x => x <= 1 ? 1 : 0), w: 3, type: 'spread' });
        feats.push({ v: lv, w: 1, type: 'spread' });
      } else {
        feats.push({ v: lv, w: 3, type: 'homog' });
      }
    }
  }
  for (const t of cls.tags) {
    if (tpl.tags[t.id]) feats.push({ v: stu.map(s => s.tags.includes(t.id) ? 1 : 0), w: 3, type: 'spread' });
  }
  feats.forEach(f => { f.mean = avg(f.v); });
  return { n, M, feats };
}

function groupCost(model, g) {
  let c = 0;
  for (let a = 0; a < g.length; a++) {
    const row = model.M[g[a]];
    for (let b = a + 1; b < g.length; b++) c += row[g[b]];
  }
  for (const f of model.feats) {
    let s = 0, s2 = 0;
    for (const i of g) { s += f.v[i]; s2 += f.v[i] * f.v[i]; }
    if (f.type === 'spread') { const d = s - g.length * f.mean; c += f.w * d * d; }
    else if (g.length) c += f.w * (s2 - s * s / g.length);
  }
  return c;
}

function optimize(model, sizes) {
  const n = model.n;
  let best = null, bestCost = Infinity;
  const restarts = 14;
  const iters = Math.max(2000, n * n * 3);
  for (let r = 0; r < restarts; r++) {
    const perm = shuffle([...Array(n).keys()]);
    let k = 0;
    const groups = sizes.map(s => perm.slice(k, (k += s)));
    const gc = groups.map(g => groupCost(model, g));
    let total = gc.reduce((a, b) => a + b, 0);
    if (groups.length > 1) {
      for (let it = 0; it < iters; it++) {
        const ga = randInt(groups.length);
        let gb = randInt(groups.length - 1);
        if (gb >= ga) gb++;
        const A = groups[ga], B = groups[gb];
        const ia = randInt(A.length), ib = randInt(B.length);
        const x = A[ia]; A[ia] = B[ib]; B[ib] = x;
        const ca = groupCost(model, A), cb = groupCost(model, B);
        const nt = total - gc[ga] - gc[gb] + ca + cb;
        if (nt <= total + 1e-9) { total = nt; gc[ga] = ca; gc[gb] = cb; }
        else { B[ib] = A[ia]; A[ia] = x; }
      }
    }
    if (total < bestCost - 1e-9) { bestCost = total; best = groups.map(g => g.slice()); }
  }
  return best;
}

function makeGroups(cls, tpl, ids, sizes) {
  const model = buildModel(cls, tpl, ids);
  const idxGroups = optimize(model, sizes);
  const groups = shuffle(idxGroups.map(g => shuffle(g.map(i => ids[i]))));
  return { groups, warnings: checkRules(cls, tpl, groups) };
}

function checkRules(cls, tpl, groups) {
  const where = new Map();
  groups.forEach((g, gi) => g.forEach(id => where.set(id, gi)));
  const warnings = [];
  for (const r of cls.rules) {
    if (!r.on) continue;
    const ids = r.ids.filter(id => where.has(id));
    if (r.type === 'apart' && tpl.applyApart) {
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
        if (where.get(ids[a]) === where.get(ids[b])) warnings.push(`„Nicht zusammen“ nicht erfüllbar: ${stuName(cls, ids[a])} und ${stuName(cls, ids[b])}`);
      }
    }
    if (r.type === 'together' && tpl.applyTogether && ids.length > 1) {
      if (new Set(ids.map(id => where.get(id))).size > 1) warnings.push(`„Zusammen“ nicht erfüllbar: ${ids.map(id => stuName(cls, id)).join(', ')}`);
    }
  }
  return warnings;
}

/* ---------- Rollen ---------- */

function activeRoles(tpl) {
  if (!tpl.rolesOn) return [];
  return roleSetOf(tpl).roles.filter(r => !tpl.rolesOff.includes(r.id) && r.name.trim()).map(r => r.name.trim());
}
function roleSetOf(tpl) {
  return S.roleSets.find(s => s.id === tpl.roleSetId) || S.roleSets[0];
}
// Kinder, die in letzter Zeit selten eine Rolle hatten, kommen bevorzugt dran
function roleCounts(cls) {
  const counts = {};
  cls.history.slice(-20).forEach(h => {
    Object.entries(h.roles || {}).forEach(([id, rs]) => { counts[id] = (counts[id] || 0) + rs.length; });
  });
  return counts;
}
function rolesForGroup(g, roles, counts) {
  const out = {};
  if (!g.length || !roles.length) return out;
  const members = shuffle(g.slice()).sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
  // Jede Gruppe bekommt alle Rollen. Bei kleinen Gruppen übernimmt ein Kind mehrere Rollen.
  shuffle(roles.slice()).forEach((role, k) => {
    const id = members[k % members.length];
    (out[id] ||= []).push(role);
  });
  return out;
}
function assignRoles(cls, roles, groups, only) {
  const counts = roleCounts(cls);
  const res = V.result;
  const out = only ? { ...res.roles } : {};
  groups.forEach((g, gi) => {
    if (only && !only.includes(gi)) return;
    g.forEach(id => delete out[id]);
    Object.assign(out, rolesForGroup(g, roles, counts));
  });
  return out;
}

/* ---------- UI-Zustand ---------- */

const V = {
  view: 'home',
  classId: null,
  tplId: null,
  sizeMode: 'size',
  size: 4,
  count: 5,
  result: null,        // { groups, roles, roleList, warnings, histId }
  admin: { section: 'class', classId: null, tab: 'students', tplId: null, ruleSel: [], showImport: false },
  pickTimer: null,
};

function go(view) {
  V.view = view;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Rendering ---------- */

function render() {
  const views = { home: viewHome, prep: viewPrep, groups: viewGroups, pick: viewPick, admin: viewAdmin };
  app.innerHTML = (views[V.view] || viewHome)();
}

function bar(left, title, right = '') {
  return `<header class="bar">${left}<div class="title">${title}</div>${right}</header>`;
}
const backBtn = (act, label = 'Zurück') => `<button class="btn ghost" data-act="${act}">${ic('back')}${label}</button>`;

function seg(opts, current, act, attrs = '') {
  return `<div class="seg">${opts.map(([val, label]) =>
    `<button class="${String(current) === String(val) ? 'on' : ''}" data-act="${act}" data-val="${esc(val)}" ${attrs}>${label}</button>`
  ).join('')}</div>`;
}
const toggle = (on, act, attrs = '') =>
  `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}" ${attrs}></button>`;

/* ----- Startseite ----- */

function viewHome() {
  const cards = S.classes.map(c => {
    const n = c.students.filter(s => s.name.trim()).length;
    return `<button class="class-card" data-act="openClass" data-id="${c.id}">
      <span class="name">${esc(c.name)}</span>
      <span class="muted">${n} ${n === 1 ? 'Kind' : 'Kinder'}</span>
    </button>`;
  }).join('');
  const body = S.classes.length
    ? `<h1>Welche Klasse?</h1><div class="class-grid">${cards}</div>`
    : `<div class="empty">
        <h1>Willkommen</h1>
        <p class="muted">Legen Sie in der Verwaltung Ihre erste Klasse an. Zum Ausprobieren gibt es auch eine Beispielklasse.</p>
        <div class="row">
          <button class="btn primary" data-act="adminNewClass">${ic('plus')}Klasse anlegen</button>
          <button class="btn" data-act="demoClass">${ic('sparkle')}Beispielklasse ausprobieren</button>
        </div>
      </div>`;
  return `<header class="bar">
      <div class="brand"><span class="logo">${ic('logo')}</span>Gruppen-Zufall</div>
      <button class="btn ghost" data-act="openAdmin">${ic('settings')}Verwaltung</button>
    </header>
    <main class="page">${body}</main>`;
}

/* ----- Vorbereitung (Anwesenheit, Größe) ----- */

function prepSizes(cls) {
  const tpl = getTpl(cls, V.tplId);
  return computeSizes(presentIds(cls).length, V.sizeMode, V.sizeMode === 'size' ? V.size : V.count, tpl.remainder);
}

function viewPrep() {
  const cls = getClass(V.classId);
  if (!cls) { V.view = 'home'; return viewHome(); }
  const abs = new Set(absentToday(cls));
  const students = cls.students.filter(s => s.name.trim()).slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const present = students.length - students.filter(s => abs.has(s.id)).length;

  const tplChips = cls.templates.length > 1 ? `
    <div class="section">
      <div class="section-head"><h2>Vorlage</h2></div>
      <div class="chips">${cls.templates.map(t =>
        `<button class="chip-btn ${t.id === V.tplId ? 'on' : ''}" data-act="pickTpl" data-id="${t.id}">${esc(t.name)}</button>`).join('')}</div>
    </div>` : '';

  const attendance = students.length ? `<div class="att-grid">${students.map(s =>
    `<button class="att ${abs.has(s.id) ? 'absent' : ''}" data-act="toggleAbsent" data-id="${s.id}">
      <span class="box">${ic('check')}</span>${esc(s.name)}</button>`).join('')}</div>`
    : `<div class="card muted">In dieser Klasse sind noch keine Kinder eingetragen. Das geht in der Verwaltung.</div>`;

  const val = V.sizeMode === 'size' ? V.size : V.count;
  return bar(backBtn('home'), esc(cls.name)) + `
    <main class="page">
      <div class="prep">
        <div>
          ${tplChips}
          <div class="section">
            <div class="section-head">
              <h2>Anwesend: ${present} von ${students.length}</h2>
              ${abs.size ? `<button class="btn sm" data-act="allPresent">Alle anwesend</button>` : ''}
            </div>
            <p class="muted small" style="margin:-4px 0 12px">Fehlende Kinder antippen.</p>
            ${attendance}
          </div>
        </div>
        <aside class="side">
          <div class="card">
            <div style="text-align:center">${seg([['size', 'Gruppengröße'], ['count', 'Anzahl Gruppen']], V.sizeMode, 'setSizeMode', 'data-lg')}</div>
            <div class="stepper">
              <button class="btn" data-act="stepSize" data-val="-1" aria-label="weniger">${ic('minus')}</button>
              <span class="val" id="sizeVal">${val}</span>
              <button class="btn" data-act="stepSize" data-val="1" aria-label="mehr">${ic('plus')}</button>
            </div>
            <div class="preview" id="sizePreview">${describeSizes(prepSizes(cls))}</div>
          </div>
          <button class="btn primary big" data-act="mix" ${present ? '' : 'disabled'}>${ic('shuffle')}Gruppen mischen</button>
          <button class="btn big" data-act="pick" ${present ? '' : 'disabled'}>${ic('user')}Ein Kind ziehen</button>
        </aside>
      </div>
    </main>`;
}

/* ----- Gruppenergebnis ----- */

function viewGroups() {
  const cls = getClass(V.classId);
  const r = V.result;
  if (!cls || !r) { V.view = 'home'; return viewHome(); }
  const cards = r.groups.map((g, gi) => `
    <section class="group g${gi % GROUP_COLORS}" data-group="${gi}">
      <h3>Gruppe ${gi + 1} <span class="cnt">${g.length} ${g.length === 1 ? 'Kind' : 'Kinder'}</span></h3>
      <div class="members">${g.map(id => `
        <div class="chip" data-id="${id}"><span class="nm-t">${esc(stuName(cls, id))}</span>${(r.roles[id] || []).map(role => `<span class="role">${esc(role)}</span>`).join('')}</div>`).join('')}
      </div>
    </section>`).join('');
  const right = `
    ${r.roleList.length ? `<button class="btn ghost no-print" data-act="reRoles">${ic('badge')}Rollen neu</button>` : ''}
    <button class="btn ghost no-print" data-act="print">${ic('print')}Drucken</button>
    <button class="btn primary no-print" data-act="mix">${ic('shuffle')}Neu mischen</button>`;
  return bar(backBtn('backToPrep'), `${esc(cls.name)} · ${r.groups.length} ${r.groups.length === 1 ? 'Gruppe' : 'Gruppen'}`, right) + `
    <main class="groups-page">
      <div class="print-title">${esc(cls.name)} – Gruppen vom ${new Date().toLocaleDateString('de-DE')}</div>
      <div class="stage ${r.groups.length > 6 ? 'many' : ''}" id="stage">${cards}</div>    </main>`;
}

/* ----- Einzelauswahl ----- */

function viewPick() {
  const cls = getClass(V.classId);
  if (!cls) { V.view = 'home'; return viewHome(); }
  return bar(backBtn('backToPrep'), esc(cls.name) + ' · Einzelauswahl') + `
    <main class="pick-stage">
      <div class="pick-name rolling" id="pickName">…</div>
      <div class="pick-actions" id="pickActions" style="visibility:hidden">
        <button class="btn primary big" data-act="pick">${ic('user')}Nächstes Kind</button>
      </div>
    </main>`;
}

/* ----- Verwaltung ----- */

function viewAdmin() {
  const A = V.admin;
  if (A.section === 'class' && !getClass(A.classId)) {
    A.classId = S.classes[0]?.id || null;
    if (!A.classId) A.section = S.classes.length ? 'class' : 'none';
  }
  const nav = `<nav class="nav">
      <div class="lbl">Klassen</div>
      ${S.classes.map(c => `<button class="${A.section === 'class' && A.classId === c.id ? 'on' : ''}" data-act="adminClass" data-id="${c.id}">
        ${ic('users')}<span>${esc(c.name)}</span><span class="sub">${c.students.filter(s => s.name.trim()).length}</span></button>`).join('')}
      <button data-act="adminNewClass">${ic('plus')}Neue Klasse</button>
      <hr>
      <div class="lbl">Allgemein</div>
      <button class="${A.section === 'roles' ? 'on' : ''}" data-act="adminSection" data-val="roles">${ic('badge')}Rollen<span class="sub">${S.roleSets.length}</span></button>
      <button class="${A.section === 'display' ? 'on' : ''}" data-act="adminSection" data-val="display">${ic('sparkle')}Anzeige</button>
      <button class="${A.section === 'backup' ? 'on' : ''}" data-act="adminSection" data-val="backup">${ic('shield')}Sicherung</button>
    </nav>`;
  let main = '';
  if (A.section === 'roles') main = adminRoles();
  else if (A.section === 'backup') main = adminBackup();
  else if (A.section === 'display') main = adminDisplay();
  else if (A.section === 'class' && A.classId) main = adminClass(getClass(A.classId));
  else main = `<div class="card empty"><h2>Noch keine Klasse</h2><p class="muted">Legen Sie links eine neue Klasse an.</p></div>`;
  return bar(backBtn('home', 'Fertig'), 'Verwaltung') + `
    <main class="page"><div class="admin">${nav}<div>${main}</div></div></main>`;
}

function adminClass(cls) {
  const A = V.admin;
  const tabs = [['students', 'Kinder'], ['subjects', 'Fächer & Merkmale'], ['rules', 'Paarungen'], ['templates', 'Vorlagen'], ['history', 'Verlauf']];
  const content = {
    students: adminStudents, subjects: adminSubjects, rules: adminRules, templates: adminTemplates, history: adminHistory,
  }[A.tab] || adminStudents;
  return `
    <div class="head-row">
      <input class="in title-in" value="${esc(cls.name)}" data-bind="className" aria-label="Klassenname">
      <button class="btn sm" data-act="copyClass">${ic('copy')}Kopieren</button>
      <button class="btn sm danger" data-act="deleteClass">${ic('trash')}Löschen</button>
    </div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${A.tab === k ? 'on' : ''}" data-act="adminTab" data-val="${k}">${l}</button>`).join('')}</div>
    ${content(cls)}`;
}

function adminStudents(cls) {
  const A = V.admin;
  const head = `<tr><th>Name</th><th>Geschlecht</th>${cls.subjects.map(s =>
    `<th>${esc(s.name)}<div class="muted" style="font-weight:400;font-size:11px">${s.mode === 'strong' ? 'stark?' : '1 schwächer · 3 stark'}</div></th>`).join('')}
    ${cls.tags.length ? '<th>Merkmale</th>' : ''}<th></th></tr>`;
  const rows = cls.students.map(s => `<tr>
      <td class="name-cell"><input class="in" value="${esc(s.name)}" placeholder="Name" data-bind="stuName" data-id="${s.id}"></td>
      <td>${seg([['w', 'w'], ['m', 'm'], ['d', 'd']], s.g, 'stuGender', `data-id="${s.id}"`)}</td>
      ${cls.subjects.map(sub => `<td>${sub.mode === 'strong'
        ? `<button class="star ${s.perf[sub.id] ? 'on' : ''}" data-act="stuStrong" data-id="${s.id}" data-sub="${sub.id}" aria-label="stark">${ic('star')}</button>`
        : seg([['0', '–'], ['1', '1'], ['2', '2'], ['3', '3']], s.perf[sub.id] || 0, 'stuLevel', `data-id="${s.id}" data-sub="${sub.id}"`)}</td>`).join('')}
      ${cls.tags.length ? `<td>${cls.tags.map(t => `<button class="tagt ${s.tags.includes(t.id) ? 'on' : ''}" data-act="stuTag" data-id="${s.id}" data-tag="${t.id}">${esc(t.name)}</button>`).join('')}</td>` : ''}
      <td><button class="icon-btn danger" data-act="delStudent" data-id="${s.id}" aria-label="Kind löschen">${ic('trash')}</button></td>
    </tr>`).join('');
  const importBox = A.showImport ? `
    <div class="card" style="margin-bottom:16px">
      <h3>Namensliste einfügen</h3>
      <p class="muted small">Ein Name pro Zeile, z. B. aus Excel oder Word kopiert. Optional mit Geschlecht dahinter, z. B. <b>Mia; w</b> oder <b>Ben, m</b>.</p>
      <textarea class="in" id="importText" placeholder="Mia; w&#10;Ben; m&#10;Lea"></textarea>
      <div style="display:flex;gap:10px;margin-top:10px">
        <button class="btn primary" data-act="doImport">Übernehmen</button>
        <button class="btn" data-act="toggleImport">Abbrechen</button>
      </div>
    </div>` : '';
  return `
    <div class="section-head">
      <h2>${cls.students.length} ${cls.students.length === 1 ? 'Kind' : 'Kinder'}</h2>
      <button class="btn sm" data-act="toggleImport">${ic('list')}Liste einfügen</button>
      <button class="btn sm primary" data-act="addStudent">${ic('plus')}Kind hinzufügen</button>
    </div>
    ${importBox}
    ${cls.students.length ? `<div class="tbl-wrap"><table class="tbl">${head}${rows}</table></div>` : `<div class="card muted">Noch keine Kinder eingetragen.</div>`}
    ${!cls.subjects.length && cls.students.length ? `<p class="muted small" style="margin-top:12px">Tipp: Unter „Fächer & Merkmale“ können Sie Fächer anlegen, um Leistungen einzutragen.</p>` : ''}`;
}

function adminSubjects(cls) {
  const unusedSuggestions = TAG_SUGGESTIONS.filter(n => !cls.tags.some(t => t.name.toLowerCase() === n.toLowerCase()));
  return `<div class="grid2">
    <div class="card">
      <div class="section-head"><h2>Fächer</h2><button class="btn sm" data-act="addSubject">${ic('plus')}Fach</button></div>
      <p class="muted small" style="margin-top:0">Pro Fach wählen Sie, ob Sie Leistungen in 3 Stufen erfassen oder nur starke Kinder ankreuzen.</p>
      ${cls.subjects.map(s => `<div class="list-row">
          <input class="in" style="flex:1;min-width:120px" value="${esc(s.name)}" placeholder="Fach" data-bind="subjName" data-id="${s.id}">
          ${seg([['levels', '3 Stufen'], ['strong', 'nur „stark“']], s.mode, 'subjMode', `data-id="${s.id}"`)}
          <button class="icon-btn danger" data-act="delSubject" data-id="${s.id}" aria-label="Fach löschen">${ic('trash')}</button>
        </div>`).join('') || '<p class="muted">Noch keine Fächer.</p>'}
    </div>
    <div class="card">
      <div class="section-head"><h2>Merkmale</h2><button class="btn sm" data-act="addTag">${ic('plus')}Merkmal</button></div>
      <p class="muted small" style="margin-top:0">Eigene Kennzeichnungen, die Sie in den Vorlagen gleichmäßig auf die Gruppen verteilen lassen können. Sie sind beim Mischen nie sichtbar.</p>
      ${cls.tags.map(t => `<div class="list-row">
          <input class="in" style="flex:1" value="${esc(t.name)}" placeholder="Merkmal" data-bind="tagName" data-id="${t.id}">
          <button class="icon-btn danger" data-act="delTag" data-id="${t.id}" aria-label="Merkmal löschen">${ic('trash')}</button>
        </div>`).join('') || '<p class="muted">Noch keine Merkmale.</p>'}
      ${unusedSuggestions.length ? `<div class="chips" style="margin-top:12px">${unusedSuggestions.map(n =>
        `<button class="chip-btn" data-act="addTagNamed" data-val="${esc(n)}">${ic('plus')} ${esc(n)}</button>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function adminRules(cls) {
  const A = V.admin;
  const sel = new Set(A.ruleSel);
  const students = cls.students.filter(s => s.name.trim()).slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const ruleList = type => {
    const rules = cls.rules.filter(r => r.type === type);
    if (!rules.length) return `<p class="muted">Noch keine Einträge.</p>`;
    return rules.map(r => `<div class="rule ${r.on ? '' : 'off'}">
        <div class="names">${r.ids.map(id => `<span class="nm ${type}">${esc(stuName(cls, id))}</span>`).join('')}</div>
        ${toggle(r.on, 'toggleRule', `data-id="${r.id}" aria-label="Regel aktiv"`)}
        <button class="icon-btn danger" data-act="delRule" data-id="${r.id}" aria-label="Löschen">${ic('trash')}</button>
      </div>`).join('');
  };
  return `
    <div class="card section">
      <h2>Neue Paarung</h2>
      <p class="muted small">Tippen Sie zwei oder mehr Kinder an und legen Sie dann fest, ob sie getrennt oder zusammen sein sollen.</p>
      <div class="sel-grid">${students.map(s =>
        `<button class="chip-btn ${sel.has(s.id) ? 'on' : ''}" data-act="ruleSel" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-act="addRule" data-val="apart" ${sel.size < 2 ? 'disabled' : ''}>Nicht zusammen</button>
        <button class="btn" data-act="addRule" data-val="together" ${sel.size < 2 ? 'disabled' : ''}>Zusammen</button>
        ${sel.size ? `<button class="btn ghost" data-act="ruleSelClear">Auswahl aufheben</button>` : ''}
      </div>
    </div>
    <div class="grid2">
      <div class="card">
        <h2>Nicht zusammen</h2>
        <p class="muted small">Keine zwei dieser Kinder kommen in dieselbe Gruppe.</p>
        ${ruleList('apart')}
      </div>
      <div class="card">
        <h2>Zusammen</h2>
        <p class="muted small">Diese Kinder kommen möglichst in dieselbe Gruppe, z. B. Sprachpate und DaZ-Kind.</p>
        ${ruleList('together')}
      </div>
    </div>
    <p class="muted small">Ob die Paarungen beim Mischen beachtet werden, stellen Sie in jeder Vorlage ein.</p>`;
}

function adminTemplates(cls) {
  const A = V.admin;
  const tpl = getTpl(cls, A.tplId);
  A.tplId = tpl.id;
  const chips = cls.templates.map(t =>
    `<button class="chip-btn ${t.id === tpl.id ? 'on' : ''}" data-act="adminTpl" data-id="${t.id}">${esc(t.name)}</button>`).join('');
  const row = (label, desc, control) => `<div class="set-row"><div class="lbl">${label}${desc ? `<div class="desc">${desc}</div>` : ''}</div>${control}</div>`;
  const subjSel = sub => seg([['none', 'egal'], ['spread', 'verteilen'], ['level', 'Niveaugruppen']], tpl.subjects[sub.id] || 'none', 'tplSubj', `data-sub="${sub.id}"`);
  const val = tpl.sizeMode === 'size' ? tpl.size : tpl.count;
  return `
    <div class="section-head">
      <div class="chips" style="flex:1">${chips}</div>
      <button class="btn sm" data-act="addTpl">${ic('plus')}Neue Vorlage</button>
    </div>
    <div class="card section">
      <div class="head-row" style="margin-bottom:6px">
        <input class="in title-in" style="font-size:20px" value="${esc(tpl.name)}" data-bind="tplName" aria-label="Name der Vorlage">
        <button class="btn sm" data-act="copyTpl">${ic('copy')}Duplizieren</button>
        ${cls.templates.length > 1 ? `<button class="btn sm danger" data-act="delTpl">${ic('trash')}Löschen</button>` : ''}
      </div>

      <h3 style="margin-top:14px">Gruppen</h3>
      ${row('Einteilung', 'Kann vor dem Mischen noch geändert werden.',
        `${seg([['size', 'Größe'], ['count', 'Anzahl']], tpl.sizeMode, 'tplSizeMode')}
         <div class="seg"><button data-act="tplStep" data-val="-1" aria-label="weniger">${ic('minus')}</button>
         <button style="min-width:48px;color:var(--text)" tabindex="-1">${val}</button>
         <button data-act="tplStep" data-val="1" aria-label="mehr">${ic('plus')}</button></div>`)}
      ${tpl.sizeMode === 'size' ? row('Wenn es nicht aufgeht', 'Z. B. 25 Kinder in 4er-Gruppen: eine 5er-Gruppe oder mehrere 3er-Gruppen.',
        seg([['larger', 'etwas größere Gruppen'], ['smaller', 'etwas kleinere Gruppen']], tpl.remainder, 'tplRemainder')) : ''}

      <h3 style="margin-top:20px">Zusammensetzung</h3>
      ${row('Mädchen und Jungen ausgleichen', 'In jeder Gruppe möglichst gleich viele Mädchen und Jungen.', toggle(tpl.gender, 'tplFlag', 'data-val="gender"'))}
      ${cls.subjects.map(sub => row(`Leistung ${esc(sub.name)}`,
        '„verteilen“: starke (und schwächere) Kinder auf alle Gruppen verteilen. „Niveaugruppen“: ähnlich starke Kinder zusammen.', subjSel(sub))).join('')
        || row('Leistung', 'Legen Sie zuerst unter „Fächer & Merkmale“ Fächer an.', '')}
      ${cls.tags.map(t => row(`${esc(t.name)} verteilen`, 'Kinder mit diesem Merkmal auf verschiedene Gruppen verteilen.', toggle(tpl.tags[t.id], 'tplTag', `data-tag="${t.id}"`))).join('')}
      ${row('„Nicht zusammen“ beachten', `${cls.rules.filter(r => r.type === 'apart' && r.on).length} aktive Einträge`, toggle(tpl.applyApart, 'tplFlag', 'data-val="applyApart"'))}
      ${row('„Zusammen“ beachten', `${cls.rules.filter(r => r.type === 'together' && r.on).length} aktive Einträge`, toggle(tpl.applyTogether, 'tplFlag', 'data-val="applyTogether"'))}
      ${row('Abwechslung', 'Kinder, die zuletzt schon zusammen waren, möglichst neu mischen.', toggle(tpl.avoidHistory, 'tplFlag', 'data-val="avoidHistory"'))}

      <h3 style="margin-top:20px">Rollen</h3>
      ${row('Rollen in den Gruppen verteilen', 'Jede Gruppe bekommt alle gewählten Rollen. Ist eine Gruppe kleiner, übernimmt ein Kind zwei Rollen.', toggle(tpl.rolesOn, 'tplFlag', 'data-val="rolesOn"'))}
      ${tpl.rolesOn ? `
        ${row('Rollenset', 'Z. B. eigene Rollen für Deutsch, Englisch oder Mathe. Rollensets bearbeiten Sie links unter „Rollen“.',
          `<div class="chips">${S.roleSets.map(s =>
            `<button class="chip-btn ${s.id === roleSetOf(tpl).id ? 'on' : ''}" data-act="tplRoleSet" data-id="${s.id}">${esc(s.name || 'Ohne Namen')}</button>`).join('')}</div>`)}
        <p class="muted small" style="margin:10px 0 6px">Diese Rollen werden vergeben (antippen zum An- und Abwählen):</p>
        <div class="chips" style="padding:0 0 12px">${roleSetOf(tpl).roles.filter(r => r.name.trim()).map(r =>
          `<button class="chip-btn ${tpl.rolesOff.includes(r.id) ? '' : 'on'}" data-act="tplRole" data-id="${r.id}">${esc(r.name)}</button>`).join('')
          || '<span class="muted">Dieses Rollenset enthält noch keine Rollen.</span>'}</div>` : ''}

      <h3 style="margin-top:20px">Einzelauswahl</h3>
      ${row('Jedes Kind erst einmal', 'Ein Kind wird erst wieder gezogen, wenn alle anderen dran waren.', toggle(tpl.noRepeatPick, 'tplFlag', 'data-val="noRepeatPick"'))}
    </div>`;
}

function adminHistory(cls) {
  const items = cls.history.slice().reverse().map(h => `
    <div class="hist">
      <div class="head-row">
        <b style="flex:1">${fmtDate(h.date)}</b><span class="pill">${esc(h.tplName || '')}</span>
        <button class="icon-btn danger" data-act="delHist" data-id="${h.id}" aria-label="Eintrag löschen">${ic('trash')}</button>
      </div>
      <div class="gl">${h.groups.map((g, gi) => `<span class="g${gi % GROUP_COLORS}">${g.map(id => {
        const r = h.roles?.[id];
        return esc(stuName(cls, id)) + (r ? ` <i>(${esc(r.join(', '))})</i>` : '');
      }).join(', ')}</span>`).join('')}</div>
      ${(h.warnings || []).map(w => `<div class="warn">${esc(w)}</div>`).join('')}
    </div>`).join('');
  const picked = cls.picked.filter(id => stuById(cls, id));
  return `
    <div class="card section">
      <div class="section-head"><h2>Einzelauswahl</h2>
        <button class="btn sm" data-act="resetPicked" ${picked.length ? '' : 'disabled'}>Zurücksetzen</button></div>
      <p class="muted small" style="margin:0">${picked.length
        ? `Schon gezogen in dieser Runde: ${picked.map(id => esc(stuName(cls, id))).join(', ')}`
        : 'In dieser Runde wurde noch niemand gezogen.'}</p>
    </div>
    <div class="card">
      <div class="section-head"><h2>Frühere Gruppen</h2>
        <button class="btn sm danger" data-act="clearHist" ${cls.history.length ? '' : 'disabled'}>Verlauf leeren</button></div>
      <p class="muted small" style="margin-top:0">Die letzten Einteilungen werden für „Abwechslung“ und eine faire Rollenverteilung genutzt. Hinweise zu nicht erfüllbaren Regeln erscheinen nur hier.</p>
      ${items || '<p class="muted">Noch keine Gruppen gemischt.</p>'}
    </div>`;
}

function curRoleSet() {
  const set = S.roleSets.find(s => s.id === V.admin.roleSetId) || S.roleSets[0];
  V.admin.roleSetId = set.id;
  return set;
}

function adminRoles() {
  const set = curRoleSet();
  const usedIn = [];
  S.classes.forEach(c => c.templates.forEach(t => {
    if (t.rolesOn && roleSetOf(t).id === set.id) usedIn.push(`${c.name} · ${t.name}`);
  }));
  const missingDefaults = DEFAULT_ROLES.filter(n => !set.roles.some(r => r.name.trim() === n));
  return `
    <div class="section-head">
      <div class="chips" style="flex:1">${S.roleSets.map(s =>
        `<button class="chip-btn ${s.id === set.id ? 'on' : ''}" data-act="adminRoleSet" data-id="${s.id}">${esc(s.name || 'Ohne Namen')}</button>`).join('')}</div>
      <button class="btn sm" data-act="addRoleSet">${ic('plus')}Neues Rollenset</button>
    </div>
    <div class="card">
      <div class="head-row" style="margin-bottom:6px">
        <input class="in title-in" style="font-size:20px" value="${esc(set.name)}" placeholder="Name, z. B. Englisch" data-bind="roleSetName" aria-label="Name des Rollensets">
        <button class="btn sm" data-act="copyRoleSet">${ic('copy')}Duplizieren</button>
        ${S.roleSets.length > 1 ? `<button class="btn sm danger" data-act="delRoleSet">${ic('trash')}Löschen</button>` : ''}
      </div>
      <p class="muted small" style="margin-top:0">${usedIn.length
        ? `Verwendet in: ${usedIn.map(esc).join(', ')}`
        : 'Wird noch in keiner Vorlage verwendet. Das Rollenset wählen Sie in der Vorlage einer Klasse aus.'}</p>
      ${set.roles.map(r => `<div class="list-row">
        <input class="in" style="flex:1" value="${esc(r.name)}" placeholder="Rolle, z. B. Vokabelprofi" data-bind="roleName" data-id="${r.id}">
        <button class="icon-btn danger" data-act="delRole" data-id="${r.id}" aria-label="Rolle löschen">${ic('trash')}</button>
      </div>`).join('') || '<p class="muted">Noch keine Rollen in diesem Set.</p>'}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn sm primary" data-act="addRole">${ic('plus')}Rolle</button>
        ${missingDefaults.length ? `<button class="btn sm" data-act="addDefaultRoles">Standardrollen ergänzen</button>` : ''}
      </div>
    </div>`;
}

function adminDisplay() {
  const anim = S.settings.anim;
  return `<div class="card">
    <h2>Anzeige</h2>
    <div class="set-row">
      <div class="lbl">Mischanimation
        <div class="desc">${anim === 'standard'
          ? 'Standard: Die Namen wirbeln sofort durcheinander und fliegen dann in ihre Gruppen.'
          : 'Mit Vorschau: Die Namen erscheinen zuerst ca. 2 Sekunden geordnet, dann wirbeln sie durcheinander und fliegen in ihre Gruppen.'}</div>
      </div>
      ${seg([['standard', 'Standard'], ['preview', 'Mit Vorschau']], anim, 'setAnim')}
    </div>
  </div>`;
}

function adminBackup() {
  return `<div class="card section">
      <h2>Sicherung</h2>
      <p class="muted">Alle Klassen, Einstellungen und der Verlauf sind nur auf diesem Gerät gespeichert. Exportieren Sie regelmäßig eine Sicherungsdatei, z. B. in die Dateien-App oder iCloud. So gehen keine Daten verloren und Sie können sie auf ein anderes Gerät übertragen.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" data-act="exportData">${ic('download')}Sicherung exportieren</button>
        <button class="btn" data-act="importData">${ic('upload')}Sicherung einlesen</button>
        <input type="file" id="importFile" accept=".json,application/json" class="hidden">
      </div>
    </div>
    <div class="info">Datenschutz: Die App sendet keine Daten ins Internet. Sie können statt vollständiger Namen auch Vornamen oder Kürzel verwenden.</div>`;
}

/* ---------- Aktionen ---------- */

const actions = {
  home() { stopPick(); go('home'); },
  openAdmin() { V.admin.section = 'class'; V.admin.classId = V.admin.classId || S.classes[0]?.id; go('admin'); },
  openClass(el) {
    const cls = getClass(el.dataset.id);
    V.classId = cls.id;
    selectTemplate(cls, cls.lastTpl);
    go('prep');
  },
  demoClass() {
    const cls = demoClass();
    S.classes.push(cls);
    save();
    toast('Beispielklasse angelegt');
    render();
  },

  // Vorbereitung
  pickTpl(el) {
    const cls = getClass(V.classId);
    selectTemplate(cls, el.dataset.id);
    cls.lastTpl = V.tplId;
  },
  toggleAbsent(el) {
    const cls = getClass(V.classId);
    const abs = absentToday(cls);
    const i = abs.indexOf(el.dataset.id);
    if (i >= 0) abs.splice(i, 1); else abs.push(el.dataset.id);
  },
  allPresent() { const cls = getClass(V.classId); cls.absent = []; },
  setSizeMode(el) { V.sizeMode = el.dataset.val; },
  stepSize(el) {
    const cls = getClass(V.classId);
    const n = Math.max(1, presentIds(cls).length);
    const d = +el.dataset.val;
    if (V.sizeMode === 'size') V.size = Math.min(Math.max(2, V.size + d), Math.max(2, n));
    else V.count = Math.min(Math.max(1, V.count + d), n);
    $('#sizeVal').textContent = V.sizeMode === 'size' ? V.size : V.count;
    $('#sizePreview').textContent = describeSizes(prepSizes(cls));
    return false;
  },
  mix() {
    const cls = getClass(V.classId);
    const tpl = getTpl(cls, V.tplId);
    const ids = presentIds(cls);
    if (!ids.length) return;
    const sizes = prepSizes(cls);
    const { groups, warnings } = makeGroups(cls, tpl, ids, sizes);
    const roleList = activeRoles(tpl);
    const prevHist = V.result?.histId;
    V.result = { groups, roles: {}, roleList, warnings, histId: prevHist || uid(), tplName: tpl.name };
    V.result.roles = assignRoles(cls, roleList, groups);
    storeHistory(cls);
    V.view = 'groups';
    render();
    window.scrollTo(0, 0);
    requestAnimationFrame(() => animateMix());
    return false;
  },
  // Das Ergebnis bleibt erhalten: erneutes Mischen in dieser Stunde überschreibt den Verlaufseintrag
  backToPrep() { stopPick(); go('prep'); },
  reRoles() {
    const cls = getClass(V.classId);
    V.result.roles = assignRoles(cls, V.result.roleList, V.result.groups);
    storeHistory(cls);
  },
  print() { window.print(); return false; },
  pick() {
    const cls = getClass(V.classId);
    const tpl = getTpl(cls, V.tplId);
    if (V.view !== 'pick') { V.view = 'pick'; render(); }
    runPick(cls, tpl);
    return false;
  },

  // Verwaltung: Navigation
  adminClass(el) { V.admin.section = 'class'; V.admin.classId = el.dataset.id; V.admin.ruleSel = []; V.admin.showImport = false; V.admin.tplId = null; },
  adminSection(el) { V.admin.section = el.dataset.val; },
  adminTab(el) { V.admin.tab = el.dataset.val; V.admin.showImport = false; },
  adminNewClass() {
    const cls = newClass(`Klasse ${S.classes.length + 1}`);
    S.classes.push(cls);
    Object.assign(V.admin, { section: 'class', classId: cls.id, tab: 'students', tplId: null, ruleSel: [] });
    if (V.view !== 'admin') { V.view = 'admin'; }
    toast('Klasse angelegt – Name oben ändern');
  },
  copyClass() {
    const src = getClass(V.admin.classId);
    const copy = normalizeClass(JSON.parse(JSON.stringify(src)));
    copy.id = uid();
    copy.name = src.name + ' (Kopie)';
    copy.history = []; copy.picked = []; copy.absent = [];
    S.classes.push(copy);
    V.admin.classId = copy.id;
    toast('Klasse kopiert');
  },
  deleteClass() {
    const cls = getClass(V.admin.classId);
    if (!confirm(`Klasse „${cls.name}“ mit allen Kindern und Einstellungen wirklich löschen?`)) return false;
    S.classes = S.classes.filter(c => c.id !== cls.id);
    V.admin.classId = S.classes[0]?.id || null;
    if (V.classId === cls.id) V.classId = null;
  },

  // Kinder
  addStudent() {
    const cls = getClass(V.admin.classId);
    const s = { id: uid(), name: '', g: '', perf: {}, tags: [] };
    cls.students.push(s);
    render();
    const inp = document.querySelector(`input[data-id="${s.id}"]`);
    inp?.focus();
    return false;
  },
  delStudent(el) {
    const cls = getClass(V.admin.classId);
    const s = stuById(cls, el.dataset.id);
    if (s.name && !confirm(`${s.name} löschen?`)) return false;
    cls.students = cls.students.filter(x => x.id !== s.id);
    cls.rules.forEach(r => { r.ids = r.ids.filter(id => id !== s.id); });
    cls.rules = cls.rules.filter(r => r.ids.length > 1);
  },
  stuGender(el) {
    const s = stuById(getClass(V.admin.classId), el.dataset.id);
    s.g = s.g === el.dataset.val ? '' : el.dataset.val;
    setSegOn(el, s.g);
    return false;
  },
  stuLevel(el) {
    const s = stuById(getClass(V.admin.classId), el.dataset.id);
    const v = +el.dataset.val;
    if (v) s.perf[el.dataset.sub] = v; else delete s.perf[el.dataset.sub];
    setSegOn(el, String(v));
    return false;
  },
  stuStrong(el) {
    const s = stuById(getClass(V.admin.classId), el.dataset.id);
    s.perf[el.dataset.sub] = !s.perf[el.dataset.sub];
    if (!s.perf[el.dataset.sub]) delete s.perf[el.dataset.sub];
    el.classList.toggle('on', !!s.perf[el.dataset.sub]);
    return false;
  },
  stuTag(el) {
    const s = stuById(getClass(V.admin.classId), el.dataset.id);
    const t = el.dataset.tag;
    s.tags = s.tags.includes(t) ? s.tags.filter(x => x !== t) : [...s.tags, t];
    el.classList.toggle('on', s.tags.includes(t));
    return false;
  },
  toggleImport() { V.admin.showImport = !V.admin.showImport; },
  doImport() {
    const cls = getClass(V.admin.classId);
    const lines = $('#importText').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const m = line.split(/[;,\t]/).map(x => x.trim());
      const name = m[0];
      if (!name) continue;
      const gRaw = (m[1] || '').toLowerCase();
      const g = /^(w|weiblich|mädchen|f)$/.test(gRaw) ? 'w' : /^(m|männlich|junge|j)$/.test(gRaw) ? 'm' : /^d/.test(gRaw) ? 'd' : '';
      cls.students.push({ id: uid(), name, g, perf: {}, tags: [] });
      added++;
    }
    V.admin.showImport = false;
    toast(`${added} ${added === 1 ? 'Kind' : 'Kinder'} hinzugefügt`);
  },

  // Fächer & Merkmale
  addSubject() { getClass(V.admin.classId).subjects.push({ id: uid(), name: '', mode: 'levels' }); },
  subjMode(el) {
    const sub = getClass(V.admin.classId).subjects.find(s => s.id === el.dataset.id);
    if (sub.mode === el.dataset.val) return false;
    const cls = getClass(V.admin.classId);
    const hasData = cls.students.some(s => s.perf[sub.id]);
    if (hasData && !confirm('Beim Wechsel werden die bisher eingetragenen Leistungen in diesem Fach umgerechnet (Stufe 3 = stark). Fortfahren?')) return false;
    cls.students.forEach(s => {
      const v = s.perf[sub.id];
      if (v === undefined) return;
      if (el.dataset.val === 'strong') { if (+v === 3) s.perf[sub.id] = true; else delete s.perf[sub.id]; }
      else s.perf[sub.id] = v === true ? 3 : v;
    });
    sub.mode = el.dataset.val;
  },
  delSubject(el) {
    const cls = getClass(V.admin.classId);
    const sub = cls.subjects.find(s => s.id === el.dataset.id);
    if (sub.name && !confirm(`Fach „${sub.name}“ mit allen Leistungsangaben löschen?`)) return false;
    cls.subjects = cls.subjects.filter(s => s.id !== sub.id);
    cls.students.forEach(s => delete s.perf[sub.id]);
    cls.templates.forEach(t => delete t.subjects[sub.id]);
  },
  addTag() { getClass(V.admin.classId).tags.push({ id: uid(), name: '' }); },
  addTagNamed(el) { getClass(V.admin.classId).tags.push({ id: uid(), name: el.dataset.val }); },
  delTag(el) {
    const cls = getClass(V.admin.classId);
    const tag = cls.tags.find(t => t.id === el.dataset.id);
    if (tag.name && !confirm(`Merkmal „${tag.name}“ löschen?`)) return false;
    cls.tags = cls.tags.filter(t => t.id !== tag.id);
    cls.students.forEach(s => { s.tags = s.tags.filter(x => x !== tag.id); });
    cls.templates.forEach(t => delete t.tags[tag.id]);
  },

  // Paarungen
  ruleSel(el) {
    const sel = V.admin.ruleSel;
    const i = sel.indexOf(el.dataset.id);
    if (i >= 0) sel.splice(i, 1); else sel.push(el.dataset.id);
  },
  ruleSelClear() { V.admin.ruleSel = []; },
  addRule(el) {
    if (V.admin.ruleSel.length < 2) return false;
    getClass(V.admin.classId).rules.push({ id: uid(), type: el.dataset.val, ids: V.admin.ruleSel.slice(), on: true });
    V.admin.ruleSel = [];
  },
  toggleRule(el) {
    const r = getClass(V.admin.classId).rules.find(x => x.id === el.dataset.id);
    r.on = !r.on;
  },
  delRule(el) {
    const cls = getClass(V.admin.classId);
    cls.rules = cls.rules.filter(r => r.id !== el.dataset.id);
  },

  // Vorlagen
  adminTpl(el) { V.admin.tplId = el.dataset.id; },
  addTpl() {
    const cls = getClass(V.admin.classId);
    const t = newTemplate(`Vorlage ${cls.templates.length + 1}`);
    cls.templates.push(t);
    V.admin.tplId = t.id;
  },
  copyTpl() {
    const cls = getClass(V.admin.classId);
    const src = getTpl(cls, V.admin.tplId);
    const t = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + ' (Kopie)' };
    cls.templates.push(t);
    V.admin.tplId = t.id;
  },
  delTpl() {
    const cls = getClass(V.admin.classId);
    const t = getTpl(cls, V.admin.tplId);
    if (!confirm(`Vorlage „${t.name}“ löschen?`)) return false;
    cls.templates = cls.templates.filter(x => x.id !== t.id);
    V.admin.tplId = cls.templates[0].id;
  },
  tplSizeMode(el) { curTpl().sizeMode = el.dataset.val; },
  tplStep(el) {
    const t = curTpl();
    const d = +el.dataset.val;
    if (t.sizeMode === 'size') t.size = Math.min(Math.max(2, t.size + d), 40);
    else t.count = Math.min(Math.max(1, t.count + d), 40);
  },
  tplRemainder(el) { curTpl().remainder = el.dataset.val; },
  tplFlag(el) { const t = curTpl(); t[el.dataset.val] = !t[el.dataset.val]; },
  tplSubj(el) {
    const t = curTpl();
    if (el.dataset.val === 'none') delete t.subjects[el.dataset.sub]; else t.subjects[el.dataset.sub] = el.dataset.val;
  },
  tplTag(el) { const t = curTpl(); t.tags[el.dataset.tag] = !t.tags[el.dataset.tag]; },
  tplRole(el) {
    const t = curTpl();
    const id = el.dataset.id;
    t.rolesOff = t.rolesOff.includes(id) ? t.rolesOff.filter(x => x !== id) : [...t.rolesOff, id];
  },
  tplRoleSet(el) { const t = curTpl(); t.roleSetId = el.dataset.id; t.rolesOff = []; },

  // Verlauf
  delHist(el) {
    const cls = getClass(V.admin.classId);
    cls.history = cls.history.filter(h => h.id !== el.dataset.id);
  },
  clearHist() {
    if (!confirm('Den gesamten Verlauf dieser Klasse löschen?')) return false;
    getClass(V.admin.classId).history = [];
  },
  resetPicked() { getClass(V.admin.classId).picked = []; toast('Einzelauswahl zurückgesetzt'); },

  // Rollensets
  adminRoleSet(el) { V.admin.roleSetId = el.dataset.id; },
  addRoleSet() {
    const set = { id: uid(), name: '', roles: [] };
    S.roleSets.push(set);
    V.admin.roleSetId = set.id;
    save();
    render();
    document.querySelector('[data-bind="roleSetName"]')?.focus();
    return false;
  },
  copyRoleSet() {
    const src = curRoleSet();
    const set = { id: uid(), name: src.name + ' (Kopie)', roles: src.roles.map(r => ({ id: uid(), name: r.name })) };
    S.roleSets.push(set);
    V.admin.roleSetId = set.id;
  },
  delRoleSet() {
    const set = curRoleSet();
    if (!confirm(`Rollenset „${set.name || 'Ohne Namen'}“ löschen? Vorlagen, die es verwenden, nutzen danach das erste Rollenset.`)) return false;
    S.roleSets = S.roleSets.filter(s => s.id !== set.id);
    S.classes.forEach(c => c.templates.forEach(t => {
      if (t.roleSetId === set.id) { t.roleSetId = S.roleSets[0].id; t.rolesOff = []; }
    }));
    V.admin.roleSetId = S.roleSets[0].id;
  },
  addRole() {
    const r = { id: uid(), name: '' };
    curRoleSet().roles.push(r);
    save();
    render();
    document.querySelector(`input[data-id="${r.id}"]`)?.focus();
    return false;
  },
  delRole(el) {
    const set = curRoleSet();
    const r = set.roles.find(x => x.id === el.dataset.id);
    if (r.name && !confirm(`Rolle „${r.name}“ löschen?`)) return false;
    set.roles = set.roles.filter(x => x.id !== r.id);
    S.classes.forEach(c => c.templates.forEach(t => { t.rolesOff = t.rolesOff.filter(id => id !== r.id); }));
  },
  addDefaultRoles() {
    const set = curRoleSet();
    DEFAULT_ROLES.filter(n => !set.roles.some(r => r.name.trim() === n))
      .forEach(n => set.roles.push({ id: uid(), name: n }));
  },
  setAnim(el) { S.settings.anim = el.dataset.val; },

  // Sicherung
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gruppen-zufall-sicherung-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return false;
  },
  importData() { $('#importFile').click(); return false; },
};

function curTpl() { return getTpl(getClass(V.admin.classId), V.admin.tplId); }

function selectTemplate(cls, tplId) {
  const tpl = getTpl(cls, tplId);
  V.tplId = tpl.id;
  V.sizeMode = tpl.sizeMode;
  V.size = tpl.size;
  V.count = tpl.count;
  V.result = null;
}

function setSegOn(el, val) {
  el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === val));
}

function storeHistory(cls) {
  const r = V.result;
  const entry = { id: r.histId, date: new Date().toISOString(), tplName: r.tplName, groups: r.groups.map(g => g.slice()), roles: r.roles, warnings: r.warnings };
  const i = cls.history.findIndex(h => h.id === r.histId);
  if (i >= 0) cls.history[i] = entry; else cls.history.push(entry);
  if (cls.history.length > HISTORY_LIMIT) cls.history.splice(0, cls.history.length - HISTORY_LIMIT);
}

/* ---------- Event-Verteilung ---------- */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  const res = fn(el, e);
  save();
  if (res !== false) render();
});

const binds = {
  className: (el, v) => {
    getClass(V.admin.classId).name = v;
    const navLabel = document.querySelector(`.nav [data-id="${V.admin.classId}"] span`);
    if (navLabel) navLabel.textContent = v;
  },
  stuName: (el, v) => { stuById(getClass(V.admin.classId), el.dataset.id).name = v; },
  subjName: (el, v) => { getClass(V.admin.classId).subjects.find(s => s.id === el.dataset.id).name = v; },
  tagName: (el, v) => { getClass(V.admin.classId).tags.find(t => t.id === el.dataset.id).name = v; },
  roleName: (el, v) => { curRoleSet().roles.find(r => r.id === el.dataset.id).name = v; },
  roleSetName: (el, v) => {
    const set = curRoleSet();
    set.name = v;
    const chip = document.querySelector(`[data-act="adminRoleSet"][data-id="${set.id}"]`);
    if (chip) chip.textContent = v || 'Ohne Namen';
  },
  tplName: (el, v) => {
    const t = curTpl();
    t.name = v;
    const chip = document.querySelector(`[data-act="adminTpl"][data-id="${t.id}"]`);
    if (chip) chip.textContent = v;
  },
};
document.addEventListener('input', e => {
  const el = e.target.closest('[data-bind]');
  if (!el) return;
  binds[el.dataset.bind]?.(el, el.value);
  save();
});
document.addEventListener('change', e => {
  if (e.target.id === 'importFile') handleImportFile(e.target);
});
// Enter im Namensfeld: nächstes Kind anlegen
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-bind="stuName"]');
  if (!el) return;
  e.preventDefault();
  const cls = getClass(V.admin.classId);
  const idx = cls.students.findIndex(s => s.id === el.dataset.id);
  const next = cls.students[idx + 1];
  if (next) document.querySelector(`input[data-bind="stuName"][data-id="${next.id}"]`)?.focus();
  else { actions.addStudent(); save(); }
});

function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.classes)) throw new Error('format');
      if (!confirm(`Sicherung mit ${data.classes.length} Klasse(n) einlesen? Die aktuellen Daten auf diesem Gerät werden dabei ersetzt.`)) return;
      S = normalizeState(data);
      save();
      V.admin.classId = S.classes[0]?.id || null;
      V.admin.section = 'class';
      toast('Sicherung eingelesen');
      render();
    } catch (err) {
      toast('Diese Datei ist keine gültige Sicherung.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Mischanimation ---------- */

function animateMix() {
  const stage = $('#stage');
  if (!stage) return;
  const chips = [...stage.querySelectorAll('.chip')];
  if (reduceMotion() || !chips.length) return;

  stage.classList.add('hiding');
  const layer = document.createElement('div');
  layer.className = 'fly-layer';
  document.body.appendChild(layer);

  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = vw / 2, cy = vh / 2 + 20;
  const R = Math.min(vw, vh) * 0.22;

  const flies = chips.map(chip => {
    const rect = chip.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'fly';
    const t = document.createElement('span');
    t.className = 'fly-t';
    t.textContent = chip.querySelector('.nm-t').textContent;
    f.appendChild(t);
    Object.assign(f.style, { left: rect.left + 'px', top: rect.top + 'px' });
    layer.appendChild(f);
    return { f, t, rect, chip };
  });

  // Alle Namenszettel gleich groß: Breite nach dem längsten Namen, Name zentriert.
  // Beim Landen wachsen sie auf die Größe des Gruppenfelds und der Name rutscht nach links.
  const padL = parseFloat(getComputedStyle(flies[0].f).paddingLeft) || 0;
  const slipW = Math.ceil(Math.max(...flies.map(x => x.t.offsetWidth)) + 2 * padL + 20);
  const slipH = Math.max(...flies.map(x => x.f.offsetHeight));
  flies.forEach(x => {
    x.ox = x.rect.left + slipW / 2;
    x.oy = x.rect.top + slipH / 2;
    Object.assign(x.f.style, { width: slipW + 'px', height: slipH + 'px' });
    x.t.style.transform = `translateX(${(slipW - x.t.offsetWidth) / 2 - padL}px)`;
  });

  const scatter = ({ f, ox, oy }) => {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R;
    const x = cx + Math.cos(a) * d * 1.4 - ox;
    const y = cy + Math.sin(a) * d - oy;
    f.style.transform = `translate(${x}px, ${y}px) rotate(${(rnd() - .5) * 30}deg) scale(.9)`;
  };

  const shuffleSteps = 6, stepMs = 230;
  let step = 0;
  let firstStepMs = stepMs;

  if (S.settings.anim === 'preview') {
    // Variante „Mit Vorschau“: Namen zuerst ca. 2 s alphabetisch geordnet in der Mitte zeigen
    showOrdered(flies, layer, vw, vh, slipW, slipH);
    firstStepMs = 550;
    setTimeout(() => { layer.classList.remove('veil'); tick(); }, 2300);
  } else {
    // Standard-Animation: alle Namen liegen sofort durcheinander in der Mitte
    flies.forEach(x => { x.f.style.transition = 'none'; scatter(x); });
    layer.getBoundingClientRect();
    setTimeout(tick, 60);
  }

  function tick() {
    if (step < shuffleSteps) {
      const ms = step === 0 ? firstStepMs : stepMs;
      flies.forEach(x => {
        x.f.style.transition = `transform ${ms}ms ease-in-out, opacity .3s`;
        scatter(x);
      });
      step++;
      setTimeout(tick, ms);
      return;
    }
    // Namen fliegen nacheinander in ihre Gruppen
    const stagger = Math.min(45, 1400 / flies.length);
    const ease = '650ms cubic-bezier(.2,.8,.25,1.05)';
    flies.forEach(({ f, t, chip, rect }, i) => {
      const gs = getComputedStyle(chip.closest('.group'));
      setTimeout(() => {
        f.style.transition = `transform ${ease}, width ${ease}, height ${ease}, background .4s, color .4s, border-color .4s`;
        f.style.transform = 'none';
        f.style.width = rect.width + 'px';
        f.style.height = rect.height + 'px';
        t.style.transition = `transform ${ease}`;
        t.style.transform = 'translateX(0)';
        f.style.background = gs.backgroundColor;
        f.style.color = gs.color;
        f.style.borderColor = 'transparent';
        f.style.boxShadow = 'none';
      }, i * stagger);
    });
    setTimeout(() => {
      stage.classList.remove('hiding');
      layer.remove();
    }, flies.length * stagger + 700);
  }
}

// Ordnet die Namensschilder alphabetisch als Raster in der Bildschirmmitte an
function showOrdered(flies, layer, vw, vh, w, h) {
  const n = flies.length, gap = 10;
  const cols = Math.max(1, Math.min(n, Math.floor((vw * 0.92 + gap) / (w + gap))));
  const rows = Math.ceil(n / cols);
  const totalH = rows * (h + gap) - gap;
  const s = Math.min(1, (vh - 150) / totalH);
  const cx = vw / 2, cy = vh / 2 + 30;
  const sorted = flies.slice().sort((a, b) => a.f.textContent.localeCompare(b.f.textContent, 'de'));
  sorted.forEach(({ f, ox, oy }, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const x = cx + (col - (inRow - 1) / 2) * (w + gap) * s - ox;
    const y = cy + (row - (rows - 1) / 2) * (h + gap) * s - oy;
    f.style.transition = 'none';
    f.style.opacity = '0';
    f.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  });
  layer.classList.add('veil');
  layer.getBoundingClientRect();
  sorted.forEach(({ f }, i) => {
    f.style.transition = 'opacity .35s ease';
    f.style.transitionDelay = `${Math.min(i * 12, 300)}ms`;
    f.style.opacity = '1';
  });
  setTimeout(() => sorted.forEach(({ f }) => { f.style.transitionDelay = '0ms'; }), 700);
}

/* ---------- Einzelauswahl ---------- */

function stopPick() {
  clearTimeout(V.pickTimer);
  V.pickTimer = null;
}

function runPick(cls, tpl) {
  stopPick();
  const present = presentIds(cls);
  if (!present.length) return;
  let pool = present;
  if (tpl.noRepeatPick) {
    pool = present.filter(id => !cls.picked.includes(id));
    if (!pool.length) {
      cls.picked = cls.picked.filter(id => !present.includes(id));
      pool = present;
      toast('Alle waren dran – neue Runde');
    }
  }
  const chosen = pool[randInt(pool.length)];
  if (tpl.noRepeatPick) cls.picked.push(chosen);
  save();

  const el = $('#pickName');
  const actionsEl = $('#pickActions');
  actionsEl.style.visibility = 'hidden';
  el.className = 'pick-name rolling';
  const names = present.map(id => stuName(cls, id));

  const finish = () => {
    el.textContent = stuName(cls, chosen);
    el.className = 'pick-name final';
    actionsEl.style.visibility = 'visible';
  };
  if (reduceMotion() || present.length === 1) return finish();

  // "Namenstrommel": zuerst schnell, dann immer langsamer
  let delay = 55, last = -1;
  const roll = () => {
    let i = randInt(names.length);
    if (names.length > 1) while (i === last) i = randInt(names.length);
    last = i;
    el.textContent = names[i];
    delay *= 1.12;
    if (delay > 380) { V.pickTimer = setTimeout(finish, 320); return; }
    V.pickTimer = setTimeout(roll, delay);
  };
  roll();
}

/* ---------- Drag & Drop (Finger und Maus) ---------- */

let drag = null;

document.addEventListener('pointerdown', e => {
  if (V.view !== 'groups') return;
  const chip = e.target.closest('#stage .chip');
  if (!chip || $('#stage').classList.contains('hiding')) return;
  drag = { chip, id: chip.dataset.id, x: e.clientX, y: e.clientY, started: false, ghost: null, over: null };
});

document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.started) {
    if (Math.hypot(dx, dy) < 8) return;
    drag.started = true;
    const r = drag.chip.getBoundingClientRect();
    drag.offX = drag.x - r.left; drag.offY = drag.y - r.top;
    const g = drag.chip.cloneNode(true);
    g.classList.add('drag-ghost');
    const cs = getComputedStyle(drag.chip.closest('.group'));
    Object.assign(g.style, { width: r.width + 'px', background: cs.backgroundColor, color: cs.color });
    document.body.appendChild(g);
    drag.ghost = g;
    drag.chip.classList.add('dragging');
  }
  e.preventDefault();
  drag.ghost.style.left = (e.clientX - drag.offX) + 'px';
  drag.ghost.style.top = (e.clientY - drag.offY) + 'px';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const grp = under?.closest('.group');
  if (drag.over !== grp) {
    drag.over?.classList.remove('drop');
    grp?.classList.add('drop');
    drag.over = grp;
  }
}, { passive: false });

function endDrag(e, cancelled) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.started) return;
  d.ghost.remove();
  d.chip.classList.remove('dragging');
  d.over?.classList.remove('drop');
  if (cancelled) return;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const targetChip = under?.closest('#stage .chip');
  const targetGroup = under?.closest('#stage .group');
  if (!targetGroup) return;
  moveKid(d.id, +targetGroup.dataset.group, targetChip && targetChip !== d.chip ? targetChip.dataset.id : null);
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));

function moveKid(id, toG, swapId) {
  const cls = getClass(V.classId);
  const r = V.result;
  const gs = r.groups;
  const fromG = gs.findIndex(g => g.includes(id));
  if (swapId) {
    const sg = gs.findIndex(g => g.includes(swapId));
    if (sg === fromG) return;
    gs[fromG][gs[fromG].indexOf(id)] = swapId;
    gs[sg][gs[sg].indexOf(swapId)] = id;
    toG = sg;
  } else {
    if (toG === fromG) return;
    gs[fromG].splice(gs[fromG].indexOf(id), 1);
    gs[toG].push(id);
  }
  // Rollen in den beiden betroffenen Gruppen neu verteilen, damit jede Gruppe wieder alle Rollen hat
  if (r.roleList.length) r.roles = assignRoles(cls, r.roleList, gs, [fromG, toG]);
  r.warnings = checkRules(cls, getTpl(cls, V.tplId), gs);
  storeHistory(cls);
  save();
  render();
}

/* ---------- Beispielklasse ---------- */

function demoClass() {
  const cls = newClass('Beispielklasse 4b');
  const kids = [
    ['Mia', 'w'], ['Ben', 'm'], ['Lea', 'w'], ['Luca', 'm'], ['Emma', 'w'], ['Noah', 'm'], ['Hanna', 'w'], ['Finn', 'm'],
    ['Sara', 'w'], ['Jonas', 'm'], ['Lina', 'w'], ['Emre', 'm'], ['Clara', 'w'], ['Tim', 'm'], ['Zoe', 'w'], ['Paul', 'm'],
    ['Amira', 'w'], ['Elias', 'm'], ['Leni', 'w'], ['Max', 'm'], ['Ida', 'w'], ['Karim', 'm'], ['Nele', 'w'], ['Oskar', 'm'],
  ];
  const math = { id: uid(), name: 'Mathe', mode: 'levels' };
  const ger = { id: uid(), name: 'Deutsch', mode: 'strong' };
  const daz = { id: uid(), name: 'DaZ' };
  const help = { id: uid(), name: 'Helferkind' };
  cls.subjects = [math, ger];
  cls.tags = [daz, help];
  cls.students = kids.map(([name, g], i) => ({
    id: uid(), name, g,
    perf: { [math.id]: [3, 2, 1, 2, 3, 2, 2, 1, 3, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 1, 2, 2, 3, 2][i], ...(i % 5 === 0 ? { [ger.id]: true } : {}) },
    tags: [],
  }));
  const by = n => cls.students.find(s => s.name === n).id;
  cls.students.find(s => s.name === 'Emre').tags.push(daz.id);
  cls.students.find(s => s.name === 'Karim').tags.push(daz.id);
  cls.students.find(s => s.name === 'Jonas').tags.push(help.id);
  cls.rules = [
    { id: uid(), type: 'apart', ids: [by('Ben'), by('Luca'), by('Tim')], on: true },
    { id: uid(), type: 'apart', ids: [by('Mia'), by('Lea')], on: true },
    { id: uid(), type: 'together', ids: [by('Emre'), by('Jonas')], on: true },
  ];
  const t = cls.templates[0];
  t.name = 'Mathe-Gruppenarbeit';
  Object.assign(t, { gender: true, subjects: { [math.id]: 'spread' }, tags: { [daz.id]: true }, rolesOn: true });
  const t2 = newTemplate('Partnerarbeit');
  t2.size = 2;
  cls.templates.push(t2);
  return cls;
}

/* ---------- Start ---------- */

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

render();
