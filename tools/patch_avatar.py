root = r"C:\Projects\Digital-Twin\frontend"

# ---------------------------------------------------------------- index.html
p = root + r"\index.html"
h = open(p, encoding="utf-8").read()
css = """  /* GestureDeck avatar transition */
  .dk-av-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 7; }
  .dk-av { position: absolute; will-change: transform; filter: drop-shadow(0 6px 10px rgba(0,0,0,.4)); }
  .dk-av .av-svg { width: 100%; height: 100%; overflow: visible; }
  .dk-slide.pulled { transition: none; z-index: 5; opacity: 1; will-change: transform; }
  .dk-av .av-leg, .dk-av .av-arm, .dk-av .av-up { transform-box: view-box; }
  .dk-av .av-leg { transform-origin: 60px 142px; }
  .dk-av .av-arm { transform-origin: 60px 94px; }
  .dk-av .av-up { transform-origin: 60px 142px; transition: transform .25s ease; }
  .dk-av.walk .av-leg-a { animation: av-leg .46s ease-in-out infinite; }
  .dk-av.walk .av-leg-b { animation: av-leg .46s ease-in-out infinite reverse; }
  .dk-av.walk .av-arm-a { animation: av-arm .46s ease-in-out infinite reverse; }
  .dk-av.walk .av-arm-b { animation: av-arm .46s ease-in-out infinite; }
  .dk-av.pull .av-up { transform: rotate(16deg); }
  .dk-av.pull .av-arm { animation: none; transform: rotate(112deg); }
  .dk-av.pull .av-arm-b { transform: rotate(98deg); }
  .dk-av.pull .av-leg-a { animation-duration: .36s; }
  .dk-av.pull .av-leg-b { animation-duration: .36s; }
  @keyframes av-leg { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
  @keyframes av-arm { 0%, 100% { transform: rotate(-35deg); } 50% { transform: rotate(35deg); } }
  .av-preview { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); background: var(--surface-2); flex: none; }
  @media (prefers-reduced-motion: reduce) { .dk-av.walk .av-leg, .dk-av.walk .av-arm { animation-duration: 1s; } }
"""
anchor = "  /* GestureDeck */"
assert anchor in h
h = h.replace(anchor, css + anchor, 1)

card = """          <div class="card" id="dkAvatarCard">
            <div class="card-head"><i data-icon="user"></i><span class="card-title">Avatar transition</span></div>
            <p class="subtle" style="margin-bottom:8px">When you swipe, your avatar runs in, grabs the slide and pulls it away. Pick the face it wears.</p>
            <label class="field" style="cursor:pointer"><span class="field-label">Avatar pulls the slide</span><input type="checkbox" id="dkAvOn"></label>
            <label class="field" style="cursor:pointer"><span class="field-label">Also for keys and clicks</span><input type="checkbox" id="dkAvAll"></label>
            <div class="field" style="align-items:center"><img class="av-preview" id="dkAvFace" alt="The face your avatar wears">
              <span class="subtle" id="dkAvFaceMsg">No face chosen: the avatar has a default smile.</span></div>
            <div class="tool-group" style="flex-wrap:wrap;gap:6px;margin-top:8px">
              <button class="btn btn-sm" id="dkAvUpload"><i data-icon="upload" data-size="14"></i><span>Upload a photo</span></button>
              <button class="btn btn-sm" id="dkAvCam"><i data-icon="camera" data-size="14"></i><span>Use my camera</span></button>
              <button class="btn btn-sm btn-ghost" id="dkAvClear">Remove face</button>
              <button class="btn btn-sm btn-primary" id="dkAvTest"><span>Preview</span></button>
            </div>
            <input type="file" id="dkAvFile" accept="image/*" class="hidden">
            <p class="subtle" style="margin-top:8px">The photo is cropped to a square around its centre and stays in this browser. Camera: face the camera with Gestures on.</p>
          </div>
"""
a2 = """          <div class="card">
            <div class="card-head"><i data-icon="list"></i><span class="card-title">Slides</span>"""
assert a2 in h
h = h.replace(a2, card + a2, 1)
open(p, "w", encoding="utf-8").write(h)

# ---------------------------------------------------------------- deck.js
p = root + r"\js\deck.js"
s = open(p, encoding="utf-8").read()
s = s.replace('import { SwipeDetector } from "./deck/swipe.js";', 'import { SwipeDetector } from "./deck/swipe.js";\nimport { Avatar, faceFromFile, faceFromVideo } from "./deck/avatar.js";', 1)
s = s.replace('prefs.camSize ??= "m";', 'prefs.camSize ??= "m"; prefs.avatar ??= true; prefs.avatarAll ??= false;', 1)
s = s.replace('const stage = $("dkStage");', 'const stage = $("dkStage");\nconst avatar = new Avatar(stage);\nlet pulling = null;                      // the slide layer the avatar is pulling away, while it does', 1)

old_show_head = "async function show(i, instant = false) {"
assert old_show_head in s
s = s.replace(old_show_head, '''function endPull() {                       // finish an avatar transition at once (a newer slide was asked for)
  if (!pulling) return;
  const l = pulling; pulling = null;
  avatar.cancel();
  l.classList.remove("on", "pulled"); l.replaceChildren();
  front.style.transition = "";
}

async function show(i, instant = false, pull = null) {''', 1)
s = s.replace("  if (n !== showing) return;                                         // a newer request won\n  const frame",
              "  if (n !== showing) return;                                         // a newer request won\n  endPull();\n  const frame", 1)
old = '''  front.classList.add("on"); back.classList.remove("on");
  if (instant) back.replaceChildren();
  else setTimeout(() => { if (!back.classList.contains("on")) back.replaceChildren(); }, 260);'''
assert old in s
s = s.replace(old, '''  front.classList.add("on");
  if (pull && !instant && back.firstChild) {                          // the avatar pulls the old slide away
    const old = back; pulling = old;
    front.style.transition = "none";
    old.classList.add("on", "pulled");
    avatar.pull(old, pull).then(() => { if (pulling === old) { pulling = null; old.classList.remove("on", "pulled"); old.replaceChildren(); front.style.transition = ""; } });
  } else {
    back.classList.remove("on");
    if (instant) back.replaceChildren();
    else setTimeout(() => { if (!back.classList.contains("on")) back.replaceChildren(); }, 260);
  }''', 1)
s = s.replace("  show(cur);\n  if (how === \"gesture\") feedback(dir);",
              "  show(cur, false, (prefs.avatar && (how === \"gesture\" || prefs.avatarAll)) || how === \"avatar\" ? dir : null);\n  if (how === \"gesture\") feedback(dir);", 1)

s += '''

// ------------------------------------------------------------ avatar settings
function renderAvatar() {
  $("dkAvOn").checked = prefs.avatar; $("dkAvAll").checked = prefs.avatarAll;
  const img = $("dkAvFace");
  if (avatar.face) { img.src = avatar.face; img.classList.remove("hidden"); } else { img.removeAttribute("src"); }
  $("dkAvFaceMsg").textContent = avatar.face ? "Your face is on the avatar." : "No face chosen: the avatar has a default smile.";
}
$("dkAvOn").onchange = e => { prefs.avatar = e.target.checked; savePrefs(); };
$("dkAvAll").onchange = e => { prefs.avatarAll = e.target.checked; savePrefs(); };
$("dkAvUpload").onclick = () => $("dkAvFile").click();
$("dkAvFile").onchange = async e => {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  try { avatar.setFace(await faceFromFile(f)); renderAvatar(); toast("Face saved for the avatar", "success", 1800); }
  catch (err) { toast(err.message || "That image could not be read", "warning", 4000); }
};
$("dkAvCam").onclick = () => {
  if (!gesturesOn || vision.state !== "on") { toast("Turn Gestures on first, then look at the camera", "warning", 3500); return; }
  try { avatar.setFace(faceFromVideo($("dkVideo"))); renderAvatar(); toast("Face taken from the camera", "success", 1800); }
  catch (err) { toast(err.message, "warning", 3500); }
};
$("dkAvClear").onclick = () => { avatar.setFace(null); renderAvatar(); };
$("dkAvTest").onclick = () => {
  if (!deck) { toast("Open a presentation first", "warning", 2500); return; }
  const dir = cur < deck.count - 1 ? "next" : "prev";
  go(dir === "next" ? cur + 1 : cur - 1, "avatar");
};
renderAvatar();
'''
open(p, "w", encoding="utf-8").write(s)
print("ok")
