import * as THREE from "three";

/*
 * Shared geometry helpers: math, a tube generator that turns a ring profile
 * into a (optionally skinned) surface for loose garment parts (skirts, coat
 * tails, hoods, collars), and fabric relief maps made from photo swatches.
 *
 * Character space: feet on y = 0, facing +z, metres.
 */

export type V3 = THREE.Vector3;
export const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const ease = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
export const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));

/* ───────────────────────── Rings + tubes ───────────────────────── */

/** One cross-section: an ellipse (or superellipse with exponent n) at height y. */
export type Ring = { y: number; rx: number; rz: number; cx?: number; cz?: number; n?: number };
/** Skin binding for a vertex at (y, angle): flat [bone, weight, bone, weight, …], up to 4 pairs. */
export type Weigher = (y: number, th: number) => number[];
/** Extra radial offset (metres) at (y, angle): anatomy, folds, pleats. */
export type Shaper = (y: number, th: number) => number;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const RING_KEYS = ["y", "rx", "rz", "cx", "cz", "n"] as const;
const full = (r: Ring): Required<Ring> => ({ cx: 0, cz: 0, n: 2, ...r });

/** Smoothly resamples a profile so silhouettes have no kinks. */
function resample(rings: Ring[], sub: number): Required<Ring>[] {
  const out: Required<Ring>[] = [];
  const get = (i: number) => full(rings[clamp(i, 0, rings.length - 1)]);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const r = {} as Required<Ring>;
      for (const k of RING_KEYS) r[k] = catmull(get(i - 1)[k], get(i)[k], get(i + 1)[k], get(i + 2)[k], t);
      out.push(r);
    }
  }
  out.push(full(rings[rings.length - 1]));
  return out;
}

const se = (s: number, n: number) => Math.sign(s) * Math.pow(Math.abs(s), 2 / n);

export type TubeOptions = {
  radial?: number;
  sub?: number;
  /** Angular range (radians from +z towards +x). Default: full circle. */
  arc?: [number, number];
  weigh?: Weigher;
  shape?: Shaper;
  /** Builds along y, then rotates so y runs forward (+z); for feet and shoes. */
  forward?: boolean;
};

export function tube(profile: Ring[], o: TubeOptions = {}): THREE.BufferGeometry {
  const rings = resample(profile, o.sub ?? (profile.length > 24 ? 1 : 4));
  const radial = o.radial ?? 32;
  const [a0, a1] = o.arc ?? [0, Math.PI * 2];
  const cols = radial + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (const r of rings) {
    const perimeter = Math.PI * (r.rx + r.rz);
    for (let i = 0; i < cols; i++) {
      const th = a0 + ((a1 - a0) * i) / radial;
      const d = o.shape?.(r.y, th) ?? 0;
      pos.push(r.cx + (r.rx + d) * se(Math.sin(th), r.n), r.y, r.cz + (r.rz + d) * se(Math.cos(th), r.n));
      uv.push(((th - a0) / (Math.PI * 2)) * perimeter, r.y);
      if (o.weigh) pushWeights(o.weigh(r.y, th), skinIndex, skinWeight);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * cols + i;
      const b = a + cols;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (o.weigh) {
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  }
  g.setIndex(index);
  g.computeVertexNormals();
  // make sure normals point outwards whatever order the rings came in
  const n = g.getAttribute("normal");
  const row = Math.floor(rings.length / 2);
  const mid = row * cols + Math.floor(radial / 4);
  const r = rings[row];
  if ((pos[mid * 3] - r.cx) * n.getX(mid) + (pos[mid * 3 + 2] - r.cz) * n.getZ(mid) < 0) {
    for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
    g.setIndex(index);
    g.computeVertexNormals();
  }
  if (o.forward) g.rotateX(Math.PI / 2);
  return g;
}

function pushWeights(w: number[], skinIndex: number[], skinWeight: number[]) {
  let total = 0;
  for (let k = 1; k < w.length; k += 2) total += w[k];
  for (let k = 0; k < 4; k++) {
    skinIndex.push(w[k * 2] ?? 0);
    skinWeight.push(total ? (w[k * 2 + 1] ?? 0) / total : k === 0 ? 1 : 0);
  }
}

/* ───────────────────────── Fabric relief ───────────────────────── */

/** Turns a fabric swatch into a tangent-space normal map from its luminance (weave relief). */
export function normalMapFrom(image: CanvasImageSource & { width: number; height: number }) {
  const W = Math.min(512, image.width);
  const H = Math.min(512, image.height);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  const at = (x: number, y: number) => h[((y + H) % H) * W + ((x + W) % W)];
  const out = ctx.createImageData(W, H);
  const strength = 2.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
