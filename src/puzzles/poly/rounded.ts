/**
 * Peça com quinas arredondadas (como o RoundedBoxGeometry dos cubos, mas para
 * qualquer poliedro convexo): é a peça "encolhida" para dentro por r, envolvida
 * por esferas de raio r — a soma de Minkowski. As faces planas ficam exatamente
 * onde estavam e as arestas/quinas ganham curvas com sombreado suave.
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clipPolyhedron, type V3 } from './clip';

let sphereDirs: THREE.Vector3[] | null = null;
function directions(): THREE.Vector3[] {
  if (sphereDirs) return sphereDirs;
  const g = new THREE.IcosahedronGeometry(1, 3); // 642 direções: curvas suaves
  const pos = g.getAttribute('position');
  const seen = new Set<string>();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    const k = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  g.dispose();
  return (sphereDirs = out);
}

export function roundedPolyhedron(faces: V3[][], r: number): THREE.BufferGeometry | null {
  const pts = faces.flat();
  const c: V3 = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length) as V3;
  // planos das faces (normal para fora)
  const planes = faces.map((f) => {
    const a = new THREE.Vector3(...f[0]), b = new THREE.Vector3(...f[1]), d = new THREE.Vector3(...f[2]);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
    if (n.dot(a.clone().sub(new THREE.Vector3(...c))) < 0) n.negate();
    return { n, d: n.dot(a) };
  });
  // poliedro interno: cada face recuada r para dentro
  let inner = faces;
  for (const pl of planes) {
    inner = clipPolyhedron(inner, pl.n.toArray() as V3, pl.d - r, -1);
    if (inner.length < 4) return null; // peça pequena demais para esse raio
  }
  const innerVerts: THREE.Vector3[] = [];
  for (const p of inner.flat()) {
    const v = new THREE.Vector3(...p);
    if (!innerVerts.some((q) => q.distanceToSquared(v) < 1e-12)) innerVerts.push(v);
  }
  // para cada direção, só os vértices internos mais "para fora" nela vão parar na
  // superfície (empates = faces planas): poucos pontos, casco convexo rápido
  const dirs = [...directions(), ...planes.map((p) => p.n)];
  const points: THREE.Vector3[] = [];
  const normalOf = new Map<string, THREE.Vector3>();
  const key = (p: THREE.Vector3) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  for (const u of dirs) {
    let m = -Infinity;
    for (const v of innerVerts) m = Math.max(m, u.dot(v));
    for (const v of innerVerts) {
      if (u.dot(v) < m - 1e-7) continue;
      const p = v.clone().addScaledVector(u, r);
      const k = key(p);
      if (normalOf.has(k)) continue;
      points.push(p);
      normalOf.set(k, u.clone());
    }
  }
  const geo = new ConvexGeometry(points);
  // normais suaves: cada ponto da superfície aponta na direção da esfera que o gerou
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const u = normalOf.get(key(p));
    if (u) nrm.setXYZ(i, u.x, u.y, u.z);
  }
  nrm.needsUpdate = true;
  return geo;
}
