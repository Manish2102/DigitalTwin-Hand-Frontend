// ui.js - small shared UI behaviours: toasts and copy-to-clipboard.
import { icon } from "./icons.js";

const KIND_ICON = { success: "checkCircle", info: "info", warning: "alert", danger: "octagon" };

// Brief, non-blocking confirmation in the bottom-right corner.
export function toast(message, kind = "info", ms = 2800) {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.innerHTML = `${icon(KIND_ICON[kind] ?? "info", 16)}<span></span>`;
  el.querySelector("span").textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, ms);
}

export async function copyText(text, label = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(`${label} to clipboard`, "success"); }
  catch { toast("Could not copy - select and copy it manually", "warning"); }
}
