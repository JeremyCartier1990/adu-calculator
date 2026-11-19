"use client";

import { useEffect, useRef } from "react";
import type { BufferGeometry, Material, Mesh, MeshStandardMaterialParameters, Object3D, Texture } from "three";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
// Eased progress of a build step that runs from `start` for `length` seconds.
const phase = (t: number, start: number, length: number) => easeOut(clamp01((t - start) / length));

// Seconds after which the build is finished; reduced-motion visitors start here.
const BUILT_AT = 11;

// ADU footprint in meters. It faces the alley (+z); the ocean is toward -z.
const W = 7;
const D = 5;
const H = 2.7;
const SLAB = 0.22;
const WALL = 0.2;
const RISE = 1.35;
const EAVE = 0.35;

// A Venice-style beach grid: 12 m lots, alleys behind, streets in front, then the boardwalk, beach, and ocean.
const LOT = 12;
const LOTS_EACH_SIDE = 11;
// [lot near edge, lot far edge, which edge faces the street]
const ROWS: Array<{ min: number; max: number; street: "min" | "max" }> = [
  { min: 13, max: 47, street: "max" },
  { min: -26, max: 8, street: "min" },
  { min: -70, max: -36, street: "max" },
  { min: -109, max: -75, street: "min" },
];
const STREETS = [
  [47, 57],
  [-36, -26],
];
const ALLEYS = [
  [8, 13],
  [-75, -70],
];
const BOARDWALK = [-116, -109];
const SHORE = -160;

// CC0 assets from Poly Haven, served from public/3d.
const ASSETS = "/3d";

async function loadModules() {
  const [
    THREE,
    { GLTFLoader },
    { HDRLoader },
    { mergeGeometries },
    { EffectComposer },
    { RenderPass },
    { GTAOPass },
    { UnrealBloomPass },
    { OutputPass },
  ] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/loaders/HDRLoader.js"),
    import("three/examples/jsm/utils/BufferGeometryUtils.js"),
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/GTAOPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
  ]);
  return { THREE, GLTFLoader, HDRLoader, mergeGeometries, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass };
}

type Modules = Awaited<ReturnType<typeof loadModules>>;

export function AduScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abort = new AbortController();
    let cleanup = () => {};

    // three and the assets load on the client only, after the hero text has painted.
    loadModules()
      .then((modules) => mountScene(modules, host, abort.signal))
      .then((dispose) => {
        if (abort.signal.aborted) dispose();
        else cleanup = dispose;
      })
      .catch((error) => {
        // The CSS sky gradient behind the canvas stays as the backdrop.
        if (!abort.signal.aborted) console.error("ADU scene failed to load", error);
      });

    return () => {
      abort.abort();
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}

// Small seeded PRNG, so the neighborhood is the same on every visit.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Replace a geometry's UVs with world-scale box mapping, so textures tile at `tile` meters on every face.
function boxUV(geometry: BufferGeometry, tile: number) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const [u, v] =
      nx >= ny && nx >= nz
        ? [position.getZ(i), position.getY(i)]
        : ny >= nz
          ? [position.getX(i), position.getZ(i)]
          : [position.getX(i), position.getY(i)];
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
}

async function mountScene(modules: Modules, host: HTMLDivElement, signal: AbortSignal): Promise<() => void> {
  const { THREE, GLTFLoader, HDRLoader, mergeGeometries, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass } =
    modules;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 768;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;opacity:0;transition:opacity 1.4s ease";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 2500);
  const textures: Texture[] = [];

  const textureLoader = new THREE.TextureLoader();
  const texture = async (file: string, color = false) => {
    const map = await textureLoader.loadAsync(`${ASSETS}/textures/${file}`);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    return map;
  };

  // How many meters one texture tile covers, per material; used by boxUV.
  const tiles = new Map<Material, number>();
  const pbr = async (name: string, tile: number, params: MeshStandardMaterialParameters = {}) => {
    const [map, normalMap, arm] = await Promise.all([
      texture(`${name}_diff.jpg`, true),
      texture(`${name}_nor.jpg`),
      texture(`${name}_arm.jpg`),
    ]);
    // ARM packs ambient occlusion (R), roughness (G), and metalness (B).
    const material = new THREE.MeshStandardMaterial({ map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm, ...params });
    tiles.set(material, tile);
    return material;
  };

  const gltfLoader = new GLTFLoader();
  const model = async (name: string) => {
    const gltf = await gltfLoader.loadAsync(`${ASSETS}/models/${name}/${name}.gltf`);
    gltf.scene.traverse((object) => {
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return gltf.scene;
  };

  const [sky, stucco, roofing, wood, concrete, grass, shrub, lounger, dining, planter] = await Promise.all([
    new HDRLoader().setDataType(THREE.FloatType).loadAsync(`${ASSETS}/sky.hdr`),
    pbr("white_stucco", 1.5, { color: 0xd9d3c8 }),
    pbr("box_profile_metal_sheet", 1.2, { color: 0x6a6f73, metalness: 1 }),
    pbr("brown_planks_07", 1.6),
    pbr("concrete_floor_02", 2),
    pbr("leafy_grass", 3, { color: 0xb8c28f }),
    model("shrub_02"),
    model("mid_century_lounge_chair"),
    model("outdoor_table_chair_set_01"),
    model("planter_box_01"),
  ]);
  if (signal.aborted) {
    renderer.dispose();
    canvas.remove();
    return () => {};
  }

  // Sky: light the scene with the HDR, and put the key light where the HDR's sun is.
  sky.mapping = THREE.EquirectangularReflectionMapping;
  textures.push(sky);
  const { data, width, height } = sky.image as { data: Float32Array; width: number; height: number };
  let brightest = 0;
  let sunIndex = 0;
  for (let i = 0; i < width * height; i++) {
    const luminance = data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2];
    if (luminance > brightest) {
      brightest = luminance;
      sunIndex = i;
    }
  }
  const sunAzimuth = ((sunIndex % width) + 0.5) / width - 0.5;
  const sunElevation = Math.max(0.2, (0.5 - (Math.floor(sunIndex / width) + 0.5) / height) * Math.PI);
  // Swing the sky so the sun sits front-right of the camera and lights the ADU's facade.
  const skyTurn = sunAzimuth * Math.PI * 2 - 0.95;
  scene.background = sky;
  scene.environment = sky;
  scene.backgroundRotation.y = skyTurn;
  scene.environmentRotation.y = skyTurn;
  scene.environmentIntensity = 0.7;

  // Fog in the horizon's own color, so the far blocks and the sea melt into the sky.
  const horizon = new THREE.Color(0, 0, 0);
  const row = Math.floor(height * 0.49) * width;
  for (let x = 0; x < width; x++) horizon.add(new THREE.Color(data[(row + x) * 4], data[(row + x) * 4 + 1], data[(row + x) * 4 + 2]));
  horizon.multiplyScalar(0.85 / width);
  scene.fog = new THREE.Fog(horizon, 140, 900);

  const sun = new THREE.DirectionalLight(0xffd9b0, 3.2);
  sun.position.setFromSphericalCoords(120, Math.PI / 2 - sunElevation, Math.PI / 2 - 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 40, far: 240 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun);

  const mat = (color: number, params: MeshStandardMaterialParameters = {}, tile?: number) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...params });
    if (tile) tiles.set(material, tile);
    return material;
  };
  const lumber = mat(0xd9b98a, { normalMap: wood.normalMap, roughness: 0.8 });
  const charcoal = mat(0x2a2a2a, { roughness: 0.45, metalness: 0.6 });
  const trim = mat(0xf2efe9, { roughness: 0.6 });
  const glass = mat(0x0c1418, { roughness: 0.04, metalness: 0.95, emissive: 0xffa860, emissiveIntensity: 0 });
  const homeGlass = mat(0x0f171c, { roughness: 0.05, metalness: 0.9, emissive: 0xffa860, emissiveIntensity: 0.12 });
  const olive = mat(0x5f6e3f, { normalMap: grass.normalMap, roughness: 0.9 });
  const hedge = mat(0x3d5230, { normalMap: grass.normalMap, roughness: 0.95 }, 2);
  const frond = mat(0x47623a, { roughness: 0.8, side: THREE.DoubleSide });
  const bark = mat(0x7a6a58, { normalMap: wood.normalMap, roughness: 0.95 });
  const asphalt = mat(0x3a3c3f, { normalMap: concrete.normalMap, roughness: 0.92 }, 2);
  const sand = mat(0xd9c6a0, { normalMap: concrete.normalMap, roughness: 1 }, 3);
  const shingle = mat(0x46494b, { normalMap: roofing.normalMap, roughness: 0.8 }, 1.2);
  const terracotta = mat(0xa0553a, { normalMap: roofing.normalMap, roughness: 0.75 }, 0.8);
  const walls = [0xe9e4da, 0xd8cbb3, 0xc9d2d4, 0xbac4ae, 0xe4cfbd, 0xf0ebe3, 0xa9b6bd].map((color) => {
    const material = stucco.clone();
    material.color.setHex(color);
    tiles.set(material, 1.5);
    return material;
  });

  // Sea: a reflective plane with a generated, tileable ripple normal map that drifts over time.
  const ripples = (() => {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    const wave = (x: number, y: number) => {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 7 - v * 5) * 0.25 + Math.sin(u * 13 + v * 11) * 0.12 + Math.sin(v * 17 - u * 5) * 0.1;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (wave(x + 1, y) - wave(x - 1, y)) * 6;
        const dy = (wave(x, y + 1) - wave(x, y - 1)) * 6;
        const n = new THREE.Vector3(-dx, -dy, 1).normalize();
        pixels.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
      }
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
    textures.push(map);
    return map;
  })();
  const sea = mat(0x0d3a4f, { roughness: 0.07, metalness: 0.15, normalMap: ripples, normalScale: new THREE.Vector2(0.4, 0.4) }, 14);

  // Everything that never moves is merged into one mesh per material, so the whole neighborhood is a handful of draw calls.
  const statics = new Map<Material, BufferGeometry[]>();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const addStatic = (geometry: BufferGeometry, material: Material, x: number, y: number, z: number, rotationY = 0, rotationX = 0) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    euler.set(rotationX, rotationY, 0, "YXZ");
    matrix.compose(new THREE.Vector3(x, y, z), quaternion.setFromEuler(euler), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(matrix);
    const tile = tiles.get(material);
    if (tile) boxUV(g, tile);
    const list = statics.get(material) ?? [];
    list.push(g);
    statics.set(material, list);
    if (g !== geometry) geometry.dispose();
  };
  // A box resting on y, in world space.
  const block = (w: number, h: number, d: number, material: Material, x: number, y: number, z: number, rotationY = 0) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(0, h / 2, 0);
    addStatic(geometry, material, x, y, z, rotationY);
  };
  // Gable roof prism, ridge along x.
  const gableRoof = (w: number, d: number, rise: number) => {
    const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-w / 2, 0, 0);
    return geometry;
  };

  const random = mulberry32(11);
  const between = (a: number, b: number) => a + random() * (b - a);
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];

  // Ground, streets, alleys, sidewalks, boardwalk, beach, sea
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), grass);
  boxUV(ground.geometry, 3);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const span = LOT * (LOTS_EACH_SIDE * 2 + 3);
  for (const [a, b] of STREETS) {
    block(span, 0.02, b - a - 3.6, asphalt, 0, 0, (a + b) / 2);
    block(span, 0.12, 1.8, concrete, 0, 0, a + 0.9);
    block(span, 0.12, 1.8, concrete, 0, 0, b - 0.9);
  }
  for (const [a, b] of ALLEYS) block(span, 0.03, b - a, mat(0x8e8a84, { normalMap: concrete.normalMap, roughness: 0.9 }, 2), 0, 0, (a + b) / 2);
  block(span, 0.1, BOARDWALK[1] - BOARDWALK[0], concrete, 0, 0, (BOARDWALK[0] + BOARDWALK[1]) / 2);
  block(1600, 0.04, BOARDWALK[0] - SHORE + 6, sand, 0, 0, (BOARDWALK[0] + SHORE - 6) / 2);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1200), sea);
  boxUV(ocean.geometry, 14);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.06, SHORE - 600);
  scene.add(ocean);

  const palm = (x: number, z: number, h: number) => {
    const lean = between(-0.06, 0.06);
    addStatic(new THREE.CylinderGeometry(0.17, 0.3, h, 8).translate(0, h / 2, 0), bark, x, 0, z, 0, lean);
    const topZ = z - Math.sin(lean) * h;
    const fronds = 18;
    for (let i = 0; i < fronds; i++) {
      const geometry = new THREE.PlaneGeometry(0.42, 3.6, 1, 6);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, 0, 1.8);
      // Droop each frond toward its tip.
      const position = geometry.getAttribute("position");
      for (let v = 0; v < position.count; v++) position.setY(v, -0.16 * position.getZ(v) ** 2);
      geometry.computeVertexNormals();
      addStatic(geometry, frond, x, h, topZ, (i / fronds) * Math.PI * 2 + between(-0.15, 0.15), between(-0.25, 0.3));
    }
  };
  const tree = (x: number, z: number, s: number) => {
    block(0.25 * s, 1.7 * s, 0.25 * s, bark, x, 0, z);
    const canopy = new THREE.IcosahedronGeometry(1.8 * s, 2).scale(1, 0.8, 1);
    addStatic(canopy, olive, x, 2.8 * s, z);
  };

  // A house set back from the street. `toStreet` is +1 or -1, the direction its front faces.
  const house = (cx: number, cz: number, toStreet: number) => {
    const style = pick(["modern", "modern", "cottage", "spanish", "cottage"] as const);
    const wall = pick(walls);
    const w = between(7.6, 9.4);
    const d = between(9, 13);
    const h = style === "modern" ? between(5.8, 6.6) : between(3.1, 3.5);
    block(w, h, d, wall, cx, 0, cz);
    const front = cz + toStreet * (d / 2 + 0.03);
    const rear = cz - toStreet * (d / 2 + 0.03);
    const floors = style === "modern" ? [0.9, 3.9] : [0.9];
    for (const y of floors) {
      const count = style === "modern" ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const x = cx - w / 2 + ((i + 0.5) * w) / count;
        const ww = style === "modern" ? w / count - 0.9 : 1.2;
        block(ww + 0.12, 1.5, 0.05, trim, x, y - 0.06, front);
        block(ww, 1.38, 0.08, homeGlass, x, y, front);
        if (random() > 0.4) block(ww, 1.38, 0.08, homeGlass, x, y, rear);
      }
    }
    if (style === "modern") {
      block(w + 0.2, 0.3, d + 0.2, wall, cx, h, cz);
      if (random() > 0.5) block(w * 0.4, h - 0.6, 0.06, wood, cx + w * 0.25, 0.3, front + toStreet * 0.02);
    } else if (style === "cottage") {
      addStatic(gableRoof(w + 0.6, d + 0.6, between(1.6, 2.2)), shingle, cx, h, cz);
    } else {
      const hip = new THREE.ConeGeometry(Math.max(w, d) * 0.74, 1.8, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d));
      addStatic(hip, terracotta, cx, h + 0.9, cz);
    }
    // Front door and a short path to the sidewalk.
    block(1, 2.1, 0.08, charcoal, cx - w / 4, 0, front);
  };
  // A garage or second unit off the alley.
  const backUnit = (cx: number, cz: number, toAlley: number) => {
    const wall = pick(walls);
    const w = between(5.5, 6.5);
    const d = between(5.5, 6.5);
    const h = between(2.8, 3.2);
    block(w, h, d, wall, cx, 0, cz);
    block(w + 0.3, 0.2, d + 0.3, wall, cx, h, cz);
    if (random() > 0.5) block(w - 1.2, 2.2, 0.06, trim, cx, 0, cz + toAlley * (d / 2 + 0.03));
    else block(2.2, 1.2, 0.08, homeGlass, cx, 1, cz + toAlley * (d / 2 + 0.03));
  };

  // Camera path, so nothing tall is built where the camera flies.
  const cameraClear = (x: number, z: number) => x > -16 && z > 10;

  for (const lotRow of ROWS) {
    const toStreet = lotRow.street === "max" ? 1 : -1;
    const streetEdge = lotRow.street === "max" ? lotRow.max : lotRow.min;
    const alleyEdge = lotRow.street === "max" ? lotRow.min : lotRow.max;
    for (let i = -LOTS_EACH_SIDE; i <= LOTS_EACH_SIDE; i++) {
      const cx = i * LOT;
      const ours = lotRow.min === -26 && i === 0;
      if (cameraClear(cx, (lotRow.min + lotRow.max) / 2)) continue;
      const d = 11;
      const houseZ = streetEdge - toStreet * (3 + d / 2);
      if (ours) {
        // The client's main house: a light stucco cottage behind the ADU.
        block(9, 3.3, 11, walls[0], cx, 0, houseZ);
        addStatic(gableRoof(9.6, 11.6, 1.9), shingle, cx, 3.3, houseZ);
        for (const x of [-2.6, 0, 2.6]) block(1.3, 1.4, 0.08, homeGlass, cx + x, 0.9, houseZ + 5.53);
      } else {
        house(cx + between(-0.6, 0.6), houseZ, toStreet);
        const neighbor = lotRow.min === -26 && Math.abs(i) === 1;
        if (!neighbor && random() > 0.45) backUnit(cx + between(-2, 2), alleyEdge + toStreet * 4.5, -toStreet);
        if (random() > 0.55) tree(cx + between(-4, 4), (houseZ + alleyEdge) / 2 + between(-2, 2), between(0.8, 1.2));
      }
      // Property-line fences between back yards.
      const yardFrom = houseZ - toStreet * (d / 2);
      const length = Math.abs(alleyEdge - yardFrom);
      if (!ours && lotRow.min > -80) block(0.12, 1.6, length, pick([wood, walls[1], hedge]), cx + LOT / 2, 0, (yardFrom + alleyEdge) / 2);
    }
  }

  // Street palms, plus the boardwalk row; tall Mexican fan palms over the rooftops.
  for (const [a, b] of [...STREETS, BOARDWALK]) {
    for (let x = -LOTS_EACH_SIDE * LOT; x <= LOTS_EACH_SIDE * LOT; x += 14) {
      for (const z of [a + 0.9, b - 0.9]) {
        if (random() < 0.35 || cameraClear(x, z)) continue;
        palm(x + between(-2, 2), z, between(13, 24));
      }
    }
  }

  // The client's yard: side fences, an olive tree, shrubs.
  block(0.12, 1.5, 20, wood, -LOT / 2, 0, -2);
  block(0.12, 1.5, 20, wood, LOT / 2, 0, -2);
  tree(-4, -8.5, 1);
  tree(4.3, -9.5, 0.8);

  for (const [geometries, material] of [...statics].map(([m, g]) => [g, m] as const)) {
    const merged = mergeGeometries(geometries);
    for (const g of geometries) g.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const textured = (geometry: BufferGeometry, material: Material) => {
    const tile = tiles.get(material);
    if (tile) boxUV(geometry, tile);
    return geometry;
  };

  // A box whose origin sits on its base, so scaling y grows it up from the ground.
  const riser = (w: number, h: number, d: number, material: Material, x: number, y: number, z: number, parent: Object3D = scene) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(textured(geometry, material), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const place = (object: Object3D, x: number, z: number, rotationY = 0, scale = 1) => {
    object.position.set(x, 0, z);
    object.rotation.y = rotationY;
    object.scale.setScalar(scale);
    scene.add(object);
    return object;
  };

  for (const [x, z, r, s] of [
    [-W / 2 - 0.9, 1.2, 0.4, 1],
    [-W / 2 - 0.8, -1.4, 2.1, 0.8],
    [W / 2 + 0.9, -1.6, 1, 0.9],
    [-5.2, -5, 0.2, 1.1],
    [5.1, -4.5, 2.6, 1],
    [5.2, 6.5, 1.3, 0.9],
    [-5.2, 6, 0.7, 1],
  ]) {
    place(shrub.clone(), x, z, r, s);
  }

  // The ADU, built in order: slab, studs, walls, openings, roof, lights, furniture.
  riser(W + 1, 0.04, 2.8, concrete, 0, 0, D / 2 + 1.6);
  const slab = riser(W + 0.4, SLAB, D + 0.4, concrete, 0, 0, 0);

  const studs: Mesh[] = [];
  const studGeometry = new THREE.BoxGeometry(0.09, H, 0.14);
  studGeometry.translate(0, H / 2, 0);
  const addStud = (x: number, z: number, alongX: boolean) => {
    const stud = new THREE.Mesh(studGeometry, lumber);
    stud.position.set(x, SLAB, z);
    if (!alongX) stud.rotation.y = Math.PI / 2;
    stud.castShadow = true;
    scene.add(stud);
    studs.push(stud);
  };
  const run = (from: number, to: number, put: (v: number) => void) => {
    const count = Math.round(Math.abs(to - from) / 0.6);
    for (let i = 0; i <= count; i++) put(from + ((to - from) * i) / count);
  };
  const inset = WALL / 2;
  run(-W / 2 + inset, W / 2 - inset, (x) => addStud(x, D / 2 - inset, true));
  run(D / 2 - inset, -D / 2 + inset, (z) => addStud(W / 2 - inset, z, false));
  run(W / 2 - inset, -W / 2 + inset, (x) => addStud(x, -D / 2 + inset, true));
  run(-D / 2 + inset, D / 2 - inset, (z) => addStud(-W / 2 + inset, z, false));

  const aduWalls = [
    [riser(W, H, WALL, stucco, 0, SLAB, D / 2 - inset), riser(2.3, H, 0.04, wood, 2.15, SLAB, D / 2 + 0.02)],
    [riser(WALL, H, D - WALL * 2, stucco, W / 2 - inset, SLAB, 0)],
    [riser(W, H, WALL, stucco, 0, SLAB, -D / 2 + inset)],
    [riser(WALL, H, D - WALL * 2, stucco, -W / 2 + inset, SLAB, 0)],
  ];

  const openings: Object3D[] = [];
  const opening = (w: number, h: number, x: number, y: number, z: number, rotationY = 0) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    riser(w + 0.14, h + 0.1, 0.05, charcoal, 0, -0.05, 0, group);
    riser(w, h, 0.04, glass, 0, 0, 0.025, group);
    riser(0.05, h, 0.07, charcoal, 0, 0, 0.03, group);
    scene.add(group);
    openings.push(group);
  };
  opening(2.5, 2.25, -1.25, SLAB + 0.02, D / 2 + 0.02);
  opening(1.4, 1.1, W / 2 + 0.02, SLAB + 1.15, 0.6, Math.PI / 2);
  opening(1.4, 1.1, -W / 2 - 0.02, SLAB + 1.15, -0.4, -Math.PI / 2);

  const roof = new THREE.Group();
  const roofBase = SLAB + H;
  roof.position.y = roofBase;
  scene.add(roof);
  const pitch = Math.atan(RISE / (D / 2));
  const halfSpan = D / 2 + EAVE;
  const slope = halfSpan / Math.cos(pitch);
  for (const side of [1, -1]) {
    const panel = new THREE.Mesh(textured(new THREE.BoxGeometry(W + EAVE * 2, 0.1, slope), roofing), roofing);
    panel.position.set(0, RISE - (halfSpan / 2) * Math.tan(pitch) + 0.08, (side * halfSpan) / 2);
    panel.rotation.x = side * pitch;
    panel.castShadow = true;
    panel.receiveShadow = true;
    roof.add(panel);
    // Fascia board along the eave.
    const fascia = riser(W + EAVE * 2, 0.18, 0.05, charcoal, 0, -0.2 - (EAVE * RISE) / (D / 2), side * (halfSpan + 0.02), roof);
    fascia.castShadow = false;
  }
  const gable = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, RISE)]);
  const gableGeometry = textured(new THREE.ExtrudeGeometry(gable, { depth: WALL, bevelEnabled: false }), stucco);
  for (const x of [W / 2 - WALL, -W / 2]) {
    const end = new THREE.Mesh(gableGeometry, stucco);
    end.rotation.y = Math.PI / 2;
    end.position.x = x;
    end.castShadow = true;
    end.receiveShadow = true;
    roof.add(end);
  }

  const interior = new THREE.PointLight(0xffa860, 0, 10, 2);
  interior.position.set(-1, SLAB + 1.6, D / 2 + 0.6);
  scene.add(interior);

  const furniture = [
    place(lounger, 2.0, D / 2 + 2.0, -0.5),
    place(lounger.clone(), 3.3, D / 2 + 1.7, -0.9),
    place(dining, -3.2, D / 2 + 1.5, 0.3),
    place(planter, 3.8, D / 2 + 0.45),
    place(planter.clone(), W / 2 + 0.5, 1.4, Math.PI / 2),
  ];

  // Post-processing: ambient occlusion grounds the objects, bloom lifts the lit windows.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = small ? null : new GTAOPass(scene, camera, 1, 1);
  if (ao) {
    ao.updateGtaoMaterial({ radius: 0.6, distanceFallOff: 1, thickness: 1 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.4, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Look past the ADU toward the sea, so the coastline sits in the upper part of the frame.
  const target = new THREE.Vector3(0, 0, -10);
  const studStagger = 2 / studs.length;
  let distance = 24;

  function update(t: number) {
    slab.scale.y = Math.max(0.001, phase(t, 0.2, 1));
    studs.forEach((stud, i) => {
      const p = phase(t, 1.2 + i * studStagger, 0.4);
      stud.visible = p > 0;
      stud.scale.y = Math.max(0.001, p);
    });
    aduWalls.forEach((parts, i) => {
      const p = phase(t, 3.4 + i * 0.3, 0.9);
      for (const part of parts) {
        part.visible = p > 0;
        part.scale.y = Math.max(0.001, p);
      }
    });
    openings.forEach((group, i) => {
      const p = phase(t, 4.9 + i * 0.15, 0.5);
      group.visible = p > 0;
      group.scale.setScalar(Math.max(0.001, p));
    });
    const roofIn = phase(t, 5.8, 1.3);
    roof.visible = t > 5.8;
    roof.position.y = roofBase + (1 - roofIn) * 4;
    const glow = phase(t, 7.4, 1.8);
    glass.emissiveIntensity = glow * 1.4;
    interior.intensity = glow * 14;
    furniture.forEach((piece, i) => {
      const p = phase(t, 8.4 + i * 0.2, 0.7);
      piece.visible = p > 0;
      piece.scale.setScalar(Math.max(0.001, p));
    });
    ripples.offset.set(t * 0.004, t * 0.007);

    const approach = 1 - phase(t, 0, 8);
    const angle = 0.5 + Math.sin(t * 0.07) * 0.35;
    const radius = distance + approach * 12;
    camera.position.set(Math.sin(angle) * radius, 12 + approach * 5, Math.cos(angle) * radius);
    camera.lookAt(target);
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    const wide = w / h > 1.1;
    camera.aspect = w / h;
    camera.fov = wide ? 48 : 58;
    distance = wide ? 24 : 30;
    // Frame the ADU right of the headline on wide screens, above it on narrow ones.
    target.set(0, 0, wide ? -10 : -1);
    if (wide) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.3, w, h);
    camera.updateProjectionMatrix();
  }

  let t = reduceMotion ? BUILT_AT : 0;
  let last = 0;
  let frame = 0;
  let running = false;

  function draw() {
    update(t);
    composer.render();
    canvas.style.opacity = "1";
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    t += last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    draw();
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!running) draw();
  });
  resizeObserver.observe(host);
  // Only animate while the hero is on screen.
  const visibility = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
  visibility.observe(host);
  resize();
  draw();

  return () => {
    stop();
    resizeObserver.disconnect();
    visibility.disconnect();
    const materials = new Set<Material>();
    scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      for (const material of [mesh.material ?? []].flat()) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      material.dispose();
    }
    for (const map of textures) map.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
