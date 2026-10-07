import * as THREE from "three";

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smoothstep = (a, b, value) => {
  if (b <= a) return value >= b ? 1 : 0;
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
};

export function createReassemblyRuntime(root, stage, options = {}) {
  const profile = options.profile === "mobile" ? "mobile" : "desktop";
  const shells = [];
  root.traverse((node) => {
    if (!/^Shell_\d{2}$/.test(node.name)) return;
    const target = node.userData?.reassemblyTargetTranslation;
    const seat = Number(node.userData?.reassemblySeatSeconds);
    if (!Array.isArray(target) || target.length !== 3 || !Number.isFinite(seat)) return;
    shells.push({
      node,
      targetLocal: new THREE.Vector3(target[0], target[1], target[2]),
      seat
    });
  });
  shells.sort((a, b) => a.node.name.localeCompare(b.node.name));

  const positions = new Float32Array(Math.max(1, shells.length * 2) * 3);
  const colors = new Float32Array(Math.max(1, shells.length * 2) * 3);
  const cyan = new THREE.Color("#65cfff");
  const gold = new THREE.Color("#e8b45a");
  for (let i = 0; i < shells.length; i += 1) {
    const color = i % 2 === 0 ? cyan : gold;
    for (let endpoint = 0; endpoint < 2; endpoint += 1) {
      const o = (i * 2 + endpoint) * 3;
      colors[o] = color.r;
      colors[o + 1] = color.g;
      colors[o + 2] = color.b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const guides = new THREE.LineSegments(geometry, material);
  guides.name = "FAZ7_MagneticSlotGuides";
  guides.frustumCulled = false;
  guides.renderOrder = 7;
  stage.add(guides);

  const sealGeometry = new THREE.TorusGeometry(2.02, 0.012, 8, profile === "mobile" ? 72 : 128);
  const sealMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#9de4ff"),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const sealRing = new THREE.Mesh(sealGeometry, sealMaterial);
  sealRing.name = "FAZ7_FinalSealRing";
  sealRing.rotation.x = Math.PI / 2;
  sealRing.visible = false;
  sealRing.renderOrder = 8;
  root.add(sealRing);

  const current = new THREE.Vector3();
  const target = new THREE.Vector3();
  function update(sceneTime, state, visualGain = 1) {
    root.updateMatrixWorld(true);
    const gain = clamp01(state?.guideGain ?? 0) * clamp01(visualGain);
    const array = geometry.attributes.position.array;
    let strongestSeat = 0;
    for (let i = 0; i < shells.length; i += 1) {
      const shell = shells[i];
      shell.node.getWorldPosition(current);
      target.copy(shell.targetLocal);
      if (shell.node.parent) target.applyMatrix4(shell.node.parent.matrixWorld);
      else target.applyMatrix4(root.matrixWorld);
      const o = i * 6;
      array[o] = current.x; array[o + 1] = current.y; array[o + 2] = current.z;
      array[o + 3] = target.x; array[o + 4] = target.y; array[o + 5] = target.z;
      const seat = smoothstep(shell.seat - 0.07, shell.seat, sceneTime)
        * (1 - smoothstep(shell.seat, shell.seat + 0.16, sceneTime));
      strongestSeat = Math.max(strongestSeat, seat);
    }
    geometry.attributes.position.needsUpdate = true;
    material.opacity = gain * (profile === "mobile" ? 0.20 : 0.30) + strongestSeat * 0.08 * clamp01(visualGain);
    guides.visible = material.opacity > 0.002;

    const seal = clamp01(state?.sealPulse ?? 0);
    sealRing.visible = seal > 0.002;
    sealMaterial.opacity = seal * clamp01(visualGain) * (profile === "mobile" ? 0.26 : 0.40);
    sealRing.scale.setScalar(1.08 - seal * 0.08);
    sealRing.rotation.z = sceneTime * 0.06;
  }

  function dispose() {
    stage.remove(guides);
    root.remove(sealRing);
    geometry.dispose();
    material.dispose();
    sealGeometry.dispose();
    sealMaterial.dispose();
  }

  return { update, dispose, shellCount: shells.length };
}
