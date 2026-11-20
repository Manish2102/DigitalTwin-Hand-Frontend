// duck.js - the ducks that pull the slide away in GestureDeck (3D, three.js; no model file, the robots are built from shapes).
//
// The design follows the little bipedal "micro duck" robots: a wide white capsule head with a grey face plate and a round eye, a flat
// orange bill, a thin black servo neck, a white torso with black servo blocks, grey hip joints, thin legs and orange feet with yellow
// soles; they waddle with a bobbing head. Here the round eye is replaced by the photo you chose, so each duck wears a face.
//
// Per swipe, one to three ducks waddle in from the side, stop and look at the audience, clip a rope to the slide, turn, and tow it away
// with a lot of effort while the next slide zooms up from underneath. "left"/"right" is the direction the slide is pulled off to.
// Falls back to the flat cartoon avatar (avatar.js) if WebGL or three.js is not available.

import { Avatar } from "./avatar.js";

let THREE = null, threeP = null;
const loadThree = () => (threeP ??= import("three").then(m => (THREE = m)).catch(() => null));

const PHRASES = ["quack!", "heave-ho!", "pull!", "so heavy!", "almost there!", "quack quack!", "one more!", "go go go!"];
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.min(1, Math.max(0, x)), ease = t => t * t * (3 - 2 * t);
const seg = (p, a, b) => clamp01((p - a) / (b - a));

// ------------------------------------------------------------------ the robot
function buildDuck(faceImg) {
  const M = (color, rough = 0.5, metal = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const white = M(0xf3f5f7, 0.32), black = M(0x1c1e24, 0.55), grey = M(0x8e949c, 0.4, 0.3), panel = M(0xbfc4cb, 0.5), orange = M(0xff6a1a, 0.42), yellow = M(0xffc21a, 0.5), orangeD = M(0xe85a10, 0.5);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);

  // legs: hip pivot -> thigh -> knee pivot -> shin -> ankle -> foot
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.1, 0.4, 0); body.add(hip);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 20), grey); disc.rotation.z = Math.PI / 2; disc.position.set(side * 0.035, 0, 0); hip.add(disc);
    hip.add(box(0.075, 0.13, 0.085, black, side * 0.01, -0.07, 0));
    hip.add(box(0.03, 0.12, 0.07, white, side * 0.055, -0.07, 0));
    const knee = new THREE.Group(); knee.position.set(0, -0.14, 0); hip.add(knee);
    const kd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16), grey); kd.rotation.z = Math.PI / 2; knee.add(kd);
    knee.add(box(0.06, 0.15, 0.06, white, 0, -0.08, 0));
    knee.add(box(0.05, 0.1, 0.05, black, 0, -0.08, 0.025));
    const ankle = new THREE.Group(); ankle.position.set(0, -0.16, 0); knee.add(ankle);
    ankle.add(box(0.12, 0.04, 0.17, orange, 0, -0.02, 0.03));
    ankle.add(box(0.125, 0.014, 0.175, yellow, 0, -0.045, 0.03));
    ankle.add(box(0.07, 0.07, 0.06, black, 0, 0.02, -0.01));
    return { hip, knee };
  }
  const legL = leg(-1), legR = leg(1);
  // torso: white shell over black servo blocks, a harness ring on the back
  const torso = new THREE.Group(); torso.position.y = 0.5; body.add(torso);
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.09, 8, 20), white); shell.scale.set(1.35, 1, 1.05); shell.position.y = 0.04; torso.add(shell);
  torso.add(box(0.15, 0.1, 0.09, black, 0, -0.07, 0.01));
  torso.add(box(0.1, 0.06, 0.05, black, 0, 0.0, 0.085));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16), grey); ring.position.set(0, 0.04, -0.105); torso.add(ring);
  // neck: two black servos and a grey joint
  const neck = new THREE.Group(); neck.position.y = 0.62; body.add(neck);
  neck.add(box(0.085, 0.07, 0.075, black, 0, 0.0, 0));
  neck.add(box(0.07, 0.06, 0.065, black, 0, 0.065, 0));
  const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 20), grey); nd.position.y = 0.035; neck.add(nd);
  // head: horizontal capsule, wider than the body; the face plate is at the front
  const head = new THREE.Group(); head.position.set(0, 0.84, 0.02); body.add(head);
  const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.3, 10, 28), white); cap.rotation.x = Math.PI / 2; cap.scale.set(1.4, 1, 0.95); head.add(cap);
  for (const s of [-1, 1]) head.add(box(0.016, 0.07, 0.09, orange, s * 0.163, -0.005, 0.0));
  // the bill
  const bill = new THREE.Group(); bill.position.set(0, -0.075, 0.26); head.add(bill);
  const up = box(0.22, 0.026, 0.17, orange, 0, 0.0, 0.07); up.rotation.x = 0.1; bill.add(up);
  bill.add(box(0.2, 0.016, 0.13, orangeD, 0, -0.022, 0.06));
  const beakTip = new THREE.Object3D(); beakTip.position.set(0, -0.01, 0.16); bill.add(beakTip);
  // the face plate: the photo, or the round eye when there is no photo
  const plate = new THREE.Group(); plate.position.set(0, 0.012, 0.272); head.add(plate);
  let faceTex = null, eye = null, pupil = null;
  if (faceImg) {
    faceTex = new THREE.Texture(faceImg); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.needsUpdate = true; faceTex.anisotropy = 4;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.108, 40), new THREE.MeshBasicMaterial({ map: faceTex })); disc.scale.set(1.0, 1.0, 1); plate.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.011, 10, 40), grey); rim.position.z = 0.002; plate.add(rim);
  } else {
    plate.add(new THREE.Mesh(new THREE.CircleGeometry(0.1, 36), panel));
    eye = new THREE.Group(); plate.add(eye);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 12, 36), yellow); r.position.z = 0.012; eye.add(r);
    pupil = new THREE.Mesh(new THREE.CircleGeometry(0.04, 28), M(0x0b0b0e, 0.2)); pupil.position.z = 0.014; eye.add(pupil);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.01, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.015, 0.016, 0.016); eye.add(glint);
  }
  return { root, body, head, torso, neck, legL, legR, bill, beakTip, ring, eye, faceTex, dispose() { root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose?.()); } }); faceTex?.dispose(); } };
}

function loadImage(url) {
  return new Promise(res => { if (!url) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
}

// ------------------------------------------------------------------ the pulling scene
export class Duck extends Avatar {
  constructor(stage) {
    super(stage);
    this.count = 2;                       // ducks per swipe (1 to 3), set from the page
    this.sound = true;
    this.canvas = null; this.renderer = null; this.run = null; this.manual = false;
    this.ready = loadThree();
    this._ac = null;
  }

  cancel() {
    this._stopRun();
    super.cancel();
  }
  _stopRun() {
    const r = this.run; this.run = null;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    for (const d of r.ducks) d.m.dispose();
    r.rope.forEach(x => { x.geometry.dispose(); x.material.dispose(); });
    r.scene.clear();
    if (this.canvas) this.canvas.style.display = "none";
    r.bubble?.remove();
    r.finish?.();
  }

  _quack() {
    if (!this.sound) return;
    try {
      const ac = this._ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.16);
      f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.22);
    } catch {}
  }

  // side: "left" or "right" = which way the slide is pulled off. (The old "next"/"prev" names are accepted for the flat avatar.)
  async pull(oldEl, side, { underEl = null, face = null, faces = null } = {}) {
    const legacy = side === "next" ? "next" : side === "prev" ? "prev" : null;
    if (legacy) side = legacy === "next" ? "left" : "right";
    this.cancel();
    const lib = await this.ready;
    const frame = oldEl.querySelector(".dk-frame")?.getBoundingClientRect();
    const sr = this.stage.getBoundingClientRect(), W = Math.round(sr.width), H = Math.round(sr.height);
    if (!lib || !frame || !W) return super.pull(oldEl, side === "left" ? "next" : "prev", { underEl, face: face ?? faces?.[0] ?? null });
    try { return await this._pull3d(oldEl, side, underEl, faces?.length ? faces : [face], frame, sr, W, H); }
    catch (e) {
      console.warn("Duck animation failed, using the flat avatar:", e);
      this._stopRun(); oldEl.style.transform = ""; if (underEl) { underEl.style.transform = ""; underEl.style.filter = ""; }
      return super.pull(oldEl, side === "left" ? "next" : "prev", { underEl, face: face ?? faces?.[0] ?? null });
    }
  }

  async _pull3d(oldEl, side, underEl, faceList, frame, sr, W, H) {
    const imgs = await Promise.all(faceList.slice(0, Math.max(1, Math.min(3, this.count))).map(loadImage));
    while (imgs.length < Math.max(1, Math.min(3, this.count))) imgs.push(imgs[imgs.length % Math.max(1, faceList.length)] ?? null);
    if (!this.canvas) {
      this.canvas = document.createElement("canvas"); this.canvas.className = "dk-duck-canvas";
      this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8";
      this.stage.appendChild(this.canvas);
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
    }
    this.canvas.style.display = "block";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, W, H, 0, -3000, 3000); cam.position.set(0, 0, 1000); cam.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9c, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(-300, 700, 900); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xaabbff, 0.6); rim.position.set(500, 200, -400); scene.add(rim);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const T = reduce ? 1200 : 5600;
    const E = side === "right" ? 1 : -1;                              // the direction the slide leaves in
    const L0 = frame.left - sr.left, R0 = frame.right - sr.left, fTop = frame.top - sr.top, fBot = frame.bottom - sr.top, fH = fBot - fTop;
    const hd = Math.max(150, Math.min(340, H * 0.44));                // duck height in px
    const aw = hd * 0.55, ground = Math.max(8, H * 0.03);
    const n = imgs.length;
    const shift = (E > 0 ? W - L0 : R0) + aw * 0.5 + 40;              // how far until the slide is gone
    const ducks = [];
    // where each duck clips its rope on: the first just beyond the slide's leading edge, the others further out (as far as the
    // stage allows; on a narrow stage they overlap a little and stand a step further "back" instead)
    const edge = aw * 1.35;                                          // keep the whole duck (head included) inside the stage
    const base0 = E > 0 ? Math.min(R0 + aw * 0.55, W - edge) : Math.max(L0 - aw * 0.55, edge);
    const room = E > 0 ? W - edge - base0 : base0 - edge;
    const gap = n > 1 ? Math.max(aw * 0.85, Math.min(aw * 1.15, room / (n - 1))) : 0;
    for (let i = 0; i < n; i++) {
      const m = buildDuck(imgs[i]);
      m.root.scale.setScalar(hd); scene.add(m.root);
      const stand = base0 + E * gap * i;
      const start = E > 0 ? W + aw * (1.3 + 0.9 * i) : -aw * (1.3 + 0.9 * i);
      ducks.push({ m, stand, start, delay: i * 0.05, phase0: i * 1.7, yOff: i * hd * 0.07, att: 0.2 + 0.3 * i });
    }
    // the ropes: thin cylinders between each duck's harness ring and the slide's leading edge
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.8 });
    const rope = ducks.map(() => { const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), ropeMat.clone()); r.visible = false; scene.add(r); return r; });
    const hook = ducks.map(() => { const h = new THREE.Mesh(new THREE.TorusGeometry(7, 2.4, 8, 14), new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.6, roughness: 0.35 })); h.visible = false; scene.add(h); return h; });
    rope.push(...hook);

    const bubble = document.createElement("b"); bubble.className = "av-bubble"; bubble.style.cssText += ";z-index:9;font-size:15px;white-space:nowrap";
    this.layer.appendChild(bubble);
    const run = this.run = { raf: 0, ducks, rope, scene, bubble, finish: null, t0: 0, quacked: false, phraseAt: -1, phrase: this.phrase || 0 };
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

    const frameAt = p => {
      // eased progress of the pull, shared by the slide and the ducks (they move together: the rope has a fixed length)
      const pu = seg(p, 0.48, 1.0), s = Math.pow(pu, 1.7);
      const dist = shift * s;
      // the first tug: the rope goes taut and the slide jerks a little before it gets going
      const tug = pu > 0 && pu < 0.16 ? Math.sin(pu / 0.16 * Math.PI) * 14 * -E : 0;
      const S = E * dist + tug;
      oldEl.style.transform = `translateX(${S}px) rotate(${E * clamp01(pu * 3) * 3 * Math.min(1, s * 4)}deg)`;
      if (underEl) {
        const z = ease(seg(p, 0.44, 1.0));
        underEl.style.transform = `scale(${lerp(0.9, 1, z)})`; underEl.style.filter = `brightness(${lerp(0.7, 1, z)})`;
      }
      let quackNow = false;
      ducks.forEach((d, i) => {
        const pd = clamp01(p - d.delay);
        const m = d.m;
        // x: walk in, stand, then follow the slide
        const walkIn = ease(seg(pd, 0.0, 0.3));
        let x = lerp(d.start, d.stand, walkIn);
        const walking = pd < 0.3 && pd > 0 ? 1 : 0;
        x += E * dist;
        // facing: toward the slide while walking in, to the audience while stopped, then toward the exit
        const toSlide = -E, toExit = E, three = 0.6;                    // yaw so that +z (the face) points along +/-x, turned a little toward the viewer
        const yawIn = toSlide * (Math.PI / 2 - three), yawOut = toExit * (Math.PI / 2 - three);
        let yaw;
        if (pd < 0.31) yaw = yawIn;
        else if (pd < 0.36) yaw = lerp(yawIn, 0, ease(seg(pd, 0.31, 0.36)));
        else if (pd < 0.42) yaw = Math.sin(pd * 40) * 0.08;             // looks at the audience, a little head-shake
        else if (pd < 0.48) yaw = lerp(0, yawOut, ease(seg(pd, 0.42, 0.48)));
        else yaw = yawOut;
        const pulling = pd >= 0.48;
        // gait: driven by the distance walked
        const walkedIn = Math.abs(lerp(d.start, d.stand, walkIn) - d.start);
        const stride = hd * 0.2;
        const phase = d.phase0 + (walkedIn + (pulling ? Math.abs(E * dist) : 0)) / stride * Math.PI;
        const moving = (walking || (pulling && pu > 0.02)) ? 1 : (pulling ? 0.4 : 0);
        const amp = pulling ? 0.55 : 0.5;
        const sw = Math.sin(phase) * amp * moving, sw2 = Math.sin(phase + Math.PI) * amp * moving;
        m.legL.hip.rotation.x = -sw; m.legR.hip.rotation.x = -sw2;
        m.legL.knee.rotation.x = Math.max(0, Math.cos(phase)) * 0.95 * moving; m.legR.knee.rotation.x = Math.max(0, Math.cos(phase + Math.PI)) * 0.95 * moving;
        const bob = Math.abs(Math.sin(phase)) * 0.022 * moving;
        m.root.position.set(x, ground - hd * 0.052 + hd * bob + d.yOff, -d.yOff);   // the soles are 0.052 duck-heights above the model's origin
        m.root.rotation.y = yaw;
        // waddle (roll), head bob, and a forward lean when pulling hard
        m.body.rotation.z = Math.sin(phase) * 0.09 * moving;
        const lean = pulling ? 0.32 * clamp01(pu * 4 + 0.3) : 0.04;
        m.body.rotation.x = lean;
        m.head.rotation.x = (pulling ? 0.16 : 0.1) + Math.sin(phase * 2) * 0.05 * moving + (pulling ? Math.sin(p * 90) * 0.015 : 0);
        m.head.rotation.z = Math.sin(phase) * -0.05 * moving + (pd > 0.36 && pd < 0.42 ? Math.sin(pd * 80) * 0.12 : 0);
        m.head.position.z = 0.02 + (moving ? Math.sin(phase * 2) * 0.012 : 0);
        if (m.eye) { const b = (Math.sin(p * 55 + i) > 0.97) ? 0.1 : 1; m.eye.scale.y = b; }
        m.root.updateMatrixWorld(true);
        // the rope and hook
        const rp = rope[i], hkm = rope[ducks.length + i];            // ropes first, then the hooks
        const att = pd >= 0.43;
        rp.visible = hkm.visible = att;
        if (att) {
          const grow = ease(seg(pd, 0.43, 0.48));
          m.ring.getWorldPosition(v1);
          const edgeX = (E > 0 ? R0 : L0) + S;                           // leading edge of the slide
          const ay = H - (fBot - fH * d.att);
          v2.set(edgeX, ay, 0);
          const A = v1, B = v1.clone().lerp(v2, grow);
          const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
          rp.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, 4); rp.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
          rp.scale.set(2.3, len, 2.3);
          hkm.position.set(B.x, B.y, 6); hkm.rotation.set(0.3, 0.2, 0);
        }
        if (i === 0) {
          if (pd > 0.33 && !run.quacked) { run.quacked = true; quackNow = true; bubble.textContent = "quack!"; }
        }
      });
      if (quackNow) this._quack();
      // speech bubble above the first duck
      const d0 = ducks[0], pd0 = clamp01(p - d0.delay);
      let show = false;
      if (pd0 > 0.33 && pd0 < 0.43) show = true;
      else if (pd0 >= 0.5 && pd0 < 0.96) {
        const k = Math.floor((pd0 - 0.5) / 0.09);
        if (k !== run.phraseAt) { run.phraseAt = k; bubble.textContent = PHRASES[(run.phrase + k) % PHRASES.length]; if (k % 3 === 2) this._quack(); }
        show = true;
      }
      if (show) {
        d0.m.head.getWorldPosition(v1);
        bubble.style.left = `${v1.x}px`; bubble.style.top = `${H - v1.y - hd * 0.22}px`; bubble.style.bottom = "auto"; bubble.style.transform = "translate(-50%,-100%) rotate(-5deg)";
      }
      bubble.classList.toggle("show", show);
      this.renderer.render(scene, cam);
    };
    this._frameAt = frameAt;

    return new Promise(res => {
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        this.phrase = (run.phrase + 6) % PHRASES.length;
        oldEl.style.transform = ""; if (underEl) { underEl.style.transform = ""; underEl.style.filter = ""; }
        res();
      };
      run.finish = finish;
      frameAt(0);
      if (this.manual) return;                                        // tests drive the frames with seek()
      run.t0 = performance.now();
      const tick = now => {
        if (this.run !== run) return;
        const p = Math.min(1, (now - run.t0) / T);
        frameAt(p);
        if (p >= 1) { this._stopRun(); return; }
        run.raf = requestAnimationFrame(tick);
      };
      run.raf = requestAnimationFrame(tick);
    });
  }

  // tests: show the scene at progress p (0..1) when manual is true
  seek(p) { this._frameAt?.(p); }
}
