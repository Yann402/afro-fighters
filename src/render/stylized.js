import * as THREE from 'three';

// Rendu stylisé des modèles GLB : on garde l'éclairage physique de Three.js (ombres, lumières de
// l'arène) et on ajoute une lumière de contour chaude sur les bords, plus un liseré de silhouette.
const RIM = { color: new THREE.Color('#ffb46a'), power: 2.6, strength: 0.55 };
const OUTLINE = { color: '#1a0f0a', width: 0.0045 };
const NO_OUTLINE = /perle|collier|bracelet|brassard|cheville|bandeau|pendentif|boucle|yeux|eyes|sourcil|paupiere|plume|amashoba|isinene|tresses|cordon|grisgris/i;

function rimPatch(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM.color };
    shader.uniforms.uRim = { value: new THREE.Vector2(RIM.power, RIM.strength) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform vec2 uRim;')
      .replace('#include <opaque_fragment>', `
        {
          // lumière de contour : plus forte sur les bords tournés vers le haut (ciel) que vers le sol
          float f = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uRim.x);
          float sky = 0.55 + 0.45 * saturate((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).y * normal.y + 0.5);
          outgoingLight += uRimColor * f * uRim.y * sky * (0.35 + diffuseColor.rgb);
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'afro-rim';
  material.needsUpdate = true;
}

let outlineMat = null;
function getOutlineMaterial() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE.color, side: THREE.BackSide, fog: true });
  outlineMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: OUTLINE.width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  outlineMat.customProgramCacheKey = () => 'afro-outline';
  return outlineMat;
}

// Applique le style à un modèle chargé. Retourne { materials, outlines } :
// les matériaux sont propres à cette instance (clonés), le matériau de liseré est partagé.
// Matériaux de vêtement qu'une tenue alternative peut reteindre (jamais la peau ni le métal).
export const CLOTH_MATERIALS = /pelage|tissu|shuka|peau_de_vache|cheveux/i;

export function applyStylized(root, { outline = true, cloneMaterials = true } = {}) {
  const seen = new Map();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) meshes.push(o); });
  const outlines = [];
  for (const o of meshes) {
    let m = seen.get(o.material);
    if (!m) {
      m = cloneMaterials ? o.material.clone() : o.material;
      m.envMapIntensity = 0;
      if (m.metalness > 0.2) { m.metalness = 0.35; m.roughness = Math.min(m.roughness, 0.32); m.emissive = new THREE.Color('#20242a'); }
      rimPatch(m);
      seen.set(o.material, m);
    }
    o.material = m;
    o.castShadow = true; o.receiveShadow = false;
    if (outline && !NO_OUTLINE.test(o.name) && !(m.side === THREE.DoubleSide)) {
      const Ctor = o.isSkinnedMesh ? THREE.SkinnedMesh : THREE.Mesh;
      const h = new Ctor(o.geometry, getOutlineMaterial());
      if (o.isSkinnedMesh) h.bind(o.skeleton, o.bindMatrix);
      h.userData.isOutline = true; h.castShadow = false; h.name = o.name + '_liseré';
      o.add(h);
      if (o.isSkinnedMesh) { h.position.set(0, 0, 0); }
      outlines.push(h);
    }
  }
  return { materials: [...seen.values()], outlines };
}
