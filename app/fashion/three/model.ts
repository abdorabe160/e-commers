import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { withCover } from "./fit";
import { clamp, lerp } from "./surface";

/*
 * Loads a Universal Base Character (Quaternius, CC0) and measures it.
 * Everything downstream (IK, garments, choreography) works in "character
 * space": the model's root at the origin, feet on y = 0, facing +z, metres,
 * in the model's bind pose (T-pose).
 */

export type BodyType = "male" | "female";

const BASE = "/models/ubc/";
export const HAIR: Record<BodyType, { default: string; underHat: string }> = {
  male: { default: "hair_parted", underHat: "hair_buzzed" },
  female: { default: "hair_long", underHat: "hair_buzzed_f" },
};

/** Body regions, by the bone that drives each vertex most. */
export const Part = { Head: 0, Neck: 1, Chest: 2, Belly: 3, UpperArm: 4, LowerArm: 5, Hand: 6, Thigh: 7, Calf: 8, Foot: 9 } as const;
export type Part = (typeof Part)[keyof typeof Part];

function partOf(bone: string): Part {
  if (bone === "Head") return Part.Head;
  if (bone === "neck_01") return Part.Neck;
  if (bone.startsWith("spine_02") || bone.startsWith("spine_03") || bone.startsWith("clavicle")) return Part.Chest;
  if (bone.startsWith("spine_01") || bone === "pelvis" || bone === "root") return Part.Belly;
  if (bone.startsWith("upperarm")) return Part.UpperArm;
  if (bone.startsWith("lowerarm")) return Part.LowerArm;
  if (bone.startsWith("thigh")) return Part.Thigh;
  if (bone.startsWith("calf")) return Part.Calf;
  if (bone.startsWith("foot") || bone.startsWith("ball")) return Part.Foot;
  return Part.Hand;
}

/** Key heights and offsets, measured from the skeleton (character space). */
export type Landmarks = {
  height: number;
  hipY: number;
  legX: number;
  kneeY: number;
  ankleY: number;
  waistY: number;
  chestY: number;
  shoulderY: number;
  shoulderX: number;
  elbowX: number;
  wristX: number;
  neckY: number;
  headY: number;
  eyeY: number;
  eyeZ: number;
  eyeX: number;
  faceZ: number;
};

/** The bind-pose body surface, used to fit garments onto it. */
export type BodySurface = {
  position: Float32Array;
  normal: Float32Array;
  index: ArrayLike<number>;
  skinIndex: THREE.BufferAttribute;
  skinWeight: THREE.BufferAttribute;
  part: Uint8Array;
  /** Signed side of each vertex: -1 right, +1 left (x sign). */
  side: Int8Array;
};

export type Character = {
  type: BodyType;
  object: THREE.Object3D;
  /** The skinned body; garments bind to its skeleton and live next to it. */
  body: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bone: (name: string) => THREE.Bone;
  /** Bone transforms in character space, captured in the bind pose. */
  restWorld: Map<THREE.Bone, THREE.Matrix4>;
  restLocal: Map<THREE.Bone, THREE.Quaternion>;
  surface: BodySurface;
  landmarks: Landmarks;
  skinMaterial: THREE.MeshStandardMaterial;
  skinMaps: { light: THREE.Texture; dark: THREE.Texture };
  hair: THREE.SkinnedMesh | null;
  materials: THREE.Material[];
};

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

export async function loadCharacter(type: BodyType, anisotropy: number): Promise<Character> {
  const gltf = await loader.loadAsync(`${BASE}${type}.gltf`);
  const object = gltf.scene;
  object.updateMatrixWorld(true);

  let body: THREE.SkinnedMesh | null = null;
  const materials: THREE.Material[] = [];
  object.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    o.userData.body = true;
    const m = o.material as THREE.MeshStandardMaterial;
    materials.push(m);
    if (/superhero/i.test(m.name)) body = o;
    if (m.map) m.map.anisotropy = anisotropy;
  });
  if (!body) throw new Error("body mesh not found");
  const bodyMesh: THREE.SkinnedMesh = body;
  const skeleton = bodyMesh.skeleton;
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const bone = (name: string) => {
    const b = byName.get(name);
    if (!b) throw new Error(`bone ${name} not found`);
    return b;
  };

  const restWorld = new Map<THREE.Bone, THREE.Matrix4>();
  const restLocal = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of skeleton.bones) {
    restWorld.set(b, b.matrixWorld.clone());
    restLocal.set(b, b.quaternion.clone());
  }
  const at = (name: string) => new THREE.Vector3().setFromMatrixPosition(restWorld.get(bone(name))!);

  // skin: soft physical shading, swappable light/dark texture
  const skinMaterial = withCover(bodyMesh.material as THREE.MeshStandardMaterial);
  skinMaterial.side = THREE.FrontSide;
  bodyMesh.geometry.setAttribute("covered", new THREE.BufferAttribute(new Float32Array(bodyMesh.geometry.getAttribute("position").count), 1));
  const light = skinMaterial.map!;
  const dark = textureLoader.load(`${BASE}${type}_dark.jpg`);
  dark.colorSpace = THREE.SRGBColorSpace;
  dark.flipY = light.flipY;
  dark.anisotropy = anisotropy;

  slimBody(bodyMesh, skeleton, restWorld, type);
  addRelief(bodyMesh, skeleton);

  // surface data for garment fitting
  const g = bodyMesh.geometry;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const si = g.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = g.getAttribute("skinWeight") as THREE.BufferAttribute;
  const count = pos.count;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const part = new Uint8Array(count);
  const side = new Int8Array(count);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const bindMatrix = bodyMesh.matrixWorld;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bindMatrix);
  let top = 0;
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(bindMatrix);
    n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
    position.set([p.x, p.y, p.z], i * 3);
    normal.set([n.x, n.y, n.z], i * 3);
    top = Math.max(top, p.y);
    let best = 0;
    let w = -1;
    for (let k = 0; k < 4; k++) {
      const wk = sw.getComponent(i, k);
      if (wk > w) {
        w = wk;
        best = si.getComponent(i, k);
      }
    }
    part[i] = partOf(skeleton.bones[best].name);
    side[i] = p.x >= 0 ? 1 : -1;
  }

  // eyes: the second small mesh on the head
  const eyes = new THREE.Box3();
  object.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh && /eye/i.test((o.material as THREE.Material).name)) eyes.setFromObject(o);
  });
  const eyeCenter = eyes.isEmpty() ? at("Head").add(new THREE.Vector3(0, 0.08, 0.07)) : eyes.getCenter(new THREE.Vector3());

  const landmarks: Landmarks = {
    height: top,
    hipY: at("thigh_l").y,
    legX: Math.abs(at("thigh_l").x),
    kneeY: at("calf_l").y,
    ankleY: at("foot_l").y,
    waistY: at("spine_01").y,
    chestY: at("spine_03").y,
    shoulderY: at("upperarm_l").y,
    shoulderX: Math.abs(at("upperarm_l").x),
    elbowX: Math.abs(at("lowerarm_l").x),
    wristX: Math.abs(at("hand_l").x),
    neckY: at("neck_01").y,
    headY: at("Head").y,
    eyeY: eyeCenter.y,
    eyeZ: eyes.isEmpty() ? eyeCenter.z : eyes.max.z,
    eyeX: eyes.isEmpty() ? 0.032 : (eyes.max.x - eyes.min.x) / 4,
    faceZ: 0,
  };
  // the most forward point of the face, for glasses
  for (let i = 0; i < count; i++) {
    const y = position[i * 3 + 1];
    if (Math.abs(y - landmarks.eyeY) < 0.015 && Math.abs(position[i * 3]) < 0.02) landmarks.faceZ = Math.max(landmarks.faceZ, position[i * 3 + 2]);
  }

  return {
    type,
    object,
    body: bodyMesh,
    skeleton,
    bone,
    restWorld,
    restLocal,
    surface: { position, normal, index: g.getIndex()!.array, skinIndex: si, skinWeight: sw, part, side },
    landmarks,
    skinMaterial,
    skinMaps: { light, dark },
    hair: null,
    materials,
  };
}

/**
 * The base characters are built like superheroes. This brings them to
 * everyday proportions without moving a single joint:
 * - limbs and neck: every vertex moves towards the bones that drive it
 *   (blended by its skin weights, so there are no seams), by a factor that can
 *   change along the bone (slimmer at the shoulder end than at the elbow);
 * - torso: a width/depth profile by height (narrower chest and lats, a fuller
 *   waist), so the superhero V becomes an everyday build.
 * Heights never change, so every landmark stays where the skeleton puts it.
 */
type Girth = number | [atStart: number, atEnd: number];
const GIRTH: Record<BodyType, Record<string, Girth>> = {
  male: { clavicle: [0.86, 0.72], neck_01: 0.82, upperarm: [0.64, 0.76], lowerarm: [0.8, 0.86], thigh: 0.88, calf: 0.9 },
  female: { clavicle: [0.92, 0.8], neck_01: 0.94, upperarm: [0.76, 0.96], lowerarm: 0.9, thigh: 0.92, calf: 0.93 },
};
const NEXT: Record<string, string> = {
  neck_01: "Head",
  clavicle: "upperarm",
  upperarm: "lowerarm",
  lowerarm: "hand",
  thigh: "calf",
  calf: "foot",
};

/**
 * Torso width (x) and depth (z) factors at key heights, each given as a bone
 * height plus an offset; smooth between keys. Measured on the meshes: male
 * chest/waist/hips ≈ 102/86/91 cm, female bust/waist/hips ≈ 92/70/101 cm.
 */
type TorsoKey = [anchor: "hip" | "waist" | "s2" | "chest" | "shoulder" | "neck", offset: number];
const TORSO: Record<BodyType, { keys: TorsoKey[]; fx: number[]; fz: number[] }> = {
  male: {
    keys: [["hip", -0.04], ["waist", 0], ["waist", 0.05], ["s2", -0.02], ["s2", 0.03], ["chest", -0.04], ["chest", 0], ["chest", 0.04], ["shoulder", -0.065], ["shoulder", 0.06], ["neck", 0.03]],
    fx: [1.0, 1.04, 1.06, 1.1, 1.12, 0.98, 0.9, 0.86, 0.85, 0.86, 0.82],
    fz: [0.97, 0.98, 1.1, 1.16, 1.08, 0.93, 0.9, 0.89, 0.89, 0.9, 0.95],
  },
  female: {
    keys: [["hip", -0.1], ["hip", -0.04], ["waist", 0], ["waist", 0.05], ["s2", 0], ["chest", -0.04], ["chest", 0.04], ["shoulder", -0.065], ["shoulder", 0.06], ["neck", 0.03]],
    fx: [1.04, 1.03, 1.0, 1.06, 1.15, 1.04, 0.93, 0.92, 0.92, 0.95],
    fz: [1.0, 1.0, 1.0, 1.08, 1.07, 1.0, 0.9, 0.9, 0.92, 1.0],
  },
};
const TRUNK = /^(pelvis|spine_0[123]|neck_01)$/;

function slimBody(mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, restWorld: Map<THREE.Bone, THREE.Matrix4>, type: BodyType) {
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const at = (b: THREE.Bone) => new THREE.Vector3().setFromMatrixPosition(restWorld.get(b)!);
  const atName = (name: string) => at(byName.get(name)!);
  // per bone: girth factor and the segment it scales towards
  const bones = skeleton.bones.map((b) => {
    const m = /^(.*?)(_[lr])?$/.exec(b.name)!;
    const base = m[1];
    const f = GIRTH[type][base];
    const sided = ["upperarm", "lowerarm", "hand", "calf", "foot"].includes(NEXT[base]);
    const next = NEXT[base] && byName.get(NEXT[base] + (sided ? (m[2] ?? "") : ""));
    return f && next ? { f, a: at(b), b: at(next) } : null;
  });
  const g = mesh.geometry;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const si = g.getAttribute("skinIndex");
  const sw = g.getAttribute("skinWeight");
  const p = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const d = new THREE.Vector3();
  const seg = new THREE.Line3();
  const out = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    out.copy(p);
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      const bone = bones[si.getComponent(i, k)];
      if (!w || !bone) continue;
      seg.set(bone.a, bone.b);
      const t = seg.closestPointToPointParameter(p, true);
      seg.at(t, closest);
      const f = typeof bone.f === "number" ? bone.f : lerp(bone.f[0], bone.f[1], t);
      out.addScaledVector(d.subVectors(p, closest), w * (f - 1));
    }
    pos.setXYZ(i, out.x, out.y, out.z);
  }

  // torso profile by height, about the spine (x about the midline, z about the spine's depth)
  const profile = TORSO[type];
  const anchors = { hip: atName("thigh_l").y, waist: atName("spine_01").y, s2: atName("spine_02").y, chest: atName("spine_03").y, shoulder: atName("upperarm_l").y, neck: atName("neck_01").y };
  const ys = profile.keys.map(([a, o]) => anchors[a] + o);
  const curve = (values: number[], y: number) => {
    if (y <= ys[0]) return values[0];
    for (let i = 1; i < ys.length; i++) {
      if (y <= ys[i]) return lerp(values[i - 1], values[i], THREE.MathUtils.smoothstep(y, ys[i - 1], ys[i]));
    }
    return values[values.length - 1];
  };
  const chain = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01"].map(atName);
  const axisZ = (y: number) => {
    if (y <= chain[0].y) return chain[0].z;
    for (let i = 1; i < chain.length; i++) if (y <= chain[i].y) return lerp(chain[i - 1].z, chain[i].z, (y - chain[i - 1].y) / (chain[i].y - chain[i - 1].y));
    return chain[chain.length - 1].z;
  };
  const trunk = skeleton.bones.map((b) => TRUNK.test(b.name));
  const thigh = skeleton.bones.map((b) => /^thigh_[lr]$/.test(b.name));
  for (let i = 0; i < pos.count; i++) {
    let wTrunk = 0;
    let wThigh = 0;
    for (let k = 0; k < 4; k++) {
      const j = si.getComponent(i, k);
      const w = sw.getComponent(i, k);
      if (trunk[j]) wTrunk += w;
      if (thigh[j]) wThigh += w;
    }
    const y = pos.getY(i);
    // the top of the thighs blends into the hips
    const w = wTrunk + wThigh * clamp((y - (anchors.hip - 0.14)) / 0.1, 0, 1);
    if (w <= 0) continue;
    const z0 = axisZ(y);
    pos.setX(i, pos.getX(i) * (1 + (curve(profile.fx, y) - 1) * w));
    pos.setZ(i, z0 + (pos.getZ(i) - z0) * (1 + (curve(profile.fz, y) - 1) * w));
  }
  pos.needsUpdate = true;
  // fresh normals, averaged across the UV seams so the shading stays continuous
  g.computeVertexNormals();
  const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 4000)},${Math.round(pos.getY(i) * 4000)},${Math.round(pos.getZ(i) * 4000)}`;
    const list = groups.get(k);
    if (list) list.push(i);
    else groups.set(k, [i]);
  }
  const n = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.add(p.fromBufferAttribute(nrm, i));
    n.normalize();
    for (const i of list) nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
  g.computeBoundingSphere();
}

/**
 * How strongly the normal map shows, per body part: full on the face, hands and
 * feet, softer on the torso and limbs (the base mesh's painted six-pack and
 * bodybuilder muscle relief are toned down to an everyday body).
 */
const RELIEF: Record<Part, number> = { [Part.Head]: 1, [Part.Neck]: 0.8, [Part.Chest]: 0.3, [Part.Belly]: 0.3, [Part.UpperArm]: 0.45, [Part.LowerArm]: 0.6, [Part.Hand]: 1, [Part.Thigh]: 0.5, [Part.Calf]: 0.6, [Part.Foot]: 1 };

function addRelief(mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton) {
  const g = mesh.geometry;
  const si = g.getAttribute("skinIndex");
  const sw = g.getAttribute("skinWeight");
  const parts = skeleton.bones.map((b) => partOf(b.name));
  const relief = new Float32Array(si.count);
  for (let i = 0; i < si.count; i++) {
    let r = 0;
    for (let k = 0; k < 4; k++) r += sw.getComponent(i, k) * RELIEF[parts[si.getComponent(i, k)]];
    relief[i] = r;
  }
  g.setAttribute("relief", new THREE.BufferAttribute(relief, 1));
  const m = mesh.material as THREE.MeshStandardMaterial;
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float relief;\nvarying float vRelief;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRelief = relief;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRelief;")
      .replace("#include <normal_fragment_maps>", THREE.ShaderChunk.normal_fragment_maps.replace("mapN.xy *= normalScale;", "mapN.xy *= normalScale * vRelief;"));
  };
  m.customProgramCacheKey = () => "covered-relief";
}

/** Loads a hairstyle and binds it to the character's skeleton (same joint order). */
export async function loadHair(c: Character, name: string) {
  const gltf = await loader.loadAsync(`${BASE}${name}.gltf`);
  let hair: THREE.SkinnedMesh | null = null;
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) hair = o;
  });
  if (!hair) throw new Error("hair mesh not found");
  const mesh: THREE.SkinnedMesh = hair;
  mesh.removeFromParent();
  mesh.bind(c.skeleton, c.body.bindMatrix);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.body = true;
  c.body.parent!.add(mesh);
  return mesh;
}
