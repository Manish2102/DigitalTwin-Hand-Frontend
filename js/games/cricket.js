// Air Cricket - your hand is the bat. Line up with the ball and swing as it arrives; the faster the swing,
// the bigger the shot. Physical sensor: the laptop camera. The ball's track is a small "Hawk-Eye" style twin.

import { W, H, C, text, roundRect, circle, cursor, clamp, lerp, rand } from "./engine.js";

const BALLS = 12, WICKETS = 3;                 // two overs, three wickets
const YT = 120, YB = 504, CX = W / 2, HWT = 48, HWB = 192;
const BAT = 86;                                // blade length in pixels
const PEAK_S = 0.16;                           // swing speed = the fastest moment in this window

// pitch coordinates (z: 0 bowler .. 1 batter, l: line -1..1, h: height) to the screen
function proj(z, l, h) {
  const zz = Math.pow(Math.max(0, z), 1.6);
  const sc = lerp(0.25, 1, zz);
  return { x: CX + l * lerp(HWT, HWB, zz), y: lerp(YT, YB, zz) - h * H * 0.16 * sc, r: lerp(3.5, 13, zz), sc };
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function newBall(s, delay) {
  const spd = rand(118, 146) + s.balls * 1.2;                     // a little quicker every ball
  s.ball = { state: "wait", t: -delay, z: 0, line: rand(-0.55, 0.55), zb: rand(0.55, 0.78), spd, swing: rand(-0.25, 0.25), trail: [] };
  s.ball.T = 1.05 * 130 / spd;                                    // seconds from the bowler to the batter
}
const say = (s, t) => { s.msg = t; s.msgT = 1.6; };
function next(g, s) {
  if (s.wk >= WICKETS || s.balls >= BALLS) {
    return g.end({ title: s.wk >= WICKETS ? "All out" : "Innings over",
                   detail: `${s.runs} runs for ${s.wk} wicket${s.wk === 1 ? "" : "s"} from ${s.balls} balls` });
  }
  newBall(s, 0.8);
}

export default {
  id: "cricket", title: "Air Cricket", icon: "bat", sensor: "webcam",
  desc: "Your hand is the bat. Meet the ball and swing fast: the faster the swing, the bigger the shot. Two overs, three wickets.",
  modes: [{ id: "innings", label: "1 player", players: 1, scored: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["Move your hand to put the bat on the ball's line (the red mark shows where it bounces).",
          "Swing fast just as the ball reaches you. A faster swing scores 1, 2, 4 or 6.",
          "Miss a ball that is on the stumps and you are bowled. Twelve balls, three wickets.",
          "Mouse: move to line up, then flick the mouse through the ball."],
  twin: { entity: "Your hand, swinging a bat.", sensors: "The laptop camera tracks the hand about 30 times a second.",
          model: "A 2.5D ball flight (line, length, swing) and the bat's speed from the hand's motion.", loop: "Runs, the ball's track, and the swing-speed meter." },

  init() {
    const s = { runs: 0, balls: 0, wk: 0, log: [], msg: "", msgT: 0, batAng: 0, peak: [], swing: 0 };
    newBall(s, 1.2);
    return s;
  },

  update(g, s, dt) {
    s.msgT -= dt;
    const q = g.ptr(), b = s.ball, px = q.x * W, py = q.y * H;
    s.batAng = lerp(s.batAng, clamp(-q.vx * 0.12, -0.9, 0.9), 0.3);
    s.peak.push({ t: g.time, v: q.speed });
    while (s.peak.length && g.time - s.peak[0].t > PEAK_S) s.peak.shift();
    const swing = s.peak.reduce((m, p) => Math.max(m, p.v), 0);
    s.swing = swing;
    b.t += dt;
    if (b.state === "wait" && b.t >= 0) b.state = "fly";
    if (b.state === "fly") {
      b.z = b.t / b.T;
      const lineNow = b.line + b.swing * Math.max(0, b.z - b.zb);
      const h = b.z < b.zb ? lerp(1, 0, b.z / b.zb) : Math.sin(clamp((b.z - b.zb) / (1 - b.zb), 0, 1) * 1.3) * 0.62;
      b.p = proj(Math.min(b.z, 1.12), lineNow, h); b.lineNow = lineNow;
      b.trail.push({ x: b.p.x, y: b.p.y });
      if (b.z > 0.84 && b.z < 1.1 && q.source !== "none") {
        // hit when the ball touches the blade (or is close to the hand) during a fast swing
        const tipX = px - Math.sin(s.batAng) * BAT, tipY = py + Math.cos(s.batAng) * BAT;
        const d = Math.min(segDist(b.p.x, b.p.y, px, py, tipX, tipY), Math.hypot(b.p.x - px, b.p.y - py) - 30);
        if (d < b.p.r + 22 && swing > 0.9) {
          const runs = swing > 3.4 ? 6 : swing > 2.4 ? 4 : swing > 1.6 ? 2 : 1;
          s.runs += runs; s.balls++; s.log.push(runs); g.addScore(1, runs);
          Object.assign(b, { state: "hit", hx: b.p.x, hy: b.p.y, hvx: clamp(q.vx, -3, 3) * W * 0.35 + rand(-40, 40),
                             hvy: -(260 + swing * 170), hr: b.p.r, ht: 0 });
          say(s, runs === 6 ? "SIX" : runs === 4 ? "FOUR" : `${runs} run${runs > 1 ? "s" : ""}`);
          g.sfx(runs >= 4 ? "win" : "good"); g.buzz(1, [40]);
        }
      }
      if (b.state === "fly" && b.z > 1.1) {
        s.balls++;
        if (Math.abs(b.lineNow) < 0.2) { s.wk++; s.log.push("W"); say(s, "BOWLED"); b.state = "out"; g.sfx("bad"); }
        else { s.log.push("."); say(s, "Dot ball"); b.state = "done"; }
        b.ot = 0;
      }
    }
    if (b.state === "hit") {
      b.ht += dt; b.hx += b.hvx * dt; b.hy += b.hvy * dt; b.hvy += 520 * dt; b.hr *= Math.pow(0.55, dt);
      if (b.ht > 1.5) next(g, s);
    }
    if (b.state === "out" || b.state === "done") { b.ot += dt; if (b.ot > 1.4) next(g, s); }
  },

  draw(g, s) {
    const c = g.ctx, b = s.ball, q = g.ptr();
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0c1a2e"); sky.addColorStop(0.35, "#12304a"); sky.addColorStop(0.36, "#1f5a2e"); sky.addColorStop(1, "#2f7a3a");
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) {                                  // floodlights
      const x = W * (0.12 + k * 0.25);
      c.fillStyle = "rgba(255,255,220,.07)"; c.beginPath(); c.moveTo(x, 12); c.lineTo(x - 80, H * 0.36); c.lineTo(x + 80, H * 0.36); c.fill();
      c.fillStyle = "#fffbe0"; c.fillRect(x - 14, 12, 28, 6);
    }
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.04)"; c.fillRect(0, H * 0.36 + k * H * 0.08, W, H * 0.08); }
    c.fillStyle = "#c9b27a";                                       // pitch
    c.beginPath(); c.moveTo(CX - HWT * 1.3, YT - 18); c.lineTo(CX + HWT * 1.3, YT - 18); c.lineTo(CX + HWB * 1.25, YB + 60); c.lineTo(CX - HWB * 1.25, YB + 60); c.fill();
    c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 2;
    for (const z of [0.03, 0.98]) { const a = proj(z, -1.25, 0), e = proj(z, 1.25, 0); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(e.x, e.y); c.stroke(); }
    const stumps = z => {
      const p = proj(z, 0, 0), w = p.r * 0.9, hh = H * 0.12 * p.sc;
      c.fillStyle = "#f5ecd7";
      for (let k = -1; k <= 1; k++) c.fillRect(p.x + k * w * 1.1 - w * 0.18, p.y - hh, w * 0.36, hh);
    };
    stumps(0.02);
    if (b.state !== "out") stumps(1);
    else {                                                          // stumps flying
      const p = proj(1, 0, 0);
      c.save(); c.translate(p.x, p.y); c.fillStyle = "#f5ecd7";
      [-1, 0, 1].forEach(k => { c.save(); c.rotate(k * 0.6 + b.ot * 2 * k); c.fillRect(k * 20 - 3, -H * 0.12 - b.ot * 40, 6, H * 0.12); c.restore(); });
      c.restore();
    }
    const bp = proj(0, 0.15, 0);                                    // bowler
    c.fillStyle = "#16324f"; c.fillRect(bp.x - 5, bp.y - 34, 10, 30); circle(bp.x, bp.y - 40, 6, "#16324f");
    if (b.trail.length > 1) {                                       // ball track
      c.strokeStyle = "rgba(255,80,80,.55)"; c.lineWidth = 3; c.beginPath();
      b.trail.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
    }
    if (b.state === "wait" || b.state === "fly") {                  // where it will bounce
      const p = proj(b.zb, b.line, 0);
      c.fillStyle = "rgba(255,80,80,.45)"; c.beginPath(); c.ellipse(p.x, p.y, p.r * 1.4, p.r * 0.5, 0, 0, 7); c.fill();
    }
    let bx, by, br;
    if ((b.state === "fly" || b.state === "out" || b.state === "done") && b.p) { bx = b.p.x; by = b.p.y; br = b.p.r; }
    if (b.state === "hit") { bx = b.hx; by = b.hy; br = b.hr; }
    if (bx !== undefined) {
      if (b.state !== "hit") {
        const sh = proj(Math.min(b.z, 1.1), b.lineNow || 0, 0);
        c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(sh.x, sh.y, br, br * 0.35, 0, 0, 7); c.fill();
      }
      circle(bx, by, br, "#d8262f");
      c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, br * 0.7, -0.6, 0.9); c.stroke();
    }
    if (q.source !== "none") {                                      // the bat, held at the pointer
      c.save(); c.translate(q.x * W, q.y * H); c.rotate(s.batAng);
      roundRect(-11, -10, 22, BAT + 4, 6, "#e7c88f", "#a8854e");
      c.fillStyle = "#6b4a2b"; c.fillRect(-4, -48, 8, 40);
      c.restore();
    }
    // swing meter
    const sp = clamp(s.swing / 4, 0, 1);
    roundRect(W - 200, 16, 184, 58, 10, "rgba(13,18,32,.85)");
    text("SWING SPEED", W - 188, 34, { size: 11, weight: 600, color: C.text3 });
    if (b.state === "fly" || b.state === "wait") text(`${b.spd.toFixed(0)} km/h`, W - 28, 34, { size: 11, weight: 600, color: C.text3, align: "right" });
    roundRect(W - 188, 44, 160, 12, 6, C.border);
    if (sp > 0.01) roundRect(W - 188, 44, Math.max(12, 160 * sp), 12, 6, sp > 0.85 ? C.warn : sp > 0.6 ? C.ok : C.accent);
    // scoreboard
    roundRect(W / 2 - 150, 10, 300, 52, 12, "rgba(13,18,32,.88)");
    text(`${s.runs}/${s.wk}`, W / 2 - 70, 44, { size: 24, weight: 700, align: "center" });
    text(`Overs ${Math.floor(s.balls / 6)}.${s.balls % 6} / 2`, W / 2 + 50, 31, { size: 12, weight: 500, color: C.text3, align: "center" });
    text(s.log.slice(-6).join("  ") || "-", W / 2 + 50, 50, { size: 12, weight: 600, color: C.text2, align: "center" });
    if (s.msgT > 0) {
      c.globalAlpha = clamp(s.msgT, 0, 1);
      text(s.msg, W / 2, H * 0.5, { size: s.msg.length < 6 ? 64 : 40, weight: 700, color: s.msg === "BOWLED" ? C.bad : "#ffe066", align: "center" });
      c.globalAlpha = 1;
    }
    if (q.source === "none") text("Show a hand to the camera, or use the mouse", W / 2, H - 16, { size: 14, color: C.text, align: "center" });
    cursor(q, "#ffe066");
  },
};
