// viewer.js - the 3D view and the exporters (Three.js, loaded only when the scanner is first used).
// The camera is limited to about 60 degrees either side by default: the model is a relief, so its
// sides and back are guesses and would look wrong if you could spin all the way round.

let T = null, OrbitControls = null;
let renderer, scene, camera, controls, mesh, lit, unlit, headlight, texture, container, ro;
let wanted = false, fitDist = 2.1, needsFit = false;

const opts = { lit: true, wireframe: false, free: false };

export async function initViewer(el) {
  container = el;
  if (renderer) return;
  T = await import("three");
  ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));

  renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-label", "3D model - drag to rotate, scroll to zoom");
  container.appendChild(renderer.domElement);

  scene = new T.Scene();
  camera = new T.PerspectiveCamera(32, 1, 0.05, 20);
  camera.position.set(0, 0, fitDist);
  scene.add(camera);
  headlight = new T.DirectionalLight(0xffffff, 1.1);      // light that follows the viewer, so shading stays readable
  headlight.position.set(0.4, 0.8, 1);
  camera.add(headlight);
  scene.add(new T.AmbientLight(0xffffff, 1.35));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.enablePan = false;
  controls.addEventListener("change", () => (wanted = true));
  applyLimits();

  ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  loop();
}

function applyLimits() {
  const free = opts.free;
  controls.minAzimuthAngle = free ? -Infinity : -1.05;
  controls.maxAzimuthAngle = free ? Infinity : 1.05;
  controls.minPolarAngle = free ? 0 : 0.7;
  controls.maxPolarAngle = free ? Math.PI : 2.3;
}

function resize() {
  if (!renderer) return;
  const w = container.clientWidth || 1, h = container.clientHeight || 1;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (needsFit && w > 1 && h > 1) { needsFit = false; fit(); }   // the view was hidden when the model arrived
  wanted = true;
}

// camera distance so the whole object fits with some margin, whatever its shape or the window's
let bounds = { width: 1, height: 1, depth: 0.4 };
function fit() {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  fitDist = Math.max(bounds.height / 2 / t, bounds.width / 2 / (t * camera.aspect)) * 1.35 + bounds.depth * 0.5;
  controls.minDistance = fitDist * 0.45;
  controls.maxDistance = fitDist * 2.6;
  camera.position.set(0, 0, fitDist);
  controls.target.set(0, 0, 0);
  controls.update();
  wanted = true;
}

function loop() {
  requestAnimationFrame(loop);
  if (!renderer || !container.offsetParent) return;      // nothing to do while the section or tab is hidden
  if (controls.update() || wanted) { renderer.render(scene, camera); wanted = false; }
}

function buildMaterials() {
  lit?.dispose(); unlit?.dispose();
  lit = new T.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0 });
  unlit = new T.MeshBasicMaterial({ map: texture });
  applyOptions();
}

function applyOptions() {
  if (!mesh) return;
  lit.wireframe = unlit.wireframe = opts.wireframe;
  mesh.material = opts.lit ? lit : unlit;
  wanted = true;
}

export function setOptions(o) {
  Object.assign(opts, o);
  if (!renderer) return;
  applyLimits();
  applyOptions();
}

/** relief: { positions, uvs, indices, bounds } from mesh.js; photo: the picture used as colour. */
export function setModel(relief, photo) {
  if (!T) return;
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(relief.positions, 3));
  g.setAttribute("uv", new T.BufferAttribute(relief.uvs, 2));
  g.setIndex(new T.BufferAttribute(relief.indices, 1));
  g.computeVertexNormals();
  g.translate(0, 0, -relief.bounds.depth * 0.25);        // keep the model centred on the turning point
  const b = relief.bounds, changed = Math.abs(b.height - bounds.height) > 0.05 * bounds.height || !mesh;
  bounds = { width: b.width, height: b.height, depth: b.depth };
  if (!mesh) {
    mesh = new T.Mesh(g);
    scene.add(mesh);
  } else { mesh.geometry.dispose(); mesh.geometry = g; }
  if (photo && (!texture || texture.image !== photo)) {
    texture?.dispose();
    texture = new T.CanvasTexture(photo);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    buildMaterials();
  }
  applyOptions();
  if (changed) { needsFit = true; if (container.clientWidth > 1) { needsFit = false; fit(); } }
  wanted = true;
}

export function resetView() {
  if (!controls) return;
  fit();
}

export const hasModel = () => !!mesh;

/** A small PNG of the current view, for the library thumbnail. */
export function snapshot(maxWidth = 320) {
  if (!renderer || !mesh) return null;
  renderer.render(scene, camera);
  const src = renderer.domElement, k = Math.min(1, maxWidth / src.width);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

function scaledCopy(factor) {
  const g = mesh.geometry.clone().scale(factor, factor, factor);
  return new T.Mesh(g, lit);
}

/** Binary glTF with the photo as its texture. Real size from `widthCm` (glTF uses metres). */
export async function exportGLB(widthCm) {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const out = await new GLTFExporter().parseAsync(scaledCopy(widthCm / 100), { binary: true });
  return new Blob([out], { type: "model/gltf-binary" });
}

/** Binary STL for 3D printing, in millimetres. The colour picture is not part of an STL. */
export async function exportSTL(widthCm) {
  const { STLExporter } = await import("three/addons/exporters/STLExporter.js");
  const out = new STLExporter().parse(scaledCopy(widthCm * 10), { binary: true });
  return new Blob([out], { type: "model/stl" });
}
