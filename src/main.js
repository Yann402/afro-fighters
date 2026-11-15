import * as THREE from 'three';
import { Match } from './sim/match.js';
import { AIController, DIFFICULTIES } from './sim/ai.js';
import { CHARACTERS, ROSTER } from './sim/characters.js';
import { DT, ROUNDS_TO_WIN, METER_MAX } from './sim/constants.js';
import { FighterView } from './render/fighterView.js';
import { buildArena } from './render/arena.js';
import { FX } from './render/fx.js';
import { CameraRig } from './render/cameraRig.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

// ───────────────────────────── Rendu
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // garder les deux combattants cadrés sur écrans étroits
  camera.fov = w / h < 1.3 ? 55 : 42;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ───────────────────────────── État global
const S = {
  state: 'title',
  prevState: null,
  playerChar: 'modou',
  cpuChar: 'themba',
  difficulty: 'normal',
  match: null,
  ai: null,
  views: [null, null],
  preview: null,
  acc: 0,
  timeScale: 1,
  slowmo: 0,
  focus: 0,
  menuIndex: 0,
  selectIndex: 0,
  resultTimer: 0,
  hpTrail: [1, 1],
  trailDelay: [0, 0],
  comboTimer: [0, 0],
};

const $ = (id) => document.getElementById(id);
const screens = ['title', 'controls', 'select', 'diff', 'pause', 'result'];

function show(name) {
  for (const s of screens) $('screen-' + s).classList.toggle('active', s === name);
  $('hud').classList.toggle('hidden', !(S.state === 'fight' || S.state === 'pause' || S.state === 'result'));
  S.menuIndex = 0;
  focusMenu();
}

function currentOpts() {
  const map = { title: 'screen-title', controls: 'screen-controls', diff: 'screen-diff', pause: 'screen-pause', result: 'screen-result', select: 'screen-select' };
  const el = $(map[S.state]);
  return el ? [...el.querySelectorAll('.opt')] : [];
}

function focusMenu() {
  const opts = currentOpts();
  opts.forEach((o, i) => o.classList.toggle('focus', i === S.menuIndex));
}

function setState(st) {
  S.prevState = S.state;
  S.state = st;
  show(st === 'fight' ? null : st);
}

// ───────────────────────────── Écran de sélection
function buildSelect() {
  const cards = $('cards');
  cards.innerHTML = '';
  ROSTER.forEach((id, i) => {
    const c = CHARACTERS[id];
    const b = document.createElement('button');
    b.className = 'opt card';
    b.innerHTML = `<span class="cn">${c.name}</span><span class="cc">${c.culture}</span>`;
    b.addEventListener('mouseenter', () => { S.menuIndex = i; selectChanged(); });
    b.addEventListener('click', () => { audio.unlock(); S.menuIndex = i; selectChanged(); confirmSelect(); });
    cards.appendChild(b);
  });
}

function statBar(label, v) {
  return `<div class="stat"><span>${label}</span><div class="bar">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= v ? 'on' : ''}"></i>`).join('')}</div></div>`;
}

function selectChanged() {
  const id = ROSTER[S.menuIndex];
  S.playerChar = id;
  const c = CHARACTERS[id];
  $('charInfo').innerHTML = `
    <div class="cname">${c.name.toUpperCase()}</div>
    <div class="ctitle">${c.title}</div>
    <div class="cculture">${c.culture} · ${c.style}</div>
    <p>${c.blurb}</p>
    ${statBar('Force', c.stats.force)}${statBar('Vitesse', c.stats.vitesse)}${statBar('Portée', c.stats.portee)}${statBar('Défense', c.stats.defense)}
    <div class="spec"><b>${c.special.name}</b><p>${c.special.desc}</p></div>
    <div class="moves">Léger : <span>${c.moves.light.name}</span><br/>Lourd : <span>${c.moves.heavy.name}</span>${id !== 'modou' ? `<br/>Projection : <span>${c.moves.throw.name}</span>` : ''}<br/>Aérien : <span>${c.moves.air.name}</span></div>`;
  focusMenu();
  setPreview(id);
}

function setPreview(id) {
  if (S.preview && S.preview.charId === id) return;
  if (S.preview) S.preview.view.dispose(scene);
  const view = new FighterView(id, scene);
  const fake = { char: CHARACTERS[id], state: 'win', t: 0, x: 0, y: 0, facing: 1, meter: 0, move: null, vy: 0 };
  view.prevX = 0; view.prevY = 0;
  S.preview = { charId: id, view, fake };
}

function clearPreview() {
  if (S.preview) { S.preview.view.dispose(scene); S.preview = null; }
}

function confirmSelect() {
  audio.ui('ok');
  setState('diff');
}

// ───────────────────────────── Combat
function startMatch() {
  clearPreview();
  disposeFight();
  const others = ROSTER.filter((r) => r !== S.playerChar);
  S.cpuChar = others[Math.floor(Math.random() * others.length)];
  S.match = new Match(S.playerChar, S.cpuChar);
  S.ai = new AIController(S.difficulty, (Math.random() * 1e9) | 0);
  S.views = [new FighterView(S.playerChar, scene), new FighterView(S.cpuChar, scene)];
  S.match.fighters.forEach((f, i) => S.views[i].snapPrev(f));
  S.acc = 0; S.slowmo = 0;
  S.hpTrail = [1, 1];
  S.comboTimer = [0, 0];
  $('c0').classList.remove('show'); $('c1').classList.remove('show');
  camRig.mode = 'fight';
  camRig.pos.set(0, 1.9, 8.5);
  $('n0').textContent = CHARACTERS[S.playerChar].name.toUpperCase();
  $('n1').textContent = `${CHARACTERS[S.cpuChar].name.toUpperCase()} · IA ${DIFFICULTIES[S.difficulty].label}`;
  fx.clear();
  setState('fight');
  audio.unlock();
  audio.startMusic();
  updateHUD(true);
}

function disposeFight() {
  for (const v of S.views) if (v) v.dispose(scene);
  S.views = [null, null];
  S.match = null;
}

function banner(html, ms = 1100) {
  const b = $('banner');
  b.innerHTML = html;
  b.classList.add('show');
  clearTimeout(banner.t);
  banner.t = setTimeout(() => b.classList.remove('show'), ms);
}

function specialBanner(text) {
  const b = $('specialBanner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(specialBanner.t);
  specialBanner.t = setTimeout(() => b.classList.remove('show'), 1300);
}

function screenFlash(strength = 0.6) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.opacity = String(strength);
  requestAnimationFrame(() => { f.style.transition = 'opacity 0.35s ease-out'; f.style.opacity = '0'; });
}

function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), ms);
}

function handleEvents(events) {
  const m = S.match;
  for (const e of events) {
    switch (e.type) {
      case 'hit': {
        fx.hit(e.x, e.y, e.heavy, e.special);
        S.views[e.f].flash = 1;
        camRig.shake(e.special ? 0.3 : e.heavy ? 0.2 : 0.1);
        audio.hit(e.heavy);
        arena.excitement = Math.min(1, arena.excitement + (e.heavy ? 0.4 : 0.15));
        input.rumble(e.heavy ? 0.8 : 0.4, e.heavy ? 180 : 90);
        if (e.combo >= 2) {
          const side = e.by;
          $('c' + side).innerHTML = `${e.combo} COUPS<small>COMBO</small>`;
          $('c' + side).classList.add('show');
          S.comboTimer[side] = 1.2;
        }
        break;
      }
      case 'block': fx.block(e.x, e.y, e.shield); audio.block(e.shield); camRig.shake(0.04); break;
      case 'armor': fx.hit(e.x, e.y, false, true); audio.block(true); S.views[e.f].flash = 0.6; break;
      case 'whoosh': audio.whoosh(e.heavy); break;
      case 'jump': fx.dust(m.fighters[e.f].x, 6, 1); audio.jump(); break;
      case 'land': fx.dust(e.x, e.hard ? 22 : 8, e.hard ? 2.4 : 1.2); audio.land(e.hard); if (e.hard) camRig.shake(0.08); break;
      case 'grab': audio.grab(); break;
      case 'slam': fx.slam(e.x, e.big); camRig.shake(e.big ? 0.35 : 0.22); audio.slam(e.big); S.views[e.f].flash = 1; arena.excitement = 1; input.rumble(1, 260); if (e.big) screenFlash(0.5); break;
      case 'special': {
        specialBanner(e.name);
        audio.special(e.char);
        const f = m.fighters[e.f];
        camRig.focusOn(f.x, f.y, 0.75, 0.55);
        screenFlash(0.35);
        arena.excitement = 1;
        break;
      }
      case 'cue': {
        const f = m.fighters[e.f];
        audio.cue(e.cue);
        if (e.cue === 'stomp') { fx.dust(f.x + f.facing * 0.2, 18, 2.2); fx.ring(f.x, 0, '#ffcf6a', 2.2, 0.4); camRig.shake(0.1); }
        if (e.cue === 'dash' || e.cue === 'leap') fx.dust(f.x, 14, 2);
        if (e.cue === 'hop') { fx.dust(f.x, 8, 1.2); fx.ring(f.x, 0, '#9fd6ff', 1.4, 0.35); }
        if (e.cue === 'impact') { fx.slam(f.x, true); camRig.shake(0.25); }
        if (e.cue === 'warcry') { fx.ring(f.x, 1.4, '#ffe6b0', 2, 0.5, false); }
        break;
      }
      case 'roundIntro': {
        const [a, b] = m.fighters;
        const final = a.roundsWon === ROUNDS_TO_WIN - 1 && b.roundsWon === ROUNDS_TO_WIN - 1;
        banner(final ? 'MANCHE FINALE' : `MANCHE ${e.round}`, 1000);
        audio.roundStart();
        S.views.forEach((v, i) => v.snapPrev(m.fighters[i]));
        break;
      }
      case 'fightStart': banner('COMBATTEZ !', 800); break;
      case 'roundEnd': {
        banner(e.reason === 'time' ? 'TEMPS ÉCOULÉ' : e.winner === -1 ? 'DOUBLE K.O.' : 'K.O.', 1500);
        S.slowmo = 1.1;
        if (e.reason === 'ko') {
          audio.ko();
          screenFlash(0.7);
          const loser = e.winner === 0 ? m.fighters[1] : m.fighters[0];
          camRig.focusOn(loser.x, 0.5, 1.6, 0.35);
        }
        input.rumble(1, 400);
        break;
      }
      case 'roundWinner': {
        if (e.winner >= 0) {
          const name = m.fighters[e.winner].char.name.toUpperCase();
          banner(`${name}<small>REMPORTE LA MANCHE</small>`, 1500);
        }
        break;
      }
      case 'matchEnd': S.resultTimer = 1.4; break;
    }
  }
}

// Effets continus pendant les pouvoirs spéciaux (par frame logique)
function specialFX() {
  const m = S.match;
  m.fighters.forEach((f, i) => {
    const v = S.views[i];
    if (f.state !== 'attack' || !f.move?.special) return;
    const fr = f.mf;
    const id = f.char.id;
    if (id === 'modou') {
      if (fr <= 34) fx.aura(f.x, 0.3, [[1, 0.75, 0.3], [1, 0.55, 0.2]], 3);
      else if (fr <= 54 && fr % 4 === 0) fx.afterimage(v, false, null, 0.22, 0.18);
    } else if (id === 'themba') {
      if (fr <= 16) fx.aura(f.x, 0.4, [[1, 0.9, 0.6]], 2);
      if (fr >= 17 && fr <= 50) {
        if (fr % 4 === 0) {
          // les « cornes du buffle » : deux guerriers spectraux encadrent la charge
          fx.afterimage(v, true, new THREE.Vector3(-f.facing * 0.35, 0, -1.0), 0.2, 0.16);
          fx.afterimage(v, true, new THREE.Vector3(-f.facing * 0.7, 0, 0.75), 0.2, 0.12);
        }
        if (fr % 4 === 0) fx.dust(f.x - f.facing * 0.3, 4, 1);
      }
    } else if (id === 'lekishon') {
      if (fr <= 62) fx.aura(f.x, f.y + 0.2, [[0.6, 0.85, 1], [1, 0.4, 0.3]], 2);
      else if (fr <= 86 && fr % 3 === 0) fx.afterimage(v, true, null, 0.2, 0.2);
    }
  });
}

function stepFight(dt) {
  const m = S.match;
  // ralenti au K.O.
  let scale = 1;
  if (S.slowmo > 0) { S.slowmo -= dt; scale = 0.3; }
  S.acc += dt * scale;
  let steps = 0;
  const maxSteps = 5 * (window.__speed || 1);
  while (S.acc >= DT && steps < maxSteps) {
    S.acc -= DT; steps++;
    m.fighters.forEach((f, i) => S.views[i].snapPrev(f));
    const p1 = window.__p1ai ? window.__p1ai.think(m.fighters[0], m.fighters[1], m) : input.read();
    const p2 = S.ai.think(m.fighters[1], m.fighters[0], m);
    m.step([p1, p2]);
    handleEvents(m.drainEvents());
    specialFX();
  }
  if (steps >= maxSteps) S.acc = 0;
  audio.tick();

  const alpha = S.acc / DT;
  const [a, b] = m.fighters;
  S.views[0].update(a, b, m, dt, alpha);
  S.views[1].update(b, a, m, dt, alpha);
  camRig.update(dt, a, b);
  updateHUD(false, dt);
  updateHint();

  if (m.phase === 'over' && S.resultTimer > 0) {
    S.resultTimer -= dt;
    if (S.resultTimer <= 0) showResult();
  }
}

const HINTS = {
  keyboard: '<b>Q/D ←→</b> bouger · <b>Z/W ↑</b> sauter · <b>S ↓</b> garde · <b>J</b> léger · <b>K</b> lourd · <b>avant+K</b> projection · <b>L</b> spécial · <b>Échap</b> pause',
  pad: '<b>Stick/Croix</b> bouger · <b>✕</b> sauter · <b>L1/R1</b> garde · <b>□</b> léger · <b>△</b> lourd · <b>avant+△</b> projection · <b>○</b> spécial · <b>Options</b> pause',
};
let hintDevice = null;
function updateHint() {
  if (hintDevice === input.lastDevice) return;
  hintDevice = input.lastDevice;
  $('fightHint').innerHTML = HINTS[hintDevice] || HINTS.keyboard;
}

function showResult() {
  const w = S.match.result.winner;
  const t = $('resultTitle');
  t.classList.toggle('lose', w === 1);
  t.textContent = w === 0 ? 'VICTOIRE' : w === 1 ? 'DÉFAITE' : 'ÉGALITÉ';
  const pc = CHARACTERS[S.playerChar].name, cc = CHARACTERS[S.cpuChar].name;
  const [a, b] = S.match.fighters;
  $('resultText').textContent = w === 0
    ? `${pc} triomphe de ${cc} (${a.roundsWon}-${b.roundsWon}) · IA ${DIFFICULTIES[S.difficulty].label}`
    : w === 1 ? `${cc} l'emporte (${b.roundsWon}-${a.roundsWon}). Retente ta chance !` : 'Aucun vainqueur cette fois.';
  $('c0').classList.remove('show'); $('c1').classList.remove('show');
  setState('result');
  S.menuLock = 0.7;
  audio.stopMusic();
}

function updateHUD(force = false, dt = 1 / 60) {
  const m = S.match;
  if (!m) return;
  m.fighters.forEach((f, i) => {
    const r = Math.max(0, f.hp / f.maxHp);
    const fill = $('h' + i);
    fill.style.width = (r * 100).toFixed(1) + '%';
    fill.classList.toggle('low', r < 0.3);
    // barre de dégâts récents qui rattrape avec un délai
    if (force) S.hpTrail[i] = r;
    if (S.hpTrail[i] > r) {
      S.trailDelay[i] += dt;
      if (S.trailDelay[i] > 0.5) S.hpTrail[i] = Math.max(r, S.hpTrail[i] - 0.012);
    } else { S.hpTrail[i] = r; S.trailDelay[i] = 0; }
    $('t' + i).style.width = (S.hpTrail[i] * 100).toFixed(1) + '%';
    $('m' + i).style.width = (f.meter / METER_MAX * 100).toFixed(1) + '%';
    $('mw' + i).classList.toggle('ready', f.meter >= METER_MAX);
    const pips = Array.from({ length: ROUNDS_TO_WIN }, (_, k) => `<i class="${k < f.roundsWon ? 'on' : ''}"></i>`).join('');
    const re = $('r' + i);
    if (re.innerHTML !== pips) re.innerHTML = pips;
    if (S.comboTimer[i] > 0) { S.comboTimer[i] -= dt; if (S.comboTimer[i] <= 0) $('c' + i).classList.remove('show'); }
  });
  const tm = $('timer');
  const tv = String(Math.max(0, m.timer));
  if (tm.textContent !== tv) tm.textContent = tv;
  tm.classList.toggle('urgent', m.timer <= 10);
}

// ───────────────────────────── Menus
function menuAction(act) {
  audio.unlock();
  switch (S.state) {
    case 'title':
      if (act === 'play') { buildSelect(); setState('select'); S.menuIndex = ROSTER.indexOf(S.playerChar); selectChanged(); camRig.mode = 'select'; }
      if (act === 'controls') { S.prevStateForControls = 'title'; setState('controls'); }
      break;
    case 'controls':
      setState(S.prevStateForControls || 'title');
      if (S.state === 'pause') focusMenu();
      break;
    case 'pause':
      if (act === 'resume') { setState('fight'); audio.startMusic(); }
      if (act === 'restart') startMatch();
      if (act === 'select') goSelect();
      if (act === 'sound') {
        const muted = audio.toggleMute();
        document.querySelector('[data-act="sound"]').textContent = `Son : ${muted ? 'coupé' : 'activé'}`;
      }
      if (act === 'controls') { S.prevStateForControls = 'pause'; setState('controls'); }
      break;
    case 'result':
      if (act === 'rematch') startMatchSame();
      if (act === 'select') goSelect();
      if (act === 'title') { disposeFight(); clearPreview(); setState('title'); camRig.mode = 'select'; }
      break;
  }
}

function startMatchSame() {
  const cpu = S.cpuChar;
  startMatch();
  // revanche : même adversaire
  if (S.cpuChar !== cpu) {
    disposeFight();
    S.cpuChar = cpu;
    S.match = new Match(S.playerChar, cpu);
    S.ai = new AIController(S.difficulty, (Math.random() * 1e9) | 0);
    S.views = [new FighterView(S.playerChar, scene), new FighterView(cpu, scene)];
    S.match.fighters.forEach((f, i) => S.views[i].snapPrev(f));
    $('n1').textContent = `${CHARACTERS[cpu].name.toUpperCase()} · IA ${DIFFICULTIES[S.difficulty].label}`;
    updateHUD(true);
  }
}

function goSelect() {
  disposeFight();
  fx.clear();
  audio.stopMusic();
  buildSelect();
  setState('select');
  camRig.mode = 'select';
  S.menuIndex = ROSTER.indexOf(S.playerChar);
  selectChanged();
}

// clics souris
document.querySelectorAll('.opt[data-act]').forEach((el) => el.addEventListener('click', () => menuAction(el.dataset.act)));
document.querySelectorAll('.opt[data-diff]').forEach((el) => el.addEventListener('click', () => { S.difficulty = el.dataset.diff; startMatch(); }));
document.querySelectorAll('.opt').forEach((el) => el.addEventListener('mouseenter', () => {
  const opts = currentOpts(); const i = opts.indexOf(el); if (i >= 0) { S.menuIndex = i; focusMenu(); }
}));

function handleMenuInput(dt) {
  const evs = input.takeMenu();
  if (S.menuLock > 0) { S.menuLock -= dt; return; }
  if (!evs.length) return;
  audio.unlock();
  for (const { a, code } of evs) {
    if (S.state === 'fight') {
      if (a === 'pause' || (a === 'back' && code === 'Escape')) { setState('pause'); audio.stopMusic(); }
      continue;
    }
    const opts = currentOpts();
    const horizontal = S.state === 'select';
    const prev = horizontal ? 'left' : 'up', next = horizontal ? 'right' : 'down';
    if (a === prev || a === next) {
      if (!opts.length) continue;
      S.menuIndex = (S.menuIndex + (a === next ? 1 : -1) + opts.length) % opts.length;
      audio.ui('move');
      if (S.state === 'select') selectChanged(); else focusMenu();
    } else if (a === 'confirm') {
      const el = opts[S.menuIndex];
      if (S.state === 'select') confirmSelect();
      else if (el?.dataset.diff) { S.difficulty = el.dataset.diff; audio.ui('ok'); startMatch(); }
      else if (el) { audio.ui('ok'); menuAction(el.dataset.act); }
    } else if (a === 'back' || a === 'pause') {
      if (S.state === 'select') { clearPreview(); setState('title'); }
      else if (S.state === 'diff') { setState('select'); S.menuIndex = ROSTER.indexOf(S.playerChar); selectChanged(); }
      else if (S.state === 'controls') menuAction('back');
      else if (S.state === 'pause') { setState('fight'); audio.startMusic(); }
    }
  }
}

input.onPadChange = (on, id) => toast(on ? `Manette connectée : ${id.split('(')[0].trim()}` : 'Manette déconnectée');

// ───────────────────────────── Boucle principale
let last = performance.now();
let idleT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) * (window.__speed || 1);
  last = now;
  input.pollMenu();
  handleMenuInput(dt);

  if (S.state === 'fight' && S.match) {
    stepFight(dt);
  } else if (S.match && (S.state === 'pause' || S.state === 'result')) {
    // scène figée (pause) ou célébration (résultat)
    if (S.state === 'result') {
      const m = S.match;
      for (const f of m.fighters) { f.t++; }
      S.views[0].update(m.fighters[0], m.fighters[1], m, dt, 1);
      S.views[1].update(m.fighters[1], m.fighters[0], m, dt, 1);
      camRig.update(dt, m.fighters[0], m.fighters[1]);
    }
  } else {
    // menus : aperçu 3D du combattant sélectionné
    idleT += dt;
    if (S.preview) {
      const p = S.preview;
      p.fake.t++;
      p.fake.state = S.state === 'diff' ? 'win' : 'idle';
      p.view.update(p.fake, p.fake, null, dt, 1);
      p.view.root.rotation.y = -0.85 + Math.sin(idleT * 0.5) * 0.3;
      p.view.root.position.x = window.innerWidth > 800 ? -0.6 : 0;
    }
    camRig.mode = 'select';
    camRig.update(dt, { x: 0, y: 0 }, { x: 0, y: 0 });
  }
  if (window.__dbg) { window.__dbg(camera, S, dt); }
  fx.update(dt);
  arena.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Démarrage
setState('title');
camRig.mode = 'select';
camRig.update(0.016, { x: 0, y: 0 }, { x: 0, y: 0 });
camRig.snap();
requestAnimationFrame((t) => { last = t; $('loading').classList.add('gone'); frame(t); });

// Accès de débogage (tests automatisés)
window.__game = { S, AIController, startMatch, setState, scene, camera, renderer, CHARACTERS, FighterView, THREE };
