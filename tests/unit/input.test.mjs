import { test } from 'node:test';
import assert from 'node:assert/strict';

// Le module d'entrées s'attend à un navigateur : on fournit le minimum avant de l'importer.
globalThis.window = { addEventListener() {} };
// navigator existe déjà dans Node et n'est accessible qu'en lecture : on le complète sans le remplacer.
if (!globalThis.navigator) globalThis.navigator = {};
const { Input, DEFAULT_BINDINGS, ACTIONS } = await import('../../src/input.js');

const INJECTION = ['<img src=x onerror="alert(1)">', 'KeyZ"><script>alert(1)</script>', "'; drop", 'Key A', 'é', '', 'A'.repeat(50)];

test('sécurité : des codes de touche fabriqués sont écartés (injection par sauvegarde importée)', () => {
  const i = new Input();
  i.setBindings({ solo: { light: INJECTION, heavy: ['KeyZ'], up: [...INJECTION, 'KeyM'] } });
  // le coup léger n'avait que des codes invalides : la valeur par défaut est conservée
  assert.deepEqual(i.bindings.solo.light, DEFAULT_BINDINGS.solo.light);
  // un code valide au milieu de codes invalides est gardé, les autres non
  assert.deepEqual(i.bindings.solo.up, ['KeyM']);
  assert.deepEqual(i.bindings.solo.heavy, ['KeyZ']);
  for (const slot of ['solo', 'p1', 'p2']) for (const a of ACTIONS) {
    for (const c of i.bindings[slot][a]) assert.match(c, /^[A-Za-z0-9]{1,24}$/, `${slot}.${a} = ${c}`);
  }
});

test('sécurité : aucun libellé de touche affiché ne contient de caractère de balisage', () => {
  const i = new Input();
  i.setBindings({ solo: { light: INJECTION } });
  for (const slot of ['solo', 'p1', 'p2']) for (const a of ACTIONS) {
    assert.doesNotMatch(i.label(slot, a), /[<>]/, `${slot}.${a}`);
  }
});

test('sécurité : rebind refuse un code non conforme et ne modifie rien', () => {
  const i = new Input();
  const before = JSON.parse(JSON.stringify(i.bindings));
  i.rebind('solo', 'light', '<script>');
  assert.deepEqual(i.bindings, before);
  i.rebind('solo', 'light', 'KeyB');
  assert.deepEqual(i.bindings.solo.light, ['KeyB']);
});

test('une touche attribuée à une action est retirée des autres actions du même jeu de commandes', () => {
  const i = new Input();
  i.rebind('solo', 'heavy', 'KeyJ');            // KeyJ servait au coup léger
  assert.deepEqual(i.bindings.solo.heavy, ['KeyJ']);
  assert.ok(!i.bindings.solo.light.includes('KeyJ'));
});

test('les commandes par défaut ne partagent aucune touche entre joueur 1 et joueur 2', () => {
  const p1 = new Set(ACTIONS.flatMap((a) => DEFAULT_BINDINGS.p1[a]));
  const p2 = new Set(ACTIONS.flatMap((a) => DEFAULT_BINDINGS.p2[a]));
  for (const c of p1) assert.ok(!p2.has(c), `touche ${c} partagée entre les deux joueurs`);
});
