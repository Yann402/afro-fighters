import * as THREE from 'three';
import { Match } from './sim/match.js';
import { AIController, DIFFICULTIES } from './sim/ai.js';
import { CHARACTERS, ROSTER } from './sim/characters.js';
import { DT, ROUNDS_TO_WIN, METER_MAX, GUARD_MAX, HURT_HALF_WIDTH } from './sim/constants.js';
import { FighterView } from './render/fighterView.js';
import { buildArena } from './render/arena.js';
import { FX } from './render/fx.js';
import { CameraRig } from './render/cameraRig.js';
import { preloadModels } from './render/glbFighter.js';
import { Input, ACTIONS, ACTION_LABELS, PAD_LABELS } from './input.js';
import { Audio } from './audio.js';
import { FixedStep } from './core/fixedStep.js';
import { Perf } from './perf.js';
import { Quality } from './quality.js';
import { Progress, MemoryStorage, OUTFITS, ARENAS, UNLOCKS, unlockLabel, xpForLevel, MAX_LEVEL } from './progress.js';

// ═════════════════════════════ Moteur de rendu
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
const camRig = new CameraRig(camera);
const arena = buildArena(scene, renderer);
const fx = new FX(scene);
const input = new Input();
const audio = new Audio();
const loop = new FixedStep(DT, 5);
const perf = new Perf(renderer, loop);
let storage;
try { storage = window.localStorage; storage.getItem('afrofighters.test'); } catch { storage = new MemoryStorage(); }
const progress = new Progress(storage);
const quality = new Quality(renderer, arena.key);
// Réglages de test : vitesse accélérée, joueurs pilotés par une IA (voir tests/browser/)
const debug = { speed: 1, p1ai: null, p2ai: null };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 55 : 42;       // garder les deux combattants cadrés sur écran étroit
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// réglages sauvegardés
input.setBindings(progress.data.settings.bindings);
quality.setMode(progress.data.settings.quality);
arena.setAmbiance(progress.data.selected.arena);
if (progress.data.settings.muted) audio.toggleMute();

// ═════════════════════════════ État
const S = {
  screen: null, arg: null, items: [], menuIndex: 0, view: null,
  mode: 'solo',              // solo | versus | training | demo
  p1: progress.data.selected.char, p2: 'themba', difficulty: progress.data.selected.difficulty,
  dummy: 'immobile', infiniteMeter: true,
  match: null, ctrl: [null, null], views: [null, null],
  preview: null, idleFrames: 0,
  slowmo: 0, resultTimer: 0, menuLock: 0,
  hpTrail: [1, 1], trailDelay: [0, 0], comboTimer: [0, 0],
  perfectRound: false, reward: null,
  train: { last: 0, hits: 0, dmg: 0, best: 0 },
  demo: null, capturing: null, confirmReset: false,
};
const $ = (id) => document.getElementById(id);
const screenEl = $('screen');
const emptyInput = () => ({ held: {}, pressed: {} });
const NAME = (id) => CHARACTERS[id].name;
const DUMMIES = { immobile: 'Immobile', garde: 'En garde', saut: 'Saute', ia: 'Riposte (IA)' };

// ═════════════════════════════ Petits utilitaires d'affichage
function banner(html, ms = 1100) {
  const b = $('banner'); b.innerHTML = html; b.classList.add('show');
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), ms);
}
function callout(text, kind, ms = 900) {
  const c = $('callout'); c.textContent = text; c.className = 'show ' + kind;
  clearTimeout(callout.t); callout.t = setTimeout(() => { c.className = kind; }, ms);
}
function specialBanner(text) {
  const b = $('specialBanner'); b.textContent = text; b.classList.add('show');
  clearTimeout(specialBanner.t); specialBanner.t = setTimeout(() => b.classList.remove('show'), 1300);
}
function screenFlash(strength = 0.6) {
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = String(strength);
  requestAnimationFrame(() => { f.style.transition = 'opacity 0.35s ease-out'; f.style.opacity = '0'; });
}
function toast(text, ms = 2600) {
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}
// Les libellés de touches viennent de la disposition réelle du clavier et peuvent contenir < & " :
// tout ce qui est inséré en HTML passe par là.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kbd = (slot, action) => `<kbd>${esc(input.label(slot, action))}</kbd>`;
const statBar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= v ? 'on' : ''}"></i>`).join('')}</div></div>`;

// ═════════════════════════════ Aperçu 3D dans les menus
function setPreview(id) {
  const tint = progress.outfit(id).tint;
  if (S.preview && S.preview.id === id) { S.preview.view.setOutfit(tint); return; }
  clearPreview();
  const view = new FighterView(id, scene);
  view.setOutfit(tint);
  S.preview = { id, view, fake: { char: CHARACTERS[id], state: 'idle', t: 0, x: 0, y: 0, facing: 1, meter: 0, move: null, vy: 0, mf: 0 } };
}
function clearPreview() {
  if (S.preview) { fx.clear(); S.preview.view.dispose(scene); S.preview = null; }
}

// ═════════════════════════════ Écrans (menus)
// Chaque écran décrit son contenu ; un seul moteur gère l'affichage, le clavier, la manette et la souris.
function open(name, arg = null, index = 0) {
  S.screen = name; S.arg = arg; S.menuIndex = index; S.capturing = null; S.confirmReset = false;
  SCREENS[name].enter?.(arg);
  render();
  S.view.onFocus?.(S.menuIndex);
  syncHud();
}
function close() { S.screen = null; S.view = null; S.items = []; screenEl.className = ''; screenEl.innerHTML = ''; syncHud(); }
function syncHud() {
  const show = !!S.match && S.mode !== 'demo' && (S.screen === null || S.screen === 'pause' || S.screen === 'result' || S.screen === 'help');
  $('hud').classList.toggle('hidden', !show);
  $('training').classList.toggle('hidden', S.mode !== 'training');
}
function render() {
  const v = SCREENS[S.screen].view(S.arg);
  S.view = v; S.items = v.items;
  if (S.menuIndex >= v.items.length) S.menuIndex = Math.max(0, v.items.length - 1);
  const items = v.items.map((it, i) => `<button class="opt ${i === S.menuIndex ? 'focus' : ''} ${it.locked ? 'locked' : ''}" data-i="${i}"><span>${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</span>${it.value !== undefined ? `<span class="v">${it.value}</span>` : ''}</button>`).join('');
  screenEl.className = 'on ' + (v.cls || '');
  screenEl.innerHTML = `${v.before || ''}<div class="${v.bare ? 'titleBox' : 'panel ' + (v.panel || '')}">${v.head || ''}<div class="menu ${v.row ? 'row cards' : ''}">${items}</div>${v.foot || ''}</div>`;
}
function focus(i) {
  if (i === S.menuIndex) return;
  S.menuIndex = i;
  if (S.view.rerenderOnFocus) render();
  else screenEl.querySelectorAll('.opt').forEach((el, k) => el.classList.toggle('focus', k === i));
  screenEl.querySelector('.opt.focus')?.scrollIntoView({ block: 'nearest' });
  S.view.onFocus?.(i);
}
function activate() {
  const it = S.items[S.menuIndex];
  if (!it || it.locked) return;
  audio.ui('ok');
  const scr = S.screen;
  if (it.action) it.action(); else if (it.adjust) it.adjust(1);
  if (S.screen === scr && S.screen !== null) render();
}
screenEl.addEventListener('click', (e) => {
  const el = e.target.closest('.opt'); if (!el) return;
  audio.unlock();
  const i = +el.dataset.i; if (i !== S.menuIndex) focus(i);
  activate();
});
screenEl.addEventListener('mousemove', (e) => { const el = e.target.closest('.opt'); if (el) focus(+el.dataset.i); });

function charInfo(id) {
  const c = CHARACTERS[id];
  return `<div class="info"><div class="cname">${c.name.toUpperCase()}</div><div class="ctitle">${c.title}</div><div class="cculture">${c.culture} · ${c.style}</div>
    <p>${c.blurb}</p>${statBar('Force', c.stats.force)}${statBar('Vitesse', c.stats.vitesse)}${statBar('Portée', c.stats.portee)}${statBar('Défense', c.stats.defense)}
    <div class="spec"><b>${c.special.name}</b><p>${c.special.desc}</p></div></div>`;
}

function commandsTable(slots) {
  const head = slots.map((s) => `<th>${{ solo: 'Clavier', p1: 'Joueur 1', p2: 'Joueur 2' }[s]}</th>`).join('');
  const rows = ACTIONS.map((a) => `<tr><td>${ACTION_LABELS[a]}</td>${slots.map((s) => `<td>${(input.bindings[s][a] || []).map((c) => `<kbd>${esc(input.keyLabel(c))}</kbd>`).join(' ')}</td>`).join('')}<td>${PAD_LABELS[a]}</td></tr>`).join('');
  return `<table class="grid"><thead><tr><th>Action</th>${head}<th>Manette PS4/PS5</th></tr></thead><tbody>${rows}
    <tr><td>Projection</td><td colspan="${slots.length + 1}">Avant + coup lourd, au contact</td></tr>
    <tr><td>Ruée / esquive</td><td colspan="${slots.length + 1}">Touche de ruée, ou deux appuis rapides sur une direction. Vers l'arrière : esquive invulnérable un court instant</td></tr>
    <tr><td>Contre</td><td colspan="${slots.length + 1}">Lever la garde juste avant l'impact</td></tr>
    <tr><td>Pause</td><td colspan="${slots.length}"><kbd>Échap</kbd> <kbd>P</kbd></td><td>Options</td></tr></tbody></table>`;
}

const MOVE_TEXT = {
  light: 'Rapide. Ouvre les enchaînements : il peut être annulé en coup moyen dès qu\'il touche.',
  medium: 'Portée intermédiaire. S\'enchaîne après un coup léger.',
  heavy: 'Lent et puissant. Conclut un enchaînement.',
  throw: 'Passe à travers la garde. Ne saisit pas un adversaire en l\'air.',
  air: 'À porter en redescendant d\'un saut.',
  special: 'Demande une jauge de pouvoir pleine.',
  dash: 'Franchit la distance d\'un bond. Peut être enchaînée sur une attaque.',
  backdash: 'Recule en restant invulnérable un court instant : fait échouer coups et projections.',
};
const MOVE_OVERRIDE = {
  modou: { medium: 'Charge armurée : encaisse un coup pendant l\'élan et renverse l\'adversaire.', heavy: 'Saisie avec élan vers l\'avant, imblocable. C\'est la projection de Modou.' },
  themba: { medium: 'Balayage bas de la lance. S\'enchaîne en coup lourd.' },
  lekishon: { medium: 'La hampe frappe à mi-distance. S\'enchaîne en coup lourd.', heavy: 'La plus longue portée du jeu, mais lente à ramener.' },
};
function movesOf(id) {
  const c = CHARACTERS[id], mv = c.moves;
  const dmg = (m) => (m.throwAnim ? m.throwAnim.damage : m.hits.reduce((s, h) => s + h.damage, 0));
  const row = (key, m, inputHtml) => ({ key, name: m ? m.name.replace(/^[A-ZÀ-Ü ]+ — /, (x) => x) : null, dmg: m ? dmg(m) : null, startup: m ? m.startup : null, inputHtml, text: (MOVE_OVERRIDE[id] && MOVE_OVERRIDE[id][key]) || MOVE_TEXT[key] });
  const k = (a) => kbd('solo', a);
  const list = [row('light', mv.light, k('light')), row('medium', mv.medium, k('medium')), row('heavy', mv.heavy, k('heavy'))];
  if (!mv.heavy.isThrow) list.push(row('throw', mv.throw, `avant + ${k('heavy')} au contact`));
  list.push(row('air', mv.air, `${k('up')} puis ${k('light')}`));
  list.push({ ...row('special', mv.special, k('special')), text: c.special.desc });
  list.push({ key: 'dash', name: 'Ruée', inputHtml: `${k('dash')} ou deux fois avant`, text: MOVE_TEXT.dash });
  list.push({ key: 'backdash', name: 'Esquive arrière', inputHtml: `arrière + ${k('dash')} ou deux fois arrière`, text: MOVE_TEXT.backdash });
  return list;
}

const SCREENS = {
  title: {
    enter() { disposeFight(); clearPreview(); camRig.mode = 'select'; camRig.shiftX = 0; audio.stopMusic(); },
    view: () => ({
      bare: true,
      head: `<div class="kicker">Légendes de l'Arène</div><h1>AFRO<br/><span>FIGHTERS</span></h1><p class="tagline">Trois guerriers · Trois traditions</p>`,
      items: [
        { label: 'Combat', action: () => open('select', { mode: 'solo', who: 0 }, ROSTER.indexOf(S.p1)) },
        { label: 'Deux joueurs', action: () => open('select', { mode: 'versus', who: 0 }, ROSTER.indexOf(S.p1)) },
        { label: 'Entraînement', action: () => open('select', { mode: 'training', who: 0 }, ROSTER.indexOf(S.p1)) },
        { label: 'Liste des coups', action: () => open('moves', { char: S.p1 }) },
        { label: 'Profil', action: () => open('profile') },
        { label: 'Options', action: () => open('options') },
      ],
      foot: `<p class="press">Niveau ${progress.level} · ${progress.data.stats.wins} victoire${progress.data.stats.wins > 1 ? 's' : ''} — ↑ ↓ naviguer · Entrée / ✕ valider</p>`,
    }),
  },

  select: {
    enter() { disposeFight(); camRig.mode = 'select'; audio.stopMusic(); },
    view: (a) => {
      const id = ROSTER[S.menuIndex] || ROSTER[0];
      const who = a.who === 0 ? (a.mode === 'versus' ? 'JOUEUR 1' : 'TON COMBATTANT') : (a.mode === 'versus' ? 'JOUEUR 2' : 'ADVERSAIRE D\'ENTRAÎNEMENT');
      return {
        cls: 'bottom', bare: true, row: true, rerenderOnFocus: true,
        before: `<div class="pickTitle"><span class="who ${a.who ? 'two' : ''}">${who}</span><h2>Choisis un combattant</h2></div>${charInfo(id)}`,
        items: ROSTER.map((r) => ({ label: `<b>${NAME(r)}</b><small>${CHARACTERS[r].culture}</small>`, action: () => pick(a, r) })),
        foot: `<p class="press">← → choisir · Entrée / ✕ valider · Échap / ○ retour</p>`,
        onFocus: (i) => setPreview(ROSTER[i]),
        back: () => (a.who === 1 ? open('select', { mode: a.mode, who: 0 }, ROSTER.indexOf(S.p1)) : open('title')),
      };
    },
  },

  diff: {
    view: () => ({
      head: `<h2>Niveau de l'adversaire</h2>`,
      items: [
        ['facile', 'Réagit lentement, garde rarement, attaque au hasard.'],
        ['normal', 'Gère la distance, enchaîne parfois, punit certaines erreurs.'],
        ['difficile', 'Punit chaque erreur, enchaîne, esquive les saisies, tente des contres.'],
      ].map(([d, sub]) => ({ label: DIFFICULTIES[d].label, sub, action: () => { S.difficulty = d; progress.data.selected.difficulty = d; const others = ROSTER.filter((r) => r !== S.p1); S.p2 = others[Math.floor(Math.random() * others.length)]; startFight('solo'); } })),
      foot: `<p class="press">Échap / ○ retour</p>`,
      back: () => open('select', { mode: 'solo', who: 0 }, ROSTER.indexOf(S.p1)),
    }),
  },

  pause: {
    view: () => {
      const it = [{ label: 'Reprendre', action: resume }, { label: 'Recommencer le combat', action: () => startFight(S.mode) }];
      if (S.mode === 'training') {
        it.push({ label: 'Mannequin', value: `◄ ${DUMMIES[S.dummy]} ►`, adjust: (d) => { const k = Object.keys(DUMMIES); S.dummy = k[(k.indexOf(S.dummy) + d + k.length) % k.length]; S.ctrl[1] = dummyController(S.dummy); } });
        it.push({ label: 'Jauge de pouvoir infinie', value: S.infiniteMeter ? 'Oui' : 'Non', adjust: () => { S.infiniteMeter = !S.infiniteMeter; S.match.options.infiniteMeter = S.infiniteMeter; } });
      }
      it.push({ label: 'Commandes', action: () => open('help') });
      it.push({ label: 'Changer de combattant', action: () => open('select', { mode: S.mode, who: 0 }, ROSTER.indexOf(S.p1)) });
      it.push({ label: 'Son', value: audio.muted ? 'Coupé' : 'Activé', adjust: toggleSound });
      it.push({ label: 'Menu principal', action: () => open('title') });
      return { cls: 'dim', head: `<h2>Pause</h2>`, items: it, back: resume };
    },
  },

  help: {
    view: () => ({
      cls: 'dim', head: `<h2>Commandes</h2>${commandsTable(S.mode === 'versus' ? ['p1', 'p2'] : ['solo'])}<p class="lead" style="margin-top:10px">Les touches se modifient dans Options, depuis le menu principal.</p>`,
      items: [{ label: 'Retour', action: () => open('pause') }], back: () => open('pause'),
    }),
  },

  result: {
    view: () => {
      const r = S.reward;
      const reward = r && r.xp !== undefined ? `<p class="reward">+<b>${r.xp}</b> points d'expérience · niveau <b>${r.level}</b>${r.level > r.levelBefore ? '<span class="new">Niveau supérieur !</span>' : ''}${r.unlocks.map((u) => `<span class="new">Débloqué — ${unlockLabel(u)}</span>`).join('')}</p><div class="xp"><i style="width:${(progress.levelProgress * 100).toFixed(0)}%"></i></div>` : '';
      return {
        cls: 'dim', head: `<div class="resultTitle ${r.lose ? 'lose' : ''}">${r.title}</div><p class="lead" style="text-align:center;max-width:none">${r.text}</p>${reward}`,
        items: [{ label: 'Revanche', action: () => startFight(S.mode) }, { label: 'Changer de combattant', action: () => open('select', { mode: S.mode, who: 0 }, ROSTER.indexOf(S.p1)) }, { label: 'Menu principal', action: () => open('title') }],
      };
    },
  },

  moves: {
    enter(a) { startDemo(a.char); },
    view: (a) => {
      const list = movesOf(a.char);
      return {
        cls: 'left', panel: 'moves', rerenderOnFocus: false,
        head: `<h2>Liste des coups</h2><p class="lead">◄ <b style="color:#fff">${NAME(a.char).toUpperCase()}</b> ► — ${CHARACTERS[a.char].style}. La démonstration se joue à droite, en boucle.</p>`,
        items: list.map((m) => ({ label: m.name, sub: `${m.inputHtml} — ${m.text}`, value: m.dmg ? `${m.dmg} dégâts · ${m.startup} img` : undefined })),
        foot: `<p class="press">↑ ↓ coup · ← → combattant · Échap / ○ retour — « img » : images avant l'impact (60 par seconde)</p>`,
        onFocus: (i) => { if (S.demo) { S.demo.move = list[i]; S.demo.t = 0; } },
        adjust: (d) => open('moves', { char: ROSTER[(ROSTER.indexOf(a.char) + d + ROSTER.length) % ROSTER.length] }),
        back: () => open('title'),
      };
    },
  },

  profile: {
    enter() { camRig.mode = 'select'; },
    view: () => {
      const d = progress.data, st = d.stats, l = progress.level;
      const next = l < MAX_LEVEL ? `${d.profile.xp - xpForLevel(l)} / ${xpForLevel(l + 1) - xpForLevel(l)} vers le niveau ${l + 1}` : 'niveau maximal';
      const rate = st.matches ? Math.round((st.wins / st.matches) * 100) : 0;
      const rows = [['Matchs contre l\'ordinateur', st.matches], ['Victoires', `${st.wins} (${rate} %)`], ['Défaites', st.losses], ['Meilleure série', st.bestStreak], ['Manches parfaites', st.perfects],
        ['Victoire la plus rapide', st.fastestWinSec === null ? '—' : `${st.fastestWinSec} s`], ['Victoires en difficile', st.byDifficulty.difficile.wins], ['Matchs à deux joueurs', st.versusMatches], ['Séances d\'entraînement', st.trainingSessions],
        ...ROSTER.map((c) => [`Avec ${NAME(c)}`, `${st.byChar[c].wins} victoire${st.byChar[c].wins > 1 ? 's' : ''} sur ${st.byChar[c].matches}`])];
      const cyc = (list, cur, dir) => list[(list.indexOf(cur) + dir + list.length) % list.length];
      const outfitItem = (c) => {
        const have = d.unlocked.outfits[c];
        return { label: `Tenue de ${NAME(c)}`, sub: `${have.length} sur ${OUTFITS[c].length} débloquée${have.length > 1 ? 's' : ''}`, value: `◄ ${progress.outfit(c).name} ►`, char: c, adjust: (dir) => { d.selected.outfits[c] = cyc(have, d.selected.outfits[c], dir); progress.save(); setPreview(c); } };
      };
      return {
        head: `<h2>Profil — niveau ${l}</h2><p class="lead" style="margin:0">${d.profile.xp} points d'expérience · ${next}</p><div class="xp"><i style="width:${(progress.levelProgress * 100).toFixed(0)}%"></i></div>
          <div class="cols"><div><h3>Statistiques</h3><table class="grid">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div>
          <div><h3>Récompenses</h3><ul class="unlocks">${UNLOCKS.map((u) => `<li class="${u.level <= l ? '' : 'no'}">Niveau ${u.level} — ${unlockLabel(u)}</li>`).join('')}</ul>
          <p class="lead" style="margin-top:8px">Les trois combattants sont disponibles dès le départ. Les récompenses sont visuelles : elles ne changent pas le combat.</p></div></div>`,
        items: [
          ...ROSTER.map(outfitItem),
          { label: 'Ambiance de l\'arène', sub: `${d.unlocked.arenas.length} sur ${ARENAS.length} débloquée${d.unlocked.arenas.length > 1 ? 's' : ''}`, value: `◄ ${ARENAS.find((x) => x.id === d.selected.arena).name} ►`, adjust: (dir) => { d.selected.arena = cyc(d.unlocked.arenas, d.selected.arena, dir); progress.save(); arena.setAmbiance(d.selected.arena); } },
          { label: 'Exporter la sauvegarde', sub: 'Télécharge un fichier à conserver ou à transférer', action: exportSave },
          { label: 'Importer une sauvegarde', action: () => $('importFile').click() },
          { label: S.confirmReset ? 'Confirmer : tout effacer ?' : 'Réinitialiser la progression', sub: S.confirmReset ? 'Valide de nouveau pour effacer définitivement' : undefined, action: () => { if (S.confirmReset) { progress.reset(); applySettings(); S.confirmReset = false; toast('Progression effacée'); } else S.confirmReset = true; } },
          { label: 'Retour', action: () => open('title') },
        ],
        onFocus: (i) => { const it = S.items[i]; if (it && it.char) setPreview(it.char); else clearPreview(); if (S.confirmReset && !(it && /effacer/.test(it.label))) { S.confirmReset = false; render(); } },
        back: () => open('title'),
      };
    },
  },

  options: {
    view: () => ({
      head: `<h2>Options</h2>`,
      items: [
        { label: 'Son', value: audio.muted ? 'Coupé' : 'Activé', adjust: toggleSound },
        { label: 'Qualité graphique', sub: 'Automatique : baisse d\'un cran si le jeu ralentit', value: `◄ ${quality.label} ►`, adjust: (dir) => { const k = ['auto', 'high', 'medium', 'low']; const m = k[(k.indexOf(quality.mode) + dir + k.length) % k.length]; quality.setMode(m); progress.data.settings.quality = m; progress.save(); } },
        { label: 'Mesures de performances', sub: 'Aussi avec la touche F3', value: perf.visible ? 'Affichées' : 'Masquées', adjust: () => perf.toggle() },
        { label: 'Commandes — un joueur', action: () => open('bind', 'solo') },
        { label: 'Commandes — joueur 1 (à deux)', action: () => open('bind', 'p1') },
        { label: 'Commandes — joueur 2 (à deux)', action: () => open('bind', 'p2') },
        { label: 'Rétablir les commandes par défaut', action: () => { input.setBindings(null); progress.data.settings.bindings = null; progress.save(); toast('Commandes par défaut rétablies'); } },
        { label: 'Retour', action: () => open('title') },
      ],
      back: () => open('title'),
    }),
  },

  bind: {
    view: (slot) => ({
      head: `<h2>Commandes — ${{ solo: 'un joueur', p1: 'joueur 1', p2: 'joueur 2' }[slot]}</h2><p class="lead">Valide une action puis appuie sur la nouvelle touche. Échap annule. Manette : ${ACTIONS.slice(3).map((a) => `${PAD_LABELS[a]} ${ACTION_LABELS[a].toLowerCase()}`).join(' · ')}.</p>`,
      items: [
        ...ACTIONS.map((a) => ({
          label: ACTION_LABELS[a], value: S.capturing === a ? 'Appuie sur une touche…' : esc((input.bindings[slot][a] || []).map((c) => input.keyLabel(c)).join(' / ')) || '—',
          action: () => {
            S.capturing = a;
            input.capture = (code) => {
              S.capturing = null;
              if (code) { progress.data.settings.bindings = input.rebind(slot, a, code); progress.save(); }
              if (S.screen === 'bind') render();
            };
          },
        })),
        { label: 'Retour', action: () => open('options') },
      ],
      back: () => open('options'),
    }),
  },
};

function pick(a, id) {
  if (a.who === 0) {
    S.p1 = id; progress.data.selected.char = id; progress.save();
    if (a.mode === 'solo') open('diff', null, ['facile', 'normal', 'difficile'].indexOf(S.difficulty));
    else open('select', { mode: a.mode, who: 1 }, ROSTER.indexOf(S.p2));
  } else { S.p2 = id; startFight(a.mode); }
}
function toggleSound() { progress.data.settings.muted = audio.toggleMute(); progress.save(); }
function applySettings() {
  input.setBindings(progress.data.settings.bindings); quality.setMode(progress.data.settings.quality); arena.setAmbiance(progress.data.selected.arena);
  if (audio.muted !== progress.data.settings.muted) audio.toggleMute();
  S.p1 = progress.data.selected.char; S.difficulty = progress.data.selected.difficulty;
}
function exportSave() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([progress.export()], { type: 'application/json' }));
  a.download = 'afro-fighters-sauvegarde.json'; a.click(); URL.revokeObjectURL(a.href);
  toast('Sauvegarde exportée');
}
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try { progress.import(await file.text()); applySettings(); toast('Sauvegarde importée'); if (S.screen === 'profile') render(); } catch (err) { toast(`Import refusé : ${err.message}`, 4000); }
});

// ═════════════════════════════ Combat
function dummyController(kind) {
  const ai = new AIController('normal', (Math.random() * 1e9) | 0);
  let t = 0;
  return (self, opp, m) => {
    t++;
    if (kind === 'ia') return ai.think(self, opp, m);
    const o = emptyInput();
    if (kind === 'garde') { o.held.guard = true; o.held.noParry = true; }
    if (kind === 'saut' && t % 80 === 0) { o.pressed.up = true; o.held.up = true; }
    return o;
  };
}

function disposeFight() {
  fx.clear();                     // les images rémanentes réutilisent les géométries des combattants : les retirer d'abord
  for (const v of S.views) if (v) v.dispose(scene);
  S.views = [null, null]; S.match = null; S.demo = null;
  for (const id of ['c0', 'c1', 'banner', 'callout', 'specialBanner']) $(id).classList.remove('show');
}

function buildMatch(p1, p2, options) {
  clearPreview(); disposeFight();
  S.match = new Match(p1, p2, options);
  S.views = [new FighterView(p1, scene), new FighterView(p2, scene)];
  S.views[0].setOutfit(progress.outfit(p1).tint);
  // deux fois le même combattant : le second porte une teinte froide pour qu'on les distingue
  S.views[1].setOutfit(p1 === p2 ? '#6f9fe6' : '#ffffff');
  S.match.fighters.forEach((f, i) => S.views[i].snapPrev(f));
  loop.reset(); S.slowmo = 0; S.hpTrail = [1, 1]; S.trailDelay = [0, 0]; S.comboTimer = [0, 0];
  input.clearLatches();
  camRig.mode = 'fight'; camRig.focus = null; camRig.shiftX = S.mode === 'demo' ? -1.9 : 0;
  arena.setAmbiance(progress.data.selected.arena);
}

function startFight(mode) {
  S.mode = mode;
  buildMatch(S.p1, S.p2, { training: mode === 'training', infiniteMeter: mode === 'training' && S.infiniteMeter });
  if (mode === 'versus') S.ctrl = [() => input.read('p1'), () => input.read('p2')];
  else if (mode === 'training') S.ctrl = [() => input.read('solo'), dummyController(S.dummy)];
  else { const ai = new AIController(S.difficulty, (Math.random() * 1e9) | 0); S.ctrl = [() => input.read('solo'), (s, o, m) => ai.think(s, o, m)]; }
  camRig.pos.set(0, 1.9, 8.5);
  $('n0').textContent = NAME(S.p1).toUpperCase(); $('n1').textContent = NAME(S.p2).toUpperCase();
  $('tag0').textContent = 'J1';
  $('tag1').textContent = mode === 'versus' ? 'J2' : mode === 'training' ? 'MANNEQUIN' : `IA ${DIFFICULTIES[S.difficulty].label.toUpperCase()}`;
  S.perfectRound = false; S.reward = null; S.train = { last: 0, hits: 0, dmg: 0, best: 0 };
  if (mode === 'training') progress.recordTraining();
  close();
  audio.unlock(); audio.startMusic();
  updateHUD(true); updateHint(true);
}

function resume() { close(); audio.startMusic(); input.clearLatches(); }
function pause() { if (S.match && S.screen === null && S.match.phase !== 'over') { open('pause'); audio.stopMusic(); } }

function handleEvents(events) {
  const m = S.match;
  const slotOf = (i) => (S.mode === 'versus' ? (i === 0 ? 'p1' : 'p2') : i === 0 ? 'solo' : null);
  const rumble = (i, s, ms) => { const sl = slotOf(i); if (sl) input.rumble(sl, s, ms); };
  for (const e of events) {
    switch (e.type) {
      case 'hit': {
        fx.hit(e.x, e.y, e.heavy, e.special);
        S.views[e.f].flash = 1;
        camRig.shake(e.special ? 0.3 : e.heavy ? 0.2 : 0.1);
        audio.hit(e.heavy);
        arena.excitement = Math.min(1, arena.excitement + (e.heavy ? 0.4 : 0.15));
        rumble(e.f, e.heavy ? 0.8 : 0.4, e.heavy ? 180 : 90);
        if (e.combo >= 2) { $('c' + e.by).innerHTML = `${e.combo} COUPS<small>ENCHAÎNEMENT</small>`; $('c' + e.by).classList.add('show'); S.comboTimer[e.by] = 1.2; }
        if (e.f === 1) trainHit(e.dmg, e.combo);
        break;
      }
      case 'block': fx.block(e.x, e.y, e.shield); audio.block(e.shield); camRig.shake(0.04); break;
      case 'armor': fx.hit(e.x, e.y, false, true); audio.block(true); S.views[e.f].flash = 0.6; if (e.f === 1) trainHit(e.dmg, 1); break;
      case 'parry': fx.parry(e.x, e.y); audio.parry(); camRig.shake(0.12); callout('CONTRE !', 'cold'); arena.excitement = 1; rumble(e.by, 0.6, 140); break;
      case 'guardBreak': fx.guardBreak(e.x, e.y); audio.guardBreak(); camRig.shake(0.25); callout('GARDE BRISÉE', 'hot', 1100); S.views[e.f].flash = 1; arena.excitement = 1; rumble(e.f, 1, 260); break;
      case 'dash': fx.dash(e.x, m.fighters[e.f].facing * e.dir); audio.dash(); break;
      case 'whoosh': audio.whoosh(e.heavy); break;
      case 'jump': fx.dust(m.fighters[e.f].x, 6, 1); audio.jump(); break;
      case 'land': fx.dust(e.x, e.hard ? 22 : 8, e.hard ? 2.4 : 1.2); audio.land(e.hard); if (e.hard) camRig.shake(0.08); break;
      case 'grab': audio.grab(); break;
      case 'slam': fx.slam(e.x, e.big); camRig.shake(e.big ? 0.35 : 0.22); audio.slam(e.big); S.views[e.f].flash = 1; arena.excitement = 1; rumble(e.f, 1, 260); if (e.big) screenFlash(0.5); if (e.f === 1) trainHit(e.dmg, 1); break;
      case 'special': {
        specialBanner(e.name); audio.special(e.char);
        const f = m.fighters[e.f];
        camRig.focusOn(f.x, f.y, 0.75, 0.55); screenFlash(0.35); arena.excitement = 1;
        break;
      }
      case 'cue': {
        const f = m.fighters[e.f];
        audio.cue(e.cue);
        if (e.cue === 'stomp') { fx.dust(f.x + f.facing * 0.2, 18, 2.2); fx.ring(f.x, 0, '#ffcf6a', 2.2, 0.4); camRig.shake(0.1); }
        if (e.cue === 'dash' || e.cue === 'leap') fx.dust(f.x, 14, 2);
        if (e.cue === 'hop') { fx.dust(f.x, 8, 1.2); fx.ring(f.x, 0, '#9fd6ff', 1.4, 0.35); }
        if (e.cue === 'impact') { fx.slam(f.x, true); camRig.shake(0.25); }
        if (e.cue === 'warcry') fx.ring(f.x, 1.4, '#ffe6b0', 2, 0.5, false);
        break;
      }
      case 'finisher': {
        const loser = m.fighters[e.f];
        fx.finisher(loser.x); audio.finisher(); screenFlash(0.9); S.finisher = true;
        break;
      }
      case 'roundIntro': {
        if (S.mode === 'demo') break;
        const [a, b] = m.fighters;
        const final = a.roundsWon === ROUNDS_TO_WIN - 1 && b.roundsWon === ROUNDS_TO_WIN - 1;
        banner(S.mode === 'training' ? 'ENTRAÎNEMENT' : final ? 'MANCHE FINALE' : `MANCHE ${e.round}`, 1000);
        $('roundLabel').textContent = S.mode === 'training' ? 'libre' : `manche ${e.round}`;
        audio.roundStart(); S.finisher = false;
        S.views.forEach((v, i) => v.snapPrev(m.fighters[i]));
        break;
      }
      case 'fightStart': if (S.mode !== 'demo') banner('COMBATTEZ !', 800); break;
      case 'roundEnd': {
        banner(e.reason === 'time' ? 'TEMPS ÉCOULÉ' : e.winner === -1 ? 'DOUBLE K.O.' : S.finisher ? 'FINITION' : 'K.O.', 1500);
        S.slowmo = S.finisher ? 1.7 : 1.1;
        if (e.winner === 0 && m.fighters[0].hp === m.fighters[0].maxHp) S.perfectRound = true;
        if (e.reason === 'ko') {
          if (!S.finisher) { audio.ko(); screenFlash(0.7); }
          const loser = e.winner === 0 ? m.fighters[1] : m.fighters[0];
          camRig.focusOn(loser.x, 0.5, 1.6, 0.35);
        }
        rumble(0, 1, 400); rumble(1, 1, 400);
        break;
      }
      case 'roundWinner': if (e.winner >= 0) banner(`${m.fighters[e.winner].char.name.toUpperCase()}<small>REMPORTE LA MANCHE</small>`, 1500); break;
      case 'matchEnd': S.resultTimer = 1.4; break;
    }
  }
}

function trainHit(dmg, combo) {
  const t = S.train;
  if (combo <= 1) { t.hits = 0; t.dmg = 0; }
  t.last = dmg; t.hits++; t.dmg += dmg; t.best = Math.max(t.best, t.dmg);
}

// Effets continus pendant les pouvoirs spéciaux (par pas de simulation)
function specialFX() {
  S.match.fighters.forEach((f, i) => {
    const v = S.views[i];
    if (f.state !== 'attack' || !f.move?.special) return;
    const fr = f.mf, id = f.char.id;
    if (id === 'modou') {
      if (fr <= 34) fx.aura(f.x, 0.3, [[1, 0.75, 0.3], [1, 0.55, 0.2]], 3);
      else if (fr <= 54 && fr % 5 === 0) fx.afterimage(v, false, null, 0.22, 0.18);
    } else if (id === 'themba') {
      if (fr <= 16) fx.aura(f.x, 0.4, [[1, 0.9, 0.6]], 2);
      if (fr >= 17 && fr <= 50) {
        if (fr % 6 === 0) {
          // les « cornes du buffle » : deux guerriers spectraux encadrent la charge
          fx.afterimage(v, true, new THREE.Vector3(-f.facing * 0.35, 0, -1.0), 0.24, 0.16);
          fx.afterimage(v, true, new THREE.Vector3(-f.facing * 0.7, 0, 0.75), 0.24, 0.12);
        }
        if (fr % 4 === 0) fx.dust(f.x - f.facing * 0.3, 4, 1);
      }
    } else if (id === 'lekishon') {
      if (fr <= 62) fx.aura(f.x, f.y + 0.2, [[0.6, 0.85, 1], [1, 0.4, 0.3]], 2);
      else if (fr <= 86 && fr % 4 === 0) fx.afterimage(v, true, null, 0.2, 0.2);
    }
  });
}

function stepFight(dt) {
  const m = S.match;
  let scale = 1;
  if (S.slowmo > 0) { S.slowmo -= dt; scale = 0.3; }      // ralenti au K.O.
  const t0 = performance.now();
  loop.maxSteps = 5 * debug.speed;
  loop.advance(dt * scale, () => {
    m.fighters.forEach((f, i) => S.views[i].snapPrev(f));
    const [a, b] = m.fighters;
    const p1 = debug.p1ai ? debug.p1ai.think(a, b, m) : S.ctrl[0](a, b, m);
    const p2 = debug.p2ai ? debug.p2ai.think(b, a, m) : S.ctrl[1](b, a, m);
    m.step([p1, p2]);
    handleEvents(m.drainEvents());
    specialFX();
  });
  perf.sim(performance.now() - t0);
  audio.tick();
  const [a, b] = m.fighters;
  S.views[0].update(a, b, m, dt, loop.alpha);
  S.views[1].update(b, a, m, dt, loop.alpha);
  camRig.update(dt, a, b);
  if (S.mode !== 'demo') { updateHUD(false, dt); updateHint(); }
  if (m.phase === 'over' && S.resultTimer > 0) { S.resultTimer -= dt; if (S.resultTimer <= 0) showResult(); }
}

function showResult() {
  const m = S.match, w = m.result.winner;
  const [a, b] = m.fighters;
  const score = `${Math.max(a.roundsWon, b.roundsWon)}-${Math.min(a.roundsWon, b.roundsWon)}`;
  if (S.mode === 'versus') {
    progress.recordVersus();
    S.reward = { title: w === -1 ? 'ÉGALITÉ' : `JOUEUR ${w + 1}`, lose: false, text: w === -1 ? 'Aucun vainqueur cette fois.' : `${NAME(w === 0 ? S.p1 : S.p2)} remporte le combat ${score}.` };
  } else {
    const result = w === 0 ? 'win' : w === 1 ? 'loss' : 'draw';
    const r = progress.recordMatch({ char: S.p1, difficulty: S.difficulty, result, perfect: result === 'win' && S.perfectRound, seconds: m.frame / 60 });
    S.reward = { ...r, title: w === 0 ? 'VICTOIRE' : w === 1 ? 'DÉFAITE' : 'ÉGALITÉ', lose: w === 1,
      text: w === 0 ? `${NAME(S.p1)} triomphe de ${NAME(S.p2)} (${score}) · IA ${DIFFICULTIES[S.difficulty].label}${S.perfectRound ? ' · manche parfaite' : ''}` : w === 1 ? `${NAME(S.p2)} l'emporte (${score}). Retente ta chance !` : 'Aucun vainqueur cette fois.' };
    if (r.unlocks.length || r.level > r.levelBefore) audio.reward();
  }
  audio.stopMusic();
  open('result'); S.menuLock = 0.7;
}

function updateHUD(force = false, dt = 1 / 60) {
  const m = S.match; if (!m) return;
  m.fighters.forEach((f, i) => {
    const r = Math.max(0, f.hp / f.maxHp);
    const fill = $('h' + i);
    fill.style.width = (r * 100).toFixed(1) + '%'; fill.classList.toggle('low', r < 0.3);
    if (force) S.hpTrail[i] = r;                       // barre claire : dégâts récents, rattrapés avec un délai
    if (S.hpTrail[i] > r) { S.trailDelay[i] += dt; if (S.trailDelay[i] > 0.5) S.hpTrail[i] = Math.max(r, S.hpTrail[i] - dt * 0.7); } else { S.hpTrail[i] = r; S.trailDelay[i] = 0; }
    $('t' + i).style.width = (S.hpTrail[i] * 100).toFixed(1) + '%';
    $('m' + i).style.width = (f.meter / METER_MAX * 100).toFixed(1) + '%';
    $('mw' + i).classList.toggle('ready', f.meter >= METER_MAX);
    $('g' + i).style.width = (f.guardHp / GUARD_MAX * 100).toFixed(1) + '%';
    $('gw' + i).classList.toggle('warn', f.guardHp < GUARD_MAX * 0.35);
    const pips = S.mode === 'training' ? '' : Array.from({ length: ROUNDS_TO_WIN }, (_, k) => `<i class="${k < f.roundsWon ? 'on' : ''}"></i>`).join('');
    const re = $('r' + i); if (re.dataset.v !== pips) { re.innerHTML = pips; re.dataset.v = pips; }
    if (S.comboTimer[i] > 0) { S.comboTimer[i] -= dt; if (S.comboTimer[i] <= 0) $('c' + i).classList.remove('show'); }
  });
  const tm = $('timer'), tv = S.mode === 'training' ? '∞' : String(Math.max(0, m.timer));
  if (tm.textContent !== tv) tm.textContent = tv;
  tm.classList.toggle('urgent', S.mode !== 'training' && m.timer <= 10);
  if (S.mode === 'training') {
    const t = S.train, o = m.fighters[1];
    const state = { idle: 'libre', walk: 'libre', guard: 'en garde', blockstun: 'bloque', hitstun: 'touché', launched: 'en l\'air', down: 'au sol', getup: 'se relève', dizzy: 'étourdi', parried: 'contré', attack: 'attaque', air: 'saute', airattack: 'attaque', dash: 'ruée' }[o.state] || o.state;
    const html = `<b>ENTRAÎNEMENT</b><table><tr><td>Dernier coup</td><td>${t.last}</td></tr><tr><td>Enchaînement</td><td>${t.hits} coup${t.hits > 1 ? 's' : ''} · ${t.dmg}</td></tr><tr><td>Meilleur enchaînement</td><td>${t.best}</td></tr><tr><td>Mannequin</td><td>${DUMMIES[S.dummy]} · ${state}</td></tr><tr><td>Garde adverse</td><td>${Math.round(o.guardHp)} %</td></tr></table>`;
    const el = $('training'); if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }
}

let hintKey = null;
function updateHint(force = false) {
  const key = S.mode + input.lastDevice + JSON.stringify(input.bindings);
  if (!force && key === hintKey) return;
  hintKey = key;
  const L = (slot, a) => esc(input.label(slot, a));
  const line = (slot) => `<b>${L(slot, 'left')} ${L(slot, 'right')}</b> bouger · <b>${L(slot, 'up')}</b> saut · <b>${L(slot, 'guard')}</b> garde · <b>${L(slot, 'light')}</b> léger · <b>${L(slot, 'medium')}</b> moyen · <b>${L(slot, 'heavy')}</b> lourd · <b>${L(slot, 'special')}</b> spécial · <b>${L(slot, 'dash')}</b> ruée`;
  $('fightHint').innerHTML = S.mode === 'versus' ? `J1 — ${line('p1')}<br/><span class="p2k">J2 — ${line('p2')}</span>` : `${line('solo')} · <b>Échap</b> pause`;
}

// ═════════════════════════════ Démonstration des coups (liste des coups)
function startDemo(char) {
  const opp = char === 'themba' ? 'lekishon' : 'themba';
  S.mode = 'demo';
  buildMatch(char, opp, { training: true, infiniteMeter: true });
  const m = S.match;
  for (let i = 0; i < 75; i++) { m.step([emptyInput(), emptyInput()]); }      // passe l'introduction
  m.drainEvents();
  S.demo = { move: movesOf(char)[0], t: 0 };
  S.ctrl = [demoController, () => emptyInput()];
  camRig.pos.set(0.6, 1.7, 6.5);
  S.views.forEach((v, i) => v.snapPrev(m.fighters[i]));
}
// Rejoue en boucle le coup sélectionné, sur un adversaire immobile placé à la bonne distance.
function demoController(self, opp, m) {
  const o = emptyInput(), d = S.demo, mv = d.move;
  const fwd = self.facing > 0 ? 'right' : 'left', back = self.facing > 0 ? 'left' : 'right';
  const press = (k) => { o.pressed[k] = true; o.held[k] = true; };
  d.t++;
  if (d.t === 1) {
    if (!(self.free && ['idle', 'guard', 'walk'].includes(opp.state))) { d.t = 0; return o; }
    const c = self.char, cm = c.moves[mv.key];
    let dist = 1.6;
    if (mv.key === 'throw' || (cm && cm.isThrow && !cm.special)) dist = c.pushWidth + opp.char.pushWidth + (cm.advance || 0) + 0.1;
    else if (mv.key === 'special') dist = c.id === 'lekishon' ? 3.0 : 1.7;
    else if (mv.key === 'dash' || mv.key === 'backdash') dist = 3.6;
    else if (cm && mv.key !== 'air') dist = Math.max(c.pushWidth + opp.char.pushWidth + 0.05, cm.maxReach + cm.advance + HURT_HALF_WIDTH - 0.25);
    self.x = -dist / 2 - 0.3; opp.x = dist / 2 - 0.3; self.vx = 0; opp.vx = 0;
  }
  if (mv.key === 'air') {
    if (d.t === 24) { press('up'); o.held[fwd] = true; }
    if (self.state === 'jumpsquat') o.held[fwd] = true;
    if (self.state === 'air') { o.held[fwd] = true; if (self.vy < 0.03 && !self.airAttackUsed) press('light'); }
  } else if (d.t === 24) {
    if (mv.key === 'throw') { o.held[fwd] = true; press('heavy'); }
    else if (mv.key === 'backdash') { o.held[back] = true; press('dash'); }
    else press(mv.key);
  }
  if (d.t > 170) d.t = 0;
  return o;
}

// ═════════════════════════════ Entrées de menu
function handleMenuInput(dt) {
  const evs = input.takeMenu();
  if (S.menuLock > 0) { S.menuLock -= dt; return; }
  if (!evs.length) return;
  audio.unlock();
  for (const { a, code } of evs) {
    if (S.screen === null) { if (S.match && (a === 'pause' || (a === 'back' && code === 'Escape'))) pause(); continue; }
    if (S.capturing) continue;
    const v = S.view, n = S.items.length;
    const prev = v.row ? 'left' : 'up', next = v.row ? 'right' : 'down';
    if (a === prev || a === next) { if (n) { audio.ui('move'); focus((S.menuIndex + (a === next ? 1 : -1) + n) % n); } }
    else if (!v.row && (a === 'left' || a === 'right')) {
      const it = S.items[S.menuIndex], d = a === 'right' ? 1 : -1;
      if (it && it.adjust) { audio.ui('move'); const scr = S.screen; it.adjust(d); if (S.screen === scr) render(); } else if (v.adjust) { audio.ui('move'); v.adjust(d); }
    } else if (a === 'confirm') activate();
    else if (a === 'back' || a === 'pause') { if (v.back) v.back(); }
  }
}

input.onPadChange = (on, id) => toast(on ? `Manette connectée : ${id.split('(')[0].trim()}` : 'Manette déconnectée');
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode !== 'demo') pause(); });
window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); perf.toggle(); if (S.screen === 'options') render(); } });
if (new URLSearchParams(location.search).has('perf')) perf.toggle(true);

// ═════════════════════════════ Boucle principale
let last = performance.now();
let idleT = 0;
function frame(now) {
  const rawMs = now - last; last = now;
  perf.frame(rawMs);
  // 0,25 s au plus : au-delà (onglet en arrière-plan), la boucle à pas fixe abandonne l'excès
  const dt = Math.min(0.25, rawMs / 1000) * debug.speed;
  input.pollMenu();
  handleMenuInput(dt);

  const running = S.match && (S.screen === null || S.screen === 'moves');
  if (running) {
    stepFight(dt);
    if (S.screen === null) quality.frame(rawMs);
  } else if (S.match && S.screen === 'result') {
    // célébration : animation calée sur le temps réel, pas sur la fréquence de l'écran
    const m = S.match;
    S.idleFrames += dt * 60;
    while (S.idleFrames >= 1) { S.idleFrames--; for (const f of m.fighters) f.t++; }
    S.views[0].update(m.fighters[0], m.fighters[1], m, dt, 1);
    S.views[1].update(m.fighters[1], m.fighters[0], m, dt, 1);
    camRig.update(dt, m.fighters[0], m.fighters[1]);
  } else if (!S.match) {
    idleT += dt;
    if (S.preview) {
      const p = S.preview;
      S.idleFrames += dt * 60;
      while (S.idleFrames >= 1) { S.idleFrames--; p.fake.t++; }
      p.fake.state = S.screen === 'diff' ? 'win' : 'idle';
      p.view.update(p.fake, p.fake, null, dt, 1);
      p.view.root.rotation.y = -0.85 + Math.sin(idleT * 0.5) * 0.3;
      p.view.root.position.x = window.innerWidth > 860 ? -0.7 : 0;
    }
    camRig.mode = 'select';
    camRig.update(dt, { x: 0, y: 0 }, { x: 0, y: 0 });
  }
  fx.update(dt);
  arena.update(dt);
  const r0 = performance.now();
  renderer.render(scene, camera);
  perf.render(performance.now() - r0);
  perf.paint(now);
  requestAnimationFrame(frame);
}

// ═════════════════════════════ Démarrage
camRig.mode = 'select';
camRig.update(0.016, { x: 0, y: 0 }, { x: 0, y: 0 });
camRig.snap();
// Les modèles 3D sont chargés avant le premier affichage ; en cas d'échec, l'ancien modèle sert de secours.
preloadModels().finally(() => {
  open('title');
  if (progress.status === 'recovered') toast('Sauvegarde abîmée : la copie de secours a été restaurée', 5000);
  if (progress.status === 'reset') toast('Sauvegarde illisible : nouvelle progression', 5000);
  requestAnimationFrame((t) => { last = t; $('loading').classList.add('gone'); frame(t); });
});

// Interface de test et de diagnostic (utilisée par tests/browser/). Sans effet sur le jeu.
window.__afro = { S, perf, loop, debug, fx, scene, camera, renderer, input, progress, quality, arena, audio, open, close, startFight, pause, FighterView, AIController, CHARACTERS, ROSTER };
