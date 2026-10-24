// ============================================================
// SECTOR 01 — 空岛纪元 / ILMANGO SKYBLOCK
// 程序化体素空岛 + 赛博虚空网格
// ============================================================
import * as THREE from 'three';
import { seeded, starField, neonGrid, holoPanel, labelSprite, circleBounds, rectBounds } from '../engine.js';

export function createMinecraft() {
  const group = new THREE.Group();
  const rnd = seeded(0x7f);
  const animated = [];

  // ---------- 虚空 ----------
  const stars = starField(1200, 120, '#8fd8ff', 0.42, 0.7);
  group.add(stars);
  const grid = neonGrid(260, 52, '#155a6b', 0.4);
  grid.position.y = -28;
  group.add(grid);

  const grid2 = neonGrid(260, 13, '#1f3a5a', 0.28);
  grid2.position.y = -29.2;
  group.add(grid2);

  // 云层
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#cfe6ef', transparent: true, opacity: 0.055, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const w = 16 + rnd() * 34;
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 8 + rnd() * 16), cloudMat);
    const a = rnd() * Math.PI * 2;
    const r = 34 + rnd() * 60;
    cloud.position.set(Math.cos(a) * r, 18 + rnd() * 16, Math.sin(a) * r);
    group.add(cloud);
  }

  // ---------- 主岛 ----------
  const block = 2;
  const N = 18;
  const topY = 0;
  const grass = new THREE.InstancedMesh(
    new THREE.BoxGeometry(block, block, block),
    new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.05, flatShading: true }),
    N * N
  );
  const dummy = new THREE.Object3D();
  const cGrass = [new THREE.Color('#63a54a'), new THREE.Color('#79c25a'), new THREE.Color('#4f8f3f')];
  let idx = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = (i - N / 2) * block + block / 2;
      const z = (j - N / 2) * block + block / 2;
      dummy.position.set(x, topY - block / 2, z);
      dummy.updateMatrix();
      grass.setMatrixAt(idx, dummy.matrix);
      grass.setColorAt(idx, cGrass[Math.floor(rnd() * cGrass.length)]);
      idx++;
    }
  }
  grass.receiveShadow = false;
  group.add(grass);

  const dirtColors = ['#6b4a30', '#5d3f28', '#4b3320'];
  for (let layer = 0; layer < 3; layer++) {
    const dirt = new THREE.InstancedMesh(
      new THREE.BoxGeometry(block, block, block),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      N * N
    );
    let k = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = (i - N / 2) * block + block / 2;
        const z = (j - N / 2) * block + block / 2;
        dummy.position.set(x, topY - block * 1.5 - layer * block, z);
        dummy.updateMatrix();
        dirt.setMatrixAt(k, dummy.matrix);
        dirt.setColorAt(k, new THREE.Color(dirtColors[Math.min(layer, 2)]));
        k++;
      }
    }
    group.add(dirt);
  }

  // 岛底不规则锥体
  const underMat = new THREE.MeshStandardMaterial({ color: '#3a2a1d', roughness: 1, flatShading: true });
  for (let i = 0; i < 46; i++) {
    const s = 1.4 + rnd() * 1.4;
    const bx = (rnd() - 0.5) * 34;
    const bz = (rnd() - 0.5) * 34;
    const by = -8 - rnd() * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), underMat);
    b.position.set(bx, by, bz);
    b.rotation.set(rnd(), rnd(), rnd());
    group.add(b);
  }

  // 岛缘霓虹描边
  const edgePts = [
    new THREE.Vector3(-18, 0.06, -18), new THREE.Vector3(18, 0.06, -18),
    new THREE.Vector3(18, 0.06, 18), new THREE.Vector3(-18, 0.06, 18),
    new THREE.Vector3(-18, 0.06, -18),
  ];
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
  const edgeLine = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: '#c8ff4d', transparent: true, opacity: 0.7 }));
  group.add(edgeLine);

  const edgeLine2 = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: '#5cf2ff', transparent: true, opacity: 0.22 }));
  edgeLine2.position.y = -12;
  group.add(edgeLine2);

  // ---------- 场景道具 ----------
  const cube = (w, h, d, color, x, y, z, emissive = 0, emissiveColor = color) => {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.85, metalness: 0.05, flatShading: true,
      emissive: emissive ? new THREE.Color(emissiveColor) : 0x000000,
      emissiveIntensity: emissive,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  const colliders = [];

  // 树
  const treeX = -10, treeZ = -8;
  for (let i = 0; i < 4; i++) cube(1.1, 1.1, 1.1, '#6b4a2a', treeX, 0.55 + i, treeZ);
  for (let lx = -2; lx <= 2; lx++) {
    for (let lz = -2; lz <= 2; lz++) {
      for (let ly = 0; ly < 2; ly++) {
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && rnd() > 0.5) continue;
        cube(1.15, 0.9, 1.15, lx % 2 === 0 ? '#3f7a3a' : '#4c8f45', treeX + lx * 1.05, 4.4 + ly, treeZ + lz * 1.05);
      }
    }
  }
  colliders.push({ minX: treeX - 0.9, maxX: treeX + 0.9, minZ: treeZ - 0.9, maxZ: treeZ + 0.9 });

  // 刷石机残骸 + 资源链终端
  const genX = 9, genZ = -6;
  cube(2.2, 5, 2.2, '#5d6c72', genX, 2.5, genZ);
  cube(1.2, 1.2, 1.2, '#5cf2ff', genX, 5.6, genZ, 0.5, '#5cf2ff');
  cube(1.4, 1.4, 1.4, '#aebfc4', genX - 3.2, 0.7, genZ + 1.4);
  cube(1.4, 1.4, 1.4, '#8f9ea3', genX - 4.1, 0.7, genZ + 0.5);
  const genPanel = holoPanel('RESOURCE CHAIN', 'FLOW 0x2A · 资源链审计中', '#5cf2ff', 4.4, 2.1);
  genPanel.position.set(genX - 1.6, 3.6, genZ + 2.2);
  genPanel.rotation.y = -0.5;
  group.add(genPanel);
  animated.push((t) => { genPanel.position.y = 3.6 + Math.sin(t * 1.4) * 0.08; });
  colliders.push({ minX: genX - 1.3, maxX: genX + 1.3, minZ: genZ - 1.3, maxZ: genZ + 1.3 });

  // 农田
  const farmX = -9, farmZ = 7;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      cube(1.6, 0.3, 1.6, '#4b3320', farmX + i * 1.7 - 2.5, 0.16, farmZ + j * 1.7 - 2.5);
      const crop = cube(0.35, 0.55, 0.35, '#9fd44f', farmX + i * 1.7 - 2.5, 0.55, farmZ + j * 1.7 - 2.5, 0.15, '#9fd44f');
      crop.scale.setScalar(0.7 + rnd() * 0.6);
    }
  }
  const farmSign = labelSprite('再生农场', 'REGROWTH FARM / 循环 04', '#c8ff4d', 3.2);
  farmSign.position.set(farmX, 2.1, farmZ);
  group.add(farmSign);
  animated.push((t) => { farmSign.position.y = 2.1 + Math.sin(t * 1.2) * 0.07; });

  // 信标
  const beaconX = 10, beaconZ = 8;
  cube(2.4, 0.8, 2.4, '#2a3a40', beaconX, 0.4, beaconZ);
  cube(1.6, 0.6, 1.6, '#c8ff4d', beaconX, 1.0, beaconZ, 0.9, '#c8ff4d');
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.9, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#c8ff4d', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.set(beaconX, 13, beaconZ);
  group.add(beam);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.035, 6, 48),
    new THREE.MeshBasicMaterial({ color: '#c8ff4d', transparent: true, opacity: 0.8 })
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.set(beaconX, 2.2, beaconZ);
  group.add(beaconRing);
  animated.push((t) => {
    beaconRing.position.y = 2.2 + Math.sin(t * 1.6) * 0.4;
    beaconRing.rotation.z = t * 0.6;
    beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.04;
  });
  colliders.push({ minX: beaconX - 1.3, maxX: beaconX + 1.3, minZ: beaconZ - 1.3, maxZ: beaconZ + 1.3 });

  // 悬空岛
  const floaters = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd();
    const r = 24 + rnd() * 12;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    const fy = 5 + rnd() * 10;
    const fg = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 4);
    for (let b = 0; b < n; b++) {
      const s = 1.2 + rnd() * 1.4;
      const bc = new THREE.Mesh(
        new THREE.BoxGeometry(s, s, s),
        new THREE.MeshStandardMaterial({ color: rnd() > 0.6 ? '#63a54a' : '#4b3320', roughness: 1, flatShading: true })
      );
      bc.position.set((rnd() - 0.5) * 3, -b * s * 0.9, (rnd() - 0.5) * 3);
      fg.add(bc);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.75, 24),
      new THREE.MeshBasicMaterial({ color: '#5cf2ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.8;
    fg.add(ring);
    fg.position.set(fx, fy, fz);
    group.add(fg);
    floaters.push({ obj: fg, base: fy, ph: rnd() * 6 });
  }
  animated.push((t) => {
    floaters.forEach((f) => { f.obj.position.y = f.base + Math.sin(t * 0.5 + f.ph) * 0.5; });
  });

  // 中央全息标题
  const titlePanel = holoPanel('ILMANGO SKYBLOCK', '世界线 0x7F · 开局一棵树', '#c8ff4d', 8.6, 2.7);
  titlePanel.position.set(0, 7.2, -2);
  group.add(titlePanel);
  animated.push((t) => {
    titlePanel.position.y = 7.2 + Math.sin(t * 0.9) * 0.12;
    titlePanel.rotation.y = Math.sin(t * 0.35) * 0.09;
  });

  // 浮空数据立方
  const cubes = [];
  for (let i = 0; i < 26; i++) {
    const s = 0.12 + rnd() * 0.3;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshBasicMaterial({ color: rnd() > 0.5 ? '#c8ff4d' : '#5cf2ff', transparent: true, opacity: 0.55, depthWrite: false })
    );
    const a = rnd() * Math.PI * 2;
    const r = 6 + rnd() * 20;
    m.position.set(Math.cos(a) * r, 1 + rnd() * 12, Math.sin(a) * r);
    m.userData.ph = rnd() * 6;
    m.userData.y = m.position.y;
    group.add(m);
    cubes.push(m);
  }
  animated.push((t) => {
    cubes.forEach((c) => { c.position.y = c.userData.y + Math.sin(t * 0.7 + c.userData.ph) * 0.35; c.rotation.y += 0.004; });
  });

  return {
    id: 'minecraft',
    group,
    bounds: rectBounds(-16.6, 16.6, -16.6, 16.6),
    colliders,
    spawn: { x: 0, z: 12 },
    npcSpots: [
      new THREE.Vector3(-7, 0, 4),
      new THREE.Vector3(7, 0, 4),
      new THREE.Vector3(0, 0, -7),
    ],
    portalPos: new THREE.Vector3(0, 0, 12.5),
    environment: {
      bg: '#040b12',
      fog: { color: '#061019', near: 26, far: 118 },
      ambient: { color: '#54798c', intensity: 0.75 },
      hemi: { sky: '#1d3a4d', ground: '#05090c', intensity: 0.9 },
      dir: { color: '#c8ff4d', intensity: 0.45, pos: [12, 22, 8] },
    },
    update(t) {
      stars.rotation.y = t * 0.006;
      grid.rotation.y = t * 0.01;
      animated.forEach((fn) => fn(t));
    },
  };
}
