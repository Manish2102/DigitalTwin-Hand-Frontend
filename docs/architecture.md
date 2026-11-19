# Frontend architecture

The app is a **static site with no build step and no framework**: plain HTML, CSS and ES modules.
The only third-party code is loaded from CDNs: QR code generation on the twin page (`qrcodejs`), the
hand-tracking model on the phone page (MediaPipe Tasks Vision), and the Inter font. The Object to 3D section
loads Three.js, Transformers.js and MediaPipe from CDNs the first time it is used (see [deployment.md](deployment.md#external-resources)).

## Two pages

| Page | Runs on | Role |
|---|---|---|
| `index.html` | The laptop (or any browser) | The **twin**: models, rules, drawing, charts, controls |
| `phone.html` | The phone | The **sensor**: camera and motion sensors, streaming, feedback display |

They share `css/design.css`, `js/config.js` and `js/icons.js`. They communicate only through the
backend, using the [protocol](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md).

## Module graph (twin page)

`index.html` loads `js/icons.js` and `js/app.js` as ES modules.

```
app.js
 ├─ core.js ─────────── config.js, icons.js, ui.js   (the hand twin core, data link, event bus)
 ├─ simulator.js ────── core.js, icons.js
 ├─ recorder.js ─────── core.js, icons.js, ui.js
 ├─ analytics.js ────── core.js, icons.js, ui.js
 ├─ predictor.js ────── core.js
 ├─ pose.js ─────────── core.js, icons.js, ui.js     (the parcel twin)
 ├─ nav.js ──────────── core.js                       (app shell navigation)
 └─ games.js ────────── core.js, nav.js, config.js, icons.js, ui.js
     ├─ games/engine.js ── core.js, games/input.js     (loop, scores, sound)
     ├─ games/input.js ─── core.js                      (phone data -> tilt / hand / shake)
     └─ games/marble.js, slicer.js, glider.js, rps.js, shake.js, pong.js  (each imports engine.js)
 └─ scan.js ─────────── core.js, icons.js, ui.js     (Object to 3D; no backend, no phone)
     ├─ scan/camera.js, library.js                     (webcam and photo input; IndexedDB)
     ├─ scan/segment.js ─── MediaPipe interactive segmenter (loaded on first use)
     ├─ scan/depth.js ───── scan/depth.worker.js       (Transformers.js depth model, in a Web Worker)
     ├─ scan/mesh.js ────── pure functions, tested in Node
     └─ scan/viewer.js ──── Three.js (loaded on first model, through the import map)
```

`app.js` imports every module for its side effects and then calls `start()` from `core.js`:

```js
import { start } from "./core.js";
import "./simulator.js"; import "./recorder.js"; import "./analytics.js";
import "./predictor.js"; import "./pose.js"; import "./nav.js"; import "./games.js"; import "./scan.js";
start();
```

Feature modules never import each other. They talk to the core through the event bus and a handful of
exports, so removing a line from `app.js` removes that feature and the rest keeps working (provided its
DOM is also removed, see below). Two small exceptions: `games.js` imports `nav.js` (to tell the phone which game is open)
and the games import the game engine, which is their own runtime. See [games.md](games.md). `scan.js` is self-contained and only
uses the core for `$`, the `section` event (to switch the camera off) and the shared icon and toast helpers. See [object-scanner.md](object-scanner.md).

## The DOM contract

Modules bind to elements by `id` at load time (`$("clear").onclick = ...`). A missing id throws and stops
the app, which is intentional: it fails loudly instead of silently missing a control.

| Module | Elements it expects |
|---|---|
| `core.js` | `drawLayer`, `handLayer`, `viewport`, `handEmpty`, `palette`, `colorPick`, `customColor`, `sizes`, `undo`, `clear`, `save`, `fingers`, `gesture`, `gestureIcon`, `rate`, `age`, `phoneFps`, `rtt`, `state`, `source`, header chips (`roomCode`, `conn`, `conn2`, `connDot`, `connDot2`, `connPill`, `copyRoom`), modal (`hint`, `hintClose`, `hintDone`, `connectBtn`, `qr`, `phoneUrl`, `copyLink`, `newRoom`) |
| `simulator.js` | `simBtn`, `simStatus` |
| `recorder.js` | `recBtn`, `replayBtn`, `speedSel`, `dlBtn`, `loadBtn`, `loadInput`, `recInfo`, `replayBar` |
| `analytics.js` | `aSpeed`, `aSteady`, `aStalls`, `aStrokes`, `chart`, `gBar`, `gLegend`, `aReset`, `log` |
| `predictor.js` | `predOn`, `predH`, `predHVal`, `predErr`, `baseErr`, `predGain` |
| `pose.js` | `pDemo`, `pDemoStatus`, `pNew`, `pRecenter`, `pModel`, `pReport`, `parcel3d`, `phone3d`, `poseStage`, `pBanner`, `pLive`, `pStatus`, `pScore`, `pGrade`, `pScoreBar`, `pTilt`, `pMaxTilt`, `pMaxG`, `pUpright`, `pIncCount`, `pDuration`, `pMaxTiltRule`, `pMaxTiltVal`, `pShockRule`, `pTiltChart`, `pShockChart`, `pAlpha`, `pBeta`, `pGamma`, `pIncidents`, `pIncMeta`, `pFlash` |
| `nav.js` | `shell`, `crumb`, `pageTitle`, `pageDesc`, `sourceChip`, `collapseBtn`, `menuBtn`, `scrim`, plus `.nav-item[data-section]` buttons and `.section#sec-<name>` panels |
| `scan.js` | `scCam`, `scMain`, `scUpload`, `scFile`, `scRetake`, `scTabs`, `scReset`, `scGlb`, `scStl`, `scSave`, `scStage`, `scVideo`, `scPhoto`, `scDepth`, `scView`, `scBanner`, `scEmpty`, `scSteps`, `scProgWrap`, `scProg`, `scWhole`, `scDevice`, `scStats`, `scStrength(V)`, `scSmooth(V)`, `scThick(V)`, `scWidth`, `scName`, `scLit`, `scWire`, `scFree`, `scLib`, `scLibMeta` |
| `games.js` | `gMenu`, `gGrid`, `gPlay`, `gBack`, `gTitle`, `gState`, `gModes`, `gP2`, `gCalibrate`, `gPause`, `gSound`, `gCanvas`, `gFrame`, `gOverlay`, `gHow`, `gControllers`, `gScores`, `gScoresMeta`, `gClearScores`, player 2 modal (`p2Modal`, `p2Close`, `p2Done`, `qr2`, `p2Url`, `copyP2`) |

## The event bus

`core.js` exports a tiny publish/subscribe bus. Modules subscribe with `on(name, fn)`; only the core
emits (feature modules call `logEvent`, which emits `event`).

| Event | Payload | Emitted when | Used by |
|---|---|---|---|
| `frame` | the raw `hand` message | Every accepted input frame, before processing | recorder |
| `state` | `{ t, pointer, tip }` | After a frame with a hand was processed (`pointer` smoothed, `tip` raw) | analytics, predictor |
| `lost` | none | The hand left the view | analytics, predictor |
| `gesture` | `{ from, to }` | The debounced gesture changed | (available) |
| `source` | `"phone" \| "simulation" \| "replay"` | The hand data source changed | simulator, recorder, analytics, predictor |
| `event` | `{ text, kind, time }` | `logEvent(...)` was called | analytics (activity log) |
| `render` | `{ ctx, rect, age }` | Each animation frame while a fresh hand is shown | predictor (ghost cursor) |
| `message` | any non-`hand`, non-`ping` message from the phone (each carries `p`, the player number) | A message arrives (for example `pose`) | pose |
| `raw` | any message from any phone, with `p` | Every message, before routing | games input |
| `phoneConnected` | player number (`1` or `2`) | The first message arrives from a phone that was considered offline | nav (sends `mode`), games |
| `phoneLeft` | player number | A phone has been silent for 3 s | (available) |
| `section` | `"hand" \| "pose" \| "games" \| "scan"` | The open section changed | games (pause and stop the loop when leaving), scan (switch the camera off when leaving) |

Log `kind` values (colour the activity dot): `info`, `ok`, `warn`, `action`, `source`, `gesture`.

## Shared state

One object, `twin`, exported from `core.js`:

| Field | Meaning |
|---|---|
| `source` | `phone`, `simulation` or `replay`: where hand frames are accepted from |
| `section` | Which section is open (`hand`, `pose`, `games`, `scan`). The hand twin only draws and clears while it is `hand`. |
| `phones`, `players` | How many phones were heard from in the last 3 s, and which player slots (`1`, `2`) are live |
| `landmarks`, `handedness`, `fingers`, `gesture`, `pointer` | Current hand state |
| `color`, `width`, `strokes` | Pen colour, brush size, and the drawing |
| `aspect` | Camera aspect ratio (shapes the drawing area) |
| `poseState` | Parcel status text (written by `pose.js`, sent to the phone in `feedback`) |
| `lastUpdate`, `phoneFps`, `rtt`, `rate` | Link health numbers |

`pose.js` keeps its own state privately (trip, incidents, rules) and shares nothing except `poseState`.

## Rooms and backend configuration

[`js/config.js`](../js/config.js) decides which backend to talk to and which room to use.

| Export | Behaviour |
|---|---|
| `BACKEND_URL` | `?backend=` query parameter if present; otherwise `http://localhost:8000` on `localhost`/`127.0.0.1`; otherwise `DEFAULT_BACKEND` |
| `WS_BASE` | `BACKEND_URL` with `http` replaced by `ws` (so `https` becomes `wss`) |
| `ensureRoom()` | Reads `?room=`, or creates a 6-character code and writes it into the URL with `history.replaceState` so a refresh keeps the same room |
| `roomFromUrl()` | Reads and validates `?room=` (4 to 12 characters `A-Z 0-9`); the phone page uses it |

The room alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I`), generated with
`crypto.getRandomValues`.

The QR code and the copy link point to `phone.html?room=<ROOM>`, plus `&backend=...` only when the
twin page itself was opened with a `?backend=` override.

## Data flow

### Hand frame, phone to screen

```
phone: video frame -> MediaPipe -> 21 joints -> {"type":"hand", ...}  (<= 30/s)
  ->  backend relay
  ->  core.js ws.onmessage
        phoneSeen()                      mark the phone as connected
        ingest(m, "phone")
          ignore unless twin.source === "phone"
          emit("frame")                  recorder captures it here
          un-mirror x if m.mirrored
          fingersUp() -> classify() -> debounce (3 identical results) -> setGesture()
          smooth the index tip (exponential, factor 0.5) -> twin.pointer
          emit("state")                  analytics and predictor update
          act: draw a segment, or run the palm-hold-to-clear timer
  ->  render() next animation frame draws skeleton, pointer, overlays (emit "render")
```

### Parcel reading, phone to screen

```
phone: deviceorientation + devicemotion -> {"type":"pose", ...}  (20/s)
  ->  backend relay
  ->  core.js ws.onmessage -> emit("message")
  ->  pose.js handlePose()
        rotation matrix -> tilt; acc -> g; gmin -> free-fall run
        rules -> incidents -> score
        status -> sendToPhone({type:"parcel"}) when it changes
  ->  render() applies the 3D transform; a 250 ms timer refreshes numbers and charts
```

### Feedback, screen to phone

| Trigger | Message |
|---|---|
| Gesture change, colour change, canvas cleared, phone connects | `feedback` |
| Parcel status change, new incident | `parcel` |
| Section switch, phone connects | `mode` |
| Phone `ping` | `pong` |

## Rendering

### Hand canvas

Two stacked canvases fill `#viewport`:

| Canvas | Content | Redrawn |
|---|---|---|
| `drawLayer` | The strokes | Incrementally (one segment per frame) and fully on resize or undo |
| `handLayer` | Skeleton, pointer ring, palm progress ring, predictor ghost | Every animation frame |

- **Coordinates are normalized** (0 to 1 of the camera image) everywhere, including stored strokes.
  `viewRect()` computes the largest rectangle with the camera's aspect ratio that fits the canvas, and
  `toPx()` maps a normalized point into it. The drawing therefore survives window resizes unchanged.
- Canvases are scaled by `devicePixelRatio` for sharpness, and a `ResizeObserver` on `#viewport` keeps
  them in step with layout changes (such as the toolbar wrapping).
- A hand frame older than 300 ms is drawn faded; older than 1000 ms it is hidden.

### Parcel stage

Pure **CSS 3D** with no library: a `perspective` stage, a tilted floor, and a model made of absolutely
positioned faces. One `matrix3d(...)` transform per animation frame rotates the model. See
[pose-twin.md](pose-twin.md#3d-model).

### Charts

Small hand-drawn `<canvas>` line charts (30 s for hand analytics, 60 s for the parcel), sampled every
250 ms, with a light grid and an empty-state message when there is no data.

## State that survives reloads

| What | Where |
|---|---|
| Room | The `?room=` query parameter |
| Open twin | The `#hand` / `#pose` URL hash |
| Sidebar collapsed or not | `localStorage` key `dtl.sidebar` |

Drawings, recordings, parcel trips and incidents are held in memory only and are lost on reload.
Recordings and delivery reports can be downloaded as JSON.

## Error handling and resilience

| Situation | Behaviour |
|---|---|
| Backend connection drops | `ws.onclose` reconnects after 1 s on both pages |
| Messages lost during a gap | Ignored: each reading supersedes the previous one |
| Phone goes quiet | After 3 s without a message the twin marks it offline and shows a toast |
| Local storage unavailable | Wrapped in `try/catch`; the app works without it |
| Unknown message type | Ignored |
| No sensor data | Empty states and "waiting" badges instead of stale numbers |
