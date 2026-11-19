// Office Twin - a live digital twin of a small office. Every room streams simulated sensors (temperature, CO2,
// occupancy, energy); a what-if slider crowds a room and an AI autopilot boosts ventilation before the air gets bad.
// The Focus Pod is live: its occupancy is the number of hands the laptop camera sees.
// Every control is on the canvas, so the whole twin can be run by pinching (or clicking).

import { W, H, C, text, roundRect, circle, cursor, clamp, lerp, rand } from "./engine.js";
import { cameraLive } from "./camera.js";

const METRICS = { temp: ["Temperature", 19, 28], co2: ["CO2", 420, 1300], occ: ["Occupancy", 0, 100], kw: ["Energy", 0, 6] };
const PL = { x: 18, y: 40, w: 576, h: 576 / 1.45 };            // floor plan on the screen
const SIDE_X = PL.x + PL.w + 24, SIDE_W = W - SIDE_X - 16;
const TICK = 1.5;                                               // seconds between occupancy updates / history samples

function room(name, x, y, w, h, cap, vol, base) {
  return { name, x, y, w, h, cap, vol, base, occ: 0, occEff: 0, co2: 440, temp: base === "server" ? 24 : 21, kw: 0.5, vent: 1, hist: [], dots: [] };
}
const hhmm = t => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ------------------------------------------------------------------ model
function profile(r, h) {                       // expected people in a room at hour h
  const bump = (c, w) => Math.exp(-(((h - c) / w) ** 2));
  if (r.base === "desk") return r.cap * (0.15 + 0.75 * clamp(bump(11, 2.2) + bump(15, 2), 0, 1));
  if (r.base === "meet") return r.name.endsWith("A") ? r.cap * 0.8 * (bump(10, 0.6) + bump(14.5, 0.8)) : r.cap * 0.6 * bump(16, 0.7);
  if (r.base === "pantry") return r.cap * (0.9 * bump(12.8, 0.6) + 0.4 * bump(10.5, 0.3) + 0.4 * bump(15.5, 0.3));
  if (r.base === "focus") return 1.2 * bump(13, 3);
  return 0;
}
// one simulation step of dtm minutes: CO2 rises with people and falls with ventilation; heat from people
// (and servers) against the HVAC set-point and the outside temperature
function simRoom(s, r, dtm, occ, vent) {
  const out = 8 + 4 * Math.sin((s.t / 60 - 9) / 24 * Math.PI * 2);
  r.co2 += dtm * (occ * 30 / r.vol - 0.06 * vent * (r.co2 - 420));
  const heat = r.base === "server" ? 0.35 : occ * 0.08 / r.vol;
  r.temp += dtm * (heat + 0.04 * (s.setp - r.temp) * (r.base === "server" ? 2.2 : 1) + 0.004 * (out - r.temp));
  r.kw = (r.base === "server" ? 3.2 : 0.25) + occ * 0.09 + Math.abs(s.setp - out) * 0.03 * (r.vol / 6) + (vent - 1) * 0.4;
}
function forecast(s, r, vent) {                 // CO2 for the next 60 minutes, with and without the autopilot
  const c = { ...r }, out = [];
  for (let k = 0; k <= 60; k += 2) { out.push(c.co2); simRoom(s, c, 2, r.occEff, vent); }
  return out;
}
const val = (r, m) => m === "occ" ? (r.cap ? r.occEff / r.cap * 100 : 0) : r[m];
function colorFor(s, r) {
  const [, lo, hi] = METRICS[s.metric], t = clamp((val(r, s.metric) - lo) / (hi - lo), 0, 1);
  const stops = [[70, 192, 104], [224, 168, 58], [242, 102, 94]], k = t < 0.5 ? 0 : 1, f = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return `rgb(${stops[k].map((v, i) => Math.round(lerp(v, stops[k + 1][i], f)))})`;
}
function fmt(r, m) {
  const v = val(r, m);
  return m === "co2" ? `${v.toFixed(0)} ppm` : m === "temp" ? `${v.toFixed(1)} C` : m === "occ" ? `${r.occEff}/${r.cap}` : `${v.toFixed(2)} kW`;
}
function logIt(s, t) { s.log.unshift(`${hhmm(s.t)}  ${t}`); s.log = s.log.slice(0, 6); }

// --------------------------------------------------------------- controls
const CTRL_Y = PL.y + PL.h + 18;
const WIDGETS = [
  ...Object.keys(METRICS).map((m, k) => ({ id: "m-" + m, type: "metric", m, x: 18 + k * 112, y: CTRL_Y, w: 106, h: 34, label: METRICS[m][0] })),
  { id: "auto", type: "toggle", x: 470, y: CTRL_Y, w: 124, h: 34, label: "AI autopilot" },
  { id: "speed", type: "slider", key: "speed", min: 1, max: 20, step: 1, x: 18, y: CTRL_Y + 50, w: 180, h: 54, label: "Speed", unit: "x" },
  { id: "setp", type: "slider", key: "setp", min: 18, max: 26, step: 0.5, x: 216, y: CTRL_Y + 50, w: 180, h: 54, label: "HVAC set-point", unit: " C" },
  { id: "extra", type: "slider", key: "extra", min: 0, max: 12, step: 1, x: 414, y: CTRL_Y + 50, w: 180, h: 54, label: "What-if: + people", unit: "" },
];
const inside = (w, x, y) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h;
function slideTo(s, w, x) {
  const t = clamp((x - w.x - 10) / (w.w - 20), 0, 1);
  s[w.key] = Math.round((w.min + t * (w.max - w.min)) / w.step) * w.step;
}

export default {
  id: "office", title: "Office Twin", icon: "building", sensor: "webcam", twinDemo: true,
  desc: "A live office: rooms coloured by CO2, temperature, occupancy or energy, a what-if slider and an AI autopilot. Hands in view fill the Focus Pod.",
  modes: [{ id: "sim", label: "Simulation", players: 1, scored: false, quick: true }],
  phone: "Nothing to do on the phone: this one uses the laptop camera.",
  howto: ["Pinch (or click) a room to see its sensors and a 60-minute CO2 forecast.",
          "Pinch a button to change the colouring; pinch and drag a slider to change it.",
          "Crowd the selected room with the what-if slider and watch the autopilot ventilate it before CO2 passes 1000 ppm.",
          "With the camera on, the Focus Pod is live: its occupancy is the number of hands in view."],
  twin: { entity: "An office: six rooms and the people in them.", sensors: "Simulated temperature, CO2, occupancy and energy sensors; the Focus Pod counts real hands through the laptop camera.",
          model: "A per-room air and heat model, run forward for the forecast.", loop: "The AI autopilot boosts ventilation and releases unused bookings." },

  init() {
    const rooms = [room("Open Desks", 0.02, 0.04, 0.56, 0.55, 24, 30, "desk"), room("Meeting Room A", 0.60, 0.04, 0.38, 0.27, 10, 6, "meet"),
                   room("Meeting Room B", 0.60, 0.33, 0.38, 0.26, 6, 4, "meet"), room("Focus Pod", 0.02, 0.62, 0.18, 0.34, 2, 2, "focus"),
                   room("Pantry", 0.22, 0.62, 0.36, 0.34, 8, 8, "pantry"), room("Server Room", 0.60, 0.62, 0.38, 0.34, 0, 5, "server")];
    rooms[2].booked = true; rooms[2].empty = 0;
    return { rooms, t: 8 * 60, speed: 3, metric: "co2", sel: 1, setp: 21.5, extra: 0, auto: true, log: [], acc: TICK, drag: null, hover: null };
  },

  update(g, s, dt) {
    const q = g.ptr(), px = q.x * W, py = q.y * H;
    // controls and room picking
    s.hover = q.source === "none" ? null : WIDGETS.find(w => inside(w, px, py))?.id ?? null;
    if (q.pinchStart && q.source !== "none") {
      const w = WIDGETS.find(x => inside(x, px, py));
      if (w?.type === "metric") s.metric = w.m;
      else if (w?.type === "toggle") s.auto = !s.auto;
      else if (w?.type === "slider") { s.drag = w; slideTo(s, w, px); }
      else s.rooms.forEach((r, k) => {
        const x = PL.x + r.x * PL.w, y = PL.y + r.y * PL.h;
        if (px > x && px < x + r.w * PL.w && py > y && py < y + r.h * PL.h) { s.sel = k; s.extra = 0; }
      });
      if (w) g.sfx("tick");
    }
    if (s.drag) { if (q.pinch) slideTo(s, s.drag, px); else s.drag = null; }

    // simulation
    const dtm = dt * s.speed;
    s.t += dtm; if (s.t >= 19 * 60) s.t = 8 * 60;
    const hour = s.t / 60;
    s.acc += dtm;
    const tick = s.acc >= TICK;
    const live = cameraLive();
    s.rooms.forEach((r, k) => {
      if (tick) { let tgt = profile(r, hour); if (r.name === "Meeting Room B" && hour > 11) tgt = 0; r.occ = clamp(Math.round(lerp(r.occ, tgt, 0.5) + rand(-1, 1) * 0.6), 0, r.cap || 0); }
      r.live = r.base === "focus" && live;
      if (r.live) r.occ = Math.min(r.cap, q.hands);
      const occ = r.occ + (k === s.sel ? s.extra : 0);
      r.occEff = occ;
      if (s.auto) {
        if (r.co2 > 850 && r.vent < 2.5) { r.vent = 2.5; logIt(s, `Vent boost: ${r.name}, ${r.co2.toFixed(0)} ppm`); }
        else if (r.co2 < 600 && r.vent > 1) r.vent = 1;
      } else r.vent = 1;
      simRoom(s, r, dtm, occ, r.vent);
      while (r.dots.length < occ) r.dots.push({ x: Math.random(), y: Math.random() });
      while (r.dots.length > occ) r.dots.pop();
      r.dots.forEach(d => { d.x = clamp(d.x + rand(-1, 1) * 0.01, 0.06, 0.94); d.y = clamp(d.y + rand(-1, 1) * 0.01, 0.3, 0.94); });
      if (tick) { r.hist.push(val(r, s.metric)); if (r.hist.length > 120) r.hist.shift(); }
      if (r.booked && hour > 10 && hour < 11) {
        r.empty = r.occ === 0 ? r.empty + dtm : 0;
        if (r.empty > 15 && s.auto) { r.booked = false; logIt(s, `Released no-show booking: ${r.name}`); }
      }
    });
    if (tick) s.acc = 0;
  },

  draw(g, s) {
    const c = g.ctx, q = g.ptr();
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    roundRect(PL.x - 6, PL.y - 6, PL.w + 12, PL.h + 12, 12, "#0f1522");
    s.rooms.forEach((r, k) => {
      const x = PL.x + r.x * PL.w, y = PL.y + r.y * PL.h, w = r.w * PL.w, h = r.h * PL.h, col = colorFor(s, r);
      c.globalAlpha = 0.22; roundRect(x, y, w, h, 8, col); c.globalAlpha = 1;
      c.beginPath(); c.roundRect(x, y, w, h, 8); c.strokeStyle = k === s.sel ? "#fff" : col; c.lineWidth = k === s.sel ? 2.5 : 1.2; c.stroke();
      text(r.name, x + 10, y + 20, { size: clamp(w * 0.06, 10, 14), weight: 600 });
      text(fmt(r, s.metric), x + 10, y + 44, { size: clamp(w * 0.08, 12, 20), weight: 700, color: col });
      if (r.live) text(`LIVE: ${q.hands} hand${q.hands === 1 ? "" : "s"}`, x + 10, y + 60, { size: 10, weight: 700, color: "#ff4d6d" });
      if (r.booked) text("BOOKED 10-11", x + w - 10, y + 20, { size: 10, weight: 600, color: C.warn, align: "right" });
      if (r.vent > 1) text("vent boost", x + w - 10, y + h - 10, { size: 10, weight: 600, color: "#4de1c1", align: "right" });
      r.dots.forEach(d => circle(x + d.x * w, y + d.y * h, 3, C.text));
      if (r.base === "server") for (let i = 0; i < 4; i++) {
        c.fillStyle = "#1d273b"; c.fillRect(x + w * 0.12 + i * w * 0.2, y + h * 0.45, w * 0.12, h * 0.42);
        for (let j = 0; j < 5; j++) { c.fillStyle = Math.random() > 0.5 ? "#4de1c1" : "#1f6f5f"; c.fillRect(x + w * 0.14 + i * w * 0.2, y + h * 0.5 + j * h * 0.07, 4, 3); }
      }
    });
    text("SIM TIME", PL.x, PL.y - 16, { size: 11, weight: 600, color: C.text3 });
    text(hhmm(s.t), PL.x + 64, PL.y - 14, { size: 16, weight: 700 });
    text(cameraLive() ? "Camera on: hands in view fill the Focus Pod" : "Turn the camera on to make the Focus Pod live", PL.x + PL.w, PL.y - 16, { size: 11, weight: 500, color: C.text3, align: "right" });

    // controls
    for (const w of WIDGETS) {
      const hot = s.hover === w.id || s.drag?.id === w.id;
      if (w.type === "metric" || w.type === "toggle") {
        const on = w.type === "metric" ? s.metric === w.m : s.auto;
        roundRect(w.x, w.y, w.w, w.h, 8, on ? "#1f2c46" : hot ? C.s3 : C.surface, on ? C.accent : hot ? C.border2 : C.border);
        text(w.type === "toggle" ? `${w.label}: ${s.auto ? "on" : "off"}` : w.label, w.x + w.w / 2, w.y + 22, { size: 12, weight: 600, color: on ? C.text : C.text2, align: "center" });
      } else {
        const t = (s[w.key] - w.min) / (w.max - w.min), hx = w.x + 10 + t * (w.w - 20), ty = w.y + 36;
        roundRect(w.x, w.y, w.w, w.h, 8, hot ? C.s3 : C.surface, hot ? C.border2 : C.border);
        text(w.label, w.x + 10, w.y + 18, { size: 11, weight: 600, color: C.text3 });
        text(`${s[w.key]}${w.unit}`, w.x + w.w - 10, w.y + 18, { size: 11, weight: 700, align: "right" });
        roundRect(w.x + 10, ty - 2, w.w - 20, 4, 2, C.border2);
        roundRect(w.x + 10, ty - 2, Math.max(4, t * (w.w - 20)), 4, 2, C.accent);
        circle(hx, ty, s.drag?.id === w.id ? 10 : 8, C.text, C.accent, 2);
      }
    }

    // side panel: selected room, forecast, agent log
    const r = s.rooms[s.sel];
    let y = 16;
    roundRect(SIDE_X, y, SIDE_W, 150, 10, C.surface, C.border);
    text(r.name, SIDE_X + 14, y + 26, { size: 16, weight: 700 });
    if (s.extra && r.cap) text(`what-if +${s.extra}`, SIDE_X + SIDE_W - 14, y + 26, { size: 11, weight: 600, color: C.warn, align: "right" });
    ["temp", "co2", "occ", "kw"].forEach((m, i) => {
      const cx = SIDE_X + 14 + (i % 2) * (SIDE_W / 2), cy = y + 54 + Math.floor(i / 2) * 44;
      text(METRICS[m][0].toUpperCase(), cx, cy, { size: 11, weight: 600, color: C.text3 });
      text(fmt(r, m), cx, cy + 20, { size: 17, weight: 700 });
    });
    y += 162;
    const ch = 190;
    roundRect(SIDE_X, y, SIDE_W, ch, 10, C.surface, C.border);
    text("CO2 FORECAST - NEXT 60 MIN", SIDE_X + 14, y + 20, { size: 11, weight: 600, color: C.accent });
    const fa = forecast(s, r, 1), fb = forecast(s, r, 2.5), gx = SIDE_X + 14, gy = y + 32, gw = SIDE_W - 28, gh = ch - 62;
    const lo = 400, hi = Math.max(1300, ...fa) + 50, Yv = v => gy + gh - (v - lo) / (hi - lo) * gh;
    c.strokeStyle = "rgba(242,102,94,.5)"; c.setLineDash([4, 4]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(gx, Yv(1000)); c.lineTo(gx + gw, Yv(1000)); c.stroke(); c.setLineDash([]);
    text("1000 ppm limit", gx + gw, Yv(1000) - 4, { size: 10, weight: 500, color: C.bad, align: "right" });
    [[fa, "#ff9f43", "Do nothing"], [fb, "#4de1c1", "With AI ventilation"]].forEach(([arr, col, l], i) => {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      arr.forEach((v, k) => { const x = gx + k / (arr.length - 1) * gw; k ? c.lineTo(x, Yv(v)) : c.moveTo(x, Yv(v)); });
      c.stroke();
      c.fillStyle = col; c.fillRect(gx + i * 120, gy + gh + 14, 10, 3);
      text(l, gx + 14 + i * 120, gy + gh + 19, { size: 10, weight: 500, color: C.text2 });
    });
    y += ch + 12;
    const lh = H - y - 16;
    roundRect(SIDE_X, y, SIDE_W, lh, 10, C.surface, C.border);
    text("AI AGENT ACTIONS", SIDE_X + 14, y + 20, { size: 11, weight: 600, color: "#4de1c1" });
    c.font = "500 11px ui-monospace, monospace"; c.fillStyle = C.text2; c.textAlign = "left";
    (s.log.length ? s.log : ["Watching the sensors..."]).slice(0, Math.floor((lh - 30) / 17))
      .forEach((t, i) => c.fillText(t.length > 44 ? t.slice(0, 43) + "." : t, SIDE_X + 14, y + 40 + i * 17));
    cursor(q);
  },
};
