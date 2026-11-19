// pose.js - Phone pose twin, used as a SMART PARCEL MONITOR.
//
// Scenario: the phone is the sensor tag on a fragile parcel in transit.
// The phone only streams raw sensor readings (20x per second):
//   alpha, beta, gamma  - orientation in degrees
//   acc                 - strongest shock since the last reading (m/s², gravity removed)
//   gmin                - lowest total acceleration (m/s²); near 0 means free fall (a drop)
// The twin:
//   1. mirrors the parcel as a 3D model                     (sync physical -> virtual)
//   2. checks every reading against the shipping rules      (intelligence)
//   3. records incidents, scores the parcel's condition     (monitoring + history)
//   4. tells the phone the status, vibrates it on incidents (feedback loop)
//   5. can replay a scripted delivery trip without a phone  (simulation)
//   6. produces a delivery report                           (reporting)

import { twin, on, logEvent, sendToPhone, ROOM, $ } from "./core.js";
import { icon, setButton } from "./icons.js";
import { toast } from "./ui.js";

const G = 9.81;
const deg = Math.PI / 180;
const STALE_MS = 1500;
const FLIP_TILT = 135;          // beyond this the parcel counts as upside down
const HYSTERESIS = 8;           // degrees back inside a limit before an incident ends (stops flicker)
const FREE_FALL = 3.0;          // m/s²: total acceleration this low means falling...
const FREE_FALL_SAMPLES = 2;    // ...for at least 2 readings in a row (~100 ms), not a single blip
const SHOCK_COOLDOWN_MS = 1500;
const DROP_COOLDOWN_MS = 2500;
const SAMPLE_MS = 250, HISTORY = 240;            // charts: 60 s
const PENALTY = { tilt: 5, flip: 15, shock: 10, drop: 20 };
const KIND = { tilt: { icon: "rotateCw", name: "Tilt" }, flip: { icon: "flip", name: "Upside down" },
               shock: { icon: "zap", name: "Shock" }, drop: { icon: "drop", name: "Drop" } };
const LEVEL = { ok:   { badge: "badge-success", icon: "checkCircle" },
                warn: { badge: "badge-warning", icon: "alert" },
                crit: { badge: "badge-danger",  icon: "octagon" } };
const rules = { maxTilt: 45, shockG: 2.0 };

let latest = null, lastMsg = 0, alpha0 = 0, demo = null;
let trip, status = { level: "ok", text: "Parcel OK" }, flashUntil = { warn: 0, crit: 0 }, lastStatusSent = "";
let bucket = { tilt: 0, g: 0 }, fallRun = 0, shownStatus = "";
const series = { tilt: [], g: [] };

// --------------------------------------------------------------- math
// W3C device orientation: R = Rz(alpha) * Rx(beta) * Ry(gamma) maps phone axes
// (x right, y top, z out of the screen) to earth axes (x east, y north, z up).
function rotation(alpha, beta, gamma) {
  const [ca, sa] = [Math.cos(alpha * deg), Math.sin(alpha * deg)];
  const [cb, sb] = [Math.cos(beta * deg), Math.sin(beta * deg)];
  const [cg, sg] = [Math.cos(gamma * deg), Math.sin(gamma * deg)];
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg,  ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg,                sb,      cb * cg],
  ];
}
// CSS has y pointing down: M = S R S with S = diag(1,-1,1), written column-major.
function cssMatrix(R) {
  const s = [1, -1, 1];
  const m = (i, j) => s[i] * R[i][j] * s[j];
  return `matrix3d(${m(0,0)},${m(1,0)},${m(2,0)},0,${m(0,1)},${m(1,1)},${m(2,1)},0,${m(0,2)},${m(1,2)},${m(2,2)},0,0,0,0,1)`;
}
// Tilt = angle between the parcel's "this side up" (phone screen) and true up.
const tiltOf = R => Math.acos(Math.max(-1, Math.min(1, R[2][2]))) / deg;

// --------------------------------------------------------------- trip
function newTrip() {
  trip = { start: Date.now(), samples: 0, okSamples: 0, maxTilt: 0, maxG: 0, score: 100,
           incidents: [], tiltInc: null, flipInc: null, lastShock: 0, lastDrop: 0 };
  series.tilt.length = 0; series.g.length = 0;
  fallRun = 0; lastStatusSent = ""; shownStatus = "";
  flashUntil = { warn: 0, crit: 0 };
  status = { level: "ok", text: "Parcel OK" };
  renderIncidents();
}

function addIncident(kind, level, text) {
  const inc = { kind, level, text, at: new Date(), t: Date.now() - trip.start };
  trip.incidents.push(inc);
  trip.score = Math.max(0, trip.score - PENALTY[kind]);
  flashUntil[level] = performance.now() + 2500;
  if (level === "crit") flash();
  logEvent(`Parcel: ${text}`, level === "crit" ? "warn" : "action");
  sendToPhone({ type: "parcel", level, text, score: trip.score, alert: true });
  renderIncidents();
  return inc;
}
const secondsSince = inc => ((Date.now() - trip.start - inc.t) / 1000).toFixed(1);

// --------------------------------------------------------- ingest + rules
function handlePose(m) {
  latest = m;
  lastMsg = performance.now();
  const R = rotation(m.alpha ?? 0, m.beta ?? 0, m.gamma ?? 0);
  const tilt = tiltOf(R);
  const g = (m.acc ?? 0) / G;
  const now = Date.now();

  trip.samples++;
  trip.maxTilt = Math.max(trip.maxTilt, tilt);
  trip.maxG = Math.max(trip.maxG, g);
  bucket.tilt = Math.max(bucket.tilt, tilt);
  bucket.g = Math.max(bucket.g, g);
  if (tilt <= rules.maxTilt) trip.okSamples++;

  // rule 1: upside down (never allowed)
  if (!trip.flipInc && tilt > FLIP_TILT) {
    trip.flipInc = addIncident("flip", "crit", "Upside down");
  } else if (trip.flipInc && tilt < FLIP_TILT - HYSTERESIS) {
    trip.flipInc.text = `Upside down for ${secondsSince(trip.flipInc)} s`;
    trip.flipInc = null; renderIncidents();
  }
  // rule 2: tilted beyond the limit - one incident per tilt, ended only once clearly back inside
  if (!trip.tiltInc && tilt > rules.maxTilt) {
    trip.tiltInc = addIncident("tilt", "warn", `Tilted beyond ${rules.maxTilt}°`);
    trip.tiltInc.peak = tilt;
  } else if (trip.tiltInc) {
    trip.tiltInc.peak = Math.max(trip.tiltInc.peak, tilt);
    if (tilt < rules.maxTilt - HYSTERESIS) {
      trip.tiltInc.text = `Tilted up to ${Math.round(trip.tiltInc.peak)}° for ${secondsSince(trip.tiltInc)} s`;
      trip.tiltInc = null; renderIncidents();
    }
  }
  // rule 3: shock above the limit
  if (g > rules.shockG && now - trip.lastShock > SHOCK_COOLDOWN_MS) {
    trip.lastShock = now;
    addIncident("shock", g > rules.shockG * 2 ? "crit" : "warn", `Shock ${g.toFixed(1)} g (limit ${rules.shockG} g)`);
  }
  // rule 4: free fall for ~100 ms or more = dropped
  fallRun = m.gmin != null && m.gmin < FREE_FALL ? fallRun + 1 : 0;
  if (fallRun >= FREE_FALL_SAMPLES && now - trip.lastDrop > DROP_COOLDOWN_MS) {
    trip.lastDrop = now;
    addIncident("drop", "crit", "Drop detected (free fall)");
  }

  // current state (the score is the whole trip; this is "right now")
  const t = performance.now();
  let level = "ok", text = "Parcel OK";
  if (trip.tiltInc || t < flashUntil.warn) { level = "warn"; text = trip.tiltInc ? `Tilted ${Math.round(tilt)}° · limit ${rules.maxTilt}°` : "Rough handling"; }
  if (trip.flipInc || t < flashUntil.crit) { level = "crit"; text = trip.flipInc ? "Upside down" : "Critical incident"; }
  status = { level, text };
  twin.poseState = text;
  const key = level + text.replace(/\d+°/, "");
  if (key !== lastStatusSent) {                 // only tell the phone when the status changes
    lastStatusSent = key;
    sendToPhone({ type: "parcel", level, text, score: trip.score });
  }
}

on("message", m => { if (m.type === "pose" && m.p === 1 && !demo) handlePose(m); });   // player 2 belongs to the games

// ------------------------------------------------------------- rendering
function flash() {
  $("pFlash").classList.add("on");
  setTimeout(() => $("pFlash").classList.remove("on"), 60);
}

function render() {
  if (latest) {
    const m = cssMatrix(rotation((latest.alpha ?? 0) - alpha0, latest.beta ?? 0, latest.gamma ?? 0));
    $("parcel3d").style.transform = m;
    $("phone3d").style.transform = m;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function setBadge(el, level, text, withIcon = true) {
  el.className = `badge ${el.id === "pBanner" ? "badge-lg " : ""}${LEVEL[level]?.badge ?? ""}`;
  el.innerHTML = `${withIcon ? icon(LEVEL[level]?.icon ?? "info", 15) : ""}<span></span>`;
  el.lastChild.textContent = text;
}

function renderIncidents() {
  const ul = $("pIncidents");
  $("pIncMeta").textContent = trip.incidents.length ? `${trip.incidents.length} recorded` : "";
  if (!trip.incidents.length) {
    ul.innerHTML = `<li class="empty">${icon("checkCircle", 22)}<span class="empty-title">No incidents</span>
      <span class="empty-desc">Tilts, flips, shocks and drops that break the shipping rules will be listed here.</span></li>`;
    return;
  }
  ul.replaceChildren(...trip.incidents.slice().reverse().map(inc => {
    const li = document.createElement("li");
    li.className = `incident ${inc.level}`;
    const time = inc.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    li.innerHTML = `<span class="ii">${icon(KIND[inc.kind].icon, 16)}</span>
      <div><div class="incident-title"></div><div class="incident-meta">${time} · ${(inc.t / 1000).toFixed(1)} s into trip</div></div>
      <span class="penalty">−${PENALTY[inc.kind]}</span>`;
    li.querySelector(".incident-title").textContent = inc.text;
    return li;
  }));
}

function grade(score) {
  return score >= 90 ? ["Excellent", "success"] : score >= 70 ? ["Good", "success"]
       : score >= 40 ? ["Damage likely", "warning"] : ["Damaged", "danger"];
}

function drawChart(id, data, max, limit, color) {
  const c = $(id), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  if (!W) return;                                 // section hidden
  if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#232932"; ctx.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(0, Math.round(H * f) + .5); ctx.lineTo(W, Math.round(H * f) + .5); ctx.stroke(); }
  const y = v => H - 4 - (Math.min(v, max) / max) * (H - 8);
  ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(242,102,94,.8)";
  ctx.beginPath(); ctx.moveTo(0, y(limit)); ctx.lineTo(W, y(limit)); ctx.stroke(); ctx.setLineDash([]);
  if (data.length < 2) {
    ctx.fillStyle = "#868e9a"; ctx.font = "12px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Waiting for sensor data", W / 2, H / 2 + 4);
    return;
  }
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
  data.forEach((v, i) => {
    const x = W - (data.length - 1 - i) * (W / (HISTORY - 1));
    i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v));
  });
  ctx.stroke();
}

setInterval(() => {
  const fresh = latest && performance.now() - lastMsg < STALE_MS;
  if (fresh) {
    series.tilt.push(bucket.tilt); series.g.push(bucket.g);
    for (const k in series) if (series[k].length > HISTORY) series[k].shift();
  }
  bucket = { tilt: 0, g: 0 };

  const stage = $("poseStage");
  const level = fresh ? status.level : "ok";
  stage.classList.toggle("stale", !fresh);
  stage.classList.toggle("warn", fresh && level === "warn");
  stage.classList.toggle("crit", fresh && level === "crit");

  const shown = fresh ? `${level}|${status.text}` : `stale|${demo ? 1 : 0}`;
  if (shown !== shownStatus) {                    // only touch the DOM when something changed
    shownStatus = shown;
    if (fresh) {
      setBadge($("pBanner"), level, status.text);
      setBadge($("pStatus"), level, status.text, false);
    } else {
      $("pBanner").className = "badge badge-lg";
      $("pBanner").innerHTML = `${icon("phone", 15)}<span>${demo ? "Starting trip" : "Waiting for the phone - tap Share motion sensors"}</span>`;
      $("pStatus").className = "badge"; $("pStatus").textContent = "No sensor data";
    }
    const live = $("pLive");
    live.className = `badge ${fresh ? "badge-accent" : ""}`;
    live.innerHTML = `<span class="dot ${fresh ? "on" : ""}"></span><span>${fresh ? (demo ? "Simulated trip" : "Live from phone") : "No sensor data"}</span>`;
  }

  const [gName, gKind] = grade(trip.score);
  $("pScore").textContent = trip.score;
  $("pGrade").className = `badge badge-${gKind}`;
  $("pGrade").textContent = gName;
  $("pScoreBar").style.width = trip.score + "%";
  $("pScoreBar").style.background = `var(--${gKind})`;

  if (latest) {
    const R = rotation((latest.alpha ?? 0) - alpha0, latest.beta ?? 0, latest.gamma ?? 0);
    $("pTilt").textContent = `${Math.round(tiltOf(R))}°`;
    $("pAlpha").textContent = `${Math.round(((((latest.alpha ?? 0) - alpha0) % 360) + 360) % 360)}°`;
    $("pBeta").textContent = `${Math.round(latest.beta ?? 0)}°`;
    $("pGamma").textContent = `${Math.round(latest.gamma ?? 0)}°`;
  }
  $("pMaxTilt").textContent = trip.samples ? `${Math.round(trip.maxTilt)}°` : "–";
  $("pMaxG").textContent = trip.samples ? `${trip.maxG.toFixed(1)} g` : "–";
  $("pUpright").textContent = trip.samples ? `${Math.round((trip.okSamples / trip.samples) * 100)}%` : "–";
  $("pIncCount").textContent = trip.incidents.length;
  const s = Math.floor((Date.now() - trip.start) / 1000);
  $("pDuration").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  drawChart("pTiltChart", series.tilt, 180, rules.maxTilt, "#7b96ff");
  drawChart("pShockChart", series.g, Math.max(4, rules.shockG * 2.5), rules.shockG, "#e0a83a");
}, SAMPLE_MS);

// -------------------------------------------------------------- controls
$("pNew").onclick = () => {
  newTrip();
  logEvent("Parcel: new shipment started", "action");
  toast("New shipment started - score reset to 100", "success");
};
$("pRecenter").onclick = () => {
  alpha0 = latest?.alpha ?? 0;
  toast("Heading recentered", "info");
};
document.querySelectorAll("#pModel button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#pModel button").forEach(x => x.classList.toggle("sel", x === b));
  $("parcel3d").classList.toggle("hidden", b.dataset.model !== "parcel");
  $("phone3d").classList.toggle("hidden", b.dataset.model !== "phone");
});
$("pMaxTiltRule").oninput = e => { rules.maxTilt = +e.target.value; $("pMaxTiltVal").textContent = `${rules.maxTilt}°`; };
$("pShockRule").onchange = e => { rules.shockG = +e.target.value; toast(`Shock limit set to ${rules.shockG} g`, "info"); };

$("pReport").onclick = () => {
  if (!trip.samples) return toast("No sensor data yet - share the phone's motion sensors or simulate a trip first", "info", 3600);
  const [gName] = grade(trip.score);
  const report = {
    report: "Smart parcel - delivery report",
    room: ROOM,
    generatedAt: new Date().toISOString(),
    shipmentStarted: new Date(trip.start).toISOString(),
    durationSeconds: Math.round((Date.now() - trip.start) / 1000),
    rules: { maxTiltDeg: rules.maxTilt, shockLimitG: rules.shockG, upsideDown: "never", drop: "never" },
    summary: {
      conditionScore: trip.score,
      verdict: gName,
      incidents: trip.incidents.length,
      maxTiltDeg: Math.round(trip.maxTilt),
      maxShockG: +trip.maxG.toFixed(2),
      timeWithinLimitsPct: Math.round((trip.okSamples / trip.samples) * 100),
    },
    incidents: trip.incidents.map(i => ({ at: i.at.toISOString(), secondsIntoTrip: +(i.t / 1000).toFixed(1),
                                           type: i.kind, severity: i.level, detail: i.text, penalty: PENALTY[i.kind] })),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  a.download = `parcel-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Delivery report downloaded", "success");
};

// ----------------------------------------------------------- simulation
// A scripted delivery trip (32 s): normal carrying with small wobbles,
// plus one of each incident so every rule can be shown without a phone.
const smooth = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (t, a, b, ramp = 0.8) => Math.min(smooth(t, a, a + ramp), 1 - smooth(t, b - ramp, b));
const SCRIPT = [
  [0, 5, "Picked up - carried by the courier"],
  [5, 9, "Courier leans the parcel over"],
  [9, 12, "Back on the van shelf"],
  [12, 13, "Pothole - a hard bump"],
  [13, 16, "Driving"],
  [16, 21, "Loaded upside down by mistake"],
  [21, 24, "Turned the right way up"],
  [24, 25.5, "Slips off the trolley - dropped"],
  [25.5, 32, "Delivered to the doorstep"],
];
const TRIP_SECONDS = 32;
function demoFrame(t) {
  const wob = (f, a) => a * Math.sin(t * f);
  const alpha = 20 * smooth(t, 0, 10) + wob(0.3, 5);
  const beta = wob(2.1, 4) + 180 * bump(t, 16, 21, 1);
  const gamma = wob(1.7, 3) + 62 * bump(t, 5, 9, 1);
  let acc = 0.3 + Math.abs(wob(5, 0.4));
  let gmin = 9.6;
  if (t >= 12 && t < 12.15) acc = 26;                       // pothole: ~2.7 g
  if (t >= 24.3 && t < 24.7) gmin = 0.6;                    // free fall
  if (t >= 24.7 && t < 24.85) acc = 42;                     // landing: ~4.3 g
  const caption = SCRIPT.find(([a, b]) => t >= a && t < b)?.[2] ?? "";
  return { msg: { type: "pose", alpha, beta, gamma, acc, gmin }, caption };
}
function stopDemo(finished) {
  clearInterval(demo); demo = null;
  $("pDemo").classList.remove("active");
  setButton($("pDemo"), "play", "Simulate delivery trip");
  $("pDemoStatus").textContent = finished
    ? `Trip complete - condition ${trip.score}/100 (${grade(trip.score)[0]}). Download the delivery report.` : "";
  if (finished) {
    logEvent(`Parcel: simulated trip delivered, score ${trip.score}`, "source");
    toast(`Trip delivered - condition ${trip.score}/100`, trip.score >= 70 ? "success" : "warning", 4000);
  }
}
$("pDemo").onclick = () => {
  if (demo) return stopDemo(false);
  newTrip();
  const t0 = performance.now();
  demo = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    if (t >= TRIP_SECONDS) return stopDemo(true);
    const { msg, caption } = demoFrame(t);
    $("pDemoStatus").textContent = `Simulated trip ${Math.floor(t)}/${TRIP_SECONDS} s · ${caption}`;
    handlePose(msg);
  }, 50);
  $("pDemo").classList.add("active");
  setButton($("pDemo"), "stop", "Stop simulation");
  logEvent("Parcel: simulated delivery trip started", "source");
};

newTrip();
