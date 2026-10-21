import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FashionProduct, Slot } from "@/lib/fashion-products";
import { sectionAt, surfaceAt } from "./fit";
import { Garment, buildGarment, fitsOver, type Fabric, type Reveal, type Rig } from "./garments";
import { HANDS, applyFingers, buildFingerRig, cloneShape, followShape, frameOf, lerpShape, squeeze, type FingerRig, type HandShape } from "./hands";
import { HAIR, Part, loadCharacter, loadHair, type BodyType, type Character } from "./model";
import { clamp, ease, lerp, normalMapFrom, seg, v, type V3, type Weigher } from "./surface";

/*
 * The fitting-room character: a rigged, textured human (Quaternius Universal
 * Base Characters, CC0) animated in code.
 *  - Arms and legs are solved with two-bone IK on the model's own skeleton;
 *    feet stay planted and step when the body turns; weight shifts between
 *    the legs; the head lags the body; fingers curl to hold things.
 *  - Secondary motion: spring bones swing skirts and coat tails (colliding
 *    with the legs) and a tote swings from the hand.
 *  - Dressing: reach for the folded item, pull it on along the body while the
 *    camera moves in, then look yourself over like in a mirror.
 *  - Interaction: drag to turn, wheel / pinch / double-click to zoom, tap a
 *    garment to pick it, tap the body to wave; stances and a catwalk.
 *
 * Choreography is authored for a reference body (hips 0.92 m, shoulders
 * 1.425 m…) and mapped onto the loaded model's measured landmarks.
 */

export type Outfit = Partial<Record<Slot, FashionProduct>>;
export type Stance = "relaxed" | "hip" | "pockets";
export type PickEvent = { slot: Slot; x: number; y: number } | null;
export type { BodyType };

const SKIRT_BONES = 12;
const SKIRT_LEN = 0.45;
const SLOTS: Slot[] = ["hat", "glasses", "top", "outer", "bottom", "shoes", "bag"];

/* ───────────────────────── Poses ───────────────────────── */

type Pose = {
  hands: [V3, V3]; // wrist targets [right (-x), left (+x)], reference-body space
  /** Hand shapes [right, left]: orientation, finger curls, spread, thumb, arm hang. */
  hand: [HandShape, HandShape];
  spineX: number;
  spineY: number;
  spineZ: number;
  headX: number;
  headY: number;
  headZ: number;
  crouch: number;
  turn: number;
  hop: number;
  lift: number; // lifts the left leg forward
  happy: number;
  weight: number; // -1 on the right leg … +1 on the left
  wave: number; // wrist wag of the waving hand
  fingerWave: number; // its fingers flexing one after another
  wavePhase: number; // the wave's clock (wrist sway, wag and finger ripple stay in step)
  pocket: [number, number]; // each wrist slid into its front pocket
};

const POSE_KEYS = ["spineX", "spineY", "spineZ", "headX", "headY", "headZ", "crouch", "turn", "hop", "lift", "happy", "weight", "wave", "fingerWave"] as const;
const NO_POCKETS: [number, number] = [0, 0];

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {
    ...a,
    hands: [a.hands[0].clone().lerp(b.hands[0], t), a.hands[1].clone().lerp(b.hands[1], t)],
    hand: [lerpShape(a.hand[0], b.hand[0], t), lerpShape(a.hand[1], b.hand[1], t)],
    pocket: [lerp(a.pocket[0], b.pocket[0], t), lerp(a.pocket[1], b.pocket[1], t)],
    wavePhase: b.wavePhase,
  };
  for (const k of POSE_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}
const withPose = (base: Pose, patch: Partial<Pose>): Pose => ({ ...base, ...patch });
function track(frames: [number, Pose][], t: number): Pose {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, p1] = frames[i];
    if (t <= t1) {
      const [t0, p0] = frames[i - 1];
      return lerpPose(p0, p1, ease((t - t0) / (t1 - t0)));
    }
  }
  return frames[frames.length - 1][1];
}
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Both hands with presets: `both(HANDS.relaxed)` or `pair(HANDS.onHip(-1), HANDS.touch(1))`. */
const both = (f: (s: number) => HandShape): [HandShape, HandShape] => [f(-1), f(1)];
const pair = (r: HandShape, l: HandShape): [HandShape, HandShape] => [r, l];

/* ───────────────────────── Choreography (reference body) ───────────────────────── */

/** Dressing beats: reach for the item, lift it, pull it on, admire until the end. */
const T_REACH = 0.6;
const T_LIFT = 0.85;
const T_DRESS = 2.0;
const T_END = 4.0;

type Choreo = {
  reveal: Reveal;
  from: number;
  to: number;
  /** Wrist targets while the garment goes on; wrists sit a pinch-length from the edge being pulled. */
  path: (h: number) => [V3, V3];
  /** How the hands hold the garment while pulling it on. */
  hold: [HandShape, HandShape];
  /** Reach lower for the item (trousers, shoes) with the crouch already started. */
  low?: boolean;
  /** Head pitch while dressing (down to see the hands; level for glasses). */
  head?: number;
  /** Admiring keys, at the default beats or at their own times (s after the garment is on). */
  admire: Partial<Pose>[];
  admireAt?: number[];
  focus: [number, number]; // camera: [height, distance factor]
};

/** Wrists on the hip bones, just behind the side midline (the fingers wrap forward onto the iliac crest). */
const onHips: [V3, V3] = [v(-0.165, 1.06, -0.03), v(0.165, 1.06, -0.03)];
const done: Partial<Pose> = { hands: onHips, happy: 1, hand: both(HANDS.onHip) };
/** A flat hand on the chest, then stroking the fabric down. */
const topAdmireAt = [0.35, 0.62, 0.95, 1.3, 1.65];
const topAdmire: Partial<Pose>[] = [
  { hands: [onHips[0], v(0.11, 1.26, 0.05)], hand: pair(HANDS.onHip(-1), HANDS.touch(1)), spineX: 0.06, headX: 0.42, happy: 0.3, weight: 0.6 },
  { hands: [onHips[0], v(0.08, 1.13, 0.05)], hand: pair(HANDS.onHip(-1), { ...HANDS.touch(1), fingers: v(-0.85, 0.25, 0.1).normalize() }), spineX: 0.08, headX: 0.45, happy: 0.4, weight: 0.6 },
  { hands: onHips, hand: both(HANDS.onHip), turn: 0.55, headX: 0.32, headY: -0.35, weight: -0.5 },
  { hands: onHips, hand: both(HANDS.onHip), turn: -0.55, headX: 0.32, headY: 0.35, weight: 0.6 },
  done,
];

const choreoFor = (p: Pick<FashionProduct, "slot" | "kind">): Choreo => {
  switch (p.slot) {
    case "hat": {
      // the hands start wide while the hat is above the head and close in as it seats
      const side = (h: number) => lerp(0.125, 0.145, clamp((h - 1.6) / 0.26, 0, 1));
      return {
        reveal: "down",
        from: 1.86,
        to: 1.6,
        focus: [1.55, 0.55],
        head: 0.1,
        path: (h) => [v(-side(h), Math.max(h - 0.055, 1.585), -0.005), v(side(h), Math.max(h - 0.055, 1.585), -0.005)],
        hold: both(HANDS.brim),
        admire: [
          { hands: [v(-0.122, 1.575, 0), v(0.122, 1.575, 0)], hand: both(HANDS.brim), headX: -0.04, headZ: 0.06, happy: 0.4 },
          { hands: [onHips[0], v(0.085, 1.655, 0.015)], hand: pair(HANDS.onHip(-1), HANDS.brimPinch(1)), turn: 0.5, headX: -0.08, headY: -0.3, headZ: -0.1, weight: -0.6 },
          { hands: onHips, hand: both(HANDS.onHip), turn: -0.5, headY: 0.3, headZ: 0.1, weight: 0.6 },
          done,
        ],
      };
    }
    case "glasses": {
      // pinching the temple arms beside the head, sliding them back over the ears as the glasses settle
      const u = (h: number) => clamp((1.72 - h) / 0.14, 0, 1);
      const at = (s: number, h: number) => v(s * 0.15, 1.6 - 0.015 * u(h), -0.05 - 0.03 * u(h));
      const bridge: Partial<Pose> = { hands: [onHips[0], v(0.007, 1.474, 0.176)], hand: pair(HANDS.onHip(-1), HANDS.push(1)) };
      return {
        reveal: "down",
        from: 1.72,
        to: 1.58,
        focus: [1.58, 0.42],
        head: -0.02,
        path: (h) => [at(-1, h), at(1, h)],
        hold: both(HANDS.temple),
        admire: [
          { ...bridge, headX: -0.04, headZ: 0.08, happy: 0.3 },
          { ...bridge, hands: [onHips[0], v(0.007, 1.486, 0.17)], turn: 0.45, headY: -0.3, headZ: -0.1 },
          { hands: onHips, hand: both(HANDS.onHip), turn: -0.45, headY: 0.3, headZ: 0.1 },
          done,
        ],
      };
    }
    case "bottom": {
      const from = p.kind === "skirt" ? 0.5 : p.kind === "shorts" ? 0.6 : 0.04;
      return {
        reveal: "up",
        from,
        to: 1.045,
        focus: [0.62, 0.75],
        path: (h) => [v(-0.16, Math.max(h, 0.47) + 0.07, 0.13), v(0.16, Math.max(h, 0.47) + 0.07, 0.13)],
        hold: both(HANDS.waistband),
        low: true,
        admireAt: topAdmireAt,
        admire: [
          { hands: [v(-0.15, 0.84, 0.05), v(0.15, 0.84, 0.05)], hand: both(HANDS.smoothing), spineX: 0.2, headX: 0.55, crouch: 0.06 },
          { hands: [v(-0.15, 0.74, 0.05), v(0.15, 0.74, 0.05)], hand: both(HANDS.smoothing), spineX: 0.26, headX: 0.6, crouch: 0.1 },
          { hands: onHips, hand: both(HANDS.onHip), turn: 0.4, lift: p.kind === "skirt" ? 0 : 1, spineX: 0.12, headX: 0.5, headY: -0.2, weight: -0.8 },
          { hands: onHips, hand: both(HANDS.onHip), turn: -0.4, spineX: 0.08, headX: 0.4, headY: 0.25, weight: 0.6 },
          done,
        ],
      };
    }
    case "shoes":
      return {
        reveal: "up",
        from: -0.02,
        to: p.kind === "boots" ? 0.28 : 0.13,
        focus: [0.32, 0.6],
        path: () => [v(-0.15, 0.48, 0.22), v(0.15, 0.48, 0.22)],
        hold: both(HANDS.heel),
        low: true,
        admire: [
          { hands: onHips, hand: both(HANDS.onHip), spineX: 0.28, headX: 0.65, crouch: 0.04 },
          { hands: onHips, hand: both(HANDS.onHip), lift: 1, spineX: 0.22, headX: 0.65, headY: 0.15, turn: 0.25, weight: -0.9 },
          { hands: onHips, hand: both(HANDS.onHip), lift: 0, turn: -0.35, spineX: 0.18, headX: 0.55, headY: 0.2, weight: 0.5 },
          done,
        ],
      };
    case "bag":
      if (p.kind === "tote") {
        return {
          reveal: "down",
          from: 0.95,
          to: 0.4,
          focus: [0.85, 0.75],
          path: (h) => [v(-0.2, 0.905, 0.015), v(0.24, clamp(h + 0.12, 0.88, 1.05), 0.12)],
          hold: pair(HANDS.relaxed(-1), HANDS.handle(1)),
          admire: [
            { hands: [onHips[0], v(0.2, 1.1, 0.3)], hand: pair(HANDS.onHip(-1), HANDS.handle(1)), headX: 0.3, headY: 0.3, happy: 0.4 },
            { hands: [onHips[0], v(0.22, 1.05, 0.25)], hand: pair(HANDS.onHip(-1), HANDS.handle(1)), turn: 0.5, headX: 0.25, headY: 0.35 },
            { hands: [onHips[0], v(0.23, 0.9, 0.06)], hand: pair(HANDS.onHip(-1), HANDS.handle(1)), turn: -0.35, headY: 0.2 },
            { hands: [onHips[0], v(0.2, 0.905, 0.015)], hand: pair(HANDS.onHip(-1), HANDS.handle(1)), happy: 1 },
          ],
        };
      }
      return {
        reveal: "down",
        from: 1.52,
        to: 0.83,
        focus: [1.1, 0.7],
        path: (h) => {
          const u = clamp((1.52 - h) / 0.69, 0, 1);
          return [v(-0.165, Math.max(h, 0.98) + 0.03, 0.15), v(lerp(0.13, 0.1, u), lerp(1.4, 1.3, u), 0.12)];
        },
        hold: pair(HANDS.carry(-1), HANDS.pinch(1)),
        admire: [
          { hands: [v(-0.17, 1.0, 0.14), v(0.1, 1.32, 0.12)], hand: pair(HANDS.smoothing(-1), HANDS.pinch(1)), spineX: 0.06, headX: 0.35, headY: 0.2, happy: 0.3 },
          { hands: [v(-0.17, 1.0, 0.14), onHips[1]], hand: pair(HANDS.smoothing(-1), HANDS.onHip(1)), turn: 0.5, headX: 0.3, headY: -0.3, weight: 0.5 },
          { hands: onHips, hand: both(HANDS.onHip), turn: -0.4, headY: 0.3, weight: -0.5 },
          done,
        ],
      };
    case "top":
    case "outer":
      return {
        reveal: "down",
        from: 1.52,
        to: p.kind === "coat" ? 0.4 : 0.83,
        focus: p.kind === "coat" ? [0.95, 0.9] : [1.18, 0.62],
        // pinching the hem at the sides and pulling it down (the wrist rides a pinch-length above the hem);
        // a coat's hem is let go at the hips and falls the rest of the way (no crouching into its tails)
        path: (h) => {
          const y = Math.max(h + 0.08, p.kind === "coat" ? 0.86 : 0.5);
          return [v(-0.245, y, 0.035), v(0.245, y, 0.035)];
        },
        hold: both(HANDS.pinch),
        admire: topAdmire,
        admireAt: topAdmireAt,
      };
  }
};

/* ───────────────────────── Scene ───────────────────────── */

type Limb = { side: number; upper: THREE.Bone; lower: THREE.Bone; end: THREE.Bone };
type Foot = { pos: V3; yaw: number; from: V3; to: V3; fromYaw: number; toYaw: number; t: number };
type SkirtBone = { bone: THREE.Bone; rest: V3; tip: V3; prev: V3 };

type Action =
  | { type: "dress"; slot: Slot; product?: FashionProduct; garment?: Garment; choreo?: Choreo; t: number; start?: Pose }
  | { type: "multi"; t: number; start?: Pose; fresh: Garment[] }
  | { type: "wave"; t: number; start?: Pose }
  | { type: "spin"; t: number; start?: Pose };

/** Everything that belongs to one loaded body. */
type Body = {
  c: Character;
  restQ: Map<THREE.Bone, THREE.Quaternion>;
  spine: { bone: THREE.Bone; share: number }[];
  pelvis: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  chest: THREE.Bone;
  arms: Limb[];
  legs: Limb[];
  fingers: FingerRig;
  /** Shoulder joints in the bind pose (character space), to let hanging arms follow the torso. */
  restShoulder: V3[];
  skirt: SkirtBone[];
  skirtSkeleton: THREE.Skeleton;
  hair: THREE.SkinnedMesh | null;
  hatHair: THREE.SkinnedMesh | null;
  restAnkle: V3[];
  /** Heel and toe ends of the sole along z, relative to each ankle (the sole overhangs the foot). */
  footSpan: number[][];
  /** Front pocket openings [right, left] and their outward normals (character space). */
  pockets: V3[];
  pocketNormals: V3[];
  /** Body cross-section at a height (torso above the hips, hips + thighs below). */
  section: (y: number) => { rx: number; rz: number; cz: number };
  /** One thigh's cross-section at a height (bind pose, the left one: mirror x for the right). */
  leg: (y: number) => { rx: number; rz: number; cz: number; cx: number };
  /** The last two joints of each finger and the thumb [right, left], to keep curled fingers off the legs. */
  tips: THREE.Bone[][];
  /** Maps reference-body coordinates onto this body. */
  X: (x: number) => number;
  Y: (y: number) => number;
};

export class CharacterScene implements Rig {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  private disposables: { dispose(): void }[] = [];
  private textures = new Map<string, Promise<Fabric>>();
  private loader = new THREE.TextureLoader();

  readonly rootGroup = new THREE.Group();
  private root = this.rootGroup;
  private body: Body | null = null;
  private bodyType: BodyType | null = null;
  private loading: Promise<void> | null = null;
  private skin = "#e8b48f";

  private ring: THREE.Mesh;
  private token: THREE.Mesh;
  private tokenMat: THREE.MeshPhysicalMaterial;

  private worn = new Map<Slot, Garment>();
  /** Outerwear (and straps) already refitted over a top that's being put on, swapped in when it goes on. */
  private refits = new Map<Slot, Garment>();
  private leaving: { garment: Garment; t: number; from: number; to: number }[] = [];
  private desired: Outfit = {};
  private queue: Action[] = [];
  private action: Action | null = null;

  private stance: Stance = "relaxed";
  private walking = false;
  private walkAmount = 0;
  private walkPhase = 0;
  private smooth: Pose | null = null;
  private feet: Foot[] = [];
  private lastStep = 0;
  private swing = { x: 0, z: 0, vx: 0, vz: 0, prev: v(), prevVel: v(), ready: false };

  private yaw = 0;
  private yawVelocity = 0;
  private lastInteraction = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragMoved = 0;
  private pinchStart = 0;
  private pointer = new THREE.Vector2(0, 0);
  private pointerActive = false;
  private headLook = new THREE.Vector2(0, 0);
  private glance = new THREE.Vector2(0, 0.05);
  private nextGlance = 1;
  private hovered: Slot | null = null;
  private coverKey = "";
  private lastHoverCheck = 0;

  private zoom = 1;
  private zoomY = 0.9;
  private cam = { y: 0.95, dist: 4.5, x: 0 };
  private fitDist = 4.5;

  private clock = new THREE.Clock();
  private time = 0;
  private raf = 0;
  private visible = true;
  private disposed = false;
  private speed: number;
  private observer: ResizeObserver;
  private io: IntersectionObserver;
  private raycaster = new THREE.Raycaster();

  onPick: (e: PickEvent) => void = () => {};
  onLoading: (loading: boolean) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    const el = this.renderer.domElement;
    Object.assign(el.style, { width: "100%", height: "100%", display: "block", touchAction: "pan-y" });
    host.appendChild(el);

    this.speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 2.5 : 1;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.6;
    room.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();
    this.disposables.push(env);

    this.scene.add(new THREE.HemisphereLight("#fff8ee", "#bfb2a0", 0.7));
    const key = new THREE.DirectionalLight("#fff3e4", 2.4);
    key.position.set(1.6, 3.4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 2.1, bottom: -0.2 });
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#e6eeff", 1.3);
    rim.position.set(-2.4, 2.2, -2.2);
    this.scene.add(rim);

    const floorGeo = this.own(new THREE.CircleGeometry(1.4, 64));
    const floor = new THREE.Mesh(floorGeo, this.own(new THREE.ShadowMaterial({ opacity: 0.22 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const glow = new THREE.Mesh(floorGeo, this.own(new THREE.MeshBasicMaterial({ map: this.own(platformTexture()), transparent: true, depthWrite: false })));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.001;
    glow.scale.setScalar(0.42);
    this.scene.add(glow);
    this.scene.add(this.root);

    this.ring = new THREE.Mesh(
      this.own(new THREE.TorusGeometry(0.3, 0.004, 6, 96)),
      this.own(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.root.add(this.ring);
    this.tokenMat = this.own(new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.9, sheen: 0.5 }));
    this.token = new THREE.Mesh(this.own(new RoundedBoxGeometry(0.24, 0.06, 0.17, 3, 0.02)), this.tokenMat);
    this.token.castShadow = true;
    this.token.visible = false;
    this.root.add(this.token);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.clock.getDelta();
    });
    this.io.observe(host);

    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerleave", this.onPointerLeave);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("dblclick", this.onDoubleClick);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);

    this.raf = requestAnimationFrame(this.loop);
  }

  /* ───────── public API ───────── */

  /** Loads (or switches to) a body; the outfit is refitted onto it. */
  setBody(type: BodyType) {
    if (this.bodyType === type && this.loading) return this.loading;
    this.bodyType = type;
    this.onLoading(true);
    const job = loadCharacter(type, Math.min(8, this.renderer.capabilities.getMaxAnisotropy())).then(async (c) => {
      const [hair, hatHair] = await Promise.all([loadHair(c, HAIR[type].default), loadHair(c, HAIR[type].underHat)]);
      if (this.disposed || this.bodyType !== type) {
        disposeObject(c.object);
        return;
      }
      this.unloadBody();
      this.body = this.rigBody(c, hair, hatHair);
      this.root.add(c.object);
      this.setSkin(this.skin);
      this.resize();
      for (const slot of SLOTS) {
        const product = this.desired[slot];
        if (!product) continue;
        const g = buildGarment(this, product);
        g.attach();
        this.worn.set(slot, g);
      }
      this.updateHair();
      this.onLoading(false);
    });
    this.loading = job.catch((e) => {
      this.onLoading(false);
      throw e;
    });
    return this.loading;
  }

  setSkin(hex: string) {
    this.skin = hex;
    const b = this.body;
    if (!b) return;
    // four tones from the model's two skin textures
    const tones: Record<string, [keyof Character["skinMaps"], string]> = {
      "#f6d2b8": ["light", "#ffffff"],
      "#e8b48f": ["light", "#e9cdb6"],
      "#c68863": ["dark", "#ffffff"],
      "#8d5a3c": ["dark", "#b98f78"],
    };
    const [map, tint] = tones[hex.toLowerCase()] ?? ["light", "#ffffff"];
    b.c.skinMaterial.map = b.c.skinMaps[map];
    b.c.skinMaterial.color.set(tint);
    b.c.skinMaterial.needsUpdate = true;
  }

  setStance(s: Stance) {
    this.stance = s;
  }

  setWalking(on: boolean) {
    this.walking = on;
  }

  zoomBy(factor: number, aroundY?: number) {
    this.zoom = clamp(this.zoom * factor, 0.32, 1);
    if (aroundY !== undefined) this.zoomY = clamp(aroundY, 0.2, 1.7);
    if (this.zoom > 0.97) this.zoomY = 0.9;
  }

  setOutfit(outfit: Outfit) {
    this.desired = { ...outfit };
    if (!this.body) return; // applied when the body has loaded
    const added: Slot[] = [];
    for (const slot of SLOTS) {
      const want = outfit[slot];
      const have = this.worn.get(slot);
      if (!want && have) this.takeOff(slot);
      else if (want && have?.product.id !== want.id) added.push(slot);
    }
    if (!added.length) return;
    if (added.length > 1) {
      this.queue = this.queue.filter((a) => a.type !== "dress");
      this.queue.push({ type: "multi", t: 0, fresh: [] });
    } else if (!this.queue.some((a) => a.type === "dress" && a.slot === added[0])) {
      this.queue.push({ type: "dress", slot: added[0], t: 0 });
    }
  }

  wave() {
    if (this.body && !this.action && !this.queue.length) this.queue.push({ type: "wave", t: 0 });
  }

  spin() {
    if (this.body && !this.action && !this.queue.length) this.queue.push({ type: "spin", t: 0 });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("dblclick", this.onDoubleClick);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.unloadBody();
    for (const t of this.textures.values()) {
      t.then(({ map, normal }) => {
        map.dispose();
        normal.dispose();
      }).catch(() => {});
    }
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    el.remove();
  }

  /* ───────── Rig (for garment builders) ───────── */

  get character() {
    return this.body!.c;
  }

  get skirtSkeleton() {
    return this.body!.skirtSkeleton;
  }

  wornIn(slot: Slot) {
    return this.worn.get(slot);
  }

  /** Pelvis (index 0) at the waist, handing over to the skirt bones (1…) below `top`. */
  skirtWeights(top: number): Weigher {
    const n = SKIRT_BONES;
    return (y, th) => {
      const s = ease((top - y) / 0.16);
      const f = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * n;
      const i0 = Math.floor(f) % n;
      const frac = f - Math.floor(f);
      return [0, 1 - s, 1 + i0, s * (1 - frac), 1 + ((i0 + 1) % n), s * frac];
    };
  }

  loadFabric(src: string, size: number) {
    const key = `${src}|${size}`;
    let p = this.textures.get(key);
    if (!p) {
      p = this.loader.loadAsync(src).then((map) => {
        const normal = normalMapFrom(map.image as HTMLImageElement);
        for (const t of [map, normal]) {
          t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
          t.repeat.set(1 / size, 1 / size);
          t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        }
        map.colorSpace = THREE.SRGBColorSpace;
        return { map, normal };
      });
      p.catch(() => {});
      this.textures.set(key, p);
    }
    return p;
  }

  private own<T extends { dispose(): void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  /* ───────── body setup ───────── */

  private rigBody(c: Character, hair: THREE.SkinnedMesh, hatHair: THREE.SkinnedMesh): Body {
    const L = c.landmarks;
    const restQ = new Map<THREE.Bone, THREE.Quaternion>();
    for (const [b, m] of c.restWorld) restQ.set(b, new THREE.Quaternion().setFromRotationMatrix(m));
    const pos = (b: THREE.Bone) => new THREE.Vector3().setFromMatrixPosition(c.restWorld.get(b)!);

    // hair and eyebrows share a grayscale texture meant to be tinted
    for (const m of [...c.materials, hair.material, hatHair.material] as THREE.MeshStandardMaterial[]) {
      if (/hair/i.test(m.name)) m.color.set(c.type === "male" ? "#3a2a20" : "#2c1e17");
    }
    hatHair.visible = false;

    const limb = (side: number, a: string, b: string, e: string): Limb => {
      const s = side < 0 ? "r" : "l";
      return { side, upper: c.bone(`${a}_${s}`), lower: c.bone(`${b}_${s}`), end: c.bone(`${e}_${s}`) };
    };
    const arms = [limb(-1, "upperarm", "lowerarm", "hand"), limb(1, "upperarm", "lowerarm", "hand")];
    const legs = [limb(-1, "thigh", "calf", "foot"), limb(1, "thigh", "calf", "foot")];

    // fingers: graded curls, spread and thumb opposition on the model's finger bones
    const fingers = buildFingerRig(c, restQ);

    // spring bones hanging from a ring around the waist
    const pelvis = c.bone("pelvis");
    const pelvisInv = c.restWorld.get(pelvis)!.clone().invert();
    const waist = sectionAt(c, L.waistY, [Part.Belly], 0.02);
    const skirt: SkirtBone[] = [];
    for (let k = 0; k < SKIRT_BONES; k++) {
      const th = (k / SKIRT_BONES) * Math.PI * 2;
      const at = v(Math.sin(th) * waist.rx * 0.9, L.waistY, waist.cz + Math.cos(th) * waist.rz * 0.9);
      const bone = new THREE.Bone();
      bone.position.copy(at.applyMatrix4(pelvisInv));
      pelvis.add(bone);
      skirt.push({ bone, rest: v(Math.sin(th) * 0.3, -1, Math.cos(th) * 0.25).normalize(), tip: v(), prev: v() });
    }
    c.object.updateMatrixWorld(true); // still at the origin: world = character space
    const skirtSkeleton = new THREE.Skeleton([pelvis, ...skirt.map((s) => s.bone)], [pelvisInv.clone(), ...skirt.map((s) => s.bone.matrixWorld.clone().invert())]);

    // reference body → this body
    const ref = [0, 0.085, 0.5, 0.92, 1.04, 1.425, 1.632, 1.75];
    const real = [0, L.ankleY, L.kneeY, L.hipY, L.waistY, L.shoulderY, L.eyeY, L.height];
    const Y = (y: number) => {
      for (let i = 1; i < ref.length; i++) {
        if (y <= ref[i] || i === ref.length - 1) return lerp(real[i - 1], real[i], (y - ref[i - 1]) / (ref[i] - ref[i - 1]));
      }
      return y;
    };
    const hipHalf = sectionAt(c, L.hipY - 0.04, [Part.Belly, Part.Thigh], 0.02).rx;
    // cross-sections every 2 cm from the top down to the knee, interpolated between
    // (a band of ±3 cm: the thighs' vertex rings are far apart, a thinner one can catch only the inner thigh)
    const sampled = (top: number, at: (y: number) => { rx: number; rz: number; cz: number; cx: number }) => {
      const rows: ReturnType<typeof at>[] = [];
      for (let y = top; y > L.kneeY; y -= 0.02) rows.push(at(y));
      return (y: number) => {
        const f = clamp((top - y) / 0.02, 0, rows.length - 1);
        const i = Math.floor(f);
        const a = rows[i];
        const b2 = rows[Math.min(i + 1, rows.length - 1)];
        const t = f - i;
        return { rx: lerp(a.rx, b2.rx, t), rz: lerp(a.rz, b2.rz, t), cz: lerp(a.cz, b2.cz, t), cx: lerp(a.cx, b2.cx, t) };
      };
    };
    const section = sampled(L.shoulderY - 0.06, (y) => sectionAt(c, y, y > L.hipY ? [Part.Chest, Part.Belly] : [Part.Belly, Part.Thigh], 0.03));
    const leg = sampled(L.hipY, (y) => sectionAt(c, y, [Part.Thigh, Part.Belly], 0.03, 1));
    const sx = Math.max(L.shoulderX + 0.025, hipHalf + 0.045) / 0.205;
    const X = (x: number) => x * sx;

    // pocket openings at the front of the hips, just off the trousers
    const pocketAt = [-1, 1].map((s) => surfaceAt(c, s * hipHalf * 0.8, L.waistY - 0.045, 1, [Part.Belly, Part.Thigh]));
    const pockets = pocketAt.map((sp) => sp.p.clone().addScaledVector(sp.n, 0.018));
    const pocketNormals = pocketAt.map((sp) => sp.n.clone().normalize());
    this.feet = legs.map((l) => {
      const p = pos(l.end);
      return { pos: p.clone(), yaw: 0, from: p.clone(), to: p.clone(), fromYaw: 0, toYaw: 0, t: -1 };
    });
    this.smooth = null;
    this.swing.ready = false;
    this.fingerPush = [0, 0];
    this.fingerDir = [v(-1, 0, 0), v(1, 0, 0)];

    return {
      c,
      restQ,
      pelvis,
      spine: [
        { bone: c.bone("spine_01"), share: 0.3 },
        { bone: c.bone("spine_02"), share: 0.35 },
        { bone: c.bone("spine_03"), share: 0.35 },
      ],
      chest: c.bone("spine_03"),
      neck: c.bone("neck_01"),
      head: c.bone("Head"),
      arms,
      legs,
      fingers,
      restShoulder: arms.map((a) => pos(a.upper)),
      skirt,
      skirtSkeleton,
      hair,
      hatHair,
      restAnkle: legs.map((l) => pos(l.end)),
      footSpan: legs.map((l) => {
        let z0 = Infinity;
        let z1 = -Infinity;
        for (let k = 0; k < c.surface.part.length; k++) {
          if (c.surface.part[k] !== Part.Foot || c.surface.side[k] !== l.side) continue;
          z0 = Math.min(z0, c.surface.position[k * 3 + 2]);
          z1 = Math.max(z1, c.surface.position[k * 3 + 2]);
        }
        const az = pos(l.end).z;
        return [z0 - 0.02 - az, z1 + 0.025 - az];
      }),
      pockets,
      pocketNormals,
      section,
      leg,
      tips: ["r", "l"].map((sd) => ["thumb", "index", "middle", "ring", "pinky"].flatMap((f) => [c.bone(`${f}_04_leaf_${sd}`), c.bone(`${f}_03_${sd}`)])),
      X,
      Y,
    };
  }

  private unloadBody() {
    for (const g of this.worn.values()) g.dispose();
    for (const l of this.leaving) l.garment.dispose();
    for (const g of this.refits.values()) g.dispose();
    this.refits.clear();
    this.worn.clear();
    this.leaving = [];
    const a = this.action;
    if (a?.type === "dress" && a.garment) a.garment.dispose();
    this.action = null;
    this.queue = [];
    this.hovered = null;
    this.token.visible = false;
    this.ring.visible = false;
    this.coverKey = "";
    if (this.body) {
      this.root.remove(this.body.c.object);
      disposeObject(this.body.c.object);
      this.body.c.skinMaps.dark.dispose();
      this.body = null;
    }
  }

  private updateHair() {
    const b = this.body;
    if (!b?.hair || !b.hatHair) return;
    const hat = this.worn.has("hat") && !this.leaving.some((l) => l.garment.slot === "hat" && l.t < 0.6);
    b.hair.visible = !hat;
    b.hatHair.visible = hat;
  }

  /**
   * Outerwear is fitted over the top worn under it (and a strap over both):
   * once that changes, it's rebuilt over what's there now (already built if a
   * top is being put on), keeping how far it's revealed. A hood lies over the
   * collar of whatever is worn over its hoodie.
   */
  private refit() {
    const a = this.action;
    for (const slot of SLOTS) {
      const g = this.worn.get(slot);
      if (!g) continue;
      const want = fitsOver(g.product).flatMap((s) => this.worn.get(s) ?? []);
      if (same(want, g.over)) continue;
      const ready = this.refits.get(slot);
      this.refits.delete(slot);
      if (ready && !same(want, ready.over)) ready.dispose();
      const fresh = ready && same(want, ready.over) ? ready : buildGarment(this, g.product, want);
      fresh.reveal = g.reveal;
      fresh.plane.copy(g.plane);
      g.dispose();
      fresh.attach();
      this.worn.set(slot, fresh);
      if (a?.type === "dress" && a.garment === g) a.garment = fresh;
      if (a?.type === "multi") a.fresh = a.fresh.map((x) => (x === g ? fresh : x));
      this.coverKey = "";
    }
    const hidden = new Set<THREE.Object3D>();
    const on = [...this.worn.values(), ...this.leaving.map((l) => l.garment)];
    for (const g of on) for (const o of g.hides) hidden.add(o);
    for (const g of on) if (g.hood) g.hood.visible = !hidden.has(g.hood);
  }

  /** Hides the skin under garments that are fully on (not while they're being put on or taken off). */
  private updateCoverage() {
    const b = this.body!;
    const a = this.action;
    const dressing = new Set<Garment>();
    if (a?.type === "dress" && a.garment && a.t < T_DRESS) dressing.add(a.garment);
    if (a?.type === "multi") for (const g of a.fresh) dressing.add(g);
    const active = [...this.worn.values()].filter((g) => g.coverage && !dressing.has(g));
    const key = active.map((g) => g.product.id).join("|");
    if (key === this.coverKey) return;
    this.coverKey = key;
    const attr = b.c.body.geometry.getAttribute("covered") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    arr.fill(0);
    for (const g of active) {
      const cov = g.coverage!;
      for (let i = 0; i < arr.length; i++) if (cov[i]) arr[i] = 1;
    }
    attr.needsUpdate = true;
  }

  private mapV(p: V3, clear = true) {
    const b = this.body!;
    const L = b.c.landmarks;
    const y = b.Y(p.y);
    const head = clamp((y - L.shoulderY) / 0.1, 0, 1);
    const out = v(lerp(b.X(p.x), p.x, head), y, p.z);
    return clear ? this.clearBody(out) : out;
  }

  /** A hand never goes into the body or the clothes on it (`extra` further off them): if it would, it rests on the surface instead. */
  private clearBody(out: V3, extra = 0) {
    const b = this.body!;
    const L = b.c.landmarks;
    if (out.y < L.shoulderY - 0.06 && out.y > L.kneeY) {
      const c = this.clearance(out.y);
      const rx = c.rx + extra;
      const rz = c.rz + extra;
      const cz = c.cz;
      const dx = out.x / rx;
      const dz = (out.z - cz) / rz;
      const d = Math.hypot(dx, dz);
      if (d < 1) {
        const k = d > 1e-3 ? 1 / d : 1;
        out.x = (d > 1e-3 ? dx : Math.sign(out.x || 1)) * k * rx;
        out.z = cz + (d > 1e-3 ? dz * k : 0) * rz;
      }
    }
    return out;
  }

  /** No front pockets to put the hands in: bare legs or a skirt. */
  private get pocketless() {
    const bottom = this.worn.get("bottom")?.product.kind;
    return !bottom || bottom === "skirt";
  }

  /** The tote hangs from the left hand: it keeps a fist, stays out of the pocket and doesn't wave. */
  private get tote() {
    return this.worn.get("bag")?.product.kind === "tote";
  }

  /* ───────── actions ───────── */

  private takeOff(slot: Slot) {
    const g = this.worn.get(slot);
    if (!g) return;
    this.worn.delete(slot);
    if (this.hovered === slot) this.hovered = null;
    const ch = choreoFor(g.product);
    g.reveal = ch.reveal;
    this.leaving.push({ garment: g, t: 0, from: this.body!.Y(ch.to), to: this.body!.Y(ch.from) });
  }

  private startNext(idle: Pose) {
    while (this.queue.length) {
      const next = this.queue.shift()!;
      next.start = this.smooth ?? idle;
      if (next.type === "dress") {
        const product = this.desired[next.slot];
        if (!product || this.worn.get(next.slot)?.product.id === product.id) continue;
        next.product = product;
        next.choreo = choreoFor(product);
        next.garment = buildGarment(this, product);
        next.garment.reveal = next.choreo.reveal;
        // what's worn over it is refitted now, with it, and swapped in when it goes on (see `refit`)
        for (const g of this.refits.values()) g.dispose();
        this.refits.clear();
        for (const slot of SLOTS) {
          const g = this.worn.get(slot);
          const over = g && fitsOver(g.product);
          if (!over?.includes(next.slot) && !over?.some((s) => this.refits.has(s))) continue;
          const under = over.flatMap((s) => (s === next.slot ? next.garment! : (this.refits.get(s) ?? this.worn.get(s))) ?? []);
          this.refits.set(slot, buildGarment(this, g!.product, under));
        }
        next.garment.setLevel(this.body!.Y(next.choreo.from));
        this.tokenMat.color.set(product.color);
        this.tokenMat.map = null;
        this.tokenMat.needsUpdate = true;
        if (product.fabric) {
          this.loadFabric(product.fabric.src, product.fabric.size).then(({ map }) => {
            if (this.action !== next) return;
            this.tokenMat.map = map;
            this.tokenMat.color.set("#ffffff");
            this.tokenMat.needsUpdate = true;
          });
        }
      }
      if (next.type === "multi") {
        for (const slot of SLOTS) {
          const want = this.desired[slot];
          const have = this.worn.get(slot);
          if (have && have.product.id !== want?.id) this.takeOff(slot);
          if (want && have?.product.id !== want.id) {
            const g = buildGarment(this, want);
            g.reveal = "down";
            g.setLevel(this.body!.c.landmarks.height + 0.15);
            g.attach();
            this.worn.set(slot, g);
            next.fresh.push(g);
          }
        }
        if (!next.fresh.length) continue;
      }
      this.action = next;
      return;
    }
  }

  /** Target pose (reference-body space) for the running action, or null when done. */
  private runAction(dt: number, idle: Pose): Pose | null {
    const a = this.action!;
    const b = this.body!;
    const rush = 1 + Math.min(this.queue.length, 3) * 0.5;
    a.t += dt * this.speed * rush;
    const t = a.t;
    const start = a.start!;

    if (a.type === "wave") {
      // waves with the free hand: the left, or the right while the left carries a tote; the other hand stays as it is
      const T = 2.3;
      if (t >= T) return null;
      const base = this.idlePose();
      const i = this.tote ? 0 : 1;
      const s = i ? 1 : -1;
      const up = seg(t, 0, 0.45) * (1 - seg(t, 1.85, T));
      const wg = seg(t, 0.3, 0.55) * (1 - seg(t, 1.7, 1.95));
      const ph = 11 * (t - 0.3);
      // the forearm pivots at the elbow: the wrist sways and the hand wags a beat behind it
      const hands: [V3, V3] = [base.hands[0], base.hands[1]];
      hands[i] = v(s * 0.38 + 0.045 * Math.sin(ph) * wg, 1.61 - 0.006 * Math.sin(ph) ** 2 * wg, 0.13);
      const raised = lerpPose(base, withPose(base, { hands, headZ: -0.1 * s, happy: 1, spineZ: 0.04 * s, weight: -0.5 * s }), up);
      // the fingers open after the wrist starts up and relax before it drops
      const hand = [...base.hand] as [HandShape, HandShape];
      hand[i] = lerpShape(base.hand[i], HANDS.wave(s), seg(t, 0.1, 0.5) * (1 - seg(t, 1.8, 2.15)));
      const pocket: [number, number] = [...base.pocket];
      pocket[i] = 0;
      return withPose(raised, { hand, pocket, wave: wg, fingerWave: wg, wavePhase: ph });
    }

    if (a.type === "spin") {
      const T = 1.8;
      if (t >= T) return null;
      const out = seg(t, 0, 0.35) * (1 - seg(t, 1.35, 1.75));
      // the hands trail the turn and lift a little with it
      const x = (t - 0.05) / 1.4;
      const wn = x > 0 && x < 1 ? 4 * x * (1 - x) : 0;
      const open = (s: number) => v(s * (0.39 + 0.03 * wn), 1.0 + 0.03 * wn, 0.03 + s * 0.055 * wn);
      const spun = withPose(idle, {
        turn: Math.PI * 2 * seg(t, 0.05, 1.45),
        hop: Math.sin(clamp((t - 1.4) / 0.35, 0, 1) * Math.PI) * 0.025,
        happy: 1 - seg(t, 1.45, T),
        hands: [open(-1), open(1)],
        hand: both(HANDS.open),
      });
      return withPose(lerpPose(idle, spun, out), { turn: spun.turn, hop: spun.hop });
    }

    if (a.type === "multi") {
      const T = 3.4;
      const top = b.c.landmarks.height + 0.15;
      const h = lerp(top, -0.05, seg(t, 0.15, 1.5));
      for (const g of a.fresh) g.setLevel(h);
      this.showRing(h, t < 1.55);
      if (t >= T) {
        for (const g of a.fresh) g.showAll();
        return null;
      }
      const u = clamp((t - 0.1) / 1.45, 0, 1);
      const wn = 4 * u * (1 - u);
      const arm = (s: number) => v(s * (0.52 + 0.02 * wn), 1.15 + 0.03 * wn, 0.06 + s * 0.06 * wn);
      const twirl = withPose(idle, { turn: Math.PI * 2 * seg(t, 0.1, 1.55), hands: [arm(-1), arm(1)], hand: both(HANDS.open), happy: 0.6, headX: -0.06 });
      if (t < 1.65) return lerpPose(start, twirl, seg(t, 0, 0.3));
      const admire = topAdmire.map((p) => withPose(idle, p));
      const turned = (p: Pose, extra = 0) => withPose(p, { turn: Math.PI * 2 + extra });
      const tt = t - 1.65;
      return this.landing(
        track(
          [
            [0, turned(twirl)],
            [0.3, turned(admire[0])],
            [0.5, turned(admire[1])],
            [0.8, turned(admire[2], 0.55)],
            [1.1, turned(admire[3], -0.55)],
            [1.4, turned(admire[4])],
            [1.75, turned(idle)],
          ],
          tt,
        ),
        tt + 0.25,
      );
    }

    // dress
    const ch = a.choreo!;
    const g = a.garment!;
    if (this.desired[a.slot]?.id !== a.product!.id) {
      if (this.worn.get(a.slot) === g) this.takeOff(a.slot);
      else g.dispose();
      if (this.desired[a.slot] && !this.queue.some((q) => q.type === "dress" && q.slot === a.slot)) this.queue.unshift({ type: "dress", slot: a.slot, t: 0 });
      return null;
    }

    // the item arrives folded on both palms in front of the chest (lower for trousers and shoes)
    const reachY = ch.low ? 1.02 : 1.12;
    const landed = 0.012 * Math.sin(Math.PI * seg(t, 0.4, 0.58));
    const reach = withPose(idle, {
      hands: [v(-0.1, reachY - landed, 0.29), v(0.1, reachY - landed, 0.29)],
      // palms open first, then close a little round the item as it lands
      hand: [0, 1].map((i) => lerpShape(lerpShape(start.hand[i], HANDS.carryOpen(i ? 1 : -1), seg(t, 0.05, 0.4)), HANDS.carry(i ? 1 : -1), seg(t, 0.4, 0.6))) as [HandShape, HandShape],
      crouch: ch.low ? 0.25 : 0,
      spineX: ch.low ? 0.14 : 0,
      headX: 0.3,
      headY: 0,
      happy: 0.15,
      weight: 0,
      pocket: NO_POCKETS,
    });

    const tokenScale = seg(t, 0.15, 0.45) * (1 - seg(t, T_REACH + 0.05, T_LIFT));
    this.token.visible = tokenScale > 0.01;
    if (this.token.visible) {
      // resting on the palms (a little past the wrists, just above the palm)
      const palms = [0, 1].map((i) => {
        const hand = b.arms[i].end;
        const q = hand.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromRotationMatrix(b.c.restWorld.get(hand)!).invert());
        const frame = b.fingers.restFrame[i];
        return hand
          .getWorldPosition(v())
          .addScaledVector(v().setFromMatrixColumn(frame, 0).applyQuaternion(q), 0.055)
          .addScaledVector(v().setFromMatrixColumn(frame, 1).applyQuaternion(q), 0.018);
      });
      const mid = this.root.worldToLocal(palms[0].clone().add(palms[1]).multiplyScalar(0.5));
      this.token.position.copy(mid).add(v(0, 0.03, 0));
      // a top widens as the hands part to take its hem
      const wide = ch.reveal === "down" && !ch.low && t > T_REACH ? clamp(palms[0].distanceTo(palms[1]) / 0.24, 1, 2.2) : 1;
      this.token.scale.set(wide, 1, 1).multiplyScalar(Math.max(0.001, tokenScale));
    }

    if (t >= T_LIFT && this.worn.get(a.slot) !== g) {
      if (this.worn.has(a.slot)) this.takeOff(a.slot);
      g.attach();
      this.worn.set(a.slot, g);
    }

    const u = seg(t, T_LIFT, T_DRESS);
    // trousers (from the feet): quick over the feet, slower up the thighs
    const href = lerp(ch.from, ch.to, a.slot === "bottom" && ch.from < 0.3 ? Math.pow(u, 0.6) : u);
    g.setLevel(b.Y(href));
    this.showRing(b.Y(href), t > T_LIFT - 0.05 && t < T_DRESS + 0.05);

    const pathPose = (hh: number, hold = ch.hold) => {
      const hands: [V3, V3] = ch.path(hh).map((h) => h.clone()) as [V3, V3];
      let grip = 0;
      let weight = 0;
      let spineX = 0;
      if (t > T_LIFT && t < T_DRESS) {
        if (a.slot === "top" || a.slot === "outer" || (a.slot === "bag" && !this.tote)) {
          // a little tension on the hem, the hands working it down unevenly, a last tug
          for (const [i, s] of [-1, 1].entries()) hands[i].y += 0.01 + s * 0.012 * Math.sin(Math.PI * u) - 0.015 * seg(u, 0.88, 1);
          grip = 0.08 * seg(u, 0.88, 1);
        } else if (a.slot === "bottom") {
          // shifting the weight side to side, the hand on the loaded side higher; a last hitch
          weight = 0.3 * Math.sin(4 * Math.PI * u);
          for (const [i, s] of [-1, 1].entries()) hands[i].y += 0.015 * Math.sin(4 * Math.PI * u) * s + 0.02 * seg(t, T_DRESS - 0.12, T_DRESS);
          grip = 0.1 * seg(t, T_DRESS - 0.12, T_DRESS);
        } else if (a.slot === "shoes") {
          // two tugs on the heel
          const tug = Math.exp(-(((u - 0.35) / 0.06) ** 2)) + Math.exp(-(((u - 0.75) / 0.06) ** 2));
          for (const h of hands) h.y += 0.025 * tug + (a.product!.kind === "boots" ? 0.08 * u : 0);
          grip = 0.2 * tug;
          spineX = -0.03 * tug;
        } else if (a.slot === "hat") {
          for (const h of hands) h.y -= 0.01 * Math.sin(Math.PI * seg(u, 0.85, 1));
        }
      }
      const low = Math.min(hands[0].y, hands[1].y);
      let crouch = a.slot === "shoes" ? 1 : clamp((0.95 - low) / 0.42, 0, 1);
      // low items: ease from the reach's crouch into the path's
      if (ch.low) crouch = lerp(0.25, crouch, seg(t, T_REACH, 1.0));
      return withPose(idle, {
        hands,
        hand: grip ? [squeeze(hold[0], grip), squeeze(hold[1], grip)] : hold,
        crouch,
        spineX: crouch * 0.55 + spineX,
        headX: ch.head ?? 0.28 + crouch * 0.3,
        headY: 0,
        weight,
        pocket: NO_POCKETS,
      });
    };

    if (t < T_REACH) return lerpPose(start, reach, seg(t, 0, T_REACH));
    if (t < T_LIFT) {
      // the hands part first, then rise; they take hold before the garment appears
      const to = pathPose(ch.from);
      const out = lerpPose(reach, to, seg(t, T_REACH, T_LIFT));
      for (const i of [0, 1]) {
        out.hands[i].x = lerp(reach.hands[i].x, to.hands[i].x, seg(t, 0.6, 0.8));
        out.hands[i].y = lerp(reach.hands[i].y, to.hands[i].y, seg(t, 0.65, 0.85));
        out.hand[i] = lerpShape(reach.hand[i], to.hand[i], seg(t, 0.6, 0.78));
      }
      return out;
    }
    if (t < T_DRESS) return pathPose(href);
    if (t >= T_END) {
      g.showAll();
      return null;
    }
    // let go: the fingers open for a beat and the hands come off the garment
    const released = pathPose(ch.to, [HANDS.release(-1, ch.hold[0]), HANDS.release(1, ch.hold[1])]);
    for (const i of [0, 1]) {
      released.hand[i] = { ...released.hand[i], orient: released.hand[i].orient * 0.5 };
      released.hands[i].addScaledVector(ch.hold[i].palm, -0.025).add(v(0, 0.01, 0));
    }
    const admire = ch.admire.map((p) => withPose(idle, p));
    const at = ch.admireAt ?? [0.45, 0.9, 1.32, 1.65];
    const last = at[at.length - 1];
    // a hand going to rest flat on the body comes up in front of it, not sweeping along it
    const lead = lerpPose(released, admire[0], 0.5);
    for (const i of [0, 1]) if (admire[0].hand[i].contact > 0.5) lead.hands[i].z += 0.09;
    const tt = t - T_DRESS;
    return this.landing(
      track(
        [
          [0, pathPose(ch.to)],
          [0.12, released],
          [lerp(0.12, at[0], 0.45), lead],
          ...admire.map((p, k) => [at[k], p] as [number, Pose]),
          [last + 0.2, admire[admire.length - 1]],
          [T_END - T_DRESS, idle],
        ],
        tt,
      ),
      tt,
    );
  }

  /** The little hop at the end of admiring: a dip to push off, up, and a soft landing (time since dressed). */
  private landing(p: Pose, tt: number) {
    const u = (tt - 1.52) / 0.2;
    const hop = u > 0 && u < 1 ? 0.14 * u * (1 - u) : 0;
    const dip = 0.08 * seg(tt, 1.38, 1.5) * (1 - seg(tt, 1.5, 1.56)) + 0.06 * seg(tt, 1.7, 1.76) * (1 - seg(tt, 1.76, 1.92));
    const grip = 0.08 * seg(tt, 1.7, 1.73) * (1 - seg(tt, 1.75, 1.8));
    return withPose(p, { hop, crouch: p.crouch + dip, hand: grip ? [squeeze(p.hand[0], grip), squeeze(p.hand[1], grip)] : p.hand });
  }

  private showRing(h: number, on: boolean) {
    this.ring.visible = on;
    if (!on) return;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.5;
    this.ring.position.y = h;
    const L = this.body!.c.landmarks;
    const r = h > L.shoulderY + 0.08 ? 0.42 : h < L.hipY ? 0.75 : 0.9;
    this.ring.scale.set(r, r * 0.75, 1);
  }

  private handWorld(i: number) {
    return this.body!.arms[i].end.getWorldPosition(v());
  }

  /* ───────── per-frame ───────── */

  /** The idle pose; `free` leaves the hands out of the pockets (for actions that use them). */
  private idlePose(free = false): Pose {
    const t = this.time;
    const b = this.body!;
    const breathe = Math.sin(t * 1.6);
    const weight = Math.tanh(3 * Math.sin(t * 0.21 + 0.6)) * 0.55;
    // hanging arms open with what's worn, so sleeves don't sink into the sides of the top
    const open = this.armsOpen();
    const relaxed: [V3, V3] = [v(-0.2 - open - weight * 0.012, 0.905 + breathe * 0.004, 0.015), v(0.2 + open - weight * 0.012, 0.905 + breathe * 0.004, 0.015)];
    const tote = this.tote;
    const base: Pose = {
      hands: relaxed,
      hand: both(HANDS.relaxed),
      spineX: -0.012 + breathe * 0.008,
      spineY: Math.sin(t * 0.37) * 0.025,
      spineZ: 0,
      headX: 0,
      headY: 0,
      headZ: -weight * 0.035,
      crouch: 0,
      turn: 0,
      hop: 0,
      lift: 0,
      happy: 0,
      weight,
      wave: 0,
      fingerWave: 0,
      wavePhase: 0,
      pocket: NO_POCKETS,
    };
    if (this.stance === "hip") {
      base.hands = [onHips[0], relaxed[1]];
      base.hand = [HANDS.onHip(-1), base.hand[1]];
      base.weight = 0.85;
      base.headZ = 0.07;
    } else if (this.stance === "pockets" && !free) {
      base.pocket = [1, tote ? 0 : 1];
      base.weight = weight * 0.6;
      // palms flat against the front of the hips; without pockets (bare legs, a skirt) the thumbs hook the waistband
      const preset = this.pocketless ? HANDS.hooked : HANDS.pocket;
      base.hand = [0, 1].map((i) => ({ ...preset(i ? 1 : -1), palm: b.pocketNormals[i].clone().negate() })) as [HandShape, HandShape];
    }
    if (tote) {
      // the bag hand: a fist round the handles, the arm hanging a little away from the thigh
      base.hands = [base.hands[0], v(0.235, 0.875, 0)];
      base.hand = [base.hand[0], HANDS.handle(1)];
    }
    if (this.walkAmount > 0.01) {
      const ph = this.walkPhase;
      // arms swing opposite the legs; the bag arm swings less
      const arm = (s: number, k = 1) => {
        const f = s * Math.sin(ph) * k;
        return v(s * (0.198 + open - 0.012 * f), 0.905 + 0.01 * f + 0.018 * f * f, 0.025 + 0.12 * f);
      };
      const walk: Pose = {
        ...base,
        hands: [arm(-1), tote ? arm(1, 0.4).setX(0.235) : arm(1)],
        hand: [HANDS.walk(-1), tote ? HANDS.handle(1) : HANDS.walk(1)],
        spineY: -Math.sin(ph) * 0.07,
        spineX: 0.02,
        // over the foot that's on the ground (the smoothing lags this by about a quarter step)
        weight: Math.cos(ph + 1.04) * 0.99,
        headZ: 0,
        pocket: NO_POCKETS,
      };
      return lerpPose(base, walk, this.walkAmount);
    }
    return base;
  }

  /** Hands on a critically damped spring (they settle without overshoot); fingers lag the wrists. */
  private handVel: [V3, V3] = [v(), v()];

  private follow(target: Pose, dt: number): Pose {
    if (!this.smooth) {
      this.handVel = [v(), v()];
      return (this.smooth = withPose(target, {
        hands: [target.hands[0].clone(), target.hands[1].clone()],
        hand: [cloneShape(target.hand[0]), cloneShape(target.hand[1])],
        pocket: [...target.pocket],
      }));
    }
    const s = this.smooth;
    const h = dt * this.speed;
    const k = (rate: number) => 1 - Math.exp(-h * rate);
    const w = 11;
    for (const i of [0, 1]) {
      const x = s.hands[i];
      const vel = this.handVel[i];
      vel.addScaledVector(target.hands[i].clone().sub(x), w * w * h).multiplyScalar(Math.exp(-2 * w * h));
      x.addScaledVector(vel, h);
      s.hand[i] = followShape(s.hand[i], target.hand[i], h);
      // sliding a hand into a pocket takes a moment
      s.pocket[i] = lerp(s.pocket[i], target.pocket[i], k(7));
    }
    for (const key of ["spineX", "spineY", "spineZ", "crouch", "lift", "wave", "fingerWave"] as const) s[key] = lerp(s[key], target[key], k(11));
    // the hop is already shaped (push-off, flight, landing)
    s.hop = target.hop;
    s.wavePhase = target.wavePhase;
    for (const key of ["headX", "headY", "headZ"] as const) s[key] = lerp(s[key], target[key], k(6));
    s.happy = lerp(s.happy, target.happy, k(8));
    s.weight = lerp(s.weight, target.weight, k(3.5));
    s.turn += angDiff(target.turn, s.turn) * k(12);
    return s;
  }

  /** Rotates `bone` by `delta` (character space) on top of its rest pose. */
  private rotateRest(bone: THREE.Bone, delta: THREE.Quaternion) {
    const b = this.body!;
    const parentQ = b.restQ.get(bone.parent as THREE.Bone) ?? new THREE.Quaternion();
    const local = parentQ.clone().invert().multiply(delta).multiply(parentQ);
    bone.quaternion.copy(local.multiply(b.c.restLocal.get(bone)!));
  }

  /** Sets a bone's world orientation. */
  private setWorldQuat(bone: THREE.Object3D, q: THREE.Quaternion) {
    const pq = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pq.invert().multiply(q));
    bone.updateMatrixWorld(true);
  }

  private applyPose(p: Pose, dt: number) {
    const b = this.body!;
    const k = b.c.landmarks.height / 1.75;
    const t = this.time;
    this.root.rotation.y = this.yaw + p.turn;

    // head: glance around, follow the pointer, lag behind the body
    if (t > this.nextGlance) {
      this.glance.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.4) * 0.3);
      this.nextGlance = t + 2 + Math.random() * 3.5;
    }
    this.headLook.lerp(this.pointerActive ? this.pointer : this.glance, 1 - Math.exp(-dt * 3));
    const wrapped = angDiff(this.root.rotation.y, 0);
    const headX = p.headX + clamp(-this.headLook.y * 0.3, -0.25, 0.3) * (1 - p.crouch);
    const headY = p.headY + clamp(this.headLook.x * 0.6 - wrapped * 0.8, -0.7, 0.7) * (1 - Math.abs(p.headY) * 1.5);

    // pelvis: weight shift, crouch, hop, walk bob (offset in character space)
    // (the bob is lowest with both feet down at full stride, highest as a leg passes, or the stride outreaches the legs)
    const w = p.weight;
    const ph = this.walkPhase;
    const wa = this.walkAmount;
    const offset = v(
      (w * 0.018 + Math.sin(ph) * 0.01 * wa) * k,
      (-0.014 - p.crouch * 0.3 - Math.abs(w) * 0.008 - Math.abs(Math.sin(ph)) * 0.012 * wa) * k + p.hop,
      -p.crouch * 0.07 * k,
    );
    const restPelvis = new THREE.Vector3().setFromMatrixPosition(b.c.restWorld.get(b.pelvis)!).add(offset);
    const parentInv = (b.c.restWorld.get(b.pelvis.parent as THREE.Bone) ?? new THREE.Matrix4()).clone().invert();
    b.pelvis.position.copy(restPelvis.applyMatrix4(parentInv));
    const euler = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
    this.rotateRest(b.pelvis, euler(0, Math.sin(ph) * 0.06 * wa, w * 0.035));
    for (const s of b.spine) this.rotateRest(s.bone, euler(p.spineX * s.share, p.spineY * s.share, (p.spineZ - w * 0.06) * s.share));
    this.rotateRest(b.neck, euler(headX * 0.4, headY * 0.4, (p.headZ + w * 0.03) * 0.4));
    this.rotateRest(b.head, euler(headX * 0.6, headY * 0.6, (p.headZ + w * 0.03) * 0.6));

    this.root.updateMatrixWorld(true);
    this.updateFeet(p, dt);
    const chestDelta = b.chest.getWorldQuaternion(new THREE.Quaternion()).multiply(b.restQ.get(b.chest)!.clone().invert());
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rootInv = this.root.matrixWorld.clone().invert();
    // the pelvis' move away from its bind pose, in character space: hip and pocket contacts ride with it
    const pelvisM = rootInv.clone().multiply(b.pelvis.matrixWorld).multiply(b.c.restWorld.get(b.pelvis)!.clone().invert());
    const waver = this.tote ? 0 : 1;
    const L = b.c.landmarks;
    for (const [i, arm] of b.arms.entries()) {
      const s = arm.side;
      const sh = p.hand[i];
      const pocket = i === 1 && this.tote ? 0 : p.pocket[i];
      const wave = i === waver ? p.wave : 0;
      let target = this.mapV(p.hands[i]);
      target.addScaledVector(this.fingerDir[i], this.fingerPush[i]);
      // hanging arms come along with the shoulders as the torso leans and turns
      if (sh.hang > 0.001) {
        const shoulder = arm.upper.getWorldPosition(v()).applyMatrix4(rootInv);
        target.addScaledVector(shoulder.sub(b.restShoulder[i]), sh.hang);
      }
      // (riding on the pelvis can bring a hand on the hip back into the waist: clear it again)
      if (sh.elbowOut > 0.001) target = this.clearBody(target.lerp(target.clone().applyMatrix4(pelvisM), sh.elbowOut), this.outerReach() * sh.elbowOut);
      // a flat hand rests on the front of the body (on the clothes), never inside them: where it was put across
      // the body (not where clearing it out of the body would have pushed it, round to the side), and as far out
      // as the body gets under its fingers, which reach in towards the middle
      if (sh.contact > 0.001 && target.y < L.shoulderY - 0.06 && target.y > L.kneeY) {
        const { rx, rz, cz } = this.clearance(target.y);
        const x = clamp(lerp(target.x, this.mapV(p.hands[i], false).x, sh.contact), -rx, rx);
        const front = (x: number) => cz + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
        target.x = x;
        target.z = lerp(target.z, Math.max(front(x), front(x - s * 0.08)) + this.fingerDir[i].z * this.fingerPush[i], sh.contact);
      }
      if (pocket > 0.001) {
        // over the front of the hip first, then down into the opening (or just onto it, without pockets)
        const e = THREE.MathUtils.smoothstep(pocket, 0, 1);
        const n = b.pocketNormals[i].clone().transformDirection(pelvisM);
        const over = (this.pocketless ? 0.03 : this.wornBulk(L.waistY - 0.045)) + this.outerReach();
        const at = b.pockets[i].clone().applyMatrix4(pelvisM).addScaledVector(n, over);
        const entry = at.clone().addScaledVector(n, 0.045).add(v(0, 0.03, 0));
        target = e < 0.65 ? this.clearBody(target.lerp(entry, e / 0.65)) : entry.lerp(at, (e - 0.65) / 0.35);
      }
      const pole = v(s * 0.9, -0.15, -0.6)
        .lerp(v(s * 0.3, -0.1, -0.95), Math.max(sh.hang, 0.5 * sh.soft))
        .lerp(v(s * 0.45, -0.85, -0.25), sh.elbowIn)
        .lerp(v(s * 1.0, 0, -0.25), sh.elbowOut)
        .lerp(v(s * 0.55, -0.83, 0.12), sh.elbowDown * wave)
        .applyQuaternion(chestDelta);
      // hanging and open arms keep a soft elbow
      this.solveLimb(arm, target, pole, Math.max(0.982, 0.998 - 0.01 * sh.hang - 0.013 * sh.soft));
      // in a pocket the hand turns down before the wrist dives, and slides in flat before curling
      const shape = pocket > 0.001 ? { ...sh, orient: sh.orient * THREE.MathUtils.smoothstep(pocket, 0.1, 0.6) } : sh;
      this.orientHand(i, shape, rootQ, wave, p.wavePhase, dt);
      const flat = pocket > 0.001 && !this.pocketless ? 1 - THREE.MathUtils.smoothstep(pocket, 0.65, 1) : 0;
      applyFingers(b.fingers, i, sh, t, i === waver ? p.fingerWave : 0, p.wavePhase, pocket > 0.001 ? flat * pocket : 0);
      // curled fingers and the thumb hang below and inside the wrist: next frame, the wrist moves out by what went into the leg
      // (or into the waist, for a hand on the hip: only a little there, the palm stays on the hip). A flat hand coming to
      // the chest sweeps its fingers past the body: it moves out along the surface's normal, over the clothes as they hang
      let gap = Infinity;
      const hanging = sh.hang > 0.5 || sh.elbowOut > 0.5;
      const away = v(s, 0, 0);
      if ((hanging || sh.contact > 0.02) && pocket < 0.001) {
        const legInv = b.legs[i].upper.matrixWorld.clone().invert().premultiply(b.c.restWorld.get(b.legs[i].upper)!);
        const pelvisInv = pelvisM.clone().invert();
        for (const tip of b.tips[i]) {
          // where the tip is on the body as it was in the bind pose: on the hips with the pelvis,
          // beside the leg with the thigh (it swings when walking)
          let q = tip.getWorldPosition(v()).applyMatrix4(rootInv).applyMatrix4(pelvisInv);
          if (q.y < L.hipY - 0.03) q = tip.getWorldPosition(v()).applyMatrix4(legInv);
          if (q.y >= L.shoulderY - 0.06 || q.y <= L.kneeY) continue;
          const onLeg = q.y < L.hipY - 0.06;
          const sec = onLeg ? b.leg(q.y) : { ...b.section(q.y), cx: 0 };
          const bulk = this.wornBulk(q.y) + 0.012;
          const { rx, rz, cz } = hanging || onLeg ? { rx: sec.rx + bulk, rz: sec.rz + bulk, cz: sec.cz } : this.clearance(q.y, 0.008);
          const ax = Math.abs(q.x) - sec.cx;
          const d = Math.hypot(ax / rx, (q.z - cz) / rz);
          const g = hanging ? (d - 1) * rx : ((d - 1) * Math.hypot(ax, q.z - cz)) / Math.max(d, 1e-3);
          if (g >= gap) continue;
          gap = g;
          // (a flat hand lies on the front: it comes forward)
          if (!hanging) away.set(0, 0, 1);
        }
      }
      this.fingerDir[i].lerp(away, 1 - Math.exp(-dt * 12)).normalize();
      const push = this.fingerPush[i];
      const kk = 1 - Math.exp(-dt * 15);
      const want = gap < 0.004 ? push + (0.004 - gap) * kk : gap > 0.012 ? Math.max(0, push - (gap - 0.012) * kk) : push;
      // never faster than 15 cm/s (no jump as the hand changes shape; a sweeping hand out a little faster),
      // and 2 cm at most on the hip, 5 cm for a flat hand
      const rate = 0.15 * dt;
      this.fingerPush[i] = clamp(want, push - rate, push + (hanging ? rate : 3 * rate));
      if (sh.hang < 0.5) this.fingerPush[i] = Math.min(this.fingerPush[i], Math.max(sh.elbowOut > 0.5 ? 0.02 : 0.05, push - rate));
    }
  }

  /** The body section plus whatever is worn over it, with the hands' clearance (as `clearBody` uses it; or `reach` given). */
  private clearance(y: number, reach?: number) {
    const b = this.body!;
    const L = b.c.landmarks;
    let bulk = this.wornBulk(y);
    const flared = this.worn.get("bottom")?.product.kind === "skirt" || this.worn.get("outer")?.product.kind === "coat";
    if (flared && y < L.hipY + 0.05) bulk += 0.09 * clamp((L.hipY + 0.05 - y) / 0.15, 0, 1);
    // along the thighs the curled fingers hang below and inside the wrist: keep them off the leg too
    reach ??= 0.02 + 0.015 * clamp((L.hipY + 0.05 - y) / 0.1, 0, 1);
    const sec = b.section(y);
    let rx = sec.rx + bulk + reach;
    let front = sec.cz + sec.rz + bulk + reach;
    let back = sec.cz - sec.rz - bulk - reach;
    // below the waist a top hangs off the body's widest section, further out than its band
    for (const g of this.worn.values()) {
      if (!g.fall || y > g.fall.from) continue;
      const f = g.fall.section(y);
      rx = Math.max(rx, f.rx + reach);
      front = Math.max(front, f.cz + f.rz + reach);
      back = Math.min(back, f.cz - f.rz - reach);
    }
    return { rx, rz: (front - back) / 2, cz: (front + back) / 2 };
  }

  /**
   * A hand resting on a jacket or coat (on the hip, at a pocket) curls its
   * fingers in round the body as it would on skin: it keeps off by the
   * garment's whole thickness again (and a little, for the knuckles), or the
   * fingers sink into it.
   */
  private outerReach() {
    const outer = this.worn.get("outer");
    return outer ? 1.2 * outer.bulk(this.body!.c.landmarks.chestY) : 0;
  }

  /** How much wider than bare the hanging hands go (reference space): with the side of the top and the sleeve between arm and body. */
  private armsOpen() {
    return 0.008 + 1.5 * this.wornBulk(this.body!.c.landmarks.chestY);
  }

  private wornBulk(y: number) {
    let bulk = 0;
    for (const g of this.worn.values()) bulk = Math.max(bulk, g.bulk(y));
    return bulk;
  }

  /** Twist of each hand last frame (unwrapped, so a roll through 180° doesn't flip), and the wrists' motion for drag. */
  private prevTwist = [0, 0];
  /** How far out each hand moves to keep its curled fingers off the leg or the waist (m, see applyPose). */
  private fingerPush = [0, 0];
  /** Which way (character space) each hand moves for it: out to the side, or off the chest. */
  private fingerDir = [v(-1, 0, 0), v(1, 0, 0)];
  private wristPrev: (V3 | null)[] = [null, null];
  private dragVel = [v(), v()];

  /**
   * Turns the hand to its shape's orientation on top of what the arm's IK gives it:
   * `orient` swings and twists towards fingers + palm, `pronate` only rolls the palm round
   * the forearm. Then wrist flexion, the wave's wag and the fingers trailing fast moves.
   * Part of the roll goes into the forearm, as a real forearm twists.
   */
  private orientHand(i: number, sh: HandShape, rootQ: THREE.Quaternion, wave: number, wavePhase: number, dt: number) {
    const b = this.body!;
    const arm = b.arms[i];
    const s = arm.side;
    const restQ = new THREE.Quaternion().setFromRotationMatrix(b.c.restWorld.get(arm.end)!);
    const have = arm.end.getWorldQuaternion(new THREE.Quaternion());
    const elbow = arm.lower.getWorldPosition(v());
    const wrist = arm.end.getWorldPosition(v());
    const axis = wrist.clone().sub(elbow).normalize();
    const frame = b.fingers.restFrame[i];
    const dirs = (q: THREE.Quaternion) => {
      const toNow = q.clone().multiply(restQ.clone().invert());
      return [v().setFromMatrixColumn(frame, 0).applyQuaternion(toNow), v().setFromMatrixColumn(frame, 1).applyQuaternion(toNow)];
    };

    // swing + twist towards the designed orientation
    let theta = 0;
    let swing = new THREE.Quaternion();
    const o = sh.orient;
    if (o > 0.001) {
      const delta = new THREE.Quaternion().setFromRotationMatrix(frameOf(sh.fingers, sh.palm).multiply(frame.clone().transpose()));
      const want = rootQ.clone().multiply(delta).multiply(restQ);
      const d = want.multiply(have.clone().invert());
      if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
      theta = 2 * Math.atan2(axis.dot(v(d.x, d.y, d.z)), d.w);
      swing = d.multiply(new THREE.Quaternion().setFromAxisAngle(axis, theta).invert());
      const angle = 2 * Math.acos(clamp(swing.w, -1, 1));
      if (angle > 2.2) swing = new THREE.Quaternion().slerp(swing, 2.2 / angle);
      swing = new THREE.Quaternion().slerp(swing, o);
    }
    if (sh.pronate > 0.001) {
      // the palm rolls round the forearm towards where it should face
      const [, n] = dirs(have);
      const want = sh.palm.clone().applyQuaternion(rootQ);
      want.addScaledVector(axis, -want.dot(axis));
      n.addScaledVector(axis, -n.dot(axis));
      if (want.lengthSq() > 1e-6 && n.lengthSq() > 1e-6) {
        want.normalize();
        n.normalize();
        theta = lerp(theta * o, Math.atan2(v().crossVectors(n, want).dot(axis), n.dot(want)), sh.pronate * (1 - o));
      }
    } else theta *= o;
    // no flipping through 180°, and within what a forearm can turn
    theta = this.prevTwist[i] + angDiff(theta, this.prevTwist[i]);
    theta = -s * clamp(-s * theta, -1.4, 1.6);
    this.prevTwist[i] = theta;
    const q = swing.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, theta)).multiply(have);

    // a hanging wrist bends a little (fingers back), less as the hand takes a designed orientation
    if (sh.flex) q.premultiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0).applyQuaternion(rootQ), sh.flex * (1 - o)));
    if (wave > 0.001) {
      // the wrist wags about the palm's facing, a beat behind the forearm's sway
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(sh.palm.clone().applyQuaternion(rootQ).normalize(), -0.3 * Math.sin(wavePhase - 1.3) * wave));
    }
    // follow-through: fast moves leave the fingers trailing a moment
    const prev = this.wristPrev[i];
    if (prev && dt > 0) {
      const vel = wrist.clone().sub(prev).divideScalar(dt);
      this.dragVel[i].lerp(vel, 1 - Math.exp(-dt * 12));
      const [f] = dirs(q);
      const vp = this.dragVel[i].clone().addScaledVector(f, -f.dot(this.dragVel[i]));
      const angle = Math.min(0.35 * vp.length(), 0.3) * sh.drag * (1 - 0.7 * o);
      if (angle > 1e-3) q.premultiply(new THREE.Quaternion().setFromAxisAngle(v().crossVectors(f, vp.negate()).normalize(), angle));
    }
    this.wristPrev[i] = wrist.clone();

    // the forearm takes ~55% of the twist about its own axis (the wrist stays where it is)
    if (Math.abs(theta) > 0.05) {
      const share = new THREE.Quaternion().setFromAxisAngle(axis, 0.55 * theta);
      this.setWorldQuat(arm.lower, share.multiply(arm.lower.getWorldQuaternion(new THREE.Quaternion())));
    }
    this.setWorldQuat(arm.end, q);
  }

  /** Feet stay planted in the world and step when the body turns or shifts. */
  private updateFeet(p: Pose, dt: number) {
    const b = this.body!;
    const k = b.c.landmarks.height / 1.75;
    const rootY = this.root.rotation.y;
    const wa = this.walkAmount;
    const pelvisDelta = b.pelvis.getWorldQuaternion(new THREE.Quaternion()).multiply(b.restQ.get(b.pelvis)!.clone().invert());
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [i, leg] of b.legs.entries()) {
      const s = leg.side;
      const foot = this.feet[i];
      const rest = b.restAnkle[i];
      const desired = this.root.localToWorld(rest.clone());
      const other = this.feet[1 - i];
      if (foot.t < 0) {
        const far = foot.pos.distanceTo(desired) > 0.05 || Math.abs(angDiff(foot.yaw, rootY)) > 0.32;
        if (far && other.t < 0 && this.time - this.lastStep > 0.06 && wa < 0.05) {
          foot.from.copy(foot.pos);
          foot.to.copy(desired);
          foot.fromYaw = foot.yaw;
          foot.toYaw = rootY;
          foot.t = 0;
          this.lastStep = this.time;
        }
      }
      let lift = 0;
      if (foot.t >= 0) {
        foot.t += (dt * this.speed) / 0.22;
        const e = ease(foot.t);
        foot.pos.lerpVectors(foot.from, foot.to, e);
        foot.yaw = foot.fromYaw + angDiff(foot.toYaw, foot.fromYaw) * e;
        lift = Math.sin(Math.PI * clamp(foot.t, 0, 1)) * 0.045;
        if (foot.t >= 1) foot.t = -1;
      }
      const target = this.root.worldToLocal(foot.pos.clone());
      target.y = rest.y + lift + p.hop;
      let pitch = 0;
      let yaw = angDiff(foot.yaw, rootY);
      if (s === 1 && p.lift > 0.001) {
        target.lerp(v(rest.x, rest.y + 0.09 * k, 0.15 * k), p.lift);
        pitch = 0.25 * p.lift;
      }
      if (wa > 0.001) {
        const phs = this.walkPhase + (s > 0 ? Math.PI : 0);
        // lift and pitch ease in and out of heel strike and toe-off (no kink in the foot's speed there)
        const up = Math.max(0, Math.cos(phs)) ** 2;
        const down = Math.max(0, -Math.cos(phs)) ** 2;
        const walk = v(rest.x * 0.85, rest.y + up * 0.075 * k, Math.sin(phs) * 0.16 * k);
        target.lerp(walk, wa);
        pitch = lerp(pitch, up * 0.35 - down * 0.1, wa);
        yaw = lerp(yaw, 0, wa);
        if (wa > 0.95) {
          foot.pos.copy(this.root.localToWorld(rest.clone()));
          foot.yaw = rootY;
        }
      }
      // the foot rocks on its heel and toe: keep both ends of the sole above the floor
      // (a soft max, so the ankle eases up instead of kinking when the sole touches down)
      const low = Math.min(...b.footSpan[i].map((z) => -rest.y * Math.cos(pitch) - z * Math.sin(pitch)));
      const under = -low - target.y;
      const soft = 0.005;
      if (under > -soft) target.y += under > soft ? under : (under + soft) ** 2 / (4 * soft);
      this.solveLimb(leg, target, v(s * 0.15, 0, 1).applyQuaternion(pelvisDelta));
      // keep the foot flat on the floor, turned with its planted yaw
      // toes point down in the air during the hop
      pitch += 0.35 * clamp(p.hop / 0.02, 0, 1);
      const charQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")).multiply(b.restQ.get(leg.end)!);
      this.setWorldQuat(leg.end, rootQ.clone().multiply(charQ));
    }
  }

  /** Two-bone IK on the model's bones; the middle joint bends toward `pole` (world). */
  private solveLimb(limb: Limb, targetChar: V3, pole: V3, reach = 0.998) {
    const b = this.body!;
    limb.upper.quaternion.copy(b.c.restLocal.get(limb.upper)!);
    limb.lower.quaternion.copy(b.c.restLocal.get(limb.lower)!);
    // the hand (foot) starts from its rest pose too: its orientation is built fresh every frame
    limb.end.quaternion.copy(b.c.restLocal.get(limb.end)!);
    limb.upper.updateMatrixWorld(true);
    const S = limb.upper.getWorldPosition(v());
    const E = limb.lower.getWorldPosition(v());
    const H = limb.end.getWorldPosition(v());
    const L1 = S.distanceTo(E);
    const L2 = E.distanceTo(H);
    const d = this.root.localToWorld(targetChar.clone()).sub(S);
    const dist = clamp(d.length(), 0.06, (L1 + L2) * reach);
    const dir = d.normalize();
    const axis = v().crossVectors(dir, pole.clone().normalize());
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize();
    const cosA = clamp((L1 ** 2 + dist ** 2 - L2 ** 2) / (2 * L1 * dist), -1, 1);
    const upperDir = dir.clone().applyAxisAngle(axis, Math.acos(cosA));
    const lowerDir = dir.clone().multiplyScalar(dist).sub(upperDir.clone().multiplyScalar(L1)).normalize();
    const swing1 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), upperDir);
    this.setWorldQuat(limb.upper, swing1.multiply(limb.upper.getWorldQuaternion(new THREE.Quaternion())));
    const E2 = limb.lower.getWorldPosition(v());
    const H2 = limb.end.getWorldPosition(v());
    const swing2 = new THREE.Quaternion().setFromUnitVectors(H2.sub(E2).normalize(), lowerDir);
    this.setWorldQuat(limb.lower, swing2.multiply(limb.lower.getWorldQuaternion(new THREE.Quaternion())));
  }

  /** Skirt / coat-tail spring bones, pushed out of the legs; simulated at a fixed 60 Hz. */
  private skirtClock = 0;

  private updateSkirt(dt: number) {
    this.skirtClock = Math.min(this.skirtClock + dt, 4 / 60);
    let steps = 0;
    while (this.skirtClock >= 1 / 60) {
      this.skirtClock -= 1 / 60;
      steps++;
    }
    for (let i = 0; i < Math.max(1, steps); i++) this.skirtStep();
  }

  private skirtStep() {
    const b = this.body!;
    this.root.updateMatrixWorld(true);
    const pelvisQ = b.pelvis.getWorldQuaternion(new THREE.Quaternion());
    const delta = pelvisQ.clone().multiply(b.restQ.get(b.pelvis)!.clone().invert());
    const pelvisInv = pelvisQ.clone().invert();
    const segs = b.legs.map((l) => [l.upper.getWorldPosition(v()), l.lower.getWorldPosition(v()), l.end.getWorldPosition(v())] as const);
    const scale = b.c.landmarks.height / 1.75;
    const pivot = v();
    const restTip = v();
    for (const sb of b.skirt) {
      sb.bone.quaternion.identity();
      sb.bone.updateMatrixWorld(true);
      sb.bone.getWorldPosition(pivot);
      const restDir = sb.rest.clone().applyQuaternion(delta);
      restTip.copy(restDir).multiplyScalar(SKIRT_LEN * scale).add(pivot);
      if (!sb.tip.lengthSq()) {
        sb.tip.copy(restTip);
        sb.prev.copy(restTip);
      }
      const vel = sb.tip.clone().sub(sb.prev).multiplyScalar(0.86);
      sb.prev.copy(sb.tip);
      sb.tip.add(vel).add(restTip.clone().sub(sb.tip).multiplyScalar(0.12)).add(v(0, -0.0002, 0));
      // (softly: the capsules are fatter than the legs, and a hard push makes the hem jump as a knee comes through)
      for (const [hip, knee, ankle] of segs) {
        pushOut(sb.tip, hip, knee, 0.125 * scale, 0.6);
        pushOut(sb.tip, knee, ankle, 0.095 * scale, 0.6);
        const mid = pivot.clone().lerp(sb.tip, 0.5);
        if (pushOut(mid, hip, knee, 0.11 * scale)) sb.tip.copy(pivot).add(mid.sub(pivot).multiplyScalar(2));
      }
      const dir = sb.tip.clone().sub(pivot).normalize();
      sb.tip.copy(pivot).addScaledVector(dir, SKIRT_LEN * scale);
      // world swing from the moving rest direction to the simulated one, expressed in the pelvis frame
      const swing = new THREE.Quaternion().setFromUnitVectors(restDir.normalize(), dir);
      sb.bone.quaternion.copy(pelvisInv.clone().multiply(swing).multiply(pelvisQ));
    }
  }

  /** The tote swings like a pendulum, driven by the hand's acceleration. */
  private updateHanging(dt: number) {
    const holders = this.worn.get("bag")?.hanging ?? [];
    if (!holders.length) {
      this.swing.ready = false;
      return;
    }
    const hand = this.handWorld(1);
    const sw = this.swing;
    if (!sw.ready || dt <= 0) {
      sw.prev.copy(hand);
      sw.prevVel.set(0, 0, 0);
      sw.ready = true;
    }
    const vel = hand.clone().sub(sw.prev).divideScalar(Math.max(dt, 1e-3));
    const acc = vel.clone().sub(sw.prevVel).divideScalar(Math.max(dt, 1e-3));
    sw.prev.copy(hand);
    sw.prevVel.copy(vel);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    acc.applyQuaternion(rootQ.clone().invert());
    sw.vx += (-45 * sw.x - 5 * sw.vx - clamp(acc.z, -30, 30) * 0.9) * dt;
    sw.vz += (-45 * sw.z - 5 * sw.vz + clamp(acc.x, -30, 30) * 0.9) * dt;
    sw.x = clamp(sw.x + sw.vx * dt, -0.7, 0.7);
    sw.z = clamp(sw.z + sw.vz * dt, -0.7, 0.7);
    for (const o of holders) {
      const parentQ = o.parent!.getWorldQuaternion(new THREE.Quaternion());
      o.quaternion.copy(parentQ.invert().multiply(rootQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sw.x, 0, sw.z))));
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (this.body) this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number) {
    this.time += dt;
    const busy = this.action?.type === "dress" || this.action?.type === "multi";
    if (!this.pointers.size) {
      this.yaw += this.yawVelocity * dt;
      this.yawVelocity *= Math.pow(0.04, dt);
      if (busy || this.time - this.lastInteraction > 4) this.yaw = angDiff(this.yaw, 0) * Math.pow(busy ? 0.03 : 0.3, dt);
    }
    this.walkAmount = lerp(this.walkAmount, this.walking && !this.action ? 1 : 0, 1 - Math.exp(-dt * 4));
    this.walkPhase += dt * Math.PI * 2 * 0.95 * this.speed;

    const idle = this.idlePose();
    if (!this.action) this.startNext(idle);
    let target = idle;
    if (this.action) {
      const p = this.runAction(dt, this.idlePose(true));
      if (p) target = p;
      else {
        if (this.action.type === "multi" && this.smooth) this.smooth.turn = angDiff(this.smooth.turn, 0);
        this.action = null;
        this.token.visible = false;
        this.ring.visible = false;
      }
    }

    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      l.t += dt * this.speed * 2.2;
      l.garment.setLevel(lerp(l.from, l.to, ease(l.t)));
      if (l.t >= 1) {
        l.garment.dispose();
        this.leaving.splice(i, 1);
      }
    }
    this.refit();
    this.updateHair();
    this.updateCoverage();

    this.applyPose(this.follow(target, dt), dt);
    this.updateSkirt(dt);
    this.updateHanging(dt);
    this.updateCamera(dt);
  }

  private updateCamera(dt: number) {
    const b = this.body!;
    const a = this.action;
    const mid = b.c.landmarks.height * 0.52;
    let y = lerp(mid, this.zoomY, 1 - this.zoom);
    let dist = this.fitDist * this.zoom;
    if (a?.type === "dress" && a.choreo && a.t < 3.4) {
      const w = seg(a.t, 0.3, 1.0) * (1 - seg(a.t, 2.9, 3.4));
      y = lerp(y, b.Y(a.choreo.focus[0]), w);
      dist = lerp(dist, this.fitDist * a.choreo.focus[1], w);
    }
    const k = 1 - Math.exp(-dt * 3);
    this.cam.y = lerp(this.cam.y, y, k);
    this.cam.dist = lerp(this.cam.dist, dist, k);
    this.cam.x = lerp(this.cam.x, this.pointerActive ? this.pointer.x * 0.06 : 0, k);
    this.camera.position.set(this.cam.x, this.cam.y + 0.12 * (this.cam.dist / this.fitDist), this.cam.dist);
    this.camera.lookAt(0, this.cam.y, 0);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const height = this.body?.c.landmarks.height ?? 1.8;
    this.fitDist = 4.3 * (height / 1.75) * Math.max(1, 0.62 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  /* ───────── input ───────── */

  private toNdc(clientX: number, clientY: number, out = new THREE.Vector2()) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return out.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  }

  private hit(ndc: THREE.Vector2): { slot: Slot | null; body: boolean; y: number } {
    if (!this.body) return { slot: null, body: false, y: NaN };
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const h of this.raycaster.intersectObject(this.root, true)) {
      if (!h.object.visible) continue;
      const slot = h.object.userData.slot as Slot | undefined;
      if (slot && this.worn.get(slot)) return { slot, body: false, y: h.point.y };
      if (h.object.userData.body) return { slot: null, body: true, y: h.point.y };
    }
    return { slot: null, body: false, y: NaN };
  }

  private setHovered(slot: Slot | null) {
    if (slot === this.hovered) return;
    if (this.hovered) this.worn.get(this.hovered)?.setHighlight(false);
    this.hovered = slot;
    if (slot) this.worn.get(slot)?.setHighlight(true);
    this.renderer.domElement.style.cursor = slot ? "pointer" : "grab";
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragMoved = 0;
    this.yawVelocity = 0;
    this.lastInteraction = this.time;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    }
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent) => {
    this.toNdc(e.clientX, e.clientY, this.pointer);
    this.pointerActive = e.pointerType === "mouse";
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === "mouse" && this.time - this.lastHoverCheck > 0.08) {
        this.lastHoverCheck = this.time;
        this.setHovered(this.hit(this.pointer).slot);
      }
      return;
    }
    const dx = e.clientX - prev.x;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragMoved += Math.abs(dx) + Math.abs(e.clientY - prev.y);
    this.lastInteraction = this.time;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchStart > 0) this.zoomBy(this.pinchStart / d);
      this.pinchStart = d;
      return;
    }
    const busy = this.action?.type === "dress" || this.action?.type === "multi";
    if (!busy) {
      this.yaw += dx * 0.012;
      this.yawVelocity = dx * 0.6;
    }
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
    this.setHovered(null);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const wasPinch = this.pointers.size > 1;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size) return;
    this.renderer.domElement.style.cursor = this.hovered ? "pointer" : "grab";
    if (wasPinch || this.dragMoved >= 6 || e.target !== this.renderer.domElement) return;
    const { slot, body } = this.hit(this.toNdc(e.clientX, e.clientY));
    const r = this.renderer.domElement.getBoundingClientRect();
    if (slot) this.onPick({ slot, x: e.clientX - r.left, y: e.clientY - r.top });
    else {
      this.onPick(null);
      if (body) this.wave();
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { y } = this.hit(this.toNdc(e.clientX, e.clientY));
    this.zoomBy(Math.exp(e.deltaY * 0.0012), Number.isNaN(y) ? undefined : y);
    this.lastInteraction = this.time;
  };

  private onDoubleClick = (e: MouseEvent) => {
    const { y } = this.hit(this.toNdc(e.clientX, e.clientY));
    if (this.zoom < 0.9) this.zoomBy(10);
    else this.zoomBy(0.42, Number.isNaN(y) ? 1.2 : y);
  };
}

/** Whether two lists hold the same garments (in any order). */
const same = (a: Garment[], b: Garment[]) => a.length === b.length && a.every((g) => b.includes(g));

/** Moves `p` out of the capsule a–b of radius r (`k` of the way out, for a soft contact). */
function pushOut(p: V3, a: V3, b: V3, r: number, k = 1) {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  const closest = a.clone().addScaledVector(ab, t);
  const d = p.clone().sub(closest);
  const len = d.length();
  if (len >= r || len < 1e-6) return false;
  p.addScaledVector(d, ((r - len) / len) * k);
  return true;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((x) => {
    if (x instanceof THREE.Mesh) {
      x.geometry.dispose();
      const mats = Array.isArray(x.material) ? x.material : [x.material];
      for (const m of mats) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    }
  });
}

function platformTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,0.5)");
  g.addColorStop(0.7, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
