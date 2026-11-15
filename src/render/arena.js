import * as THREE from 'three';
import { sandTex, patternTex, skyTex } from './textures.js';

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

  // Public en silhouette (instancié)
  const crowdGeo = new THREE.CapsuleGeometry(0.22, 0.5, 2, 5);
  const crowdMat = m('#2b1820', { roughness: 1 });
  const N = 260;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, N);
  const dummy = new THREE.Object3D();
  const crowdData = [];
  for (let i = 0; i < N; i++) {
    const row = i % 3;
    const a = Math.PI * 0.58 + (Math.floor(i / 3) / (N / 3)) * Math.PI * 0.84 + (Math.random() - 0.5) * 0.02;
    const r = 12.6 + row * 1.1;
    dummy.position.set(Math.sin(a) * r, 0.85 + row * 0.55, Math.cos(a) * r);
    const s = 0.9 + Math.random() * 0.25;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    crowdData.push({ base: dummy.position.y, phase: Math.random() * 10, s, x: dummy.position.x, z: dummy.position.z });
  }
  group.add(crowd);
  // Gradins
  for (let row = 0; row < 3; row++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(12.9 + row * 1.1, 12.9 + row * 1.1, 0.3 + row * 0.55, 40, 1, true, Math.PI * 0.55, Math.PI * 0.9), m('#5a3420'));
    step.material.side = THREE.DoubleSide;
    step.position.y = (0.3 + row * 0.55) / 2; group.add(step);
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

  let crowdT = 0;
  return {
    group,
    excitement: 0,
    update(dt) {
      crowdT += dt;
      this.excitement = Math.max(0, this.excitement - dt * 0.6);
      for (const t of torches) {
        const f = Math.sin(crowdT * 17 + t.seed) * 0.5 + Math.sin(crowdT * 9.3 + t.seed * 2) * 0.5;
        t.flame.scale.set(1 + f * 0.08, 1 + f * 0.18, 1 + f * 0.08);
        t.light.intensity = 5.5 + f * 1.2;
      }
      // le public s'anime selon l'intensité du combat
      const ex = 0.02 + this.excitement * 0.18;
      for (let i = 0; i < crowdData.length; i++) {
        const c = crowdData[i];
        const jump = Math.max(0, Math.sin(crowdT * (6 + (i % 5)) + c.phase)) * ex;
        dummy.position.set(c.x, c.base + jump, c.z);
        dummy.scale.setScalar(c.s);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
      }
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
}
