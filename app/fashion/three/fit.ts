import * as THREE from "three";
import { Part, type Character } from "./model";

/*
 * Fits garments onto the loaded body. A garment "shell" is the part of the
 * body surface a garment covers, pushed out along the normals by its ease,
 * relaxed with Laplacian smoothing so it bridges muscles and hollows like
 * fabric (instead of being painted on), and skinned with the body's own
 * weights so it moves exactly with it.
 *
 * Hems and openings are not cut along mesh edges: every vertex carries a
 * signed distance to the garment boundary (`cut`), interpolated across
 * triangles, and the fragment shader discards where it goes negative — so
 * edges are smooth lines wherever they fall.
 */

export type V3 = THREE.Vector3;
const tmp = new THREE.Vector3();

export type Vertex = { i: number; p: V3; n: V3; part: Part; side: number };

/** A cross-section a top falls straight from (below the waist), at height y. */
export type Section = { rx: number; rz: number; cz: number };

export type ShellSpec = {
  /** Signed distance (m) to the garment edge: > 0 covered, < 0 not. */
  cut: (v: Vertex) => number;
  /** Offset along the normal (m): ease allowance + folds. */
  ease: (v: Vertex) => number;
  /**
   * How far the fabric may sit from the skin after relaxing: [min, max] (m).
   * Keeping each layer inside its own band means layers never pass through
   * one another (tee < sweater < jacket < coat).
   */
  range?: (v: Vertex) => [number, number];
  /** Laplacian relaxation passes (0 = skin tight). */
  smooth?: number;
  /**
   * Below `from` the garment stops following the body and falls onto the
   * section returned by `section(y)` (fully by `to`): tops over the hips,
   * instead of hugging the crotch. Those vertices also ride on `bone`.
   */
  hang?: { from: number; to: number; section: (y: number) => Section; bone: number; lift?: number };
  /** Texture coordinates (m) for a vertex; `period` > 0 marks a wrapping u. */
  uv?: (v: Vertex) => [number, number, number];
  /**
   * An edge measured on the fitted fabric rather than on the skin (e.g. the
   * open front of a jacket), so it stays straight however far the fabric
   * stands off the body. Combined with `cut`.
   */
  edge?: (p: V3) => number;
  /**
   * Extra smoothing applied only to the shading normals: fabric catches light
   * as a smooth surface, it doesn't show every muscle under it.
   */
  soften?: number;
  /** Skin weights to reuse (another shell's `userData.weights`), so details move exactly with the fabric they're on. */
  weights?: ShellWeights;
  /**
   * The way fabric stands off a vertex where it isn't along the skin's normal
   * (a unit vector): in a cleavage the skin faces across to the other side,
   * and fabric spanning it comes straight forward instead.
   */
  dir?: (v: Vertex) => V3;
};

/** Skin weights of a shell, by body vertex: up to 4 [bone, weight] pairs each (row -1: the body's own). */
export type ShellWeights = { row: Int32Array; index: Uint16Array; weight: Float32Array };

/** Iterates body vertices in character space (bind pose). */
export function bodyVertices(c: Character) {
  const s = c.surface;
  const count = s.part.length;
  const list: Vertex[] = new Array(count);
  for (let i = 0; i < count; i++) {
    list[i] = {
      i,
      p: new THREE.Vector3(s.position[i * 3], s.position[i * 3 + 1], s.position[i * 3 + 2]),
      n: new THREE.Vector3(s.normal[i * 3], s.normal[i * 3 + 1], s.normal[i * 3 + 2]),
      part: s.part[i] as Part,
      side: s.side[i],
    };
  }
  return list;
}

type Topology = {
  verts: Vertex[];
  neighbors: Uint32Array[];
  /** Every vertex's group of coincident vertices (the body mesh is split at UV seams). */
  twins: Int32Array[];
};

const cache = new WeakMap<Character, Topology>();

/** The body's vertices (cached per character; don't modify them). */
export const vertices = (c: Character) => topology(c).verts;

function topology(c: Character): Topology {
  let t = cache.get(c);
  if (t) return t;
  const verts = bodyVertices(c);
  const sets: Set<number>[] = verts.map(() => new Set());
  const idx = c.surface.index;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k];
    const b = idx[k + 1];
    const d = idx[k + 2];
    sets[a].add(b).add(d);
    sets[b].add(a).add(d);
    sets[d].add(a).add(b);
  }
  // weld the seams: coincident vertices share neighbours, and a single averaged normal,
  // so offsetting along normals can't open cracks along the seams
  const key = (v: V3) => `${Math.round(v.x * 4000)},${Math.round(v.y * 4000)},${Math.round(v.z * 4000)}`;
  const groups = new Map<string, number[]>();
  verts.forEach((v) => {
    const k = key(v.p);
    const g = groups.get(k);
    if (g) g.push(v.i);
    else groups.set(k, [v.i]);
  });
  const twins: Int32Array[] = new Array(verts.length);
  for (const g of groups.values()) {
    const arr = Int32Array.from(g);
    for (const i of g) twins[i] = arr;
    if (g.length < 2) continue;
    const merged = new Set<number>();
    const n = new THREE.Vector3();
    for (const i of g) {
      for (const j of sets[i]) merged.add(j);
      n.add(verts[i].n);
    }
    n.normalize();
    for (const i of g) {
      for (const j of merged) if (j !== i) sets[i].add(j);
      verts[i].n.copy(n);
    }
  }
  t = { verts, neighbors: sets.map((s) => Uint32Array.from(s)), twins };
  cache.set(c, t);
  return t;
}

const se = (s: number, n: number) => Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
/** Squareness of the section hanging fabric falls onto: a little fuller than an ellipse, never a box. */
export const HANG_N = 2.3;

/** Default fabric mapping: around the torso, around each limb, flat on the feet. */
export function defaultUv(c: Character): (v: Vertex) => [number, number, number] {
  const L = c.landmarks;
  return ({ p, part, side }) => {
    if (part === Part.UpperArm || part === Part.LowerArm || part === Part.Hand) {
      const a = Math.atan2(p.z, p.y - L.shoulderY);
      return [a * 0.05, Math.abs(p.x), Math.PI * 2 * 0.05];
    }
    if (part === Part.Thigh || part === Part.Calf) {
      const a = Math.atan2(side * (p.x - side * L.legX), p.z);
      return [a * 0.07, p.y, Math.PI * 2 * 0.07];
    }
    if (part === Part.Foot) return [p.x, p.z, 0];
    const a = Math.atan2(p.x, p.z);
    return [a * 0.16, p.y, Math.PI * 2 * 0.16];
  };
}

export function fitShell(c: Character, spec: ShellSpec): THREE.BufferGeometry {
  const { verts, neighbors, twins } = topology(c);
  const n = verts.length;
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i++) cut[i] = spec.cut(verts[i]);
  // twins must agree, or the edge would split along a seam
  for (let i = 0; i < n; i++) {
    const tw = twins[i];
    if (tw.length > 1 && tw[0] === i) {
      let sum = 0;
      for (const j of tw) sum += cut[j];
      for (const j of tw) cut[j] = sum / tw.length;
    }
  }

  // triangles touching the covered area (a little beyond, so the edge interpolates)
  const idx = c.surface.index;
  const tris: number[] = [];
  const used = new Int32Array(n).fill(-1);
  const order: number[] = [];
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k];
    const b = idx[k + 1];
    const d = idx[k + 2];
    if (Math.max(cut[a], cut[b], cut[d]) <= 0) continue;
    tris.push(a, b, d);
    for (const v of [a, b, d]) {
      if (used[v] < 0) {
        used[v] = order.length;
        order.push(v);
      }
    }
  }

  // push out along the (welded) normals
  const m = order.length;
  const ease = new Float32Array(m);
  const lo = new Float32Array(m);
  const hi = new Float32Array(m);
  const P = new Float32Array(m * 3);
  /** The way each vertex's fabric stands off it (the welded normal, unless `dir` says otherwise). */
  const D = new Float32Array(m * 3);
  order.forEach((vi, j) => {
    const v = verts[vi];
    const d = spec.dir?.(v) ?? v.n;
    D.set([d.x, d.y, d.z], j * 3);
    ease[j] = spec.ease(v);
    const [a, b] = spec.range?.(v) ?? [ease[j] * 0.75, ease[j] + 0.03];
    lo[j] = a;
    hi[j] = Math.max(a, b);
    P[j * 3] = v.p.x + d.x * ease[j];
    P[j * 3 + 1] = v.p.y + d.y * ease[j];
    P[j * 3 + 2] = v.p.z + d.z * ease[j];
  });

  // falling parts: where the garment leaves the body and hangs from a section
  const hang = new Float32Array(m);
  const hangTarget = new Float32Array(m * 3);
  const hangSec = new Float32Array(m * 3);
  if (spec.hang) {
    const h = spec.hang;
    order.forEach((vi, j) => {
      const v = verts[vi];
      const w = clamp01((h.from - v.p.y) / (h.from - h.to));
      if (w <= 0) return;
      const sec = h.section(v.p.y);
      const th = Math.atan2(v.p.x, v.p.z - sec.cz);
      const lift = h.lift ?? 0;
      hang[j] = w * w * (3 - 2 * w);
      hangSec.set([sec.rx + lift, sec.rz + lift, sec.cz], j * 3);
      hangTarget[j * 3] = (sec.rx + lift) * se(Math.sin(th), HANG_N);
      hangTarget[j * 3 + 1] = v.p.y;
      hangTarget[j * 3 + 2] = sec.cz + (sec.rz + lift) * se(Math.cos(th), HANG_N);
    });
  }

  // relax like cloth, keeping every point within its layer's band off the skin
  const Q = new Float32Array(m * 3);
  const constrain = () => {
    for (let j = 0; j < m; j++) {
      const v = verts[order[j]];
      if (hang[j] > 0) {
        // fabric falls outwards onto the section, it is never pulled in by it
        const rx = hangSec[j * 3];
        const rz = hangSec[j * 3 + 1];
        const cz = hangSec[j * 3 + 2];
        const inside = Math.pow(Math.abs(Q[j * 3]) / rx, HANG_N) + Math.pow(Math.abs(Q[j * 3 + 2] - cz) / rz, HANG_N) < 1;
        const w = inside ? hang[j] : 0;
        Q[j * 3] = Q[j * 3] * (1 - w) + hangTarget[j * 3] * w;
        Q[j * 3 + 1] = Q[j * 3 + 1] * (1 - w) + hangTarget[j * 3 + 1] * w;
        Q[j * 3 + 2] = Q[j * 3 + 2] * (1 - w) + hangTarget[j * 3 + 2] * w;
        if (hang[j] > 0.5) {
          P.set(Q.subarray(j * 3, j * 3 + 3), j * 3);
          continue;
        }
      }
      const d = (Q[j * 3] - v.p.x) * D[j * 3] + (Q[j * 3 + 1] - v.p.y) * D[j * 3 + 1] + (Q[j * 3 + 2] - v.p.z) * D[j * 3 + 2];
      const fix = d < lo[j] ? lo[j] - d : d > hi[j] ? hi[j] - d : 0;
      P[j * 3] = Q[j * 3] + D[j * 3] * fix;
      P[j * 3 + 1] = Q[j * 3 + 1] + D[j * 3 + 1] * fix;
      P[j * 3 + 2] = Q[j * 3 + 2] + D[j * 3 + 2] * fix;
    }
    // coincident vertices move as one
    for (let j = 0; j < m; j++) {
      const tw = twins[order[j]];
      if (tw.length < 2 || tw[0] !== order[j]) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      let k = 0;
      for (const t of tw) {
        const u = used[t];
        if (u < 0) continue;
        x += P[u * 3];
        y += P[u * 3 + 1];
        z += P[u * 3 + 2];
        k++;
      }
      for (const t of tw) {
        const u = used[t];
        if (u >= 0) P.set([x / k, y / k, z / k], u * 3);
      }
    }
  };
  // Taubin smoothing (a shrinking pass then an inflating one): removes small detail like muscle
  // definition without losing volume, so fabric drapes over the body instead of following it
  const pass = (k: number) => {
    for (let j = 0; j < m; j++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let c = 0;
      for (const ni of neighbors[order[j]]) {
        const nj = used[ni];
        if (nj < 0) continue;
        sx += P[nj * 3];
        sy += P[nj * 3 + 1];
        sz += P[nj * 3 + 2];
        c++;
      }
      if (!c) {
        Q.set(P.subarray(j * 3, j * 3 + 3), j * 3);
        continue;
      }
      // move only along the skin normal (the fabric's way off it): sliding sideways would bend straight edges and stretch the fabric
      const [nx, ny, nz] = [D[j * 3], D[j * 3 + 1], D[j * 3 + 2]];
      const d = k * ((sx / c - P[j * 3]) * nx + (sy / c - P[j * 3 + 1]) * ny + (sz / c - P[j * 3 + 2]) * nz);
      Q[j * 3] = P[j * 3] + nx * d;
      Q[j * 3 + 1] = P[j * 3 + 1] + ny * d;
      Q[j * 3 + 2] = P[j * 3 + 2] + nz * d;
    }
    P.set(Q);
  };
  Q.set(P);
  constrain();
  for (let it = 0; it < (spec.smooth ?? 0); it++) {
    pass(0.5);
    pass(-0.53);
    Q.set(P);
    constrain();
  }

  // smooth normals, shared across seams (computed on a softened copy of the surface)
  const shading = new Float32Array(P);
  for (let it = 0; it < (spec.soften ?? 0); it++) {
    for (let j = 0; j < m; j++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let c = 0;
      for (const ni of neighbors[order[j]]) {
        const nj = used[ni];
        if (nj < 0) continue;
        sx += shading[nj * 3];
        sy += shading[nj * 3 + 1];
        sz += shading[nj * 3 + 2];
        c++;
      }
      if (c) Q.set([shading[j * 3] * 0.5 + (sx / c) * 0.5, shading[j * 3 + 1] * 0.5 + (sy / c) * 0.5, shading[j * 3 + 2] * 0.5 + (sz / c) * 0.5], j * 3);
      else Q.set(shading.subarray(j * 3, j * 3 + 3), j * 3);
    }
    shading.set(Q);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.BufferAttribute(shading, 3));
  indexed.setIndex(tris.map((vi) => used[vi]));
  indexed.computeVertexNormals();
  const N = indexed.getAttribute("normal") as THREE.BufferAttribute;
  for (let j = 0; j < m; j++) {
    const tw = twins[order[j]];
    if (tw.length < 2 || tw[0] !== order[j]) continue;
    const acc = new THREE.Vector3();
    for (const t of tw) if (used[t] >= 0) acc.add(tmp.fromBufferAttribute(N, used[t]));
    acc.normalize();
    for (const t of tw) if (used[t] >= 0) N.setXYZ(used[t], acc.x, acc.y, acc.z);
  }

  const spread = spec.weights ?? spreadWeights(c, order, used, P);

  // expand to triangles so each one can carry its own seam-free UVs
  const uvFn = spec.uv ?? defaultUv(c);
  const T = tris.length;
  const pos = new Float32Array(T * 3);
  const nor = new Float32Array(T * 3);
  const uv = new Float32Array(T * 2);
  const cuts = new Float32Array(T);
  const si = new Uint16Array(T * 4);
  const sw = new Float32Array(T * 4);
  const skinIndex = c.surface.skinIndex;
  const skinWeight = c.surface.skinWeight;
  const bone = spec.hang?.bone ?? 0;
  for (let t = 0; t < T; t += 3) {
    const tri = [tris[t], tris[t + 1], tris[t + 2]];
    // the triangle's majority part decides the mapping, so it stays continuous
    const parts = tri.map((vi) => verts[vi].part);
    const major = parts[0] === parts[1] || parts[0] === parts[2] ? parts[0] : parts[1];
    const uvs = tri.map((vi) => uvFn({ ...verts[vi], part: hang[used[vi]] > 0.5 ? Part.Belly : major }));
    const period = uvs[0][2];
    if (period > 0) {
      const us = uvs.map((x) => x[0]);
      if (Math.max(...us) - Math.min(...us) > period / 2) for (const x of uvs) if (x[0] < 0) x[0] += period;
    }
    tri.forEach((vi, k) => {
      const j = used[vi];
      const o = t + k;
      pos.set(P.subarray(j * 3, j * 3 + 3), o * 3);
      nor.set([N.getX(j), N.getY(j), N.getZ(j)], o * 3);
      uv.set([uvs[k][0], uvs[k][1]], o * 2);
      cuts[o] = spec.edge ? Math.min(cut[vi], spec.edge(tmp.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]))) : cut[vi];
      // hanging fabric rides on the pelvis instead of stretching with the legs
      const w = hang[j];
      const weights: [number, number][] = [];
      const r = spread.row[vi];
      for (let q = 0; q < 4; q++) {
        if (r >= 0) weights.push([spread.index[r * 4 + q], spread.weight[r * 4 + q] * (1 - w)]);
        else weights.push([skinIndex.getComponent(vi, q), skinWeight.getComponent(vi, q) * (1 - w)]);
      }
      if (w > 0) {
        const at = weights.find((x) => x[0] === bone);
        if (at) at[1] += w;
        else weights.push([bone, w]);
        weights.sort((a, b) => b[1] - a[1]);
      }
      const top = weights.slice(0, 4);
      const total = top.reduce((a, x) => a + x[1], 0) || 1;
      top.forEach(([b, wt], q) => {
        si[o * 4 + q] = b;
        sw[o * 4 + q] = wt / total;
      });
    });
  }
  indexed.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("cut", new THREE.BufferAttribute(cuts, 1));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  // coverage uses the final edges (a jacket's open front isn't covering anything)
  const finalCut = new Float32Array(cut);
  if (spec.edge) order.forEach((vi, j) => (finalCut[vi] = Math.min(cut[vi], spec.edge!(tmp.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2])))));
  g.userData.cut = finalCut;
  g.userData.weights = spread;
  // how far the fabric stands off each body vertex it covers (NaN where it doesn't), for layers fitted over it
  const offset = new Float32Array(n).fill(NaN);
  order.forEach((vi, j) => {
    if (finalCut[vi] <= 0) return;
    const v = verts[vi];
    offset[vi] = (P[j * 3] - v.p.x) * D[j * 3] + (P[j * 3 + 1] - v.p.y) * D[j * 3 + 1] + (P[j * 3 + 2] - v.p.z) * D[j * 3 + 2];
  });
  g.userData.offset = offset;
  return g;
}

/**
 * The least a layer worn over others may stand off each body vertex: the
 * outermost of their fabric (`offsets`, NaN where uncovered) plus `gap`,
 * carried on past their edges and falling off by `slope` (m per m along the
 * skin), so the layer over a hem or a cuff eases over it instead of stepping.
 */
export function floorOver(c: Character, offsets: Float32Array[], gap: number, slope = 0.25) {
  const { verts, neighbors } = topology(c);
  const n = verts.length;
  const floor = new Float32Array(n).fill(-Infinity);
  for (const o of offsets) for (let i = 0; i < n; i++) if (o[i] + gap > floor[i]) floor[i] = o[i] + gap;
  // (only past their edges: where they cover, the floor is their own fabric)
  const covered = floor.map((f) => +(f > -Infinity));
  for (let it = 0; it < 8; it++) {
    for (let i = 0; i < n; i++) {
      if (covered[i]) continue;
      const p = verts[i].p;
      for (const j of neighbors[i]) {
        const f = floor[j] - slope * p.distanceTo(verts[j].p);
        if (f > floor[i]) floor[i] = f;
      }
    }
  }
  return floor;
}

/**
 * Fabric standing off the skin bends round a joint more softly than the skin
 * under it, and linear blend skinning of an offset surface pinches it (inner
 * elbows and armpits fold through themselves, the outside over-stretches).
 * So the body's weights are spread over the shell, as far as it stands off:
 * barely on a tee, over a few centimetres on a jacket. Neighbours count by
 * how close they are on the shell: where it bunches up (in an armpit) points
 * a few millimetres apart must move alike, or the cloth tears open between them.
 */
function spreadWeights(c: Character, order: number[], used: Int32Array, P: Float32Array): ShellWeights {
  const { verts, neighbors } = topology(c);
  const skinIndex = c.surface.skinIndex;
  const skinWeight = c.surface.skinWeight;
  const m = order.length;
  // dense rows over just the bones this shell uses
  const slot = new Map<number, number>();
  const bones: number[] = [];
  for (const vi of order) {
    for (let q = 0; q < 4; q++) {
      const b = skinIndex.getComponent(vi, q);
      if (skinWeight.getComponent(vi, q) > 0 && !slot.has(b)) {
        slot.set(b, bones.length);
        bones.push(b);
      }
    }
  }
  const nb = bones.length;
  let W = new Float32Array(m * nb);
  let next = new Float32Array(m * nb);
  const alpha = new Float32Array(m);
  // neighbours on the shell, weighted by 1 / distance (normalised per vertex)
  const start = new Int32Array(m + 1);
  const link: number[] = [];
  const pull: number[] = [];
  order.forEach((vi, j) => {
    for (let q = 0; q < 4; q++) {
      const w = skinWeight.getComponent(vi, q);
      if (w > 0) W[j * nb + slot.get(skinIndex.getComponent(vi, q))!] += w;
    }
    const v = verts[vi];
    const off = (P[j * 3] - v.p.x) * v.n.x + (P[j * 3 + 1] - v.p.y) * v.n.y + (P[j * 3 + 2] - v.p.z) * v.n.z;
    alpha[j] = 0.6 * clamp01(off / 0.03);
    let total = 0;
    for (const ni of neighbors[vi]) {
      const nj = used[ni];
      if (nj < 0) continue;
      const w = 1 / Math.max(0.002, Math.hypot(P[nj * 3] - P[j * 3], P[nj * 3 + 1] - P[j * 3 + 1], P[nj * 3 + 2] - P[j * 3 + 2]));
      link.push(nj);
      pull.push(w);
      total += w;
    }
    for (let e = start[j]; e < link.length; e++) pull[e] /= total;
    start[j + 1] = link.length;
  });
  for (let it = 0; it < 12; it++) {
    for (let j = 0; j < m; j++) {
      const o = j * nb;
      const a = start[j + 1] > start[j] ? alpha[j] : 0;
      for (let b = 0; b < nb; b++) next[o + b] = W[o + b] * (1 - a);
      if (!a) continue;
      for (let e = start[j]; e < start[j + 1]; e++) {
        const on = link[e] * nb;
        const f = a * pull[e];
        for (let b = 0; b < nb; b++) next[o + b] += W[on + b] * f;
      }
    }
    [W, next] = [next, W];
  }
  // keep the 4 strongest
  const row = new Int32Array(verts.length).fill(-1);
  const index = new Uint16Array(m * 4);
  const weight = new Float32Array(m * 4);
  order.forEach((vi, j) => {
    row[vi] = j;
    const o = j * nb;
    for (let q = 0; q < 4; q++) {
      let best = -1;
      for (let b = 0; b < nb; b++) {
        if (W[o + b] > 0 && (best < 0 || W[o + b] > W[o + best])) best = b;
      }
      if (best < 0) break;
      index[j * 4 + q] = bones[best];
      weight[j * 4 + q] = W[o + best];
      W[o + best] = -W[o + best];
    }
  });
  return { row, index, weight };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Body vertices a shell hides. Only skin well inside the garment is hidden
 * (never near an opening you can look into: sleeves, shorts legs, an open
 * front), and only if all its neighbours are covered too — the skin is hidden
 * per triangle, and on long triangles a vertex just inside the edge would cut
 * a hole beyond the hem.
 */
export function coveredBy(c: Character, cut: Float32Array, depth = 0.045) {
  const { neighbors } = topology(c);
  const out = new Uint8Array(cut.length);
  for (let i = 0; i < cut.length; i++) {
    if (cut[i] <= depth) continue;
    let ok = true;
    for (const j of neighbors[i]) {
      if (cut[j] <= depth * 0.5) {
        ok = false;
        break;
      }
    }
    if (ok) out[i] = 1;
  }
  return out;
}

/** Makes a material discard fragments outside a shell's `cut` boundary. */
export function withCut<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float cut;\nvarying float vCut;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCut = cut;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCut;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vCut < 0.0) discard;");
  };
  m.customProgramCacheKey = () => "cut";
  return m;
}

/** Hides the body skin wherever it's covered (attribute `covered` > 0.5), so it can never poke through clothes. */
export function withCover<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float covered;\nvarying float vCovered;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCovered = covered;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCovered;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vCovered > 0.5) discard;");
  };
  m.customProgramCacheKey = () => "covered";
  return m;
}

/**
 * Skins arbitrary geometry (buttons, straps, bags…) with the weights of the
 * nearest body vertex among `parts`, so it rides on the body surface.
 */
export function skinToBody(c: Character, g: THREE.BufferGeometry, parts?: Part[], fixed?: number[]) {
  const { verts } = topology(c);
  const pos = g.getAttribute("position");
  const si = new Uint16Array(pos.count * 4);
  const sw = new Float32Array(pos.count * 4);
  const pool = parts ? verts.filter((v) => parts.includes(v.part)) : verts;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (fixed) {
      si.set([fixed[0], fixed[0], fixed[0], fixed[0]], i * 4);
      sw.set([1, 0, 0, 0], i * 4);
      continue;
    }
    p.fromBufferAttribute(pos, i);
    let best = pool[0];
    let bd = Infinity;
    for (const v of pool) {
      const d = v.p.distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    for (let q = 0; q < 4; q++) {
      si[i * 4 + q] = c.surface.skinIndex.getComponent(best.i, q);
      sw[i * 4 + q] = c.surface.skinWeight.getComponent(best.i, q);
    }
  }
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  return g;
}

/**
 * A point on the body surface: among vertices of `parts` near (x, y) that face
 * `dir` (+1 front, -1 back), the one furthest out that way. Returns position
 * and normal. (The mesh is sparse: a small window can hold only vertices on
 * the far side, so those are skipped and the window grows instead.)
 */
export function surfaceAt(c: Character, x: number, y: number, dir = 1, parts?: Part[], tol = 0.012) {
  const { verts } = topology(c);
  let best: Vertex | null = null;
  for (let r = tol; !best && r < 0.1; r *= 1.6) {
    for (const v of verts) {
      if (parts && !parts.includes(v.part)) continue;
      if (v.n.z * dir < 0.2) continue;
      if (Math.abs(v.p.y - y) > r || Math.abs(v.p.x - x) > r) continue;
      if (!best || v.p.z * dir > best.p.z * dir) best = v;
    }
  }
  return best ?? verts[0];
}

/** Cross-section of the body at height y (half widths and centre), for skirts and coat tails. */
export function sectionAt(c: Character, y: number, parts: Part[], band = 0.012, side = 0) {
  const { verts } = topology(c);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of verts) {
    if (!parts.includes(v.part) || Math.abs(v.p.y - y) > band || (side && v.side !== side)) continue;
    minX = Math.min(minX, v.p.x);
    maxX = Math.max(maxX, v.p.x);
    minZ = Math.min(minZ, v.p.z);
    maxZ = Math.max(maxZ, v.p.z);
  }
  if (!Number.isFinite(minX)) return { rx: 0.15, rz: 0.11, cz: 0, cx: 0 };
  return { rx: (maxX - minX) / 2, rz: (maxZ - minZ) / 2, cz: (maxZ + minZ) / 2, cx: (maxX + minX) / 2 };
}
