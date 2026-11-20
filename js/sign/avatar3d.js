// avatar3d.js - the 3D talking avatar for the Sign twin page (three.js, no model file: the character is built from shapes).
//
// It fills the stage. Its mouth follows the speech (talker.mouth, 0..1, driven by the voice), it blinks, breathes, sways, nods and
// raises its brows while talking, and it can wave. Rendering pauses while the page is hidden or another section is open.
// If WebGL or three.js is not available, createAvatar3D rejects and the page keeps the flat avatar.

import * as THREE from "three";

export async function createAvatar3D(stage, talker, { section } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "sd-avatar"; canvas.setAttribute("aria-label", "3D avatar that speaks the lines");
  stage.prepend(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { canvas.remove(); throw new Error("WebGL is not available"); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4566, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.2, 3.2, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa6ff, 0.9); rim.position.set(-3, 2, -2.5); scene.add(rim);

  const mat = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const skin = mat(0xf0bf98, 0.62), hairM = mat(0x2a2833, 0.45), shirt = mat(0x4f6ef7, 0.7), dark = mat(0x1b1a24, 0.35);
  const mesh = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };

  const root = new THREE.Group(); scene.add(root);
  // body
  const body = new THREE.Group(); root.add(body);
  const torso = mesh(new THREE.SphereGeometry(0.78, 40, 28), shirt, 0, 0.66, 0, 0.86, 0.82, 0.52); body.add(torso);
  body.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.36, 24), skin, 0, 1.2, 0));
  const collar = mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 32), mat(0xe9edff, 0.7), 0, 1.04, 0.03, 1.0, 1.0, 0.9); collar.rotation.x = Math.PI / 2; body.add(collar);
  const armMat = shirt;
  function arm(side) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.66, 0.96, 0); body.add(pivot);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.12, 0.55, 8, 16), armMat, side * 0.04, -0.34, 0));
    pivot.add(mesh(new THREE.SphereGeometry(0.115, 20, 16), skin, side * 0.04, -0.78, 0.0));
    pivot.rotation.z = side * 0.16;
    return pivot;
  }
  const armL = arm(-1), armR = arm(1);

  // head
  const head = new THREE.Group(); head.position.set(0, 1.62, 0); root.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.52, 56, 40), skin, 0, 0, 0, 0.95, 1.08, 0.98));
  const hair = mesh(new THREE.SphereGeometry(0.545, 56, 36, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 0.035, -0.02, 0.97, 1.1, 1.0);
  hair.rotation.x = -0.28; head.add(hair);
  head.add(mesh(new THREE.SphereGeometry(0.2, 24, 16), hairM, 0.12, 0.43, 0.38, 1.5, 0.6, 0.8));      // fringe
  head.add(mesh(new THREE.SphereGeometry(0.17, 24, 16), hairM, -0.14, 0.45, 0.36, 1.4, 0.55, 0.8));
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.09, 20, 16), skin, s * 0.5, -0.02, 0.0, 0.5, 1.0, 0.8));   // ears
  head.add(mesh(new THREE.SphereGeometry(0.055, 20, 16), mat(0xe6ac84, 0.6), 0, -0.05, 0.5, 1.0, 1.1, 1.0));                    // nose
  const cheek = mat(0xf2968f, 0.8, { transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.075, 20, 16), cheek, s * 0.28, -0.12, 0.44, 1.2, 0.8, 0.3));

  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.19, 0.06, 0.435); head.add(eye);
    eye.add(mesh(new THREE.SphereGeometry(0.088, 24, 18), mat(0xffffff, 0.3), 0, 0, 0, 1, 1.05, 0.55));
    const pupil = mesh(new THREE.SphereGeometry(0.048, 20, 16), dark, 0, 0, 0.032, 1, 1, 0.6); eye.add(pupil);
    eye.add(mesh(new THREE.SphereGeometry(0.014, 12, 10), mat(0xffffff, 0.1), 0.015, 0.018, 0.058));
    eyes.push({ eye, pupil });
  }
  const brows = [];
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.CapsuleGeometry(0.016, 0.13, 6, 10), hairM, s * 0.19, 0.2, 0.44); b.rotation.z = Math.PI / 2 + s * 0.12; head.add(b); brows.push(b);
  }
  // mouth: a dark opening with lips and teeth; its height follows the voice
  const mouth = new THREE.Group(); mouth.position.set(0, -0.2, 0.455); head.add(mouth);
  const inside = mesh(new THREE.SphereGeometry(1, 28, 18), mat(0x4a0f1c, 0.5), 0, 0, 0, 0.11, 0.012, 0.05); mouth.add(inside);
  const tongue = mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xd9606e, 0.6), 0, -0.01, 0.01, 0.07, 0.01, 0.03); mouth.add(tongue);
  const teeth = mesh(new THREE.BoxGeometry(0.15, 0.025, 0.02), mat(0xffffff, 0.35), 0, 0.012, 0.035); mouth.add(teeth);
  const lipMat = mat(0xc9606a, 0.55);
  const upper = mesh(new THREE.TorusGeometry(0.075, 0.014, 10, 24, Math.PI), lipMat, 0, 0, 0.04, 1.0, 0.5, 1.0); upper.rotation.z = 0; mouth.add(upper);
  const lower = mesh(new THREE.TorusGeometry(0.075, 0.016, 10, 24, Math.PI), lipMat, 0, 0, 0.04, 1.0, 0.7, 1.0); lower.rotation.z = Math.PI; mouth.add(lower);

  function frameCamera() {
    const w = stage.clientWidth || 640, h = stage.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // head, shoulders and a raised arm in view for any shape of stage; shifted left on wide stages to leave room for the camera box
    const dist = camera.aspect >= 1.7 ? 5.2 : Math.min(11, 5.2 * 1.7 / camera.aspect);
    camera.position.set(0, 1.5, dist);
    camera.lookAt(0, 1.2, 0);
    camera.updateProjectionMatrix();
    root.position.x = camera.aspect >= 1.0 ? -0.5 : 0;
  }
  new ResizeObserver(frameCamera).observe(stage); frameCamera();

  // ----------------------------------------------------------- animation
  let mo = 0, blinkAt = 2, blinkT = -1, waveT = -1, last = performance.now(), lookX = 0, lookY = 0, lookNext = 0;
  const visible = () => !document.hidden && (!section || section.classList.contains("active"));
  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible()) { last = now; return; }
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    try { update(dt, now / 1000); } catch (e) { if (!tick.warned) { tick.warned = true; console.warn("3D avatar animation error:", e); } renderer.render(scene, camera); }
  }
  function update(dt, t) {
    const talking = talker.talking, open = talker.mouth || 0;
    // mouth
    mo += ((talking ? open : 0) - mo) * Math.min(1, dt * 18);
    const ry = 0.012 + mo * 0.085;
    inside.scale.y = ry; inside.scale.x = 0.11 - mo * 0.012;
    tongue.scale.y = Math.max(0.005, ry * 0.5); tongue.position.y = -ry * 0.45;
    teeth.visible = mo > 0.12; teeth.position.y = ry * 0.85;
    upper.position.y = ry * 0.9; lower.position.y = -ry * 0.9; upper.scale.y = 0.5; lower.scale.y = 0.55 + mo * 0.4;
    mouth.scale.x = 1 - mo * 0.12;
    // blink and gaze
    blinkAt -= dt;
    if (blinkAt <= 0 && blinkT < 0) { blinkT = 0; blinkAt = 2 + Math.random() * 3.5; }
    let lid = 1;
    if (blinkT >= 0) { blinkT += dt; lid = Math.abs(blinkT / 0.09 - 1); if (blinkT > 0.18) blinkT = -1; lid = Math.max(0.08, Math.min(1, lid)); }
    const now = t * 1000;
    if (now > lookNext) { lookX = (Math.random() - 0.5) * 0.025; lookY = (Math.random() - 0.5) * 0.015; lookNext = now + 1200 + Math.random() * 2000; }
    for (const e of eyes) { e.eye.scale.y = lid; e.pupil.position.x += (lookX - e.pupil.position.x) * 0.1; e.pupil.position.y += (lookY - e.pupil.position.y) * 0.1; }
    // head, brows, body
    const sway = Math.sin(t * 0.55) * 0.09, nod = talking ? Math.sin(t * 5.2) * 0.03 + Math.sin(t * 2.3) * 0.02 : Math.sin(t * 0.8) * 0.012;
    head.rotation.y += ((sway + (talking ? Math.sin(t * 2.1) * 0.07 : 0)) - head.rotation.y) * 0.12;
    head.rotation.x += (nod - head.rotation.x) * 0.2;
    head.rotation.z = Math.sin(t * 0.7) * 0.015;
    head.position.y = 1.62 + Math.sin(t * 1.6) * 0.008 + (talking ? Math.sin(t * 5.2) * 0.006 : 0);
    const brow = (talking ? 0.018 + 0.016 * Math.sin(t * 3.1) + mo * 0.02 : 0);
    for (const b of brows) b.position.y += (0.2 + brow - b.position.y) * 0.2;
    torso.scale.y = 0.8 * (1 + Math.sin(t * 1.6) * 0.012);
    // arms: the right arm waves when asked
    let aR = 0.16, aL = -0.16 + Math.sin(t * 1.1) * 0.01;
    if (waveT >= 0) {
      waveT += dt;
      const up = Math.min(1, waveT / 0.35) * (waveT > 2.4 ? Math.max(0, 1 - (waveT - 2.4) / 0.4) : 1);
      aR = 0.16 + (Math.PI - 0.5 - 0.16) * up + Math.sin(waveT * 9) * 0.25 * up;
      if (waveT > 2.8) waveT = -1;
    } else if (talking) aR = 0.16 + Math.sin(t * 2.6) * 0.04;
    armR.rotation.z += (aR - armR.rotation.z) * 0.25; armL.rotation.z += (aL - armL.rotation.z) * 0.1;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  // advance the animation by `seconds` in 1/30 s frames (used by tests: browsers may throttle animation frames in a hidden pane)
  function advance(seconds) { let t = performance.now() / 1000; for (let i = 0; i < seconds * 30; i++) { t += 1 / 30; update(1 / 30, t); } }
  return { wave() { if (waveT < 0) waveT = 0; }, advance, canvas, dispose() { renderer.dispose(); canvas.remove(); } };
}
