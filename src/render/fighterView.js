import * as THREE from 'three';
import { buildFighter } from './rig.js';
import { KEYS, ZERO, targetPose, smoothingRate } from './poses.js';

const YAW = Math.PI / 2 - 0.5; // vue de 3/4 vers la caméra
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();

export class FighterView {
  constructor(charId, scene) {
    this.charId = charId;
    const rig = buildFighter(charId);
    this.rig = rig;
    this.root = new THREE.Group();
    this.root.add(rig.root);
    scene.add(this.root);
    this.pose = { ...ZERO, ...targetPose({ char: { id: charId }, state: 'intro', t: 0 }, { time: 0, build: rig.build }) };
    this.time = 0;
    this.walkPhase = 0;
    this.build = rig.build;
    this.prevX = 0; this.prevY = 0;
    this.flash = 0;
    this.glow = 0;
    this.yaw = YAW;
    this.mirror = 1;
    this.initMirror = true;
    this.ghosts = null;
    this.hipBase = rig.J.hips.position.y;
    // contour léger (silhouette) pour lisibilité
    this.materials = [];
    rig.root.traverse((o) => { if (o.isMesh && !this.materials.includes(o.material)) this.materials.push(o.material); });
  }

  dispose(scene) {
    scene.remove(this.root);
    if (this.ghosts) for (const g of this.ghosts) scene.remove(g.root);
  }

  snapPrev(f) { this.prevX = f.x; this.prevY = f.y; }

  update(f, opp, match, dt, alpha) {
    this.time += dt;
    // position interpolée entre deux frames logiques
    let x = this.prevX + (f.x - this.prevX) * alpha;
    let y = this.prevY + (f.y - this.prevY) * alpha;

    // projection : l'adversaire décrit un arc au-dessus du lanceur
    let extraFall = 0;
    if (f.state === 'thrown' && opp.throwData) {
      const anim = opp.throwData.anim;
      const p = Math.min(1, f.t / anim.slamAt);
      const big = anim.fx === 'bigSlam';
      y += Math.sin(p * Math.PI) * (big ? 1.2 : 0.9);
      x = opp.x + opp.facing * (0.7 - Math.sin(p * Math.PI) * (big ? 0.6 : 0.4));
      extraFall = -p * (big ? 2.8 : 1.4);
    }

    if (f.state === 'walk') this.walkPhase += dt * (f.char.id === 'lekishon' ? 11 : 9) * (f.walkDir || 1);

    // pose cible + lissage exponentiel → transitions fluides
    const target = targetPose(f, this, match);
    const k = 1 - Math.exp(-smoothingRate(f) * dt);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;

    // orientation : miroir selon le côté, rotation de 3/4
    // demi-tour animé (bascule rapide plutôt qu'un retournement instantané)
    const wantMirror = f.facing >= 0 ? 1 : -1;
    if (this.initMirror) { this.mirror = wantMirror; this.initMirror = false; }
    this.mirror += (wantMirror - this.mirror) * Math.min(1, dt * 22);
    if (Math.abs(wantMirror - this.mirror) < 0.02) this.mirror = wantMirror;
    const sx = Math.sign(this.mirror) * Math.max(0.08, Math.abs(this.mirror));
    this.root.position.set(x, y, 0);
    this.rig.root.scale.x = sx;
    this.rig.root.rotation.y = Math.sign(this.mirror || 1) * YAW;

    const J = this.rig.J;
    J.hips.position.y = this.hipBase + p.rootY;
    J.hips.rotation.set(p.fall + extraFall, p.turn, 0);
    J.spine.rotation.set(p.lean, p.twist, p.side);
    J.head.rotation.set(p.head, 0, 0);
    J.shR.rotation.set(-p.rShF, 0, -p.rShA);
    J.shL.rotation.set(-p.lShF, 0, p.lShA);
    J.elR.rotation.set(-p.rEl, 0, 0);
    J.elL.rotation.set(-p.lEl, 0, 0);
    J.handR.rotation.set(p.rW, 0, 0);
    J.handL.rotation.set(p.lW, 0, 0);
    J.hipR.rotation.set(-p.rHip, 0, -p.spread);
    J.hipL.rotation.set(-p.lHip, 0, p.spread);
    J.kneeR.rotation.set(p.rKnee, 0, 0);
    J.kneeL.rotation.set(p.lKnee, 0, 0);
    J.footR.rotation.set(p.rHip - p.rKnee + (p.fall < -0.5 ? 0.6 : 0), 0, 0);
    J.footL.rotation.set(p.lHip - p.lKnee + (p.fall < -0.5 ? 0.6 : 0), 0, 0);

    // le bouclier zoulou reste orienté vers l'avant quel que soit l'angle du bras
    const shield = this.rig.weapons.shield;
    if (shield) {
      qA.copy(J.shL.quaternion).multiply(J.elL.quaternion).invert();
      qB.setFromEuler(new THREE.Euler(0.15, -0.35, 0));
      shield.quaternion.copy(qA).multiply(qB);
    }

    // éclat lors d'un coup reçu / aura du spécial
    this.flash = Math.max(0, this.flash - dt * 6);
    const special = f.state === 'attack' && f.move?.special;
    this.glow += ((special ? 1 : f.meter >= 100 ? 0.35 : 0) - this.glow) * Math.min(1, dt * 8);
    const pulse = f.meter >= 100 && !special ? (Math.sin(this.time * 6) * 0.5 + 0.5) * 0.35 : 0;
    for (const m of this.materials) {
      if (!m.emissive) continue;
      const e = this.flash * 0.45;
      const gl = Math.max(this.glow * 0.06, pulse * 0.1);
      m.emissive.setRGB(e + gl * 1.0, e + gl * 0.6, e + gl * 0.15);
    }
    for (const m of this.rig.accents) if (m.emissive) m.emissive.setRGB(0.4 * this.glow + this.flash, 0.25 * this.glow + this.flash, 0.05 * this.glow + this.flash);
  }

  // Positions monde utiles aux effets (pointe d'arme, mains)
  worldPoint(name, out = new THREE.Vector3()) {
    const J = this.rig.J;
    const obj = name === 'blade' ? this.rig.weapons.spearBlade || J.handR : J[name] || J.spine;
    return obj.getWorldPosition(out);
  }
}
