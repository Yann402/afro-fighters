import * as THREE from 'three';
import { shukaTex, ngembTex, cowhideTex, leopardTex } from './textures.js';

// Construction des combattants low-poly : squelette articulé + tenue propre à chaque culture.
// Le modèle regarde vers +Z, Y vers le haut ; la droite du personnage est en -X.

const texCache = {};
const tex = (name, fn) => (texCache[name] ||= fn());

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.0, ...opts });
}

// Segment cylindrique dont le haut est sur le pivot et qui descend de L
function limb(r1, r2, L, m, seg = 7) {
  const g = new THREE.CylinderGeometry(r1, r2, L, seg, 1);
  g.translate(0, -L / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function ball(r, m, detail = 1) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m);
  mesh.castShadow = true;
  return mesh;
}

function joint(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

// Proportions par personnage
const BUILDS = {
  modou: { thigh: 0.46, shin: 0.45, pelvisW: 0.2, torso: 0.56, chestW: 0.29, chestD: 0.2, shoulderW: 0.31, ua: 0.31, fa: 0.29, armR: 0.085, legR: 0.105, head: 0.125, neck: 0.08 },
  themba: { thigh: 0.47, shin: 0.47, pelvisW: 0.16, torso: 0.53, chestW: 0.24, chestD: 0.16, shoulderW: 0.26, ua: 0.31, fa: 0.29, armR: 0.065, legR: 0.08, head: 0.115, neck: 0.08 },
  lekishon: { thigh: 0.51, shin: 0.52, pelvisW: 0.14, torso: 0.55, chestW: 0.2, chestD: 0.14, shoulderW: 0.23, ua: 0.33, fa: 0.31, armR: 0.055, legR: 0.065, head: 0.11, neck: 0.1 },
};

const SKIN = { modou: '#4e2f1f', themba: '#4a2b1b', lekishon: '#5a3220' };

export function buildFighter(id) {
  const B = BUILDS[id];
  const skin = mat(SKIN[id], { roughness: 0.6 });
  const root = new THREE.Group();
  const J = {};

  // Bassin
  J.hips = joint(root, 0, B.thigh + B.shin + 0.05, 0);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(B.pelvisW + 0.02, B.pelvisW, 0.2, 7), skin);
  pelvis.position.y = -0.04; pelvis.scale.z = 0.75; pelvis.castShadow = true;
  J.hips.add(pelvis);

  // Colonne / torse
  J.spine = joint(J.hips, 0, 0.04, 0);
  const torsoG = new THREE.CylinderGeometry(B.chestW, B.pelvisW + 0.01, B.torso, 7, 2);
  torsoG.translate(0, B.torso / 2, 0);
  const torso = new THREE.Mesh(torsoG, skin);
  torso.scale.z = B.chestD / B.chestW;
  torso.castShadow = true;
  J.spine.add(torso);
  // pectoraux / épaules pour une silhouette moins tubulaire
  const chest = ball(B.chestW * 0.95, skin, 1);
  chest.scale.set(1.15, 0.62, (B.chestD / B.chestW) * 1.05);
  chest.position.set(0, B.torso * 0.78, 0.02);
  J.spine.add(chest);

  J.neck = joint(J.spine, 0, B.torso, 0);
  const nk = limb(0.065, 0.055, B.neck, skin, 6); nk.rotation.x = Math.PI; J.neck.add(nk); // vers le haut
  J.head = joint(J.neck, 0, B.neck + B.head * 0.85, 0.01);
  const head = ball(B.head, skin, 1);
  head.scale.set(0.9, 1.1, 1.0);
  J.head.add(head);
  // mâchoire / visage stylisé
  const jaw = box(B.head * 1.1, B.head * 0.6, B.head * 1.0, skin, 0, -B.head * 0.5, 0.02);
  J.head.add(jaw);
  const eyeM = mat('#f4efe6', { roughness: 0.3 });
  const pupilM = mat('#120c08');
  for (const s of [-1, 1]) {
    const e = box(0.032, 0.016, 0.01, eyeM, s * 0.042, 0.015, B.head * 0.93);
    J.head.add(e);
    J.head.add(box(0.014, 0.014, 0.01, pupilM, s * 0.042, 0.015, B.head * 0.95));
    const brow = box(0.045, 0.012, 0.02, mat('#1a0f09'), s * 0.042, 0.045, B.head * 0.9);
    brow.rotation.z = s * -0.15; J.head.add(brow);
  }
  J.head.add(box(0.03, 0.045, 0.035, skin, 0, -0.02, B.head * 0.98)); // nez

  // Bras (droit = -X)
  for (const [side, sx] of [['R', -1], ['L', 1]]) {
    const sh = joint(J.spine, sx * B.shoulderW, B.torso - 0.06, 0);
    J['sh' + side] = sh;
    const delt = ball(B.armR * 1.45, skin, 0); delt.scale.set(1, 0.9, 1); sh.add(delt);
    sh.add(limb(B.armR * 1.15, B.armR * 0.9, B.ua, skin));
    const el = joint(sh, 0, -B.ua, 0);
    J['el' + side] = el;
    el.add(limb(B.armR * 0.95, B.armR * 0.75, B.fa, skin));
    const hand = joint(el, 0, -B.fa, 0);
    J['hand' + side] = hand;
    const fist = box(B.armR * 1.6, B.armR * 1.9, B.armR * 1.7, skin, 0, -B.armR * 0.8, 0.01);
    hand.add(fist);
    J['grip' + side] = joint(hand, 0, -B.armR * 0.85, 0.0);
  }

  // Jambes
  for (const [side, sx] of [['R', -1], ['L', 1]]) {
    const hip = joint(J.hips, sx * B.pelvisW * 0.6, -0.06, 0);
    J['hip' + side] = hip;
    hip.add(limb(B.legR * 1.3, B.legR, B.thigh, skin));
    const knee = joint(hip, 0, -B.thigh, 0);
    J['knee' + side] = knee;
    knee.add(limb(B.legR * 0.95, B.legR * 0.7, B.shin, skin));
    const foot = joint(knee, 0, -B.shin, 0);
    J['foot' + side] = foot;
    const f = box(B.legR * 1.5, 0.06, 0.24, skin, 0, -0.03, 0.06);
    foot.add(f);
  }

  const weapons = {};
  const accents = []; // matériaux à faire briller pendant le spécial
  OUTFITS[id](J, B, weapons, accents);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return { root, J, weapons, accents, build: B };
}

// ───────────────────────────────────────────── Tenues
const OUTFITS = {
  // Lutteur sénégalais : ngemb noué, gris-gris aux bras et à la taille, cordons
  modou(J, B, W, accents) {
    const cloth = mat('#ffffff', { map: tex('ngemb', ngembTex), roughness: 0.9 });
    const leather = mat('#5a3214', { roughness: 0.8 });
    const red = mat('#a8241b');
    const cowrie = mat('#f1ead8', { roughness: 0.4 });

    // ngemb : bande enroulée + pans avant/arrière noués
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(B.pelvisW + 0.06, B.pelvisW + 0.08, 0.26, 8, 1, true), cloth);
    wrap.material.side = THREE.DoubleSide;
    wrap.position.y = -0.07; wrap.scale.z = 0.8; J.hips.add(wrap);
    const flapF = box(0.2, 0.3, 0.03, cloth, 0, -0.27, 0.15); flapF.rotation.x = 0.12; J.hips.add(flapF);
    const flapB = box(0.24, 0.42, 0.03, cloth, 0, -0.3, -0.16); flapB.rotation.x = -0.15; J.hips.add(flapB);
    const knot = ball(0.06, cloth, 0); knot.position.set(0.12, 0.02, 0.13); J.hips.add(knot);
    for (const s of [-1, 1]) {
      const tail = box(0.05, 0.3, 0.02, cloth, 0.12 + s * 0.03, -0.12, 0.15); tail.rotation.z = s * 0.25; J.hips.add(tail);
    }

    // ceinture de gris-gris
    const belt = new THREE.Mesh(new THREE.TorusGeometry(B.pelvisW + 0.085, 0.022, 5, 14), leather);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.06; belt.scale.y = 0.8; J.hips.add(belt);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = B.pelvisW + 0.1;
      const p = box(0.06, 0.08, 0.035, i % 3 === 0 ? red : leather, Math.cos(a) * r, 0.02, Math.sin(a) * r * 0.8);
      p.rotation.y = -a; J.hips.add(p);
    }

    // gris-gris aux bras (biceps) et aux avant-bras
    for (const side of ['R', 'L']) {
      const sh = J['sh' + side];
      const band = new THREE.Mesh(new THREE.TorusGeometry(B.armR * 1.15, 0.018, 4, 10), leather);
      band.rotation.x = Math.PI / 2; band.position.y = -B.ua * 0.35; sh.add(band);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.6;
        const p = box(0.05, 0.065, 0.035, i === 1 ? red : leather, Math.cos(a) * B.armR * 1.25, -B.ua * 0.42, Math.sin(a) * B.armR * 1.25);
        p.rotation.y = -a; sh.add(p);
      }
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(B.armR * 0.85, 0.02, 4, 10), cowrie);
      cuff.rotation.x = Math.PI / 2; cuff.position.y = -B.fa * 0.8; J['el' + side].add(cuff);
      // chevillère
      const ank = new THREE.Mesh(new THREE.TorusGeometry(B.legR * 0.8, 0.02, 4, 10), cowrie);
      ank.rotation.x = Math.PI / 2; ank.position.y = -B.shin * 0.88; J['knee' + side].add(ank);
    }

    // cordons croisés sur le torse avec amulettes
    for (const s of [-1, 1]) {
      const cord = box(0.02, B.torso * 0.95, 0.02, leather, s * 0.02, B.torso * 0.5, B.chestD + 0.012);
      cord.rotation.z = s * 0.55; J.spine.add(cord);
    }
    const amulet = box(0.07, 0.09, 0.04, red, 0, B.torso * 0.62, B.chestD + 0.03); J.spine.add(amulet);
    accents.push(amulet.material);
    // corne-amulette sur l'épaule
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 5), cowrie);
    horn.position.set(-0.06, B.torso * 0.6, B.chestD + 0.03); horn.rotation.z = 2.4; J.spine.add(horn);

    // bandeau de tête blanc
    const hb = new THREE.Mesh(new THREE.TorusGeometry(B.head * 0.92, 0.022, 4, 12), cowrie);
    hb.rotation.x = Math.PI / 2 - 0.15; hb.position.y = 0.04; J.head.add(hb);
    // barbe courte
    J.head.add(box(B.head * 1.05, 0.05, 0.06, mat('#120a06'), 0, -B.head * 0.78, B.head * 0.55));
    // crâne rasé : léger reflet
    J.head.children[0].material = mat(SKIN.modou, { roughness: 0.35 });
  },

  // Guerrier zoulou : isihlangu, iklwa, umqhele en léopard, amashoba (queues de vache), plumes
  themba(J, B, W, accents) {
    const fur = mat('#ffffff', { map: tex('leopard', leopardTex), roughness: 0.95 });
    const hide = mat('#ffffff', { map: tex('cowhide', cowhideTex), roughness: 0.85, side: THREE.DoubleSide });
    const white = mat('#f3efe6', { roughness: 0.95 });
    const brown = mat('#6b3a1e', { roughness: 0.9 });
    const wood = mat('#4a2e17');
    const steel = mat('#c9ccd1', { metalness: 0.7, roughness: 0.3 });
    const black = mat('#1a1410');

    // umqhele : bandeau de fourrure
    const band = new THREE.Mesh(new THREE.TorusGeometry(B.head * 0.98, 0.04, 5, 12), fur);
    band.rotation.x = Math.PI / 2 - 0.1; band.position.y = 0.035; J.head.add(band);
    // plumes noires et blanches à l'arrière
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.32, 4), i % 2 ? white : black);
      f.position.set((i - 2) * 0.03, 0.2, -0.06);
      f.rotation.x = -0.45; f.rotation.z = (i - 2) * 0.18;
      J.head.add(f);
    }
    // amashoba : franges blanches aux bras et sous les genoux
    const fringe = (parent, y, r, n, len) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.022, len, 4), white);
        t.position.set(Math.cos(a) * r, y - len / 2, Math.sin(a) * r);
        t.rotation.x = Math.PI + Math.sin(a) * 0.25; t.rotation.z = Math.cos(a) * 0.25;
        parent.add(t);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 4, 10), brown);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; parent.add(ring);
    };
    fringe(J.shR, -0.06, B.armR * 1.3, 9, 0.2);
    fringe(J.shL, -0.06, B.armR * 1.3, 9, 0.2);
    fringe(J.kneeR, -0.03, B.legR * 1.1, 9, 0.24);
    fringe(J.kneeL, -0.03, B.legR * 1.1, 9, 0.24);

    // isinene (avant, lanières de fourrure) et ibheshu (arrière, peau de vache)
    const belt = new THREE.Mesh(new THREE.TorusGeometry(B.pelvisW + 0.03, 0.025, 4, 12), brown);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.03; belt.scale.y = 0.75; J.hips.add(belt);
    for (let i = 0; i < 7; i++) {
      const s = box(0.035, 0.32, 0.015, i % 2 ? fur : brown, (i - 3) * 0.035, -0.13, 0.13);
      s.rotation.x = 0.08; J.hips.add(s);
    }
    const back = box(0.34, 0.5, 0.02, hide, 0, -0.2, -0.14); back.rotation.x = -0.12; J.hips.add(back);
    // collier de fourrure sur les épaules
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(B.chestW * 0.75, B.chestW * 1.05, 0.12, 8, 1, true), fur);
    cape.position.y = B.torso - 0.05; cape.scale.z = 0.75; J.spine.add(cape);

    // Isihlangu : grand bouclier ovale (bras gauche)
    const shield = new THREE.Group();
    const sg = new THREE.CylinderGeometry(0.5, 0.5, 0.025, 14, 1);
    const shieldMesh = new THREE.Mesh(sg, hide);
    shieldMesh.rotation.x = Math.PI / 2;
    shieldMesh.scale.set(0.55, 1, 1.25);
    shield.add(shieldMesh);
    const stick = limb(0.012, 0.012, 1.6, wood, 5); stick.position.y = 0.8; shield.add(stick);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.15, 5), fur); tuft.position.y = 0.88; shield.add(tuft);
    shield.position.set(0.04, -0.12, 0.12);
    J.elL.add(shield);
    W.shield = shield;
    accents.push(tuft.material);

    // Iklwa : lance courte à large lame
    const spear = new THREE.Group();
    spear.add(limb(0.016, 0.018, 0.85, wood, 5));
    spear.children[0].position.y = 0.3;
    const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), steel);
    blade.scale.set(0.45, 2.1, 0.12); blade.position.y = 0.48; spear.add(blade);
    const bind = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 5), brown); bind.position.y = 0.28; spear.add(bind);
    spear.rotation.x = Math.PI / 2;
    J.gripR.add(spear);
    W.spear = spear;
    W.spearBlade = blade;
  },

  // Guerrier maasaï : shuka rouge, collier de perles plat, tresses ocre, longue lance, rungu
  lekishon(J, B, W, accents) {
    const shuka = mat('#ffffff', { map: tex('shuka', shukaTex), roughness: 0.9, side: THREE.DoubleSide });
    const ochre = mat('#a8452a', { roughness: 0.9 });
    const wood = mat('#3c2412');
    const steel = mat('#d2d4d8', { metalness: 0.75, roughness: 0.28 });
    const beads = ['#f2efe8', '#c0392b', '#1f5fae', '#f0a521', '#2e8b57', '#f2efe8'].map((c) => mat(c, { roughness: 0.35 }));

    // Shuka : jupe longue + drapé en diagonale sur l'épaule
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(B.pelvisW + 0.05, B.pelvisW + 0.16, 0.62, 9, 1, true), shuka);
    skirt.position.y = -0.33; skirt.scale.z = 0.85; J.hips.add(skirt);
    const wrapTop = new THREE.Mesh(new THREE.CylinderGeometry(B.chestW * 1.03, B.pelvisW + 0.05, B.torso * 0.62, 8, 1, true), shuka);
    wrapTop.position.y = B.torso * 0.3; wrapTop.scale.z = B.chestD / B.chestW + 0.12; J.spine.add(wrapTop);
    const sash = box(0.12, B.torso * 1.15, 0.03, shuka, 0.02, B.torso * 0.58, 0);
    sash.rotation.z = -0.62; sash.scale.z = 1;
    const sashF = sash.clone(); sashF.position.z = B.chestD + 0.02; J.spine.add(sashF);
    const sashB = sash.clone(); sashB.position.z = -B.chestD - 0.02; J.spine.add(sashB);
    // pan qui flotte sur l'épaule gauche
    const knot = ball(0.055, shuka, 0); knot.position.set(B.shoulderW * 0.7, B.torso - 0.02, 0.0); J.spine.add(knot);
    const drape = box(0.16, 0.42, 0.02, shuka, 0, -0.2, -0.06); drape.rotation.x = -0.15;
    J.shL.add(drape);

    // Collier de perles plat (anneaux concentriques)
    for (let i = 0; i < 5; i++) {
      const r = B.neck * 0.7 + 0.035 + i * 0.026;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 4, 18), beads[i]);
      ring.rotation.x = Math.PI / 2 + 0.25; ring.position.set(0, B.torso + 0.01 - i * 0.012, 0.015);
      ring.scale.y = 0.92;
      J.spine.add(ring);
      if (i === 2) accents.push(beads[i]);
    }
    // Bandeau perlé et boucles
    const hb = new THREE.Mesh(new THREE.TorusGeometry(B.head * 0.95, 0.016, 4, 14), beads[2]);
    hb.rotation.x = Math.PI / 2 - 0.2; hb.position.y = 0.05; J.head.add(hb);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), beads[3]);
      ear.position.set(s * B.head * 0.95, -0.04, 0); ear.rotation.y = Math.PI / 2; J.head.add(ear);
    }
    // Tresses ocre (cheveux longs teints à l'ocre, traditionnels des jeunes guerriers)
    const hair = ball(B.head * 1.04, ochre, 1); hair.scale.set(0.95, 0.9, 1.0); hair.position.set(0, 0.02, -0.015); J.head.add(hair);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i - 4) * 0.22;
      const br = limb(0.016, 0.01, 0.34, ochre, 4);
      br.position.set(Math.sin(a) * B.head * 0.7, 0.02, Math.cos(a) * B.head * 0.75);
      br.rotation.x = 0.12;
      J.head.add(br);
    }
    // Bracelets perlés
    for (const side of ['R', 'L']) {
      for (let k = 0; k < 2; k++) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(B.armR * 0.85, 0.014, 4, 10), beads[(k + (side === 'R' ? 1 : 3)) % 5]);
        b.rotation.x = Math.PI / 2; b.position.y = -B.fa * (0.78 + k * 0.07); J['el' + side].add(b);
        const a = new THREE.Mesh(new THREE.TorusGeometry(B.legR * 0.85, 0.014, 4, 10), beads[(k + 1) % 5]);
        a.rotation.x = Math.PI / 2; a.position.y = -B.shin * (0.86 + k * 0.05); J['knee' + side].add(a);
      }
    }

    // Longue lance maasaï (main droite) : lame longue en haut, pointe en bas
    const spear = new THREE.Group();
    const shaft = limb(0.014, 0.014, 1.5, wood, 5); shaft.position.y = 0.75; spear.add(shaft);
    const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), steel);
    blade.scale.set(0.32, 3.4, 0.1); blade.position.y = 1.05; spear.add(blade);
    const butt = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.35, 5), steel);
    butt.rotation.x = Math.PI; butt.position.y = -0.92; spear.add(butt);
    spear.rotation.x = Math.PI / 2;
    J.gripR.add(spear);
    W.spear = spear;
    W.spearBlade = blade;

    // Rungu (main gauche) : massue à tête ronde
    const rungu = new THREE.Group();
    const rs = limb(0.016, 0.02, 0.42, wood, 5); rs.position.y = 0.32; rungu.add(rs);
    const knob = ball(0.065, wood, 1); knob.position.y = 0.36; rungu.add(knob);
    rungu.rotation.x = Math.PI / 2;
    J.gripL.add(rungu);
    W.rungu = rungu;
  },
};
