// nav.js - left navigation: switch between the twins (sections).
// The choice is kept in the URL hash (#hand / #pose) and sent to the phone,
// so the phone can highlight the sensor that the open twin needs.

import { on, sendToPhone, logEvent } from "./core.js";

const SECTIONS = ["hand", "pose"];
let current = null;

export function showSection(name) {
  if (!SECTIONS.includes(name) || name === current) return;
  current = name;
  document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.section === name));
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === `sec-${name}`));
  history.replaceState(null, "", `${location.pathname}${location.search}#${name}`);
  sendToPhone({ type: "mode", mode: name });
  logEvent(`Opened ${name === "hand" ? "Hand drawing" : "Phone pose twin"}`, "source");
}

document.querySelectorAll(".navbtn").forEach(b => b.onclick = () => showSection(b.dataset.section));
on("phoneConnected", () => sendToPhone({ type: "mode", mode: current }));

showSection(SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "hand");
