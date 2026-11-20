// config.js - where the backend lives, and which private room this page uses.

// >>> After deploying the backend, put its URL here (no trailing slash). <<<
// You can also override it per visit with ?backend=https://your-backend.vercel.app
const DEFAULT_BACKEND = "https://digitaltwin-hand-backend-two.vercel.app";
const LOCAL_BACKEND = "http://localhost:8000";   // used when the page itself runs on localhost

const params = new URLSearchParams(location.search);
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

export const BACKEND_OVERRIDE = params.get("backend");
export const BACKEND_URL = (BACKEND_OVERRIDE || (isLocal ? LOCAL_BACKEND : DEFAULT_BACKEND)).replace(/\/$/, "");
export const WS_BASE = BACKEND_URL.replace(/^http/, "ws");   // http -> ws, https -> wss

// A room is a private channel: one twin page + the phone(s) that scanned its QR code.
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I confusion
function newRoom() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join("");
}
export function roomFromUrl() {
  const r = (params.get("room") || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(r) ? r : null;
}
// Twin page: reuse the room in the URL, or create one and put it in the URL (so refresh keeps it).
export function ensureRoom() {
  let room = roomFromUrl();
  if (!room) {
    room = newRoom();
    const u = new URL(location.href);
    u.searchParams.set("room", room);
    history.replaceState(null, "", u);
  }
  return room;
}
