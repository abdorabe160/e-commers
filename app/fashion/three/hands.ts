import * as THREE from "three";
import type { Character } from "./model";
import { clamp, lerp, v, type V3 } from "./surface";

/*
 * Hands: designed hand shapes instead of a single "grip" number.
 *
 * A HandShape says where the fingers point and which way the palm faces
 * (character space), how strongly to impose that over what the arm's IK gives
 * (`orient` for a full orientation, `pronate` for turning the palm only), how
 * much each finger curls, how much they fan out, and where the thumb sits.
 * Shapes are blended and smoothed like the rest of the pose, so hands change
 * shape slightly after the wrist arrives (fingers lag the wrist).
 *
 * Character space: +z forward, side -1 = right hand (x < 0), +1 = left.
 */

export type HandShape = {
  /** 0..1: impose the full orientation (fingers + palm) over the IK result. */
  orient: number;
  /** 0..1: only roll the palm towards `palm`, keeping the direction the arm gives the fingers. */
  pronate: number;
  fingers: V3;
  palm: V3;
  /** Curl per finger: index, middle, ring, pinky, thumb (scaled per joint). */
  grip: [number, number, number, number, number];
  /** Fan the fingers apart (1 = natural relaxed spread). */
  spread: number;
  /** Thumb across the palm towards the index (+, opposition) or out to the side (−). */
  oppose: number;
  /** 1: a hanging arm (follows the shoulders, slightly bent elbow, elbow behind); 0: a hand placed on a target. */
  hang: number;
  /** 0..1: tuck the elbow down by the ribs (carrying in front). */
  elbowIn: number;
  /** 0..1: elbow out to the side (hand on the hip); the wrist also rides with the pelvis. */
  elbowOut: number;
  /** 0..1: elbow down under the hand (waving). */
  elbowDown: number;
  /** 0..1: soft elbow for open arms. */
  soft: number;
  /** Wrist flexion (rad, fingers towards −z) on top of what the arm gives, for un-oriented hands. */
  flex: number;
  /** 0..1: the fingers trail behind when the hand moves fast. */
  drag: number;
  /** 0..1: the palm rests on the body or the clothes in front (pulled onto the surface). */
  contact: number;
  /** 0..1: idle finger micro-motion. */
  alive: number;
};

type Grip = HandShape["grip"];
const g5 = (i: number, m: number, r: number, p: number, t: number): Grip => [i, m, r, p, t];

const BASE = { orient: 1, pronate: 0, spread: 0, oppose: 0, hang: 0, elbowIn: 0, elbowOut: 0, elbowDown: 0, soft: 0, flex: 0, drag: 0.3, contact: 0, alive: 0.3 };
const shape = (s: Partial<HandShape> & Pick<HandShape, "fingers" | "palm" | "grip">): HandShape => ({ ...BASE, ...s, fingers: s.fingers.clone().normalize(), palm: s.palm.clone().normalize() });

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const m4 = new THREE.Matrix4();

/** Blends two shapes; the orientation goes through a quaternion so it turns along the shortest way. */
export function lerpShape(a: HandShape, b: HandShape, t: number): HandShape {
  qa.setFromRotationMatrix(frameOf(a.fingers, a.palm));
  qb.setFromRotationMatrix(frameOf(b.fingers, b.palm));
  if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
  m4.makeRotationFromQuaternion(qa.slerp(qb, t));
  const out = { ...a } as HandShape;
  for (const k of Object.keys(BASE) as (keyof typeof BASE)[]) out[k] = lerp(a[k], b[k], t);
  out.fingers = v().setFromMatrixColumn(m4, 0);
  out.palm = v().setFromMatrixColumn(m4, 1);
  out.grip = a.grip.map((x, i) => lerp(x, b.grip[i], t)) as Grip;
  return out;
}

/**
 * Smooths a shape towards a target: the palm turns quickly, the fingers close a little
 * after it (and open faster than they close), the arm settings follow more slowly.
 */
export function followShape(s: HandShape, target: HandShape, h: number): HandShape {
  const k = (rate: number) => 1 - Math.exp(-h * rate);
  const out = lerpShape(s, target, k(10));
  for (const key of ["spread", "oppose"] as const) out[key] = lerp(s[key], target[key], k(9));
  for (const key of ["hang", "elbowIn", "elbowOut", "elbowDown", "soft", "contact", "alive", "drag"] as const) out[key] = lerp(s[key], target[key], k(8));
  out.grip = s.grip.map((x, i) => lerp(x, target.grip[i], k(target.grip[i] > x ? 7 : 12))) as Grip;
  return out;
}

export const cloneShape = (s: HandShape): HandShape => ({ ...s, fingers: s.fingers.clone(), palm: s.palm.clone(), grip: [...s.grip] as Grip });

/** Adds to every finger's curl (a tighter grip for a tug or a landing). */
export const squeeze = (s: HandShape, amount: number): HandShape => ({ ...cloneShape(s), grip: s.grip.map((g) => g + amount) as Grip });

/** Hand shape presets for a side (−1 right, +1 left). */
export const HANDS = {
  /** Hanging at the side: palm to the thigh turned a little back, graded curl, thumb resting on the index. */
  relaxed: (s: number) =>
    shape({ orient: 0, pronate: 0.7, fingers: v(s * 0.05, -1, 0.12), palm: v(-s * 0.95, 0, -0.3), grip: g5(0.42, 0.5, 0.56, 0.62, 0.45), spread: 0.35, oppose: 0.12, hang: 1, flex: 0.12, drag: 1, alive: 1 }),
  /** Walking: as relaxed, a little looser. */
  walk: (s: number) =>
    shape({ orient: 0, pronate: 0.7, fingers: v(s * 0.05, -1, 0.12), palm: v(-s * 0.95, 0, -0.3), grip: g5(0.36, 0.43, 0.48, 0.53, 0.4), spread: 0.35, oppose: 0.12, hang: 1, flex: 0.12, drag: 1, alive: 1 }),
  /** Palms up and open, ready to receive the folded item. */
  carryOpen: (s: number) => shape({ fingers: v(-s * 0.35, 0.05, 0.94), palm: v(-s * 0.45, 0.89, 0), grip: g5(0.05, 0.05, 0.05, 0.05, 0.05), spread: 0.6, oppose: -0.15, elbowIn: 0.8, drag: 0, alive: 0.3 }),
  /** Supporting the folded item from below: palms up and turned in, fingers forward, slightly fanned. */
  carry: (s: number) => shape({ fingers: v(-s * 0.35, 0.05, 0.94), palm: v(-s * 0.45, 0.89, 0), grip: g5(0.12, 0.16, 0.19, 0.26, 0.12), spread: 0.5, oppose: -0.12, elbowIn: 0.8, drag: 0, alive: 0.3 }),
  /** Pinching a hem between thumb and index, fingers down, palm to the body (pulling a top down). */
  pinch: (s: number) => shape({ fingers: v(s * 0.08, -0.93, 0.36), palm: v(-s, 0, 0.12), grip: g5(0.65, 0.92, 1.0, 1.1, 0.92), oppose: 0.6, drag: 0.2, alive: 0.2 }),
  /** A fist around a waistband, thumb hooked inside (pulling trousers up). */
  waistband: (s: number) => shape({ fingers: v(s * 0.12, -0.96, 0.25), palm: v(-s * 0.55, 0, -0.83), grip: g5(1.0, 1.12, 1.18, 1.24, 0.15), oppose: 0.15, alive: 0 }),
  /** Hooking a heel tab / collar beside the ankle. */
  heel: (s: number) => shape({ fingers: v(s * 0.05, -0.92, -0.38), palm: v(-s, 0, 0.05), grip: g5(0.75, 0.85, 0.9, 0.95, 0.6), oppose: 0.25, alive: 0 }),
  /** Holding the hat at the sides of the head: palms in, fingertips wrapping onto the crown, thumb pressing the band. */
  brim: (s: number) => shape({ orient: 0.9, fingers: v(-s * 0.35, 0.92, 0.15), palm: v(-s, 0.3, 0), grip: g5(0.4, 0.42, 0.47, 0.5, 0.5), spread: 0.1, oppose: 0.25 }),
  /** Pinching the brim's front corner: fingers forward along the brim, palm down on it. */
  brimPinch: (s: number) => shape({ orient: 0.9, fingers: v(-s * 0.35, 0.05, 0.94), palm: v(-s * 0.25, -0.97, 0), grip: g5(0.6, 0.8, 1.0, 1.1, 0.75), oppose: 0.5 }),
  /** Holding a glasses temple between thumb and fingers, fingers forward. */
  temple: (s: number) => shape({ orient: 0.8, fingers: v(-s * 0.1, 0.35, 0.93), palm: v(-s, -0.2, 0), grip: g5(0.7, 0.92, 1.12, 1.22, 0.75), oppose: 0.45 }),
  /** Letting go: fingers open, thumb out, for a beat. */
  release: (s: number, from: HandShape) => ({ ...cloneShape(from), grip: g5(0.03, 0.03, 0.04, 0.05, 0), spread: 0.6, oppose: -0.15, hang: 0, elbowIn: 0, elbowOut: 0 }),
  /** Arms open for a spin: fingers out along the arm, palm down, relaxed and fanned. */
  open: (s: number) => shape({ orient: 0.55, fingers: v(s * 0.6, -0.75, 0), palm: v(-s * 0.35, -0.9, -0.2), grip: g5(0.25, 0.25, 0.26, 0.26, 0.25), spread: 1.2, oppose: -0.1, soft: 1, drag: 1, alive: 0.5 }),
  /** Waving: fingers up, palm to the viewer, relaxed open fingers. */
  wave: (s: number) => shape({ fingers: v(s * 0.08, 1, 0), palm: v(-s * 0.12, 0.03, 0.99), grip: g5(0.06, 0.06, 0.08, 0.1, 0.05), spread: 1.0, oppose: -0.2, elbowDown: 1, drag: 0.3, alive: 0 }),
  /** In a front pocket: fingers down and in under the fabric, thumb out. */
  pocket: (s: number) => shape({ fingers: v(-s * 0.15, -1, 0.12), palm: v(-s * 0.65, 0.05, -0.75), grip: g5(0.35, 0.4, 0.45, 0.5, 0), spread: 0.15, oppose: -0.45, alive: 0 }),
  /** Thumbs hooked in the waistband (no pockets to put the hands in). */
  hooked: (s: number) => shape({ orient: 0.85, fingers: v(-s * 0.1, -1, 0.15), palm: v(-s * 0.65, 0.05, -0.75), grip: g5(0.15, 0.17, 0.2, 0.22, 0.15), spread: 0.15, oppose: -0.6, alive: 0.3 }),
  /** Hand on the hip: palm on the hip bone, fingers forward and down round the hip's curve (not into the waist), thumb behind, elbow out. */
  onHip: (s: number) => shape({ orient: 0.85, fingers: v(s * 0.2, -0.55, 0.8), palm: v(-s * 0.95, -0.25, 0.2), grip: g5(0.18, 0.2, 0.22, 0.24, 0.1), spread: 0.3, oppose: -0.45, elbowOut: 1, alive: 0.5 }),
  /** Flat open hand on the chest, smoothing the fabric. */
  touch: (s: number) => shape({ fingers: v(-s * 0.75, 0.45, 0), palm: v(0, 0, -1), grip: g5(0.06, 0.07, 0.08, 0.09, 0.1), spread: 0.3, elbowIn: 0.3, contact: 1, alive: 0.2 }),
  /** Flat hands smoothing the front of the thighs. */
  smoothing: (s: number) => shape({ fingers: v(-s * 0.1, -0.9, 0.35), palm: v(-s * 0.2, 0.1, -1), grip: g5(0.06, 0.07, 0.08, 0.09, 0.1), spread: 0.3, contact: 1, alive: 0.2 }),
  /** Index pushing the bridge of the glasses up, others folded. */
  push: (s: number) => shape({ fingers: v(-s * 0.15, 0.93, -0.33), palm: v(-s * 0.35, 0, -0.94), grip: g5(0.08, 1.45, 1.5, 1.55, 1.0), oppose: 0.6, elbowIn: 0.4, alive: 0 }),
  /** A fist around a bag handle, palm to the body, arm hanging. */
  handle: (s: number) =>
    shape({ orient: 0, pronate: 0.8, fingers: v(0, -1, 0.1), palm: v(-s, 0, -0.2), grip: g5(1.25, 1.35, 1.4, 1.45, 1.2), oppose: 0.35, hang: 1, drag: 0.5, alive: 0 }),
};

/* ───────────────────────── Finger rig ───────────────────────── */

type Joint = {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  curlAxis: V3;
  amount: number;
  finger: number;
  knuckle: number;
  spreadAxis?: V3;
  spread?: number;
  /** Thumb base: across the palm (adduction) and about its own length (turning the pad to the fingers). */
  opposeAxis?: V3;
  rollAxis?: V3;
};

/** Per-joint curl distribution and per-finger scale: the pinky curls most, the index least; the thumb's tip bends most. */
const JOINT_AMOUNT = [0.85, 1.0, 0.7];
const FINGER_AMOUNT = [0.8, 0.95, 1.1, 1.25];
const THUMB_AMOUNT = [0.25, 0.4, 0.45];
const SPREAD = [0.12, 0.02, -0.09, -0.18];
const FREQ = [0.7, 0.9, 1.1, 1.3, 0.8];
/** Joint limits (rad): knuckle, middle, tip; the thumb has its own. */
const LIMITS = [
  [-0.05, 1.55],
  [0, 1.85],
  [0, 1.3],
];

export type FingerRig = { joints: Joint[][]; restFrame: THREE.Matrix4[] };

export function buildFingerRig(c: Character, restQ: Map<THREE.Bone, THREE.Quaternion>): FingerRig {
  const pos = (b: THREE.Bone) => new THREE.Vector3().setFromMatrixPosition(c.restWorld.get(b)!);
  const toLocal = (axis: V3, b: THREE.Bone) => axis.clone().applyQuaternion(restQ.get(b)!.clone().invert()).normalize();
  const palm = v(0, -1, 0); // bind T-pose: palms down
  const joints: Joint[][] = [];
  const restFrame: THREE.Matrix4[] = [];
  for (const side of [-1, 1]) {
    const s = side < 0 ? "r" : "l";
    const list: Joint[] = [];
    const middle = pos(c.bone(`middle_01_${s}`));
    const hand = pos(c.bone(`hand_${s}`));
    restFrame.push(frameOf(middle.clone().sub(hand), palm));
    // the thumb bends towards the palm and across it, not straight down
    const across = pos(c.bone(`pinky_01_${s}`)).sub(pos(c.bone(`index_01_${s}`))).normalize();
    const thumbNormal = palm.clone().multiplyScalar(0.5).addScaledVector(across, 0.85).normalize();
    for (const [fi, f] of ["index", "middle", "ring", "pinky", "thumb"].entries()) {
      for (let k = 1; k <= 3; k++) {
        const bone = c.bone(`${f}_0${k}_${s}`);
        const next = c.bone(k < 3 ? `${f}_0${k + 1}_${s}` : `${f}_04_leaf_${s}`);
        const dir = pos(next).sub(pos(bone)).normalize();
        const thumb = fi === 4;
        const joint: Joint = {
          bone,
          rest: c.restLocal.get(bone)!.clone(),
          curlAxis: toLocal(v().crossVectors(dir, thumb ? thumbNormal : palm), bone),
          amount: thumb ? THUMB_AMOUNT[k - 1] : JOINT_AMOUNT[k - 1] * FINGER_AMOUNT[fi],
          finger: fi,
          knuckle: k - 1,
        };
        if (k === 1 && !thumb) {
          // fan about the palm normal: index towards the thumb, pinky away (mirrored per side)
          joint.spreadAxis = toLocal(v(0, -side, 0), bone);
          joint.spread = SPREAD[fi];
        }
        if (k === 1 && thumb) {
          // thumb towards the middle finger's base (adduction) / away (abduction)
          joint.opposeAxis = toLocal(v().crossVectors(dir, middle.clone().sub(pos(bone)).normalize()), bone);
          // roll the pad towards the index: pick the sign that turns the thumb's bending side towards it
          const toIndex = pos(c.bone(`index_01_${s}`)).sub(pos(bone)).normalize();
          const rolled = thumbNormal.clone().applyAxisAngle(dir, 0.6);
          const sign = rolled.dot(toIndex) > thumbNormal.dot(toIndex) ? 1 : -1;
          joint.rollAxis = toLocal(dir.clone().multiplyScalar(sign), bone);
        }
        list.push(joint);
      }
    }
    joints.push(list);
  }
  return { joints, restFrame };
}

const q1 = new THREE.Quaternion();

/**
 * Poses the fingers of one hand. `ripple` (0..1) flexes them one after another on `phase`
 * (the wave's clock); `t` is the clock for idle micro-motion; `flat` (0..1) opens the hand
 * (sliding into a pocket before curling inside).
 */
export function applyFingers(rig: FingerRig, i: number, shape: HandShape, t: number, ripple = 0, phase = 0, flat = 0) {
  const curls = shape.grip.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  // fingers close together in a fist
  const spread = shape.spread * (1 - 0.7 * clamp(curls / 1.2, 0, 1));
  for (const j of rig.joints[i]) {
    const thumb = j.finger === 4;
    let grip = lerp(shape.grip[j.finger], 0.15, flat);
    // fingers are never perfectly still (a clenched hand is)
    grip += 0.03 * shape.alive * Math.max(0, 1 - grip / 1.9) * Math.sin(t * FREQ[j.finger] + j.finger * 1.1 + i * 2.1) * (thumb ? 0.5 : 1);
    if (ripple && !thumb) grip += ripple * (0.04 + 0.07 * Math.sin(phase - 0.9 - 0.35 * j.finger));
    let angle = grip * j.amount;
    angle = thumb ? clamp(angle, -0.15, 1.2) : clamp(angle, LIMITS[j.knuckle][0], LIMITS[j.knuckle][1]);
    const q = j.bone.quaternion.copy(j.rest);
    if (j.spreadAxis) q.multiply(q1.setFromAxisAngle(j.spreadAxis, j.spread! * spread));
    if (j.opposeAxis) {
      const o = shape.oppose;
      if (o > 0) {
        // opposition: flex across the palm, adduct and turn the pad towards the fingers
        q.multiply(q1.setFromAxisAngle(j.curlAxis, 0.8 * o));
        q.multiply(q1.setFromAxisAngle(j.opposeAxis, 0.3 * o));
        q.multiply(q1.setFromAxisAngle(j.rollAxis!, 0.6 * o));
      } else q.multiply(q1.setFromAxisAngle(j.opposeAxis, Math.max(o, -0.6)));
    }
    q.multiply(q1.setFromAxisAngle(j.curlAxis, angle));
  }
}

/** An orthonormal frame (columns: fingers, palm normal, their cross product). */
export function frameOf(fingers: V3, palm: V3) {
  const f = fingers.clone().normalize();
  const n = palm.clone().addScaledVector(f, -palm.dot(f));
  if (n.lengthSq() < 1e-6) n.set(f.y, -f.x, 0);
  n.normalize();
  const t = v().crossVectors(f, n);
  return new THREE.Matrix4().makeBasis(f, n, t);
}
