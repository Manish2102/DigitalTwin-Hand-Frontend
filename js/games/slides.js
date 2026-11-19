// Air Slides - present without a clicker. Swipe a hand to change slides, pinch for a laser pointer,
// hold a fist to blank the screen. Physical sensor: the laptop camera (hand tracking in the browser).

import { W, H, C, text, roundRect, circle, cursor, clamp, lerp } from "./engine.js";

const SLIDES = [
  { t: "Digital Twin Lab", s: "Physical AI in a browser", b: ["Swipe your hand to the left to begin"] },
  { t: "What is Physical AI?", b: ["AI that perceives, reasons and acts in the real world", "Camera and sensors to model to action in under 50 ms", "Robots, wearables, smart spaces, sports tech"] },
  { t: "What is a digital twin?", b: ["A live virtual copy of a physical thing", "Kept in sync by sensors: monitor, predict, try what-ifs", "Factories, buildings, sports, people"] },
  { t: "The real-time trick", b: ["Fast loop: perception on the device, 30 times a second", "Slow loop: a language model for reasoning and reports", "Never put the language model inside the control loop"] },
  { t: "Demo time", b: ["Air Cricket, Flick Carrom, Snooker Coach", "Robot arm twin and the live office twin", "All in the browser, with only the laptop camera"] },
  { t: "Thank you", s: "Questions?", b: ["Pinch to point, hold a fist to blank the screen"] },
];
const SWIPE_V = 1.6;            // horizontal speed (screen widths per second) that counts as a swipe
const COOL = 0.7;               // seconds between two swipes
const RETURN_GUARD = 1.2;       // the hand coming back after a swipe must not swipe the other way
const FIST_HOLD = 0.6;

const SW = 826, SH = SW * 9 / 16, SX = (W - SW) / 2, SY = (H - SH) / 2 - 12;

function go(s, d) {
  const n = clamp(s.i + d, 0, SLIDES.length - 1);
  if (n === s.i) { s.bump = d * 0.06; return; }
  s.i = n; s.off = d; s.flash = d > 0 ? "Next" : "Previous"; s.flashT = 0.7;
}

export default {
  id: "slides", title: "Air Slides", icon: "presentation", sensor: "webcam",
  desc: "Present without a clicker: swipe to change slides, pinch for a laser pointer, hold a fist to blank the screen.",
  modes: [{ id: "deck", label: "Presenter", players: 1, scored: false, quick: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["Swipe an open hand to the left for the next slide, to the right for the previous one.",
          "Pinch thumb and index finger together to show a red laser pointer.",
          "Hold a fist for half a second to blank the screen, and again to bring it back.",
          "Mouse: drag fast left or right to swipe, hold the button for the laser. Arrow keys and B work too."],
  twin: { entity: "The presenter's hand.", sensors: "The laptop camera, 21 hand points about 30 times a second.",
          model: "A swipe detector (speed and direction of the hand) and a pinch and fist detector.", loop: "The slide changes, the laser follows your fingers." },

  init() { return { i: 0, off: 0, bump: 0, cool: 0, guardDir: 0, guardT: 0, black: false, fistT: 0, latch: false, trail: [], flash: "", flashT: 0, t: 0 }; },

  key(g, s, e) {
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "pagedown" || k === " ") { go(s, 1); e.preventDefault(); }
    if (k === "arrowleft" || k === "pageup") { go(s, -1); e.preventDefault(); }
    if (k === "b") s.black = !s.black;
  },

  update(g, s, dt) {
    s.t += dt;
    const q = g.ptr();
    s.off = lerp(s.off, 0, 1 - Math.pow(0.0005, dt)); s.bump = lerp(s.bump, 0, 1 - Math.pow(0.001, dt));
    s.cool -= dt; s.flashT -= dt; s.guardT -= dt;
    const hand = q.source === "camera" || q.source === "phone";
    const canSwipe = hand ? !q.pinch && !q.fist : q.pinch;          // mouse: swipe while dragging
    if (canSwipe && s.cool <= 0 && Math.abs(q.vx) > SWIPE_V && Math.abs(q.vx) > 1.6 * Math.abs(q.vy)) {
      const d = q.vx < 0 ? 1 : -1;                                  // hand moves left = next slide
      if (!(s.guardT > 0 && d === -s.guardDir)) { go(s, d); s.guardDir = d; s.guardT = RETURN_GUARD; g.sfx("tick"); }
      s.cool = COOL;
    }
    if (hand) {
      if (q.fist) { s.fistT += dt; if (s.fistT > FIST_HOLD && !s.latch) { s.black = !s.black; s.latch = true; } }
      else { s.fistT = 0; s.latch = false; }
    }
    if (q.pinch && !(q.source === "mouse" && Math.abs(q.vx) > 1)) s.trail.push({ x: q.x * W, y: q.y * H, t: s.t });
    s.trail = s.trail.filter(p => s.t - p.t < 0.35);
  },

  draw(g, s) {
    const c = g.ctx, q = g.ptr();
    c.fillStyle = "#07090d"; c.fillRect(0, 0, W, H);
    c.save();
    c.translate((s.off * 0.35 + s.bump) * SW, 0);
    c.globalAlpha = 1 - Math.min(0.6, Math.abs(s.off));
    const grad = c.createLinearGradient(SX, SY, SX + SW, SY + SH);
    grad.addColorStop(0, "#152036"); grad.addColorStop(1, "#1b1934");
    roundRect(SX, SY, SW, SH, 16, grad, C.border2);
    c.strokeStyle = "rgba(123,150,255,.16)"; c.lineWidth = 2;
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(SX + SW * 0.86, SY + SH * 0.22, 30 + k * 28, Math.PI * 0.5, Math.PI * 1.25); c.stroke(); }
    const sl = SLIDES[s.i], u = SW / 100;
    text(`${String(s.i + 1).padStart(2, "0")} / ${String(SLIDES.length).padStart(2, "0")}`, SX + 6 * u, SY + 8 * u, { size: 1.5 * u, color: C.accent });
    text(sl.t, SX + 6 * u, SY + (sl.s ? 20 : 19) * u, { size: 5.4 * u, weight: 700 });
    let y = SY + 27 * u;
    if (sl.s) { text(sl.s, SX + 6 * u, y, { size: 2.4 * u, weight: 500, color: C.text2 }); y += 8 * u; } else y += 4 * u;
    for (const b of sl.b) {
      circle(SX + 7 * u, y - 0.8 * u, 0.7 * u, C.accent);
      text(b, SX + 9.5 * u, y, { size: 2.5 * u, weight: 500, color: "#dde3ee" });
      y += 6.5 * u;
    }
    c.restore();
    SLIDES.forEach((_, k) => circle(W / 2 + (k - (SLIDES.length - 1) / 2) * 16, SY + SH + 20, 4, k === s.i ? C.accent : C.border2));
    if (s.black) {
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      text("Screen blanked - hold a fist again (or press B) to bring it back", W / 2, H - 30, { size: 13, weight: 500, color: "#3a3f48", align: "center" });
    }
    s.trail.forEach((p, k) => { const a = k / s.trail.length; circle(p.x, p.y, 3 + a * 5, `rgba(255,40,60,${a * 0.5})`); });
    if (q.pinch) {
      c.shadowColor = "#ff2840"; c.shadowBlur = 18; circle(q.x * W, q.y * H, 7, "#ff2840"); c.shadowBlur = 0;
    } else if (!s.black) cursor(q);
    if (s.flashT > 0) {
      c.globalAlpha = clamp(s.flashT / 0.4, 0, 1);
      text(s.flash, W / 2, SY - 14, { size: 22, weight: 700, color: C.accent, align: "center" });
      c.globalAlpha = 1;
    }
    if (s.fistT > 0 && !s.latch) {
      c.strokeStyle = C.warn; c.lineWidth = 4; c.beginPath();
      c.arc(q.x * W, q.y * H, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.fistT / FIST_HOLD); c.stroke();
    }
    if (q.source === "none" && !s.black) text("Show a hand to the camera, or use the mouse and arrow keys", W / 2, H - 14, { size: 13, color: C.text3, align: "center" });
  },
};
