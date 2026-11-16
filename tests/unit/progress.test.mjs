import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progress, MemoryStorage, SAVE_KEY, BACKUP_KEY, SAVE_VERSION, defaultSave, parseSave, xpForLevel, levelForXp, UNLOCKS, OUTFITS } from '../../src/progress.js';

test('première utilisation : sauvegarde neuve, niveau 1, tenues classiques seules', () => {
  const p = new Progress(new MemoryStorage());
  assert.equal(p.status, 'new'); assert.equal(p.level, 1);
  assert.deepEqual(p.data.unlocked.outfits.themba, ['classique']);
});

test('la progression survit à un rechargement (sauvegarde puis restauration)', () => {
  const st = new MemoryStorage();
  const a = new Progress(st);
  a.recordMatch({ char: 'themba', difficulty: 'difficile', result: 'win', perfect: true, seconds: 41.6 });
  a.recordMatch({ char: 'themba', difficulty: 'normal', result: 'loss' });
  a.data.settings.muted = true; a.data.selected.char = 'lekishon'; a.save();
  const b = new Progress(st);
  assert.equal(b.status, 'loaded');
  assert.deepEqual(b.data, a.data);
  assert.equal(b.data.stats.wins, 1); assert.equal(b.data.stats.losses, 1); assert.equal(b.data.stats.perfects, 1);
  assert.equal(b.data.stats.fastestWinSec, 42); assert.equal(b.data.stats.byChar.themba.matches, 2);
  assert.equal(b.data.profile.xp, 160 + 40 + 25);
});

test('expérience et niveaux : seuils croissants, déblocages accordés au bon niveau', () => {
  assert.equal(levelForXp(0), 1); assert.equal(levelForXp(xpForLevel(2) - 1), 1); assert.equal(levelForXp(xpForLevel(2)), 2);
  const p = new Progress(new MemoryStorage());
  const got = [];
  for (let i = 0; i < 60; i++) got.push(...p.recordMatch({ char: 'modou', difficulty: 'difficile', result: 'win' }).unlocks);
  assert.equal(got.length, UNLOCKS.length, 'tous les déblocages doivent être atteints');
  assert.ok(p.data.unlocked.arenas.includes('nuit') && p.data.unlocked.arenas.includes('aube'));
  for (const c of Object.keys(OUTFITS)) assert.equal(p.data.unlocked.outfits[c].length, OUTFITS[c].length);
  assert.equal(new Set(got.map((u) => JSON.stringify(u))).size, got.length, 'aucun déblocage accordé deux fois');
});

test('série de victoires : bonus plafonné, remise à zéro sur défaite', () => {
  const p = new Progress(new MemoryStorage());
  const xs = []; for (let i = 0; i < 8; i++) xs.push(p.recordMatch({ char: 'modou', difficulty: 'facile', result: 'win' }).xp);
  assert.deepEqual(xs, [60, 70, 80, 90, 100, 110, 110, 110]);
  p.recordMatch({ char: 'modou', difficulty: 'facile', result: 'loss' });
  assert.equal(p.data.stats.streak, 0); assert.equal(p.data.stats.bestStreak, 8);
});

test('sauvegarde illisible : la copie de secours est restaurée', () => {
  const st = new MemoryStorage();
  const a = new Progress(st);
  a.recordMatch({ char: 'modou', difficulty: 'normal', result: 'win' });
  a.recordMatch({ char: 'modou', difficulty: 'normal', result: 'win' });   // la 1re sauvegarde devient la copie de secours
  st.setItem(SAVE_KEY, '{"version":2,"profile":{"xp":12');                 // fichier tronqué
  const b = new Progress(st);
  assert.equal(b.status, 'recovered');
  assert.equal(b.data.stats.wins, 1);
  assert.equal(new Progress(st).status, 'loaded', 'la sauvegarde principale doit être réparée');
});

test('sauvegarde et copie de secours illisibles : remise à neuf sans plantage', () => {
  const st = new MemoryStorage();
  st.setItem(SAVE_KEY, 'pas du json'); st.setItem(BACKUP_KEY, '[1,2');
  const p = new Progress(st);
  assert.equal(p.status, 'reset'); assert.deepEqual(p.data, defaultSave());
});

test('mise à niveau depuis la version 1', () => {
  const st = new MemoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ version: 1, wins: 7, losses: 3, xp: 500 }));
  const p = new Progress(st);
  assert.equal(p.status, 'migrated');
  assert.equal(p.data.version, SAVE_VERSION); assert.equal(p.data.stats.wins, 7); assert.equal(p.data.profile.xp, 500);
  assert.equal(p.level, levelForXp(500));
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).version, SAVE_VERSION, 'la sauvegarde mise à niveau doit être réécrite');
});

test('valeurs invalides réparées, déblocages falsifiés ignorés', () => {
  const s = defaultSave();
  s.profile.xp = -50; s.stats.wins = 'beaucoup'; s.unlocked.outfits.modou = ['classique', 'or', 'nuit']; s.unlocked.arenas.push('aube');
  s.selected.outfits.modou = 'nuit'; s.selected.arena = 'aube'; s.settings.quality = 'ultra'; delete s.stats.byChar.themba;
  const r = parseSave(JSON.stringify(s));
  assert.equal(r.profile.xp, 0); assert.equal(r.stats.wins, 0);
  assert.deepEqual(r.unlocked.outfits.modou, ['classique']); assert.deepEqual(r.unlocked.arenas, ['crepuscule']);
  assert.equal(r.selected.outfits.modou, 'classique'); assert.equal(r.selected.arena, 'crepuscule'); assert.equal(r.settings.quality, 'auto');
  assert.deepEqual(r.stats.byChar.themba, { matches: 0, wins: 0, losses: 0 });
});

test('sauvegarde d\'une version future refusée ; export puis import à l\'identique', () => {
  assert.throws(() => parseSave(JSON.stringify({ version: SAVE_VERSION + 1 })));
  const a = new Progress(new MemoryStorage());
  for (let i = 0; i < 9; i++) a.recordMatch({ char: 'lekishon', difficulty: 'normal', result: 'win' });
  const b = new Progress(new MemoryStorage());
  b.import(a.export());
  assert.deepEqual(b.data, a.data);
  assert.throws(() => b.import('{"n\'importe":"quoi"}'));
  assert.deepEqual(b.data, a.data, 'un import refusé ne doit rien modifier');
});

test('stockage indisponible (navigation privée, quota) : le jeu continue sans sauvegarder', () => {
  const broken = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('refusé'); }, removeItem() {} };
  const p = new Progress(broken);
  assert.equal(p.status, 'new');
  assert.equal(p.save(), false);
  assert.equal(p.recordMatch({ char: 'modou', difficulty: 'normal', result: 'win' }).xp, 100);
});
