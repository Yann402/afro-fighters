// Outils communs aux tests : générateur aléatoire déterministe, entrées, invariants.
import { Match } from '../../src/sim/match.js';
import { STAGE_HALF, METER_MAX } from '../../src/sim/constants.js';

export function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

export const noInput = () => ({ held: {}, pressed: {} });

export function input(heldKeys = [], pressedKeys = []) {
  const held = {}, pressed = {};
  for (const k of heldKeys) held[k] = true;
  for (const k of pressedKeys) { pressed[k] = true; held[k] = true; }
  return { held, pressed };
}

// Joueur « singe » : appuie au hasard, par séquences courtes (plus proche d'un humain qui martèle).
export function monkey(seed, style = 'mixed') {
  const r = rng(seed);
  let held = {}, until = 0, f = 0;
  return () => {
    f++;
    if (f >= until) {
      held = {};
      const d = r();
      if (d < 0.35) held.right = true; else if (d < 0.7) held.left = true;
      if (r() < (style === 'turtle' ? 0.5 : 0.15)) held.guard = true;
      until = f + 2 + Math.floor(r() * 18);
    }
    const pressed = {};
    const p = style === 'masher' ? 0.25 : 0.1;
    if (r() < p) pressed.light = true;
    if (r() < p) pressed.heavy = true;
    if (r() < p * 0.6) pressed.special = true;
    if (r() < p * 0.4) pressed.up = true;
    return { held: { ...held, ...pressed }, pressed };
  };
}

const TERMINAL = new Set(['idle', 'walk', 'guard', 'ko', 'win', 'intro', 'lose']);

// Vérifie les invariants après chaque step. Retourne la liste des violations (chaînes).
export function makeChecker(m) {
  const stuck = [0, 0];
  const last = [null, null];
  return () => {
    const errs = [];
    m.fighters.forEach((f, i) => {
      const o = m.fighters[1 - i];
      const tag = `[frame ${m.frame}] ${f.char.id}(${i}) état=${f.state}`;
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) errs.push(`${tag} position non finie`);
      if (Math.abs(f.x) > STAGE_HALF + 1e-6) errs.push(`${tag} hors arène x=${f.x}`);
      if (f.y < -1e-6) errs.push(`${tag} sous le sol y=${f.y}`);
      if (f.hp < 0 || f.hp > f.maxHp) errs.push(`${tag} PV invalides ${f.hp}`);
      if (f.meter < 0 || f.meter > METER_MAX) errs.push(`${tag} jauge invalide ${f.meter}`);
      if ((f.state === 'attack' || f.state === 'airattack') && !f.move) errs.push(`${tag} attaque sans coup`);
      if (f.state === 'throwing' && !f.throwData) errs.push(`${tag} projection sans données`);
      if (f.state === 'thrown' && o.state !== 'throwing') errs.push(`${tag} projeté mais l'adversaire est « ${o.state} » (blocage définitif)`);
      // détection d'état figé
      const key = f.state + ':' + (f.move ? f.move.id : '');
      if (key === last[i] && !TERMINAL.has(f.state) && m.hitstop === 0) stuck[i]++; else stuck[i] = 0;
      last[i] = key;
      if (stuck[i] === 240) errs.push(`${tag} figé depuis 240 frames`);
    });
    return errs;
  };
}

// Joue un match complet avec deux sources d'entrées. Retourne un bilan.
export function playMatch(a, b, srcA, srcB, { maxFrames = 60 * 60 * 7, check = true, onEvent = null, onFrame = null } = {}) {
  const m = new Match(a, b);
  const checker = check ? makeChecker(m) : null;
  const errors = [];
  let hash = 0;
  while (m.phase !== 'over' && m.frame < maxFrames) {
    m.step([srcA(m.fighters[0], m.fighters[1], m), srcB(m.fighters[1], m.fighters[0], m)]);
    const evs = m.drainEvents();
    if (onEvent) for (const e of evs) onEvent(e, m);
    if (onFrame) onFrame(m);
    if (checker) { const e = checker(); if (e.length && errors.length < 5) errors.push(...e); }
    const [p, q] = m.fighters;
    hash = (Math.imul(hash, 31) + ((p.x * 1000) | 0) + ((q.x * 1000) | 0) * 7 + p.hp * 13 + q.hp * 17) | 0;
  }
  return { m, errors, hash, frames: m.frame, finished: m.phase === 'over', winner: m.result ? m.result.winner : null };
}
