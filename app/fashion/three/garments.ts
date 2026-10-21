import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FabricFinish, FashionProduct, Slot } from "@/lib/fashion-products";
import { HANG_N, bodyVertices, coveredBy, fitShell, floorOver, sectionAt, skinToBody, surfaceAt, vertices, withCut, type Section, type ShellSpec, type ShellWeights, type Vertex } from "./fit";
import { Part, type Character } from "./model";
import { clamp, gauss, lerp, tube, v, type Ring, type V3, type Weigher } from "./surface";

/*
 * Garments for a loaded character. Fitted parts (bodies, sleeves, legs, shoes,
 * hats, pockets, plackets, waistbands) are shells fitted on the body surface;
 * loose parts (hood, skirts, coat tails, collars) are generated from body
 * cross-sections; small hardware (buttons, rivets, laces, glasses, bags) is
 * placed on the surface and skinned to whatever it sits on.
 */

export type Fabric = { map: THREE.Texture; normal: THREE.Texture };
export type Reveal = "down" | "up";

/** What garment builders need from the scene. */
export interface Rig {
  character: Character;
  /** Character-space parent for garment meshes. */
  rootGroup: THREE.Group;
  /** Pelvis + the ring of spring bones that swing skirts and coat tails. */
  skirtSkeleton: THREE.Skeleton;
  skirtWeights(top: number): Weigher;
  loadFabric(src: string, size: number): Promise<Fabric>;
  /** What's worn in a slot: outerwear is fitted over the top under it, a strap over both. */
  wornIn(slot: Slot): Garment | undefined;
}

type Finish = THREE.MeshPhysicalMaterialParameters & { relief?: number };
const finishes: Record<FabricFinish, Finish> = {
  cotton: { roughness: 0.9, sheen: 0.6, sheenRoughness: 0.8, relief: 0.5 },
  knit: { roughness: 0.95, sheen: 0.8, sheenRoughness: 0.9, relief: 1.4 },
  denim: { roughness: 0.86, sheen: 0.35, sheenRoughness: 0.7, relief: 1.1 },
  twill: { roughness: 0.82, sheen: 0.3, sheenRoughness: 0.7, relief: 0.7 },
  nylon: { roughness: 0.45, sheen: 0.1, sheenRoughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5, relief: 0.25 },
  leather: { roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.4, relief: 0.35 },
  tulle: { roughness: 0.75, sheen: 0.7, sheenRoughness: 0.6, relief: 0.6 },
  metal: { roughness: 0.25, metalness: 0.9 },
  plastic: { roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15 },
};
const surfaceParams = (f: FabricFinish): THREE.MeshPhysicalMaterialParameters => {
  const { relief: _r, ...rest } = finishes[f];
  void _r;
  return rest;
};

type Attachment = { parent: THREE.Object3D; object: THREE.Object3D };

export class Garment {
  readonly attachments: Attachment[] = [];
  readonly materials: THREE.MeshPhysicalMaterial[] = [];
  readonly plane = new THREE.Plane(v(0, 1, 0), 100);
  /** Objects that hang from the hand and swing (tote). */
  readonly hanging: THREE.Object3D[] = [];
  /** Body vertices this garment hides (well inside its edges). */
  coverage: Uint8Array | null = null;
  /** The section the garment hangs on below `from` (for keeping the hands clear of it), and the room it leaves under it. */
  fall: { from: number; section: (y: number) => Section; room: number } | null = null;
  reveal: Reveal = "down";
  /** How far the fabric stands off each body vertex (NaN where it doesn't cover), for layers worn over it. */
  offset: Float32Array | null = null;
  /** The garments this one was fitted over (an outer over its top); it's refitted when they change. */
  over: Garment[] = [];
  /** The main fitted shell (what's sewn on it, or strapped over it, moves with its weights). */
  main: THREE.BufferGeometry | null = null;
  /** The garment's outermost surface (or the skin beside it) seen from above, for what lies over its shoulders. */
  above: Field | null = null;
  /** A hood lying on the back, which a layer worn over the garment lays over its own collar instead. */
  hood: THREE.Mesh | null = null;
  /** Parts of the garments under this one that it replaces while worn (their hood, laid over this one's collar). */
  hides: THREE.Object3D[] = [];

  constructor(
    readonly product: FashionProduct,
    private rig: Rig,
  ) {}

  get slot(): Slot {
    return this.product.slot;
  }

  /** The product's own fabric (photo swatch + relief), optionally a shade off. */
  fabric(o: { shade?: number; shell?: boolean; params?: THREE.MeshPhysicalMaterialParameters } = {}) {
    const p = this.product;
    const finish = p.fabric?.finish ?? "cotton";
    const relief = finishes[finish].relief ?? 0.6;
    const m = this.mat(p.color, { ...surfaceParams(finish), side: THREE.DoubleSide, ...o.params }, o.shell);
    const k = o.shade ?? 1;
    if (p.fabric) {
      const smoothFabric = finish === "nylon";
      this.rig.loadFabric(p.fabric.src, p.fabric.size).then(({ map, normal }) => {
        if (smoothFabric) {
          m.normalMap = normal;
          m.normalScale.set(0.15, 0.15);
          // the photo's average reads lighter under the studio light; settle it back to the garment's tone
          m.color.set(p.color).multiplyScalar(k * 0.68);
          m.needsUpdate = true;
          return;
        }
        m.map = map;
        m.normalMap = normal;
        m.normalScale.set(relief, relief);
        m.color.setRGB(k, k, k);
        m.needsUpdate = true;
      });
    } else if (k !== 1) {
      m.color.multiplyScalar(k);
    }
    return m;
  }

  mat(color: THREE.ColorRepresentation, params: THREE.MeshPhysicalMaterialParameters = {}, shell = false) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.8, clippingPlanes: [this.plane], clipShadows: true, ...params });
    if (m.sheen && !params.sheenColor) m.sheenColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4);
    if (shell) withCut(m);
    this.materials.push(m);
    return m;
  }

  /** A mesh skinned to the body skeleton (geometry in character space). */
  skinned(geometry: THREE.BufferGeometry, material: THREE.Material, skeleton = this.rig.character.skeleton) {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.attachments.push({ parent: this.rig.rootGroup, object: mesh });
    return mesh;
  }

  /** A rigid object parented to a bone (tote). */
  rigid(parent: THREE.Object3D, object: THREE.Object3D) {
    this.attachments.push({ parent, object });
    return object;
  }

  setLevel(h: number) {
    if (this.reveal === "down") this.plane.set(v(0, 1, 0), -h);
    else this.plane.set(v(0, -1, 0), h);
  }

  showAll() {
    this.plane.set(v(0, 1, 0), 100);
  }

  setHighlight(on: boolean) {
    for (const m of this.materials) m.emissive.set(on ? "#3a3530" : "#000000");
  }

  attach() {
    for (const { parent, object } of this.attachments) {
      object.traverse((o) => (o.userData.slot = this.slot));
      parent.add(object);
    }
    for (const o of this.hides) o.visible = false;
  }

  /** How far the garment stands off the body at height y (for keeping arms clear of it). */
  bulk(y: number): number {
    const own = bulkOf(this.product, y, this.rig.character.landmarks.waistY);
    return this.slot === "outer" ? Math.max(own, ...this.over.map((u) => u.bulk(y) + OVER_GAP + 0.004)) : own;
  }

  dispose() {
    for (const o of this.hides) o.visible = true;
    for (const { parent, object } of this.attachments) {
      parent.remove(object);
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    for (const m of this.materials) m.dispose();
  }
}

/* ───────────────────────── Layers ───────────────────────── */

type Layer = "tee" | "shirt" | "knit" | "jacket" | "coat" | "pants" | "shoes" | "hat";
/**
 * How far each layer may sit off the skin [min, max] (m). Outerwear's band is
 * for bare skin: over a top it is fitted on that top's fabric instead (see
 * `floorOver`), so it is as close as what's under it lets it be. The outer
 * slot holds one garment, so a jacket and a coat never sit over each other.
 */
const LAYERS: Record<Layer, [number, number]> = {
  tee: [0.005, 0.024],
  shirt: [0.007, 0.026],
  knit: [0.012, 0.024],
  jacket: [0.012, 0.034],
  coat: [0.014, 0.038],
  pants: [0.006, 0.034],
  shoes: [0.007, 0.022],
  hat: [0.01, 0.03],
};
/**
 * The same for sleeves, which sit closer: a hanging arm is only a few
 * centimetres from the side of the torso, and both carry their layers.
 */
const SLEEVES: Partial<Record<Layer, [number, number]>> = {
  tee: [0.005, 0.016],
  shirt: [0.007, 0.018],
  knit: [0.012, 0.02],
  jacket: [0.01, 0.024],
  coat: [0.012, 0.026],
};
/** Room a top leaves below the waist over the body's widest section, for what's under it (trousers; outerwear: over bare skin). */
const FALL: Partial<Record<Layer, number>> = { tee: 0.018, shirt: 0.02, knit: 0.024, jacket: 0.022, coat: 0.028 };
/** Room between a layer and the fabric of the one under it: its own thickness and a little air. */
const OVER_GAP = 0.005;
const layerOf = (kind: FashionProduct["kind"]): Layer => {
  switch (kind) {
    case "tee":
      return "tee";
    case "shirt":
      return "shirt";
    case "sweater":
    case "hoodie":
      return "knit";
    case "jacket":
      return "jacket";
    case "coat":
      return "coat";
    case "sneakers":
    case "boots":
      return "shoes";
    case "cap":
    case "beanie":
      return "hat";
    default:
      return "pants";
  }
};

/** How far a worn product stands off the body at height y (for keeping arms clear of it). */
export function bulkOf(p: FashionProduct, y: number, waistY: number) {
  const layer = layerOf(p.kind);
  if (p.slot === "bag") return 0;
  // trouser legs (not the waist, where the hands go into the pockets)
  if (p.kind === "jeans" || p.kind === "chinos" || p.kind === "shorts") return y < waistY - 0.08 ? 0.022 : 0;
  const fall = FALL[layer];
  if (fall === undefined) return 0;
  return y < waistY ? fall + 0.004 : LAYERS[layer][1];
}

/* ───────────────────────── Helpers ───────────────────────── */

const wave = (x: number) => 0.5 + 0.5 * Math.sin(x);
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const TORSO_PARTS: Part[] = [Part.Chest, Part.Belly, Part.Neck];
const isArm = (v: Vertex) => v.part === Part.UpperArm || v.part === Part.LowerArm;
/** Arm or hand: sleeves run on past the wrist joint, so their cuffs are cut cleanly round the wrist. */
const isSleeve = (v: Vertex) => isArm(v) || v.part === Part.Hand;
const smoothstep = THREE.MathUtils.smoothstep;
const isLeg = (v: Vertex) => v.part === Part.Thigh || v.part === Part.Calf;
const isTorso = (v: Vertex) => v.part === Part.Chest || v.part === Part.Belly || v.part === Part.Neck;

/** Body measurements every builder uses. */
function measure(c: Character) {
  const L = c.landmarks;
  const armLen = L.wristX - L.shoulderX;
  const neck = sectionAt(c, L.neckY + 0.01, [Part.Neck]);
  const verts = vertices(c);
  // the neck column itself (above where the trapezius flares out), for necklines
  const col = verts.filter((v) => v.part === Part.Neck && v.p.y > L.neckY + 0.015 && v.p.y < L.neckY + 0.06);
  const mid = col.filter((v) => Math.abs(v.p.x) < 0.015);
  const fronts = mid.filter((v) => v.n.z > 0).map((v) => v.p.z);
  const backs = mid.filter((v) => v.n.z < 0).map((v) => v.p.z);
  let colZ = neck.cz;
  let colRz = neck.rz;
  let colRx = neck.rx;
  if (fronts.length && backs.length) {
    const nf = Math.min(...fronts);
    const nb = Math.max(...backs);
    colZ = (nf + nb) / 2;
    colRz = (nf - nb) / 2;
    const sides = col.filter((v) => Math.abs(v.p.z - colZ) < 0.02 && Math.abs(v.p.x) > 0.02).map((v) => Math.abs(v.p.x));
    if (sides.length) colRx = Math.min(...sides);
  }
  // where the neck column meets the shoulders at the sides: on a steep trapezius, well above the neck joint
  let sideRootY = Infinity;
  for (const v of verts) {
    if ((v.part !== Part.Neck && v.part !== Part.Chest) || v.p.y < L.neckY - 0.01) continue;
    const dz = v.p.z - colZ;
    const r = Math.hypot(v.p.x / (colRx + 0.012), dz / (colRz + 0.012));
    if (r < 1.05 && Math.abs(v.p.x) > 0.7 * Math.hypot(v.p.x, dz)) sideRootY = Math.min(sideRootY, v.p.y);
  }
  sideRootY = clamp(sideRootY, L.neckY, L.neckY + 0.08);
  // the bust (or chest) apex: tops drape from here
  let bustY = L.chestY;
  let bustZ = -Infinity;
  let bustX = 0.08;
  for (const v of verts) {
    if (v.part === Part.Chest && Math.abs(v.p.x) > 0.02 && Math.abs(v.p.x) < 0.15 && v.p.z > bustZ) {
      bustZ = v.p.z;
      bustY = v.p.y;
      bustX = Math.abs(v.p.x);
    }
  }
  const waist = sectionAt(c, L.waistY, [Part.Belly, Part.Chest], 0.01);
  const waistFront = waist.cz + waist.rz;
  /**
   * How far fabric on the front of the torso stands off the skin to span it the
   * way cloth does: straight across between the bust (or chest) apexes, and
   * falling from them to the waist instead of tucking in under them.
   */
  /**
   * In the cleavage the skin faces across to the other side: fabric pushed
   * out that way would cross over the middle and fold, so it comes straight
   * forward there instead (0 … 1 of the way).
   */
  const inCleavage = (v: Vertex) => {
    if (!isTorso(v) || v.n.z < 0 || v.n.x * v.p.x >= 0 || v.p.y > bustY + 0.04 || v.p.y < L.waistY + 0.04) return 0;
    return (1 - smoothstep(Math.abs(v.p.x), bustX - 0.01, bustX + 0.01)) * smoothstep(Math.abs(v.n.x), 0.15, 0.4);
  };
  const forward = v(0, 0, 1);
  const drapeDir = (vx: Vertex) => {
    const w = inCleavage(vx);
    return w > 0 ? vx.n.clone().lerp(forward, w).normalize() : vx.n;
  };
  const drape = (vx: Vertex) => {
    if (!isTorso(vx) || vx.p.y > bustY + 0.04 || vx.p.y < L.waistY) return 0;
    const across = 1 - smoothstep(Math.abs(vx.p.x), bustX + 0.02, bustX + 0.07);
    const above = 1 - smoothstep(vx.p.y, bustY, bustY + 0.04);
    const d = drapeDir(vx);
    // only skin facing forward (or turned forward in the cleavage): at the sides the fabric would go out sideways
    const facing = smoothstep(d.z, 0.45, 0.75);
    const z = vx.p.y >= bustY ? bustZ : lerp(waistFront, bustZ, smoothstep(vx.p.y, L.waistY, bustY));
    // (not all the way onto the line: skin pushed out onto one plane from different depths would flip over itself in it)
    return Math.min(0.05, (0.8 * Math.max(0, z - vx.p.z) * across * above * facing) / Math.max(d.z, 0.6));
  };
  return {
    L,
    armLen,
    elbowT: (L.elbowX - L.shoulderX) / armLen,
    armT: (v: Vertex) => (Math.abs(v.p.x) - L.shoulderX) / armLen,
    neckZ: neck.cz,
    neckBaseY: L.neckY - 0.01,
    colZ,
    colRx,
    colRz,
    sideRootY,
    bustY,
    drape,
    drapeDir,
  };
}
type M = ReturnType<typeof measure>;

/**
 * The section a top falls from at height y: the widest the body gets between
 * the waist and y (fabric doesn't tuck back in), with room for what's under.
 * The room is added to each section before taking the widest, so it isn't
 * counted twice where the body recedes (under the belly, above the seat).
 */
function fallSection(c: Character, m: M, allowance: number, top = m.L.waistY + 0.03) {
  const { L } = m;
  const step = 0.01;
  const table: Section[] = [];
  let rx = 0;
  let front = -Infinity;
  let back = Infinity;
  for (let y = top; y > L.kneeY; y -= step) {
    const s = sectionAt(c, y, y > L.waistY - 0.02 ? [Part.Belly, Part.Chest] : [Part.Belly, Part.Thigh], 0.008);
    rx = Math.max(rx, s.rx + allowance);
    front = Math.max(front, s.cz + s.rz + allowance);
    back = Math.min(back, s.cz - s.rz - allowance);
    table.push({ rx, rz: (front - back) / 2, cz: (front + back) / 2 });
  }
  return (y: number): Section => {
    const f = clamp((top - y) / step, 0, table.length - 1);
    const i = Math.floor(f);
    const a = table[i];
    const b = table[Math.min(i + 1, table.length - 1)];
    const t = f - i;
    return { rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), cz: lerp(a.cz, b.cz, t) };
  };
}

/**
 * Keeps the torso below a neckline: a crew line round the base of the neck,
 * `drop` below the neck joint at the front and `back` above it at the back,
 * that never climbs higher than `rise` over that line (it can't creep up the
 * neck) — except at the sides, where it follows the shoulders up to the neck
 * column (a steep trapezius rises well above the neck joint).
 */
function neckline(m: M, v: Vertex, o: NecklineOptions = {}) {
  const { drop = 0.005, widen = 0.012, back = 0.02, rise = 0.02 } = o;
  const dz = v.p.z - m.colZ;
  const cs = dz / (Math.hypot((v.p.x * m.colRz) / m.colRx, dz) || 1); // +1 front … -1 back
  const base = m.L.neckY + lerp(back, -drop, (cs + 1) / 2);
  const out = (Math.hypot(v.p.x / (m.colRx + widen), dz / (m.colRz + widen)) - 1) * Math.min(m.colRx, m.colRz);
  const side = 1 - Math.abs(cs);
  const ceil = lerp(base + rise * (1 - Math.max(0, cs)), Math.max(base + rise, m.sideRootY + 0.005), side * side);
  return Math.min(ceil - v.p.y, Math.max(base - v.p.y, out));
}

type NecklineOptions = { drop?: number; widen?: number; back?: number; rise?: number };
type TopOptions = { hem: number; sleeve: number; neck?: NecklineOptions; open?: number };

/** Coverage of a top: torso to the hem, arms to the sleeve end, open front for jackets. */
function topCut(m: M, o: TopOptions) {
  return (v: Vertex) => {
    if (isSleeve(v)) return (o.sleeve - m.armT(v)) * m.armLen;
    if (!isTorso(v) && v.part !== Part.Thigh) return -1;
    return Math.min(v.p.y - o.hem, neckline(m, v, o.neck));
  };
}

/** Ease of a top: loose over the belly and hips, flaring at short sleeves, folds at elbow and wrist. */
function topEase(m: M, base: number, o: TopOptions, sleeveBase = base) {
  const { L } = m;
  return (v: Vertex) => {
    if (isSleeve(v)) {
      const t = m.armT(v);
      const folds =
        o.sleeve > 0.8
          ? 0.0035 * wave(t * 55 + v.p.z * 90) * gauss(t - m.elbowT, 0.06) + 0.004 * wave(t * 70 + v.p.z * 120) * gauss(t - (o.sleeve - 0.08), 0.05)
          : 0.003 * Math.max(0, t - (o.sleeve - 0.25)) * 8;
      return sleeveBase + folds;
    }
    const belly = clamp((L.chestY - 0.05 - v.p.y) / 0.25, 0, 1);
    return base + belly * 0.004 + 0.0015 * Math.sin(v.p.y * 90 + Math.atan2(v.p.x, v.p.z) * 3) * gauss(v.p.y - L.waistY, 0.05);
  };
}

/** Moves geometry so it's centred at `at` with its +z along `normal`. */
function place(geo: THREE.BufferGeometry, at: V3, normal: V3, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), normal.clone().normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), spin));
  geo.applyQuaternion(q);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

/** Where fitted fabric is, seen along one axis (null where there's none). */
type Field = (a: number, b: number) => number | null;

/** Two fields as one: where both have fabric, the one `pick` chooses (Math.max seen from above, Math.min from behind). */
const both = (a: Field, b: Field, pick: (p: number, q: number) => number): Field => (x, y) => {
  const p = a(x, y);
  const q = b(x, y);
  return p === null ? q : q === null ? p : pick(p, q);
};

/** A field built the first time it's asked (rasterising a shell isn't free, and most are never asked). */
const lazy = (make: () => Field): Field => {
  let f: Field | null = null;
  return (a, b) => (f ??= make())(a, b);
};

/**
 * A fitted shell seen along one axis, on a 1 cm grid: the outermost fabric
 * (where it isn't cut away) over each cell. `axis` 1 looks down (the highest
 * fabric over (x, z)); `axis` 2 looks from the front (sign 1, the front-most
 * fabric over (x, y)) or from the back (sign -1). Loose parts and hardware sit
 * on it, rather than at a fixed distance from the skin that the fabric may not
 * be at.
 */
function fabricField(geo: THREE.BufferGeometry, axis: 1 | 2, sign = 1, cell = 0.01): Field {
  // a shell is a triangle soup (three vertices per triangle), each rasterised onto the grid:
  // its triangles are a few cm across, so its vertices alone would leave cells empty or low
  const pos = geo.getAttribute("position");
  const cut = geo.getAttribute("cut");
  const b = axis === 1 ? 2 : 1;
  const grid = new Map<number, number>();
  const key = (i: number, j: number) => (i + 1000) * 2000 + (j + 1000);
  const put = (i: number, j: number, w: number) => {
    const k = key(i, j);
    const prev = grid.get(k);
    if (prev === undefined || w > prev) grid.set(k, w);
  };
  const P = [v(), v(), v()];
  const C = [0, 0, 0];
  const e1 = v();
  const e2 = v();
  for (let t = 0; t < pos.count; t += 3) {
    for (let k = 0; k < 3; k++) {
      P[k].fromBufferAttribute(pos, t + k);
      C[k] = cut ? cut.getX(t + k) : 1;
    }
    if (Math.max(...C) < 0) continue;
    // seen from the front, only fabric facing the viewer (not the back of the body behind it)
    const n = e1.subVectors(P[1], P[0]).cross(e2.subVectors(P[2], P[0]));
    if (axis === 2 && n.z * sign <= 0.1 * n.length()) continue;
    const A = P.map((q) => q.x);
    const B = P.map((q) => q.getComponent(b));
    const W = P.map((q) => q.getComponent(axis) * sign);
    for (let k = 0; k < 3; k++) if (C[k] >= 0) put(Math.round(A[k] / cell), Math.round(B[k] / cell), W[k]);
    const det = (A[1] - A[0]) * (B[2] - B[0]) - (A[2] - A[0]) * (B[1] - B[0]);
    if (Math.abs(det) < 1e-9) continue;
    for (let i = Math.ceil(Math.min(...A) / cell); i * cell <= Math.max(...A); i++) {
      for (let j = Math.ceil(Math.min(...B) / cell); j * cell <= Math.max(...B); j++) {
        const da = i * cell - A[0];
        const db = j * cell - B[0];
        const l1 = (da * (B[2] - B[0]) - (A[2] - A[0]) * db) / det;
        const l2 = ((A[1] - A[0]) * db - da * (B[1] - B[0])) / det;
        const l0 = 1 - l1 - l2;
        if (l0 < 0 || l1 < 0 || l2 < 0 || l0 * C[0] + l1 * C[1] + l2 * C[2] < 0) continue;
        put(i, j, l0 * W[0] + l1 * W[1] + l2 * W[2]);
      }
    }
  }
  return (x, y) => {
    const ci = Math.round(x / cell);
    const cj = Math.round(y / cell);
    for (let r = 0; r <= 2; r++) {
      let best = -Infinity;
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          const w = grid.get(key(ci + i, cj + j));
          if (w !== undefined && w > best) best = w;
        }
      }
      if (best > -Infinity) return best * sign;
    }
    return null;
  };
}

const necks = new WeakMap<Character, Field>();
/** The skin of the neck and shoulders seen from above (not the head over them), cached per character. */
function neckTop(c: Character): Field {
  let f = necks.get(c);
  if (f) return f;
  const s = c.surface;
  const tris: number[] = [];
  for (let k = 0; k < s.index.length; k += 3) {
    const t = [s.index[k], s.index[k + 1], s.index[k + 2]];
    if (t.some((i) => s.part[i] !== Part.Neck && s.part[i] !== Part.Chest)) continue;
    for (const i of t) tris.push(s.position[i * 3], s.position[i * 3 + 1], s.position[i * 3 + 2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  f = fabricField(geo, 1);
  geo.dispose();
  necks.set(c, f);
  return f;
}

/** Whatever is on top at (x, z): the garment's fabric, or bare skin where it doesn't reach (above a neckline). */
function onTop(c: Character, fabric: Field): Field {
  const skin = neckTop(c);
  return (x, z) => {
    const a = fabric(x, z);
    const b = skin(x, z);
    return a === null ? b : b === null ? a : Math.max(a, b);
  };
}

/**
 * Hardware on the front (dir 1) or back (-1) of the body at (x, y): `lift` off
 * the fabric in `on` if there is any there, else `lift` off the skin.
 */
function pin(c: Character, g: Garment, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, lift: number, dir = 1, parts = TORSO_PARTS, on?: Field) {
  const s = surfaceAt(c, x, y, dir, parts);
  const z = on?.(x, y);
  const at = z == null ? s.p.clone().addScaledVector(s.n, lift) : v(x, y, z).addScaledVector(s.n, lift);
  g.skinned(skinToBody(c, place(geo, at, s.n), parts), mat);
}

/**
 * Seats a loose part (collar, hood) built round the neck on the garment under
 * it. Each angle round the neck moves up or down so the part's lowest ring
 * rests on the fabric there (following the shoulder slope and the back), and
 * no point ends up below the fabric. With `taper` [span, k], points `span`
 * above the ring only move by k of that (a hood's top stays at the neck).
 * With `back` (the fabric's depth seen from behind), the back of the ring is
 * seated outwards onto it instead: a back panel is near vertical under a
 * collar, and a height seen from above lands anywhere on it.
 */
function seat(geo: THREE.BufferGeometry, under: Field, ring: Ring, gap: number, taper: [number, number] = [1, 1], back?: Field) {
  const { y: y0, rx, rz } = ring;
  const cz = ring.cz ?? 0;
  const N = 72;
  const dy = new Float32Array(N);
  const has = new Uint8Array(N);
  const out = new Float32Array(N).fill(1);
  const behind = (th: number) => (back ? smoothstep(-Math.cos(th), 0.3, 0.5) : 0);
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    const w = behind(th);
    const bz = w > 0 ? back!(rx * Math.sin(th), y0) : null;
    if (bz !== null) out[k] = lerp(1, clamp((bz - gap - cz) / (rz * Math.cos(th)), 0.8, 1.6), w);
    const h = under(rx * Math.sin(th), cz + rz * Math.cos(th));
    if (h === null) continue;
    dy[k] = clamp(h + gap - y0, -0.06, 0.09) * (1 - w);
    has[k] = 1;
  }
  // angles with no fabric under them (an open front) take their neighbours' height
  if (has.some(Boolean)) {
    for (let k = 0; k < N; k++) {
      if (has[k]) continue;
      let l = k;
      let r = k;
      while (!has[(l + N) % N]) l--;
      while (!has[r % N]) r++;
      dy[k] = lerp(dy[(l + N) % N], dy[r % N], (k - l) / (r - l));
    }
  }
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const th = Math.atan2(pos.getX(i), pos.getZ(i) - cz);
    const f = ((th / (Math.PI * 2) + 1) % 1) * N;
    const k = Math.floor(f);
    const follow = lerp(1, taper[1], clamp((pos.getY(i) - y0) / taper[0], 0, 1));
    let y = pos.getY(i) + lerp(dy[k % N], dy[(k + 1) % N], f - k) * follow;
    // out (or in) onto the back panel: the lowest ring fully, the stand above it not at all
    const s = 1 + (lerp(out[k % N], out[(k + 1) % N], f - k) - 1) * (1 - clamp((pos.getY(i) - y0) / 0.04, 0, 1));
    const x = pos.getX(i) * s;
    let z = cz + (pos.getZ(i) - cz) * s;
    if (behind(th) > 0.5) {
      const bz = back!(x, y);
      if (bz !== null) z = Math.min(z, bz - gap);
    } else {
      const h = under(x, z);
      if (h !== null) y = Math.max(y, h + gap);
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ───────────────────────── Builders ───────────────────────── */

/** The slots a product is fitted over: outerwear over the top, a cross-body strap over everything it crosses. */
export const fitsOver = (p: FashionProduct): Slot[] => (p.slot === "outer" ? ["top"] : p.kind === "crossbody" ? ["top", "outer", "bottom"] : []);

/** Builds a product for the rig's body, over `under` (by default what's worn in the slots it fits over). */
export function buildGarment(rig: Rig, p: FashionProduct, under = fitsOver(p).flatMap((s) => rig.wornIn(s) ?? [])): Garment {
  const c = rig.character;
  const g = new Garment(p, rig);
  g.over = under;
  const m = measure(c);
  const { L } = m;
  const shellMat = g.fabric({ shell: true });
  const shade = (k: number, shell = true) => g.fabric({ shade: k, shell });
  const accent = g.mat(p.accent, { roughness: 0.5 });
  const metal = g.mat(p.accent, finishes.metal);
  const pelvisBone = c.skeleton.bones.indexOf(c.bone("pelvis"));
  /** Layer band for this product, shifted out by `lift` for details sewn on top (bands, pockets). */
  const layer = layerOf(p.kind);
  const band = LAYERS[layer];
  const sleeveBand = SLEEVES[layer] ?? [band[0], band[0] + 0.022];
  const isTop = SLEEVES[layer] !== undefined;
  /**
   * Under the arm, sleeve and side panel sit at the bottom of their bands (a
   * gusset): fitted in the T-pose, both swing into the narrow gap between a
   * hanging arm and the torso, and each would bring its full ease into it.
   */
  const gusset = (v: Vertex) => {
    if (!isTop) return 0;
    if (isArm(v)) return v.n.y < -0.25 ? smoothstep(-v.n.y, 0.25, 0.55) * (1 - smoothstep(m.armT(v), m.elbowT - 0.05, m.elbowT + 0.05)) : 0;
    if (!isTorso(v)) return 0;
    return smoothstep(Math.abs(v.n.x), 0.45, 0.7) * smoothstep(v.p.y, L.waistY - 0.02, L.waistY + 0.05) * (1 - smoothstep(v.p.y, L.shoulderY - 0.02, L.shoulderY + 0.03));
  };
  /** Every layer of a top spans the bust the same way, so they stay in order over it. */
  const drape = (v: Vertex) => (isTop ? m.drape(v) : 0);
  /** Over another top, the least this one may stand off the skin: on that top's fabric. */
  const inner = under.flatMap((u) => u.offset ?? []);
  const floor = inner.length ? floorOver(c, inner, OVER_GAP) : null;
  let hangSpec: ShellSpec["hang"] | undefined;
  let edgeSpec: ShellSpec["edge"] | undefined;
  /** The main shell's skin weights: everything sewn on it moves with it. */
  let weights: ShellWeights | undefined;
  const shell = (cut: (v: Vertex) => number, ease: (v: Vertex) => number, mat: THREE.Material = shellMat, smooth = 8, covers = false, lift = 0) => {
    const range = (v: Vertex): [number, number] => {
      const [lo, hi] = isSleeve(v) ? sleeveBand : isLeg(v) || v.part === Part.Foot || v.part === Part.Head ? [band[0], band[1] + 0.006] : band;
      const d = drape(v);
      const under = floor ? floor[v.i] - d : -Infinity;
      const a = Math.max(lo, under);
      return [a + d + lift, Math.max(lerp(hi, lo + 0.004, gusset(v)), a + 0.006) + d + lift];
    };
    const eased = (v: Vertex) => {
      const lo = isSleeve(v) ? sleeveBand[0] : band[0];
      const e = lerp(ease(v), lo + 0.001, gusset(v)) + drape(v);
      return (floor ? Math.max(e, floor[v.i] + 0.002) : e) + lift;
    };
    const hang = hangSpec && { ...hangSpec, lift: (hangSpec.lift ?? 0) + lift };
    // fabric reflects light as a smooth surface; tight things (pants, shoes) a bit less so
    const soften = { tee: 6, shirt: 8, knit: 12, jacket: 18, coat: 18, pants: 4, shoes: 2, hat: 2 }[layer];
    const geo = fitShell(c, { cut, ease: eased, smooth, range, hang, soften, edge: edgeSpec, weights, dir: isTop ? m.drapeDir : undefined });
    // what a layer over this one is fitted on: the outermost of its fabric (details included)
    const off = geo.userData.offset as Float32Array;
    if (lift >= 0 && mat.side !== THREE.BackSide) {
      const o = (g.offset ??= new Float32Array(off.length).fill(NaN));
      for (let i = 0; i < off.length; i++) if (off[i] > o[i] || (Number.isNaN(o[i]) && !Number.isNaN(off[i]))) o[i] = off[i];
    }
    if (covers) {
      g.main ??= geo;
      weights ??= geo.userData.weights as ShellWeights;
      // under an open front you can look in as deep as the garment stands off the body
      const mask = coveredBy(c, geo.userData.cut as Float32Array, edgeSpec ? Math.max(0.045, band[1]) : undefined);
      g.coverage ??= new Uint8Array(mask.length);
      for (let i = 0; i < mask.length; i++) if (mask[i]) g.coverage[i] = 1;
    }
    return g.skinned(geo, mat);
  };
  const bodyNear = (geo: THREE.BufferGeometry, parts: Part[] = TORSO_PARTS) => skinToBody(c, geo, parts);
  /**
   * Below the waist, tops fall straight from the body's widest section (plus
   * room for what's under), and never inside what a top under them falls on.
   */
  const fallFrom = (allowance: number, from = L.waistY + 0.03) => {
    const own = fallSection(c, m, allowance, from);
    const falls = under.flatMap((u) => u.fall ?? []);
    const room = Math.max(allowance, ...falls.map((f) => f.room + OVER_GAP));
    const section = !falls.length
      ? own
      : (y: number): Section => {
          const o = own(y);
          let rx = o.rx;
          let front = o.cz + o.rz;
          let back = o.cz - o.rz;
          for (const f of falls) {
            const s = f.section(y);
            rx = Math.max(rx, s.rx + OVER_GAP);
            front = Math.max(front, s.cz + s.rz + OVER_GAP);
            back = Math.min(back, s.cz - s.rz - OVER_GAP);
          }
          return { rx, rz: (front - back) / 2, cz: (front + back) / 2 };
        };
    hangSpec = { from, to: L.waistY - 0.07, section, bone: pelvisBone };
    g.fall = { from, section, room };
  };

  switch (p.kind) {
    case "tee":
    case "sweater":
    case "hoodie":
    case "shirt": {
      const knit = p.kind === "sweater" || p.kind === "hoodie";
      const o: TopOptions = {
        hem: p.kind === "tee" ? L.hipY - 0.035 : p.kind === "shirt" ? L.hipY - 0.05 : L.hipY - 0.045,
        sleeve: p.kind === "tee" ? 0.36 : 1,
        // a crew neck sits at the base of the neck; a shirt opens down to its placket
        neck: p.kind === "tee" ? { drop: 0.005, widen: 0.01 } : p.kind === "shirt" ? { drop: 0.06, back: 0 } : { drop: 0, widen: 0.012 },
      };
      const base = band[0] + 0.004;
      const ease = topEase(m, base, o, sleeveBand[0] + 0.004);
      const cut = topCut(m, o);
      const relax = knit ? 14 : 10;
      fallFrom(FALL[layer]!);
      const main = shell(cut, ease, shellMat, relax, true).geometry;
      g.above = lazy(() => onTop(c, fabricField(main, 1)));
      // hem and cuffs: a rib on knits, a turned hem on wovens
      const rib = shade(0.86);
      const hemH = knit ? 0.05 : 0.016;
      shell((v) => Math.min(cut(v), isSleeve(v) ? -1 : o.hem + hemH - v.p.y), ease, knit ? rib : shade(0.97), relax, false, 0.0018);
      shell((v) => (isSleeve(v) ? Math.min(cut(v), (m.armT(v) - (o.sleeve - (knit ? 0.12 : 0.05))) * m.armLen) : -1), ease, knit ? rib : shade(0.97), relax, false, 0.0018);
      if (p.kind !== "shirt") {
        shell((v) => (isTorso(v) ? Math.min(cut(v), 0.016 - Math.max(0, neckline(m, v, o.neck))) : -1), ease, rib, relax, false, 0.002);
      }
      if (p.kind === "hoodie") {
        g.hood = hood(rig, g, m, shade(0.97, false), onTop(c, fabricField(main, 1)));
        shell((v) => (isTorso(v) ? Math.min(cut(v), v.p.y - (o.hem + 0.06), L.waistY + 0.06 - v.p.y, 0.13 - Math.abs(v.p.x), v.p.z) : -1), ease, shade(0.95), relax, false, 0.004);
        // drawstrings hang from the neck rib, lying on the fabric
        const front = fabricField(main, 2);
        for (const s of [-1, 1]) {
          const pts = [0, 0.05, 0.11].map((d) => {
            const x = s * (0.035 + d * 0.05);
            const y = m.neckBaseY - 0.02 - d;
            const sp = surfaceAt(c, x, y, 1, TORSO_PARTS);
            const z = front(x, y);
            return z === null ? sp.p.clone().addScaledVector(sp.n, base + 0.014) : v(x, y, z).addScaledVector(sp.n, 0.0045);
          });
          g.skinned(bodyNear(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0028, 6)), accent);
          g.skinned(bodyNear(new THREE.CylinderGeometry(0.0034, 0.0034, 0.016, 8).translate(pts[2].x, pts[2].y - 0.008, pts[2].z)), g.mat("#d8d4cc", finishes.metal));
        }
      }
      if (p.kind === "shirt") {
        collar(rig, g, m, shade(1, false), 0.012, 0.35, onTop(c, fabricField(main, 1)));
        const placket = shell((v) => (isTorso(v) || v.part === Part.Thigh ? Math.min(cut(v), 0.016 - Math.abs(v.p.x), v.p.z) : -1), ease, shade(0.93), relax, false, 0.0022).geometry;
        shell(
          (v) => (isTorso(v) && v.side > 0 ? Math.min(cut(v), v.p.y - (L.chestY - 0.03), L.chestY + 0.07 - v.p.y, Math.abs(v.p.x) - 0.04, 0.15 - Math.abs(v.p.x), v.p.z) : -1),
          ease,
          shellMat,
          relax,
          false,
          0.0026,
        );
        // buttons on the placket, evenly from just under the open neck down to the hem
        const onPlacket = fabricField(placket, 2);
        const first = L.neckY - 0.085;
        const last = o.hem + 0.045;
        const count = Math.max(1, Math.round((first - last) / 0.085));
        for (let k = 0; k <= count; k++) {
          pin(c, g, new THREE.CylinderGeometry(0.0055, 0.0055, 0.0025, 14).rotateX(Math.PI / 2), accent, 0, lerp(first, last, k / count), 0.0018, 1, TORSO_PARTS, onPlacket);
        }
      }
      break;
    }
    case "jacket":
    case "coat": {
      const coat = p.kind === "coat";
      const bomber = p.id.includes("bomber");
      // the sleeves cover the wrist bone
      const o: TopOptions = { hem: coat ? L.hipY - 0.04 : L.hipY - 0.025, sleeve: 1.02, neck: { drop: 0.05, back: 0, rise: 0.01 }, open: 0.035 };
      const base = band[0] + 0.004;
      const ease = topEase(m, base, o, sleeveBand[0] + 0.004);
      const cut = topCut(m, o);
      // falling from the waist (not the ribs), so the hem comes in to the hips
      fallFrom(FALL[layer]!, L.waistY);
      const open = o.open!;
      const neckZ = m.neckZ;
      edgeSpec = (q) => Math.max(Math.abs(q.x) - open, neckZ - q.z);
      const main = shell(cut, ease, shellMat, 40, true).geometry;
      const front = fabricField(main, 2);
      // lining, visible inside the open front
      shell(cut, ease, g.mat(new THREE.Color(p.color).multiplyScalar(0.5), { roughness: 0.6, side: THREE.BackSide }, true), 40, false, -0.003);
      const rib = shade(0.78);
      if (!coat) {
        shell((v) => Math.min(cut(v), isSleeve(v) ? -1 : o.hem + (bomber ? 0.045 : 0.025) - v.p.y), ease, bomber ? rib : shade(0.9), 40, false, 0.002);
        shell((v) => (isSleeve(v) ? Math.min(cut(v), (m.armT(v) - (o.sleeve - 0.08)) * m.armLen) : -1), ease, rib, 40, false, 0.002);
      }
      // off the neck column by a set amount (it sits on the neck and the fabric, whatever the band), moving with the fabric under it
      const back = fabricField(main, 2, -1);
      const top = onTop(c, fabricField(main, 1));
      const neck = collar(rig, g, m, bomber ? shade(0.78, false) : shade(coat ? 1 : 0.9, false), 0.022, 0.5, top, back, main);
      g.above = both(top, fabricField(neck, 1), Math.max);
      // a hoodie's hood comes out over the collar and lies on the back
      const hoodie = under.find((u) => u.hood);
      if (hoodie?.hood) {
        hood(rig, g, m, hoodie.hood.material as THREE.Material, g.above, both(back, fabricField(neck, 2, -1), Math.min), 0.012);
        g.hides.push(hoodie.hood);
      }
      if (coat) {
        coatTails(rig, g, m, g.fabric(), o.hem, hangSpec!.section);
        shell((v) => Math.min(cut(v), v.p.y - (L.waistY - 0.02), L.waistY + 0.02 - v.p.y), ease, shade(0.9), 40, false, 0.006);
        for (const s of [-1, 1]) {
          for (const y of [L.chestY - 0.06, L.waistY + 0.07]) pin(c, g, new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 16).rotateX(Math.PI / 2), accent, s * 0.075, y, 0.0026, 1, TORSO_PARTS, front);
        }
      } else if (!bomber) {
        // denim: chest pocket flaps and shank buttons
        for (const s of [-1, 1]) {
          shell(
            (v) => (isTorso(v) && v.side === s ? Math.min(cut(v), v.p.y - (L.chestY - 0.02), L.chestY + 0.035 - v.p.y, Math.abs(v.p.x) - 0.05, 0.14 - Math.abs(v.p.x), v.p.z) : -1),
            ease,
            shade(0.92),
            40,
            false,
            0.004,
          );
          pin(c, g, new THREE.CylinderGeometry(0.0062, 0.0062, 0.004, 14).rotateX(Math.PI / 2), metal, s * 0.095, L.chestY + 0.025, 0.0066, 1, TORSO_PARTS, front);
        }
        for (const y of [L.chestY + 0.05, L.chestY - 0.08, L.waistY + 0.02]) pin(c, g, new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 14).rotateX(Math.PI / 2), metal, 0.05, y, 0.0026, 1, TORSO_PARTS, front);
      }
      break;
    }
    case "jeans":
    case "chinos":
    case "shorts": {
      const shorts = p.kind === "shorts";
      const top = L.waistY - 0.015;
      const hem = shorts ? L.kneeY + 0.12 : L.ankleY + 0.02;
      const base = p.kind === "chinos" ? 0.012 : 0.009;
      const cut = (v: Vertex) => (isTorso(v) || isLeg(v) ? Math.min(top - v.p.y, v.p.y - hem) : -1);
      const ease = (v: Vertex) => {
        if (!isLeg(v)) return base;
        const stack = shorts ? 0 : 0.006 * wave(v.p.y * 115 + Math.atan2(v.p.x, v.p.z) * 2.2) * gauss(v.p.y - (hem + 0.07), 0.05);
        const knee = 0.0018 * Math.sin(v.p.y * 130 + v.p.z * 40) * gauss(v.p.y - L.kneeY, 0.035);
        const calf = shorts ? 0 : clamp((L.hipY - 0.1 - v.p.y) / 0.45, 0, 1) * 0.018;
        return base + stack + knee + calf + (shorts ? 0.01 * clamp((L.hipY - v.p.y) / 0.25, 0, 1) : 0);
      };
      shell(cut, ease, shellMat, 22, true);
      // waistband, hem, back pockets, belt loops, button
      shell((v) => Math.min(cut(v), v.p.y - (top - 0.038)), ease, shade(0.82), 22, false, 0.0022);
      shell((v) => (isLeg(v) ? Math.min(cut(v), hem + 0.02 - v.p.y) : -1), ease, shade(0.9), 22, false, 0.002);
      for (const s of [-1, 1]) {
        shell(
          (v) =>
            v.side === s && (isTorso(v) || v.part === Part.Thigh)
              ? Math.min(cut(v), v.p.y - (L.hipY - 0.085), L.hipY + 0.035 - v.p.y, Math.abs(v.p.x) - 0.035, 0.145 - Math.abs(v.p.x), -v.p.z)
              : -1,
          ease,
          shellMat,
          22,
          false,
          0.003,
        );
      }
      for (const [x, dir] of [[0.075, 1], [-0.075, 1], [0.13, -1], [-0.13, -1], [0, -1]] as const) {
        pin(c, g, new THREE.BoxGeometry(0.011, 0.04, 0.0016), shade(0.85, false), x, top - 0.02, base + 0.003, dir, [Part.Belly]);
      }
      pin(c, g, new THREE.CylinderGeometry(0.008, 0.008, 0.002, 16).rotateX(Math.PI / 2), metal, 0, top - 0.019, base + 0.003, 1, [Part.Belly]);
      break;
    }
    case "skirt": {
      skirt(rig, g, m);
      // the legs under the skirt never show through it
      g.coverage = new Uint8Array(c.surface.part.length);
      for (const v of bodyVertices(c)) {
        if ((v.part === Part.Belly || v.part === Part.Thigh) && v.p.y < L.waistY - 0.01 && v.p.y > L.kneeY + 0.08) g.coverage[v.i] = 1;
      }
      shell((v) => (isTorso(v) ? Math.min(L.waistY + 0.005 - v.p.y, v.p.y - (L.waistY - 0.035)) : -1), () => 0.008, shade(0.85), 6);
      break;
    }
    case "sneakers":
    case "boots": {
      shoes(rig, g, m, p.kind === "boots");
      break;
    }
    case "cap":
    case "beanie": {
      const beanie = p.kind === "beanie";
      const line = (v: Vertex) => lerp(L.eyeY - (beanie ? 0.03 : 0.015), L.eyeY + (beanie ? 0.03 : 0.045), clamp(v.p.z / 0.18 + 0.5, 0, 1));
      const cut = (v: Vertex) => (v.part === Part.Head ? v.p.y - line(v) : -1);
      shell(cut, (v) => (beanie ? 0.02 + 0.002 * Math.sin(Math.atan2(v.p.x, v.p.z) * 40) : 0.014), shellMat, 8, true);
      const headIdx = c.skeleton.bones.indexOf(c.bone("Head"));
      if (beanie) {
        shell((v) => Math.min(cut(v), line(v) + 0.045 - v.p.y), () => 0.026, shade(0.92), 8);
      } else {
        const brim = new THREE.Shape();
        brim.moveTo(-0.075, 0);
        brim.bezierCurveTo(-0.072, 0.09, 0.072, 0.09, 0.075, 0);
        brim.lineTo(-0.075, 0);
        const geo = new THREE.ExtrudeGeometry(brim, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24 });
        geo.rotateX(Math.PI / 2);
        const bp = geo.getAttribute("position");
        for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) - 2.2 * bp.getX(i) ** 2);
        geo.rotateX(0.22);
        geo.translate(0, L.eyeY + 0.045, L.faceZ - 0.035);
        geo.computeVertexNormals();
        g.skinned(skinToBody(c, geo, undefined, [headIdx]), shade(0.9, false));
      }
      break;
    }
    case "sunglasses":
    case "round-glasses": {
      glasses(rig, g, m, p.kind === "round-glasses");
      break;
    }
    case "crossbody": {
      // strap from the left shoulder across the chest to the right hip, lying on whatever is worn there
      const strap = 0.006;
      const falls = under.flatMap((u) => u.fall ?? []);
      /** `d` off the skin at a surface point, then out of anything hanging there (a coat below the waist). */
      const onClothes = (sp: Vertex, d: number) => {
        const p = sp.p.clone().addScaledVector(sp.n, Math.max(0.003, floor ? floor[sp.i] : 0) + d);
        for (const f of falls) {
          if (p.y > f.from) continue;
          const sec = f.section(p.y);
          const th = Math.atan2(p.x, p.z - sec.cz);
          const r = Math.hypot(p.x, p.z - sec.cz);
          const need = Math.hypot((sec.rx + d) * Math.sin(th), (sec.rz + d) * Math.cos(th));
          if (r < need) p.set(p.x * (need / r), p.y, sec.cz + (p.z - sec.cz) * (need / r));
        }
        return p;
      };
      // round the shoulder from the back to the front, through the section at sx: outside the skin, what's worn on it,
      // and a collar lying on the shoulder
      const sx = 0.13;
      const centre = v(sx, L.shoulderY - 0.04, m.colZ);
      const above = g.over.reduce<Field>((f, u) => (u.above ? both(f, u.above, Math.max) : f), neckTop(c));
      const section = vertices(c).filter((vx) => Math.abs(vx.p.x - sx) < 0.025 && TORSO_PARTS.includes(vx.part) && vx.p.y > centre.y - 0.02);
      const arc = Array.from({ length: 11 }, (_, k) => lerp(-1.45, 1.05, k / 10));
      const reach = arc.map((a) => {
        let r = 0;
        for (const vx of section) {
          const dy = vx.p.y - centre.y;
          const dz = vx.p.z - centre.z;
          if (Math.abs(angDiff(Math.atan2(dz, dy), a)) < 0.2) r = Math.max(r, Math.hypot(dy, dz) + Math.max(0.003, floor ? floor[vx.i] : 0) + strap + 0.004);
        }
        return r;
      });
      // (the mesh is sparse over the shoulder: an angle that met no skin takes its neighbours' reach)
      for (let k = 0; k < reach.length; k++) if (!reach[k]) reach[k] = Math.max(reach[k - 1] ?? 0, reach[k + 1] ?? 0, 0.08);
      const pts = arc.map((a, k) => {
        const p = centre.clone().add(v(0, Math.cos(a) * reach[k], Math.sin(a) * reach[k]));
        const h = above(p.x, p.z);
        if (h !== null && Math.cos(a) > 0.3) p.y = Math.max(p.y, h + strap + 0.002);
        return p;
      });
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        pts.push(onClothes(surfaceAt(c, lerp(0.115, -0.15, t), lerp(L.shoulderY + 0.03, L.hipY + 0.03, t), 1, TORSO_PARTS), strap + 0.002));
      }
      const outer = [...g.over].reverse().find((u) => u.main);
      const strapGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, strap, 8);
      g.skinned(outer?.main ? skinToShell(strapGeo, outer.main) : bodyNear(strapGeo), g.fabric({ shade: 1.4 }));
      const bagAt = surfaceAt(c, -0.17, L.hipY, 1, [Part.Belly, Part.Thigh]);
      const bag = place(new RoundedBoxGeometry(0.17, 0.12, 0.05, 3, 0.018), onClothes(bagAt, 0.03), bagAt.n);
      g.skinned(skinToBody(c, bag, [Part.Belly]), g.fabric());
      break;
    }
    case "tote": {
      const holder = new THREE.Group();
      g.rigid(c.bone("hand_l"), holder);
      g.hanging.push(holder);
      const bag = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.33, 0.035, 2, 0.01), g.fabric());
      bag.position.set(0.06, -0.33, 0);
      bag.rotation.y = 0.5;
      bag.castShadow = true;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 24, Math.PI), g.fabric({ shade: 0.8 }));
      handle.position.set(0.06, -0.165, 0);
      handle.rotation.y = 0.5;
      holder.add(bag, handle);
      break;
    }
  }
  return g;
}

/* ───────────────────────── Shoes ───────────────────────── */

/**
 * A shoe built around the measured foot: an upper with a rounded toe box that
 * stops at the ankle (or rises into a shaft for boots), a separate sole that
 * is wider than the upper and lifts at the toe, laces over a tongue and a heel
 * tab. Skinned to the foot and toe bones, and the bare foot inside is hidden.
 */
function shoes(rig: Rig, g: Garment, m: M, boots: boolean) {
  const c = rig.character;
  const { L } = m;
  const p = g.product;
  const chunky = p.id.includes("chunky");
  const upperMat = g.fabric();
  const soleMat = g.mat(boots ? p.accent : "#f4f3ef", { roughness: boots ? 0.7 : 0.55 });
  const trim = g.fabric({ shade: 0.85 });
  const accent = g.mat(p.accent, { roughness: 0.55 });
  const sole = boots ? 0.03 : chunky ? 0.034 : 0.024;
  const verts = bodyVertices(c);
  g.coverage = new Uint8Array(c.surface.part.length);
  const shaftTop = L.ankleY + 0.15;
  // a shoe is stiff: it rides on the foot and toe bones, and only its collar
  // keeps a share of the ankle's blend into the calf so the leg stays inside
  const bones = c.skeleton.bones;
  const footBones = new Set(["foot_l", "ball_l", "foot_r", "ball_r"].map((n) => bones.indexOf(c.bone(n))));
  const stiff = (geo: THREE.BufferGeometry) => {
    skinToBody(c, geo, [Part.Foot]);
    const pos = geo.getAttribute("position");
    const si = geo.getAttribute("skinIndex");
    const sw = geo.getAttribute("skinWeight");
    for (let i = 0; i < pos.count; i++) {
      const keep = THREE.MathUtils.smoothstep(pos.getY(i), L.ankleY - 0.03, L.ankleY + 0.02);
      let total = 0;
      for (let q = 0; q < 4; q++) {
        if (!footBones.has(si.getComponent(i, q))) sw.setComponent(i, q, sw.getComponent(i, q) * keep);
        total += sw.getComponent(i, q);
      }
      for (let q = 0; q < 4; q++) sw.setComponent(i, q, total ? sw.getComponent(i, q) / total : 0);
    }
    return geo;
  };

  const cap = boots ? L.ankleY + 0.045 : L.ankleY + 0.025;
  for (const side of [-1, 1]) {
    // the foot, and the back of the heel up to the collar (the Achilles is skinned as calf): the heel counter rises round it
    const foot = verts.filter((v) => (v.part === Part.Foot || (v.part === Part.Calf && v.p.y < cap)) && v.side === side);
    for (const v of foot) if (v.part === Part.Foot || v.p.y < cap - 0.012) g.coverage[v.i] = 1;
    if (boots) for (const v of verts) if (v.part === Part.Calf && v.side === side && v.p.y < shaftTop - 0.03) g.coverage[v.i] = 1;
    let zMin = Infinity;
    let zMax = -Infinity;
    let cx = 0;
    for (const v of foot) {
      zMin = Math.min(zMin, v.p.z);
      zMax = Math.max(zMax, v.p.z);
      cx += v.p.x;
    }
    cx /= foot.length;
    const len = zMax - zMin;
    const N = 18;
    // each section is centred on itself: the toes turn in towards the big toe
    const slices: { z: number; cx: number; hw: number; top: number }[] = [];
    for (let k = 0; k <= N; k++) {
      const z = lerp(zMin + 0.004, zMax - 0.004, k / N);
      let x0 = Infinity;
      let x1 = -Infinity;
      let top = 0;
      for (const v of foot) {
        if (Math.abs(v.p.z - z) > len / N) continue;
        x0 = Math.min(x0, v.p.x);
        x1 = Math.max(x1, v.p.x);
        top = Math.max(top, v.p.y);
      }
      const prev = slices[slices.length - 1] ?? { cx, hw: 0.04, top: 0.06 };
      slices.push(x1 > x0 ? { z, cx: (x0 + x1) / 2, hw: (x1 - x0) / 2, top: Math.min(cap, top) } : { ...prev, z });
    }
    const spring = (z: number) => 0.012 * clamp((z - (zMax - 0.06)) / 0.06, 0, 1) ** 2;
    const base = sole * 0.7;
    // upper: a dome over each section, its lower half flattened onto the sole,
    // so it is widest at the sole and wraps the instep
    // (rounder over the toes, which taper in a curve, not a box)
    const upper: Ring[] = slices.map(({ z, cx, hw, top }) => ({
      y: z,
      rx: hw + 0.008 - 0.002 * smoothstep(z, zMax - 0.06, zMax),
      rz: Math.max(top + 0.009 - base - spring(z), 0.012),
      cz: -(base + spring(z)),
      cx,
      n: lerp(2.3, 2, smoothstep(z, zMax - 0.07, zMax - 0.02)),
    }));
    const first = upper[0];
    const last = upper[upper.length - 1];
    // closed at heel and toe: the end rings shrink to a point
    upper.unshift({ ...first, y: zMin - 0.017, rx: 0.002, rz: 0.002 }, { ...first, y: zMin - 0.012, rx: first.rx * 0.7, rz: first.rz * 0.85 });
    const toe = { ...last, y: zMax + 0.007, rx: last.rx * 0.55, rz: last.rz * 0.6, cz: (last.cz ?? 0) + last.rz * 0.25 };
    upper.push(toe, { ...toe, y: zMax + 0.011, rx: 0.002, rz: 0.002 });
    const upperGeo = tube(upper, { forward: true, radial: 48, sub: 2 });
    const up = upperGeo.getAttribute("position");
    for (let i = 0; i < up.count; i++) up.setY(i, Math.max(up.getY(i), base + spring(up.getZ(i))));
    collarOpening(upperGeo, verts.filter((v) => (v.part === Part.Calf || v.part === Part.Foot) && v.side === side && Math.abs(v.p.y - cap) < 0.012), cap);
    g.skinned(stiff(upperGeo), upperMat);
    // sole: wider than the upper, flat underneath, toe lifted, closed at both ends
    const soleRings: Ring[] = slices.map(({ z, cx, hw }) => ({ y: z, rx: hw + 0.012, rz: sole / 2, cz: -(sole / 2 + spring(z)), cx, n: 3.4 }));
    const s0 = soleRings[0];
    const s1 = soleRings[soleRings.length - 1];
    soleRings.unshift({ ...s0, y: zMin - 0.021, rx: 0.002, rz: 0.002 }, { ...s0, y: zMin - 0.016, rx: s0.rx * 0.85 });
    soleRings.push({ ...s1, y: zMax + 0.013, rx: s1.rx * 0.6 }, { ...s1, y: zMax + 0.017, rx: 0.002, rz: 0.002 });
    g.skinned(stiff(tube(soleRings, { forward: true, radial: 40, sub: 2 })), soleMat);

    // a pull tab standing above the collar, and laces resting on a tongue
    const heel = slices[1];
    g.skinned(stiff(new RoundedBoxGeometry(0.028, 0.03, 0.008, 2, 0.003).translate(heel.cx, heel.top + 0.006, zMin - 0.01)), boots ? trim : accent);
    if (!boots) {
      const laceFrom = Math.floor(N * 0.42);
      const laceTo = Math.floor(N * 0.72);
      const tongue: Ring[] = [];
      for (let k = laceFrom; k <= laceTo; k++) {
        const sl = slices[k];
        tongue.push({ y: sl.z, rx: 0.014, rz: 0.003, cx: sl.cx, cz: -(sl.top + 0.011 + spring(sl.z)) });
      }
      g.skinned(stiff(tube(tongue, { forward: true, radial: 16, sub: 2 })), g.fabric({ shade: 0.95 }));
      for (let k = laceFrom; k <= laceTo; k += 2) {
        const sl = slices[k];
        const y = sl.top + 0.0155 + spring(sl.z);
        for (const dir of [-1, 1]) {
          const lace = new THREE.CapsuleGeometry(0.0017, sl.hw * 0.6, 3, 6).rotateZ(Math.PI / 2).rotateY(dir * 0.35).translate(sl.cx, y, sl.z);
          g.skinned(stiff(lace), accent);
        }
      }
    } else {
      // shaft rising around the lower leg
      const ys = [shaftTop, lerp(shaftTop, cap, 0.5), cap - 0.025];
      // this leg's own cross-sections (wide enough band to always find the leg)
      const leg = verts.filter((v) => (v.part === Part.Calf || v.part === Part.Foot) && v.side === side);
      const shaft: Ring[] = ys.map((y) => {
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (let band = 0.01; x0 === Infinity && band < 0.08; band *= 2) {
          for (const v of leg) {
            if (Math.abs(v.p.y - y) > band) continue;
            x0 = Math.min(x0, v.p.x);
            x1 = Math.max(x1, v.p.x);
            z0 = Math.min(z0, v.p.z);
            z1 = Math.max(z1, v.p.z);
          }
        }
        return { y, rx: (x1 - x0) / 2 + 0.009, rz: (z1 - z0) / 2 + 0.009, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
      });
      // the shaft follows the shin; its foot end is tucked under the upper's collar
      g.skinned(skinToBody(c, tube(shaft, { radial: 40, sub: 3 }), [Part.Calf]), upperMat);
      g.skinned(skinToBody(c, tube([{ ...shaft[0], y: shaftTop + 0.004, rx: shaft[0].rx + 0.002, rz: shaft[0].rz + 0.002 }, { ...shaft[0], y: shaftTop - 0.012, rx: shaft[0].rx + 0.002, rz: shaft[0].rz + 0.002 }], { radial: 40, sub: 1 }), [Part.Calf]), trim);
    }
  }
}

/**
 * Opens a shoe's upper round the ankle: the dome is cut away over the leg's
 * section at the collar (`leg`: the skin there) a few millimetres off it, and
 * the cut edge is drawn onto that ellipse so the collar runs smoothly round
 * the leg instead of the leg coming up through the top of the shoe.
 */
function collarOpening(geo: THREE.BufferGeometry, leg: Vertex[], cap: number) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const v of leg) {
    x0 = Math.min(x0, v.p.x);
    x1 = Math.max(x1, v.p.x);
    z0 = Math.min(z0, v.p.z);
    z1 = Math.max(z1, v.p.z);
  }
  if (!(x1 > x0)) return;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const rx = (x1 - x0) / 2 + 0.006;
  const rz = (z1 - z0) / 2 + 0.006;
  const pos = geo.getAttribute("position");
  const index = geo.getIndex()!;
  const inside = (x: number, z: number) => Math.hypot((x - cx) / rx, (z - cz) / rz);
  const kept: number[] = [];
  const edge = new Set<number>();
  const cut: number[] = [];
  for (let k = 0; k < index.count; k += 3) {
    const t = [index.getX(k), index.getX(k + 1), index.getX(k + 2)];
    const x = (pos.getX(t[0]) + pos.getX(t[1]) + pos.getX(t[2])) / 3;
    const y = (pos.getY(t[0]) + pos.getY(t[1]) + pos.getY(t[2])) / 3;
    const z = (pos.getZ(t[0]) + pos.getZ(t[1]) + pos.getZ(t[2])) / 3;
    if (y > cap - 0.025 && inside(x, z) < 1) cut.push(...t);
    else kept.push(...t);
  }
  const used = new Set(kept);
  for (const i of cut) if (used.has(i)) edge.add(i);
  for (const i of edge) {
    const d = inside(pos.getX(i), pos.getZ(i)) || 1;
    pos.setXYZ(i, cx + (pos.getX(i) - cx) / d, pos.getY(i), cz + (pos.getZ(i) - cz) / d);
  }
  // drop the vertices only the cut-away triangles used
  const map = new Map<number, number>();
  for (const i of kept) if (!map.has(i)) map.set(i, map.size);
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.getAttribute(name);
    const out = new Float32Array(map.size * a.itemSize);
    for (const [from, to] of map) for (let k = 0; k < a.itemSize; k++) out[to * a.itemSize + k] = a.getComponent(from, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  geo.setIndex(kept.map((i) => map.get(i)!));
  geo.computeVertexNormals();
}

/* ───────────────────────── Glasses ───────────────────────── */

/**
 * Glasses sized to the face: two frame rims with real thickness (thin metal
 * wire or chunkier acetate), curved lenses, a bridge over the nose, nose pads
 * on metal frames, and temples that run back along the head and hook behind
 * the ears.
 */
function glasses(rig: Rig, g: Garment, m: M, metalFrame: boolean) {
  const c = rig.character;
  const { L } = m;
  const p = g.product;
  const head = [c.skeleton.bones.indexOf(c.bone("Head"))];
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material) => g.skinned(skinToBody(c, geo, undefined, head), mat);
  const frame = g.mat(p.color, metalFrame ? finishes.metal : { ...finishes.plastic, transparent: true, opacity: 0.92 });
  const lens = g.mat(p.accent, metalFrame
    ? { roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2 }
    : { roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  // the head's half width at the temples (just behind the eyes, above the ears)
  let faceHalf = 0;
  for (const vx of bodyVertices(c)) {
    if (vx.part !== Part.Head || Math.abs(vx.p.y - (L.eyeY + 0.01)) > 0.008) continue;
    if (vx.p.z < L.eyeZ - 0.07 || vx.p.z > L.eyeZ - 0.02) continue;
    faceHalf = Math.max(faceHalf, Math.abs(vx.p.x));
  }
  faceHalf = clamp(faceHalf || 0.072, 0.06, 0.085);
  const r = metalFrame ? 0.022 : 0.024;
  const rim = metalFrame ? 0.0016 : 0.0028;
  const z = L.eyeZ + 0.013;
  const cxs = [-1, 1].map((s) => s * Math.max(L.eyeX, r + 0.009));
  for (const [i, s] of [-1, 1].entries()) {
    const x = cxs[i];
    // rim: a ring with depth, turned slightly to follow the face
    const ring = new THREE.Shape();
    ring.absarc(0, 0, r + rim, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, r, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const rimGeo = new THREE.ExtrudeGeometry(ring, { depth: metalFrame ? 0.0016 : 0.0035, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 48 });
    rimGeo.rotateY(-s * 0.1).translate(x, L.eyeY, z - 0.002);
    put(rimGeo, frame);
    // lens: a shallow spherical cap so it catches reflections like real glass
    const R = 0.09;
    const lensGeo = new THREE.SphereGeometry(R, 40, 6, 0, Math.PI * 2, 0, Math.asin(r / R));
    lensGeo.rotateX(Math.PI / 2).translate(0, 0, -R * Math.cos(Math.asin(r / R)) + 0.001).rotateY(-s * 0.1).translate(x, L.eyeY, z);
    put(lensGeo, lens);
    // temple: hinge at the outer rim, along the side of the head, hooking down behind the ear
    const hinge = v(x + s * (r + rim), L.eyeY + 0.006, z - 0.002);
    const pts = [hinge, v(s * (faceHalf + 0.006), L.eyeY + 0.007, z - 0.03), v(s * (faceHalf + 0.008), L.eyeY + 0.004, L.eyeZ - 0.07), v(s * (faceHalf + 0.002), L.eyeY - 0.012, L.eyeZ - 0.105), v(s * (faceHalf - 0.008), L.eyeY - 0.03, L.eyeZ - 0.11)];
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, metalFrame ? 0.0011 : 0.0021, 8).scale(1, metalFrame ? 1 : 1.6, 1), frame);
    if (metalFrame) {
      put(new THREE.SphereGeometry(0.003, 10, 8).scale(1, 1.4, 0.6).translate(x - s * (r - 0.004), L.eyeY - r * 0.55, z - 0.008), lens);
    }
  }
  // bridge over the nose
  const inner = Math.abs(cxs[0]) - r - rim * 0.5;
  const bridge = new THREE.CatmullRomCurve3([v(-inner, L.eyeY + 0.004, z), v(0, L.eyeY + 0.009, z + 0.003), v(inner, L.eyeY + 0.004, z)]);
  put(new THREE.TubeGeometry(bridge, 16, metalFrame ? 0.0011 : 0.0024, 8), frame);
}

/* ───────────────────────── Loose parts ───────────────────────── */

/**
 * Hood lying on the back of the neck, resting on the hoodie (`under`; seen
 * from behind, `back`). Sized from the neck column (not the trapezius flaring
 * round it), `out` further round it to clear a collar under it, and carried by
 * the upper spine so it doesn't swing when the head turns.
 */
function hood(rig: Rig, g: Garment, m: M, mat: THREE.Material, under: Field, back?: Field, out = 0) {
  const c = rig.character;
  const y0 = m.neckBaseY - 0.015;
  const { colRx: rx, colRz: rz, colZ: cz } = m;
  const rings: Ring[] = [
    { y: y0 + 0.085, rx: rx * 0.8 + 0.01 + out, rz: rz * 0.6, cz: cz - rz - 0.075 - out },
    { y: y0 + 0.06, rx: rx + 0.045 + out, rz: rz + 0.015 + out, cz: cz - 0.05 },
    { y: y0 + 0.03, rx: rx + 0.06 + out, rz: rz + 0.04 + out, cz: cz - 0.028 },
    { y: y0, rx: rx + 0.065 + out, rz: rz + 0.045 + out, cz: cz - 0.012 },
  ];
  const geo = tube(rings, { arc: [1.7, Math.PI * 2 - 1.7], shape: (y, th) => 0.004 * Math.sin(th * 4) * gauss(y - (y0 + 0.04), 0.03) });
  seat(geo, under, rings[3], 0.004, [0.085, 0.5], back);
  const mesh = g.skinned(skinToBody(c, geo, undefined, [c.skeleton.bones.indexOf(c.bone("spine_03"))]), mat);
  mesh.name = "hood";
  return mesh;
}

/**
 * A collar standing around the neck, open at the front by `gap` radians,
 * `lift` off the neck column and seated on the garment's shoulders (`under`).
 * With `shell` (the fabric it's sewn on) it moves with that fabric's weights.
 */
function collar(rig: Rig, g: Garment, m: M, mat: THREE.Material, lift: number, gap: number, under: Field, back?: Field, shell?: THREE.BufferGeometry) {
  // a collar band rising around the neck, folding over and lying down on the shoulders
  const rx = m.colRx + lift;
  const rz = m.colRz + lift;
  const cz = m.colZ;
  const rings: Ring[] = [
    { y: m.neckBaseY - 0.03, rx: rx + 0.05, rz: rz + 0.03, cz: cz - 0.004 },
    { y: m.neckBaseY + 0.012, rx: rx + 0.022, rz: rz + 0.012, cz: cz - 0.006 },
    { y: m.neckBaseY + 0.032, rx: rx + 0.006, rz: rz + 0.002, cz: cz - 0.008 },
    { y: m.neckBaseY + 0.02, rx: rx - 0.002, rz: rz - 0.006, cz: cz - 0.008 },
  ];
  const geo = seat(tube(rings, { sub: 4, radial: 48, arc: [gap, Math.PI * 2 - gap] }), under, rings[0], 0.003, [1, 1], back);
  // seated higher on a steep trapezius, the stand meets a thicker neck: keep it off the neck all round
  const neck = neckRadius(rig.character, cz);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const dz = pos.getZ(i) - cz;
    const r = Math.hypot(x, dz);
    if (r > Math.max(rx, rz) + 0.015) continue;
    const need = neck(Math.atan2(x, dz), pos.getY(i));
    if (need === null || r >= need + 0.004) continue;
    const k = (need + 0.004) / (r || 1);
    pos.setX(i, x * k);
    pos.setZ(i, cz + dz * k);
  }
  geo.computeVertexNormals();
  g.skinned(shell ? skinToShell(geo, shell) : skinToBody(rig.character, geo, [Part.Neck, Part.Chest]), mat);
  return geo;
}

/**
 * Skins a loose part with the weights of the drawn fabric of a fitted shell
 * near it (blended by distance): those are spread smoothly over the fabric,
 * where the nearest body vertex's jump from one bone to another (and tear the
 * part as the arms move).
 */
function skinToShell(geo: THREE.BufferGeometry, shell: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  const sp = shell.getAttribute("position");
  const cut = shell.getAttribute("cut");
  const ssi = shell.getAttribute("skinIndex");
  const ssw = shell.getAttribute("skinWeight");
  geo.computeBoundingBox();
  const box = geo.boundingBox!.expandByScalar(0.15);
  const cell = 0.025;
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, number[]>();
  const q = v();
  for (let i = 0; i < sp.count; i++) {
    q.fromBufferAttribute(sp, i);
    if (!box.containsPoint(q) || (cut && cut.getX(i) < 0)) continue;
    const k = key(q.x, q.y, q.z);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  const si = new Uint16Array(pos.count * 4);
  const sw = new Float32Array(pos.count * 4);
  const p = v();
  const acc = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    acc.clear();
    // the nearest fabric, and everything within 1.5 cm further than it
    let near = Infinity;
    const found: [number, number][] = [];
    for (let r = 1; !found.length && r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            if (r > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < r) continue;
            for (const j of grid.get(key(p.x + dx * cell, p.y + dy * cell, p.z + dz * cell)) ?? []) {
              const d = q.fromBufferAttribute(sp, j).distanceTo(p);
              near = Math.min(near, d);
              found.push([j, d]);
            }
          }
        }
      }
    }
    for (const [j, d] of found) {
      if (d > near + 0.015) continue;
      const w = 1 / (d - near + 0.004) ** 2;
      for (let k = 0; k < 4; k++) {
        const b = ssi.getComponent(j, k);
        acc.set(b, (acc.get(b) ?? 0) + w * ssw.getComponent(j, k));
      }
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((t, x) => t + x[1], 0);
    top.forEach(([b, w], k) => {
      si[i * 4 + k] = b;
      sw[i * 4 + k] = total ? w / total : +(k === 0);
    });
  }
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  return geo;
}

const neckRadii = new WeakMap<Character, (th: number, y: number) => number | null>();
/** How far the neck's skin reaches from its axis (at depth `cz`) at an angle and height, cached per character. */
function neckRadius(c: Character, cz: number) {
  let f = neckRadii.get(c);
  if (f) return f;
  const N = 48;
  const bins = new Map<number, number>();
  const bin = (th: number, y: number) => ((Math.round(((th / (Math.PI * 2)) % 1) * N) + N) % N) + N * Math.round(y / 0.01);
  for (const v of vertices(c)) {
    if (v.part !== Part.Neck) continue;
    const dz = v.p.z - cz;
    const k = bin(Math.atan2(v.p.x, dz), v.p.y);
    bins.set(k, Math.max(bins.get(k) ?? 0, Math.hypot(v.p.x, dz)));
  }
  f = (th, y) => {
    let r = -1;
    for (const dy of [-0.01, 0, 0.01]) for (const dt of [-1, 0, 1]) r = Math.max(r, bins.get(bin(th + (dt * Math.PI * 2) / N, y + dy)) ?? -1);
    return r < 0 ? null : r;
  };
  neckRadii.set(c, f);
  return f;
}

/** Skirt hanging from the waist on the spring bones. */
function skirt(rig: Rig, g: Garment, m: M) {
  const { L } = m;
  const c = rig.character;
  const body = [Part.Belly, Part.Thigh];
  const hem = L.kneeY + 0.02;
  const rings: Ring[] = [L.waistY, L.hipY + 0.06, L.hipY - 0.03].map((y, i) => {
    const s = sectionAt(c, y, body, 0.015);
    return { y, rx: s.rx + 0.008 + i * 0.012, rz: s.rz + 0.008 + i * 0.012, cz: s.cz };
  });
  const last = rings[rings.length - 1];
  // the flare goes to the front and back, not the sides, where the hands hang
  rings.push({ y: lerp(last.y, hem, 0.5), rx: last.rx + 0.035, rz: last.rz + 0.045, cz: last.cz });
  rings.push({ y: hem, rx: last.rx + 0.065, rz: last.rz + 0.09, cz: last.cz });
  const pleats = (y: number, th: number) => {
    const d = clamp((L.waistY - y) / (L.waistY - hem), 0, 1);
    return d * (0.009 * Math.sin(th * 13 + 1.3 * Math.sin(th * 3)) + 0.004 * Math.sin(th * 29));
  };
  const w = rig.skirtWeights(L.waistY - 0.02);
  g.skinned(tube(rings, { weigh: w, radial: 96, shape: pleats }), g.fabric(), rig.skirtSkeleton);
  g.skinned(tube(rings.map((r) => ({ ...r, rx: r.rx - 0.012, rz: r.rz - 0.012 })), { weigh: w, radial: 64 }), g.fabric({ shade: 0.8 }), rig.skirtSkeleton);
}

/** Long coat tails below the hips, open at the front, swinging with the legs; `section` is what the coat itself hangs on. */
function coatTails(rig: Rig, g: Garment, m: M, mat: THREE.Material, top: number, section: (y: number) => Section) {
  const { L } = m;
  const s = sectionAt(rig.character, L.hipY - 0.03, [Part.Belly, Part.Thigh], 0.02);
  const hem = L.kneeY - 0.06;
  // continuing the coat's own fall just over its hem (no step), then flaring mostly front and back (the hands hang at the sides)
  const f = section(top + 0.04);
  // room round the hips for the legs' swing (a woman's stride swings her knees further into the front and back)
  const room = 0.034;
  const swing = rig.character.type === "female" ? 1.3 : 1;
  const rings: Ring[] = [
    { y: top + 0.04, rx: f.rx + 0.003, rz: f.rz + 0.003, cz: f.cz, n: HANG_N },
    { y: lerp(top, hem, 0.5), rx: Math.max(s.rx + room + 0.015, f.rx + 0.01), rz: Math.max(s.rz + 0.075 * swing, f.rz + 0.02), cz: s.cz - 0.005, n: 2.4 },
    { y: hem, rx: Math.max(s.rx + room + 0.03, f.rx + 0.02), rz: Math.max(s.rz + 0.105 * swing, f.rz + 0.04), cz: s.cz - 0.01, n: 2.3 },
  ];
  const folds = (y: number, th: number) => clamp((top - y) / (top - hem), 0, 1) * (0.011 * Math.sin(th * 5 + 0.7) + 0.004 * Math.sin(th * 11));
  const arc: [number, number] = [0.3, Math.PI * 2 - 0.3];
  const w = rig.skirtWeights(top + 0.02);
  g.skinned(tube(rings, { weigh: w, radial: 64, arc, shape: folds }), mat, rig.skirtSkeleton);
  g.skinned(tube(rings, { weigh: w, radial: 64, arc, shape: folds }), g.mat(new THREE.Color(g.product.color).multiplyScalar(0.5), { roughness: 0.6, side: THREE.BackSide }), rig.skirtSkeleton);
}
