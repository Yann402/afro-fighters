import * as THREE from 'three';
import { sandTex, patternTex, skyTex, mudTex } from './textures.js';

const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...o });

// L'arène du crépuscule : cercle de sable, muret décoré, public en silhouette, baobabs, torches.
export function buildArena(scene, renderer) {
  const group = new THREE.Group();
  scene.add(group);

  scene.background = new THREE.Color('#2a1a2e');
  scene.fog = new THREE.Fog('#b0603f', 22, 70);

  // Ciel
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  // Soleil couchant
  const sun = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: '#ffd38a', fog: false }));
  sun.position.set(-18, 9, -100); group.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: '#ff9d4d', transparent: true, opacity: 0.25, fog: false }));
  sunGlow.position.set(-18, 9, -101); group.add(sunGlow);

  // Lumières
  const hemi = new THREE.HemisphereLight('#ffd7a8', '#4a2a2a', 1.15);
  group.add(hemi);
  const key = new THREE.DirectionalLight('#ffb070', 2.6);
  key.position.set(-7, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -10; sc.right = 10; sc.top = 8; sc.bottom = -4; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  group.add(key);
  const rim = new THREE.DirectionalLight('#7a8cff', 0.9);
  rim.position.set(6, 5, -8); group.add(rim);

  // Sol : cercle de sable
  const sand = new THREE.Mesh(new THREE.CircleGeometry(11, 48), m('#ffffff', { map: sandTex(), flatShading: false }));
  sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  group.add(sand);
  // Terre extérieure
  const outer = new THREE.Mesh(new THREE.RingGeometry(11, 80, 48, 1), m('#6b3f24'));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
  group.add(outer);
  // Tracé du cercle de lutte
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 7.6, 64), new THREE.MeshBasicMaterial({ color: '#efe1c0', transparent: true, opacity: 0.35 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; group.add(ring);

  // Muret circulaire décoré (derrière les combattants)
  const wallMat = m('#ffffff', { map: patternTex('#8a4422', '#e7c07a', '#2a1a12') });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.5, 1.1, 48, 1, true, Math.PI * 0.55, Math.PI * 0.9), wallMat);
  wall.material.side = THREE.DoubleSide;
  wall.position.y = 0.55; wall.receiveShadow = true;
  group.add(wall);

  // Public : corps drapés de couleurs variées et têtes, en deux maillages instanciés
  const crowdGeo = new THREE.CapsuleGeometry(0.22, 0.5, 2, 6);
  const headGeo = new THREE.IcosahedronGeometry(0.15, 1);
  const N = 260;
  const crowd = new THREE.InstancedMesh(crowdGeo, m('#ffffff', { roughness: 1, flatShading: false }), N);
  const heads = new THREE.InstancedMesh(headGeo, m('#3a2218', { roughness: 0.9, flatShading: false }), N);
  const dummy = new THREE.Object3D();
  const crowdData = [];
  const cloth = ['#8a2a22', '#b5651d', '#24507a', '#6b3a6b', '#2e6b4a', '#c79a3a', '#d8c8a8', '#4a2a22', '#a8452a', '#1f3a6b'];
  const tint = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const row = i % 3;
    const a = Math.PI * 0.58 + (Math.floor(i / 3) / (N / 3)) * Math.PI * 0.84 + (Math.random() - 0.5) * 0.03;
    const r = 12.6 + row * 1.1;
    const sc = 0.85 + Math.random() * 0.3;
    crowdData.push({ base: 0.85 + row * 0.55, phase: Math.random() * 10, s: sc, x: Math.sin(a) * r, z: Math.cos(a) * r, speed: 5 + Math.random() * 4, keen: 0.4 + Math.random() * 0.9 });
    crowd.setColorAt(i, tint.set(cloth[Math.floor(Math.random() * cloth.length)]).multiplyScalar(0.55));
  }
  crowd.instanceColor.needsUpdate = true;
  group.add(crowd); group.add(heads);
  // Gradins
  for (let row = 0; row < 3; row++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(12.9 + row * 1.1, 12.9 + row * 1.1, 0.3 + row * 0.55, 40, 1, true, Math.PI * 0.55, Math.PI * 0.9), m('#5a3420'));
    step.material.side = THREE.DoubleSide;
    step.position.y = (0.3 + row * 0.55) / 2; group.add(step);
  }

  // Enceinte de banco derrière les gradins : tours effilées hérissées de bois (style soudano-sahélien)
  const mud = m('#ffffff', { map: mudTex(), flatShading: false, roughness: 1 });
  const stick = m('#3b2414');
  const tower = (x, z, hgt, wid) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(wid * 0.52, wid, hgt, 4, 1), mud);
    body.rotation.y = Math.PI / 4; body.position.y = hgt / 2; g.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(wid * 0.34, hgt * 0.16, 6), mud); tip.position.y = hgt * 1.07; g.add(tip);
    for (let row = 0; row < 4; row++) for (let k = -1; k <= 1; k++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 4), stick);
      const y = hgt * (0.3 + row * 0.16), w2 = wid * (1 - 0.48 * (y / hgt)) * 0.72;
      st.rotation.x = Math.PI / 2; st.position.set(k * w2 * 0.55, y, w2 * 0.72 + 0.3); g.add(st);
    }
    g.position.set(x, 0, z); g.lookAt(0, 0, 0); group.add(g);
  };
  for (const [x, z, hgt, wid] of [[-15, -15.5, 8.5, 2.4], [-8, -18, 11, 2.8], [0, -19.5, 13.5, 3.2], [8, -18, 11, 2.8], [15, -15.5, 8.5, 2.4]]) tower(x, z, hgt, wid);
  for (const [x, z, len, rot] of [[-11.5, -16.9, 7.6, 0.33], [-4, -18.9, 8.2, 0.19], [4, -18.9, 8.2, -0.19], [11.5, -16.9, 7.6, -0.33]]) {
    const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(len, 5.2, 1.1), mud);
    wallSeg.position.set(x, 2.6, z); wallSeg.rotation.y = rot; group.add(wallSeg);
    for (let k = 0; k < 5; k++) {
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 5), mud);
      cr.position.set(x + Math.cos(rot) * (k - 2) * len / 5.5, 5.6, z - Math.sin(rot) * (k - 2) * len / 5.5); group.add(cr);
    }
  }

  // Baobabs
  const bark = m('#6e5040');
  const leaves = m('#3d5a2a');
  const baobab = (x, z, s) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 5, 8), bark);
    trunk.position.y = 2.5; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.4, 5), bark);
      br.position.set(Math.cos(a) * 0.9, 5.6, Math.sin(a) * 0.9);
      br.rotation.z = Math.cos(a) * 0.7; br.rotation.x = -Math.sin(a) * 0.7;
      g.add(br);
      const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), leaves);
      lf.position.set(Math.cos(a) * 1.9, 6.7, Math.sin(a) * 1.9); lf.scale.set(1.3, 0.55, 1.3);
      g.add(lf);
    }
    g.position.set(x, 0, z); g.scale.setScalar(s);
    group.add(g);
  };
  baobab(-21, -24, 1.4);
  baobab(19, -27, 1.7);
  baobab(-34, -40, 1.9);
  baobab(36, -45, 2.1);

  // Collines lointaines
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(8 + Math.random() * 8, 4 + Math.random() * 5, 6), m('#5c2f2a', { fog: true }));
    hill.position.set(-60 + i * 15, 0, -62 - Math.random() * 8);
    group.add(hill);
  }

  // Torches avec flammes vacillantes
  const torches = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
  for (const [x, z] of [[-8.6, -6.8], [8.6, -6.8]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 6), m('#3b2414'));
    post.position.set(x, 1.2, z); group.add(post);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.25, 7), m('#2a1a10'));
    bowl.position.set(x, 2.45, z); group.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), flameMat);
    flame.position.set(x, 2.85, z); group.add(flame);
    const light = new THREE.PointLight('#ff9a3c', 6, 12, 1.6);
    light.position.set(x, 3.1, z); group.add(light);
    torches.push({ flame, light, seed: Math.random() * 10 });
  }

  // Tambours (sabar / djembé) en bord d'arène
  const drumMat = m('#7a4520');
  const skinMat = m('#e8d6b0');
  for (const [x, z, s] of [[-5.5, -8.4, 1], [-4.6, -8.8, 0.8], [5.2, -8.5, 1.1], [6.1, -8.1, 0.75]]) {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.75, 8), drumMat); body.position.y = 0.6; d.add(body);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 8), drumMat); base.position.y = 0.15; d.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 8), skinMat); top.position.y = 0.99; d.add(top);
    d.position.set(x, 0, z); d.scale.setScalar(s);
    d.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(d);
  }

  // Bannières à motifs
  for (const [x, col] of [[-3, '#1f4f7a'], [3, '#7a1f2b']]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 5), m('#3b2414'));
    pole.position.set(x, 2.2, -10.6); group.add(pole);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), m('#ffffff', { map: patternTex(col, '#f1d38a', '#111'), side: THREE.DoubleSide }));
    ban.material.map = ban.material.map.clone(); ban.material.map.repeat.set(1, 4); ban.material.map.rotation = Math.PI / 2; ban.material.map.needsUpdate = true;
    ban.position.set(x + 0.52, 3.2, -10.6); group.add(ban);
  }

  // Ambiances : mêmes décors, autre heure
  const AMBIANCES = {
    crepuscule: { sky: undefined, fog: ['#b0603f', 22, 70], hemi: ['#ffd7a8', '#4a2a2a', 1.15], key: ['#ffb070', 2.6, [-7, 9, 8]], rim: ['#7a8cff', 0.9], sun: ['#ffd38a', '#ff9d4d', 1, [-18, 9]], torch: 1, exposure: 1.05 },
    nuit: { sky: [[0, '#05060f'], [0.45, '#0e1430'], [0.7, '#243055'], [0.76, '#3a3a5a'], [1, '#0a0806']], fog: ['#141a33', 16, 60], hemi: ['#6f84c8', '#1a1420', 0.55], key: ['#a9bdff', 1.5, [6, 10, 7]], rim: ['#ff9a50', 1.3], sun: ['#e6ecff', '#8fa8ff', 0.5, [20, 22]], torch: 2.6, exposure: 1.15 },
    aube: { sky: [[0, '#5b86c4'], [0.4, '#a9c3e6'], [0.62, '#f3cfc0'], [0.72, '#ffe2b0'], [0.76, '#fff0cf'], [1, '#4a3626']], fog: ['#e3b79c', 26, 80], hemi: ['#fff0e0', '#6a5040', 1.35], key: ['#ffe6c0', 2.9, [8, 8, 8]], rim: ['#9ad0ff', 0.7], sun: ['#fff3c8', '#ffd08a', 1, [22, 6]], torch: 0.35, exposure: 1.0 },
  };
  let crowdT = 0;
  let torchScale = 1;
  return {
    group,
    key,
    ambiance: 'crepuscule',
    setAmbiance(id) {
      const A = AMBIANCES[id] || AMBIANCES.crepuscule;
      this.ambiance = AMBIANCES[id] ? id : 'crepuscule';
      const old = sky.material.map; sky.material.map = skyTex(A.sky); sky.material.needsUpdate = true; old.dispose();
      scene.fog.color.set(A.fog[0]); scene.fog.near = A.fog[1]; scene.fog.far = A.fog[2];
      hemi.color.set(A.hemi[0]); hemi.groundColor.set(A.hemi[1]); hemi.intensity = A.hemi[2];
      key.color.set(A.key[0]); key.intensity = A.key[1]; key.position.set(...A.key[2]);
      rim.color.set(A.rim[0]); rim.intensity = A.rim[1];
      sun.material.color.set(A.sun[0]); sunGlow.material.color.set(A.sun[1]); sun.scale.setScalar(A.sun[2]); sunGlow.scale.setScalar(A.sun[2]);
      sun.position.set(A.sun[3][0], A.sun[3][1], -100); sunGlow.position.set(A.sun[3][0], A.sun[3][1], -101);
      torchScale = A.torch;
      renderer.toneMappingExposure = A.exposure;
    },
    excitement: 0,
    update(dt) {
      crowdT += dt;
      this.excitement = Math.max(0, this.excitement - dt * 0.6);
      for (const t of torches) {
        const f = Math.sin(crowdT * 17 + t.seed) * 0.5 + Math.sin(crowdT * 9.3 + t.seed * 2) * 0.5;
        t.flame.scale.set(1 + f * 0.08, 1 + f * 0.18, 1 + f * 0.08);
        t.light.intensity = (5.5 + f * 1.2) * torchScale;
      }
      // le public s'anime selon l'intensité du combat ; chaque spectateur a son rythme et son entrain
      const ex = 0.015 + this.excitement * 0.2;
      for (let i = 0; i < crowdData.length; i++) {
        const c = crowdData[i];
        const jump = Math.max(0, Math.sin(crowdT * c.speed + c.phase)) * ex * c.keen;
        const sway = Math.sin(crowdT * 1.3 + c.phase) * 0.03;
        dummy.position.set(c.x + sway, c.base + jump, c.z);
        dummy.scale.setScalar(c.s); dummy.rotation.z = sway * 1.5;
        dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 0.52 * c.s; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      }
      crowd.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    },
  };
}
