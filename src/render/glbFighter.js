import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../../vendor/jsm/utils/SkeletonUtils.js';
import { applyStylized } from './stylized.js';

// Combattants modélisés (fichiers GLB produits par tools/art/). Un combattant sans fichier GLB
// garde son ancien modèle construit par le code : le jeu fonctionne dans les deux cas.
export const MODELS = {
  modou: { url: 'assets/models/modou.glb', scale: 1.0 },
  themba: { url: 'assets/models/themba.glb', scale: 1.0 },
  lekishon: { url: 'assets/models/lekishon.glb', scale: 1.05 },   // plus grand et plus élancé
};

// Les modèles sont au repos bras écartés (pose en A) ; les poses du jeu sont définies bras le long du corps.
const ARM_ANGLE = THREE.MathUtils.degToRad(35);
const cache = new Map();      // id -> gltf chargé (géométries et textures partagées entre les instances)

export function preloadModels(ids = Object.keys(MODELS)) {
  const loader = new GLTFLoader();
  return Promise.all(ids.filter((id) => MODELS[id] && !cache.has(id)).map((id) =>
    loader.loadAsync(MODELS[id].url).then((g) => { cache.set(id, g); }).catch((e) => { console.warn(`Modèle ${id} indisponible, modèle de secours utilisé :`, e.message || e); })));
}
export const hasModel = (id) => cache.has(id);

const E = new THREE.Euler();
const q1 = new THREE.Quaternion(), qShield = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, -0.35, 0));
const v1 = new THREE.Vector3();

// Os pilotés : nom de l'os, parent logique, et compensation de la pose de repos
const DRIVEN = [
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['head', 'chest'],
  ['upperArmR', 'chest'], ['forearmR', 'upperArmR'], ['handR', 'forearmR'],
  ['upperArmL', 'chest'], ['forearmL', 'upperArmL'], ['handL', 'forearmL'],
  ['thighR', 'hips'], ['shinR', 'thighR'], ['footR', 'shinR'],
  ['thighL', 'hips'], ['shinL', 'thighL'], ['footL', 'shinL'],
];

export class GlbRig {
  constructor(id) {
    const gltf = cache.get(id);
    this.root = cloneSkinned(gltf.scene);
    this.scale = MODELS[id].scale || 1;
    const { materials } = applyStylized(this.root);
    this.materials = materials;                 // propres à cette instance : libérés par dispose()
    this.accents = [];
    this.build = { thigh: 0.49, shin: 0.46 };   // utilisé par les poses au sol
    this.bones = {};
    this.root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.root.updateMatrixWorld(true);
    // orientation de repos de chaque os (et de son parent réel) dans le repère du modèle
    this.rest = {};
    for (const [name] of DRIVEN) {
      const b = this.bones[name];
      if (!b) throw new Error(`os manquant dans le modèle ${id} : ${name}`);
      this.rest[name] = { w: b.getWorldQuaternion(new THREE.Quaternion()), pInv: b.parent.getWorldQuaternion(new THREE.Quaternion()).invert() };
    }
    this.hipsRest = this.bones.hips.position.clone();
    this.hipsParentInv = this.rest.hips.pInv.clone();
    this.C = Object.fromEntries(DRIVEN.map(([n]) => [n, new THREE.Quaternion()]));   // rotations cumulées, repère du modèle
    this.shield = this.root.getObjectByName('shield') || null;
    if (this.shield) this.shieldRest = this.shield.getWorldQuaternion(new THREE.Quaternion());
    this.skeletons = new Set();
    this.root.traverse((o) => { if (o.isSkinnedMesh) this.skeletons.add(o.skeleton); });
    this.offL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ARM_ANGLE);
    this.offR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ARM_ANGLE);
  }

  // Applique à l'os une rotation exprimée dans le repère du modèle (x, y, z en radians, ordre XYZ),
  // comme le faisait l'ancien squelette dont tous les axes étaient alignés au repos.
  set(name, parent, x, y, z, offset = null) {
    q1.setFromEuler(E.set(x, y, z, 'XYZ'));
    if (offset) q1.multiply(offset);
    const C = this.C[name];
    if (parent) C.copy(this.C[parent]).multiply(q1); else C.copy(q1);
    // local = (repos du parent réel)^-1 · rotation voulue · repos de l'os.
    // Valable quand le parent réel est le parent logique ou un os intermédiaire laissé au repos.
    const r = this.rest[name];
    this.bones[name].quaternion.copy(r.pInv).multiply(q1).multiply(r.w);
  }

  applyPose(p, extraFall = 0) {
    v1.set(0, p.rootY, 0).applyQuaternion(this.hipsParentInv);
    this.bones.hips.position.copy(this.hipsRest).add(v1);
    const lie = p.fall < -0.5 ? 0.6 : 0;
    this.set('hips', null, p.fall + extraFall, p.turn, 0);
    this.set('spine', 'hips', p.lean * 0.5, p.twist * 0.5, p.side * 0.5);
    this.set('chest', 'spine', p.lean * 0.5, p.twist * 0.5, p.side * 0.5);
    this.set('head', 'chest', p.head, 0, 0);
    this.set('upperArmR', 'chest', -p.rShF, 0, -p.rShA, this.offR);
    this.set('upperArmL', 'chest', -p.lShF, 0, p.lShA, this.offL);
    this.set('forearmR', 'upperArmR', -p.rEl, 0, 0);
    this.set('forearmL', 'upperArmL', -p.lEl, 0, 0);
    this.set('handR', 'forearmR', p.rW, 0, 0);
    this.set('handL', 'forearmL', p.lW, 0, 0);
    this.set('thighR', 'hips', -p.rHip, 0, -p.spread);
    this.set('thighL', 'hips', -p.lHip, 0, p.spread);
    this.set('shinR', 'thighR', p.rKnee, 0, 0);
    this.set('shinL', 'thighL', p.lKnee, 0, 0);
    this.set('footR', 'shinR', p.rHip - p.rKnee + lie, 0, 0);
    this.set('footL', 'shinL', p.lHip - p.lKnee + lie, 0, 0);
    if (this.shield) {
      // le bouclier reste tourné vers l'adversaire quel que soit l'angle du bras
      q1.copy(this.C.forearmL).multiply(this.rest.forearmL.w).invert();     // inverse de l'orientation réelle de l'avant-bras
      this.shield.quaternion.copy(q1).multiply(this.C.spine).multiply(qShield).multiply(this.shieldRest);
    }
  }

  // Copie figée dans la pose courante (images rémanentes des pouvoirs spéciaux).
  snapshot() {
    this.root.updateMatrixWorld(true);
    return cloneSkinned(this.root);
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    for (const s of this.skeletons) s.dispose();
    this.materials.length = 0;
  }
}
