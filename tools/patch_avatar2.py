import re
root = r"C:\Projects\Digital-Twin\frontend"

# ---- avatar.js small fix
p = root + r"\js\deck\avatar.js"
s = open(p, encoding="utf-8").read()
s = s.replace(', transformOrigin: "50% 100%" }', ' }')
s = s.replace("bottom:${bottom}px;left:0`;", "bottom:${bottom}px;left:0;transform-origin:50% 100%`;")
open(p, "w", encoding="utf-8").write(s)

# ---- index.html: css + card
p = root + r"\index.html"
h = open(p, encoding="utf-8").read()
a = h.index("  /* GestureDeck avatar transition */"); b = h.index("  /* GestureDeck */")
css = """  /* GestureDeck avatar transition */
  .dk-av-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 7; }
  .dk-av { position: absolute; will-change: transform; filter: drop-shadow(0 8px 12px rgba(0,0,0,.45)); }
  .dk-av .av-svg { width: 100%; height: 100%; overflow: visible; }
  .dk-slide.pulled { transition: none; z-index: 5; opacity: 1; will-change: transform; }
  .dk-slide.pulled .dk-frame { box-shadow: 0 14px 50px rgba(0,0,0,.65); }
  .dk-av .av-leg, .dk-av .av-arm, .dk-av .av-up, .dk-av .av-head, .dk-av .av-bob { transform-box: view-box; }
  .dk-av .av-leg { transform-origin: 80px 168px; }
  .dk-av .av-arm { transform-origin: 80px 122px; }
  .dk-av .av-up { transform-origin: 80px 170px; transition: transform .25s ease; }
  .dk-av .av-head { transform-origin: 80px 108px; }
  .dk-av .av-sweat { opacity: 0; }
  .dk-av.walk .av-bob { animation: av-bob .34s ease-in-out infinite; }
  .dk-av.walk .av-leg-a { animation: av-leg .34s ease-in-out infinite; }
  .dk-av.walk .av-leg-b { animation: av-leg .34s ease-in-out infinite reverse; }
  .dk-av.walk .av-arm-a { animation: av-arm .34s ease-in-out infinite reverse; }
  .dk-av.walk .av-arm-b { animation: av-arm .34s ease-in-out infinite; }
  .dk-av.walk .av-head { animation: av-wobble .34s ease-in-out infinite; }
  .dk-av.pull .av-up { transform: rotate(20deg); }
  .dk-av.pull .av-arm { animation: none; transform: rotate(118deg); }
  .dk-av.pull .av-arm-b { transform: rotate(104deg); }
  .dk-av.pull .av-bob { animation-duration: .5s; }
  .dk-av.pull .av-leg-a, .dk-av.pull .av-leg-b { animation-duration: .27s; }
  .dk-av.pull .av-head { animation: av-strain .12s linear infinite; }
  .dk-av.pull .av-sweat { opacity: 1; animation: av-drip .7s ease-in infinite; }
  .av-bubble { position: absolute; left: 50%; top: -6%; transform: translate(-50%, 10px) scale(.6) rotate(-6deg); opacity: 0; padding: 4px 12px; border-radius: 14px;
               background: #fff; color: #d6213f; font: 900 clamp(14px, 2.6vw, 26px)/1 Inter, system-ui, sans-serif; letter-spacing: .04em; white-space: nowrap;
               border: 3px solid #d6213f; transition: transform .18s cubic-bezier(.3,1.6,.5,1), opacity .12s; }
  .av-bubble.show { opacity: 1; transform: translate(-50%, 0) scale(1) rotate(-6deg); }
  .av-dust { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: rgba(230,232,240,.8); filter: blur(1.5px); }
  @keyframes av-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
  @keyframes av-leg { 0%, 100% { transform: rotate(-38deg); } 50% { transform: rotate(38deg); } }
  @keyframes av-arm { 0%, 100% { transform: rotate(-45deg); } 50% { transform: rotate(45deg); } }
  @keyframes av-wobble { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
  @keyframes av-strain { 0%, 100% { transform: rotate(-2deg) translateX(-1.5px); } 50% { transform: rotate(2deg) translateX(1.5px); } }
  @keyframes av-drip { 0% { transform: translateY(-4px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(16px); opacity: 0; } }
  .av-slot { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .av-preview { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); background: var(--surface-2); flex: none; }
  .av-slot .av-lbl { flex: 1; min-width: 0; font-size: var(--fs-sm); }
  .av-slot .av-btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
  @media (prefers-reduced-motion: reduce) { .dk-av.walk .av-leg, .dk-av.walk .av-arm, .dk-av.walk .av-head, .dk-av.walk .av-bob { animation-duration: 1s; } }
"""
h = h[:a] + css + h[b:]

a = h.index('          <div class="card" id="dkAvatarCard">'); b = h.index('          <div class="card">\n            <div class="card-head"><i data-icon="list"></i><span class="card-title">Slides</span>')
card = """          <div class="card" id="dkAvatarCard">
            <div class="card-head"><i data-icon="user"></i><span class="card-title">Avatar transition</span></div>
            <p class="subtle" style="margin-bottom:8px">When you swipe, a big-headed avatar sprints in, grabs the slide and hauls it away. Give it your face: one picture for swipes to the right and one for swipes to the left. <b>If you add only one, it is used for both.</b></p>
            <label class="field" style="cursor:pointer"><span class="field-label">Avatar pulls the slide</span><input type="checkbox" id="dkAvOn"></label>
            <label class="field" style="cursor:pointer"><span class="field-label">Also for keys and clicks</span><input type="checkbox" id="dkAvAll"></label>
            <div id="dkAvSlots"></div>
            <div class="tool-group" style="flex-wrap:wrap;gap:6px;margin-top:10px">
              <button class="btn btn-sm btn-primary" id="dkAvTestNext"><span>Preview: next</span></button>
              <button class="btn btn-sm btn-primary" id="dkAvTestPrev"><span>Preview: previous</span></button>
            </div>
            <input type="file" id="dkAvFile" accept="image/*" class="hidden">
            <p class="subtle" style="margin-top:8px">Photos are cropped to a square around the centre and stay in this browser. For the camera option, turn Gestures on and face the camera.</p>
          </div>
"""
h = h[:a] + card + h[b:]
open(p, "w", encoding="utf-8").write(h)

# ---- deck.js
p = root + r"\js\deck.js"
s = open(p, encoding="utf-8").read()
a = s.index("// ------------------------------------------------------------ avatar settings")
s = s[:a] + '''// ------------------------------------------------------------ avatar settings
// "right" = the face for a swipe to the right (next slide, unless "reverse" is on), "left" = for a swipe to the left.
const SLOTS = [["right", "Swipe right (next slide)"], ["left", "Swipe left (previous slide)"]];
const sideFor = dir => (dir === "next") !== prefs.reverse ? "right" : "left";
let faceTarget = "right";
function renderAvatar() {
  $("dkAvOn").checked = prefs.avatar; $("dkAvAll").checked = prefs.avatarAll;
  $("dkAvSlots").innerHTML = SLOTS.map(([side, label]) => {
    const own = avatar.faces[side], shown = avatar.faceFor(side);
    const msg = own ? "Your picture." : shown ? "Using the other picture." : "None yet: default goofy face.";
    return `<div class="av-slot"><img class="av-preview" alt="Face for ${label}" ${shown ? `src="${shown}"` : ""} style="${shown ? "" : "visibility:hidden"}">
      <div class="av-lbl"><b>${label}</b><div class="subtle">${msg}</div>
        <div class="av-btns"><button class="btn btn-sm" data-av="up" data-side="${side}">Upload</button><button class="btn btn-sm" data-av="cam" data-side="${side}">Camera</button>${own ? `<button class="btn btn-sm btn-ghost" data-av="rm" data-side="${side}">Remove</button>` : ""}</div></div></div>`;
  }).join("");
}
$("dkAvSlots").onclick = e => {
  const b = e.target.closest("[data-av]"); if (!b) return;
  const side = b.dataset.side;
  if (b.dataset.av === "up") { faceTarget = side; $("dkAvFile").click(); }
  else if (b.dataset.av === "rm") { avatar.setFace(side, null); renderAvatar(); }
  else {
    if (!gesturesOn || vision.state !== "on") { toast("Turn Gestures on first, then look at the camera", "warning", 3500); return; }
    try { avatar.setFace(side, faceFromVideo($("dkVideo"))); renderAvatar(); toast("Face taken from the camera", "success", 1800); }
    catch (err) { toast(err.message, "warning", 3500); }
  }
};
$("dkAvOn").onchange = e => { prefs.avatar = e.target.checked; savePrefs(); };
$("dkAvAll").onchange = e => { prefs.avatarAll = e.target.checked; savePrefs(); };
$("dkAvFile").onchange = async e => {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  try { avatar.setFace(faceTarget, await faceFromFile(f)); renderAvatar(); toast("Face saved for the avatar", "success", 1800); }
  catch (err) { toast(err.message || "That image could not be read", "warning", 4000); }
};
function previewPull(dir) {
  if (!deck) { toast("Open a presentation first", "warning", 2500); return; }
  if (dir === "next" ? cur >= deck.count - 1 : cur <= 0) { toast(dir === "next" ? "You are on the last slide" : "You are on the first slide", "warning", 2000); return; }
  go(dir === "next" ? cur + 1 : cur - 1, "avatar");
}
$("dkAvTestNext").onclick = () => previewPull("next");
$("dkAvTestPrev").onclick = () => previewPull("prev");
renderAvatar();
'''
# the pull call: pass the under layer and the side
s = s.replace("avatar.pull(old, pull).then(", "avatar.pull(old, pull, { underEl: front, side: sideFor(pull) }).then(")
s = s.replace('$("dkReverse").onchange = e => { prefs.reverse = e.target.checked; savePrefs(); renderGestureUi(); };',
              '$("dkReverse").onchange = e => { prefs.reverse = e.target.checked; savePrefs(); renderGestureUi(); renderAvatar?.(); };')
open(p, "w", encoding="utf-8").write(s)
print("ok")
