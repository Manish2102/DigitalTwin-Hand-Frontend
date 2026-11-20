// nav.js - app shell navigation: switch between the twins (sections),
// keep the page header (breadcrumb, title, description) in sync, collapse the
// sidebar on desktop and open it as a drawer on small screens.
// The open section is kept in the URL hash (#hand / #pose) and sent to the phone,
// so the phone can highlight the sensor that the open twin needs.

import { on, emit, twin, sendToPhone, logEvent, $ } from "./core.js";

const SECTIONS = {
  hand: { title: "Hand drawing", desc: "A live virtual copy of your hand, built from the phone's camera. Draw with gestures." },
  pose: { title: "Phone pose twin", desc: "Smart parcel monitor: the phone is the sensor tag on a fragile parcel in transit." },
  games: { title: "Arcade", desc: "Twelve browser games: the phone as the controller (tilt, shake, hand), or the laptop camera tracking your hand." },
  scan: { title: "Object to 3D", desc: "Show an object to the laptop webcam: an AI model estimates its depth and builds a 3D model you can rotate and export." },
  deck: { title: "GestureDeck", desc: "Present your own PowerPoint or PDF and change slides with a swipe of your hand, seen by the laptop camera." },
  sign: { title: "Sign language", desc: "Indian Sign Language to text: sign to the laptop camera and read the words as you sign." },
  signdemo: { title: "Sign twin", desc: "" },
};
// The games add what the phone needs to know (which sensor, which game); see games.js
let modeExtra = () => ({});
export function setModeExtra(fn) { modeExtra = fn; }
export function resendMode() { sendToPhone({ type: "mode", mode: current, ...(current === "games" ? modeExtra() : {}) }); }
let current = null;
const shell = $("shell");

export function showSection(name) {
  if (!SECTIONS[name] || name === current) return;
  current = name;
  document.querySelectorAll(".nav-item").forEach(b => {
    const on = b.dataset.section === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === `sec-${name}`));
  $("crumb").textContent = $("pageTitle").textContent = SECTIONS[name].title;
  $("pageDesc").textContent = SECTIONS[name].desc;
  $("sourceChip").style.display = name === "hand" ? "" : "none";   // hand data source only matters there
  document.title = `${SECTIONS[name].title} · Digital Twin Lab`;
  history.replaceState(null, "", `${location.pathname}${location.search}#${name}`);
  shell.classList.remove("nav-open");
  twin.section = name;
  emit("section", name);
  resendMode();
  logEvent(`Opened ${SECTIONS[name].title}`, "source");
}

document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => showSection(b.dataset.section));
on("phoneConnected", resendMode);

// collapsible sidebar (remembered per browser)
function setCollapsed(c) {
  shell.classList.toggle("collapsed", c);
  $("collapseBtn").setAttribute("aria-label", c ? "Expand sidebar" : "Collapse sidebar");
  try { localStorage.setItem("dtl.sidebar", c ? "collapsed" : "open"); } catch {}
}
try { setCollapsed(localStorage.getItem("dtl.sidebar") === "collapsed"); } catch { setCollapsed(false); }
$("collapseBtn").onclick = () => setCollapsed(!shell.classList.contains("collapsed"));

// drawer on small screens
$("menuBtn").onclick = () => shell.classList.add("nav-open");
$("scrim").onclick = () => shell.classList.remove("nav-open");

showSection(SECTIONS[location.hash.slice(1)] ? location.hash.slice(1) : "hand");
