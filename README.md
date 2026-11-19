# Digital Twin Lab - Frontend

Your phone is the sensor and this web page is the **live virtual copy** (the digital twin).
The app has two twins and an arcade, which you choose in the sidebar. One phone can feed all of them.

| Section | Physical thing | Phone sensor | What the twin does |
|---|---|---|---|
| **Hand drawing** | Your hand | Camera + on-device hand tracking | Mirrors the hand skeleton, recognizes gestures, draws with your finger |
| **Phone pose twin** | A fragile parcel (the phone is its sensor tag) | Gyroscope + accelerometer | Mirrors the parcel in 3D, enforces shipping rules, scores its condition, writes a delivery report |
| **Object to 3D** | Any object you hold up | The laptop webcam | Cuts the object out, estimates depth with AI, builds a solid 3D model to rotate, export and save |
| **GestureDeck** | You, presenting | The laptop webcam | Opens your own .pptx or .pdf in the browser; a hand swipe changes the slide (right = next, left = previous) |
| **Sign language** | A person signing Indian Sign Language | The laptop webcam | Recognises ISL words and fingerspelled letters and numbers and writes them as text (and can speak it) |
| **Arcade** | You, with the phone as a controller or your hand in front of the laptop camera | Tilt, shaking, phone camera or laptop webcam hand tracking | Twelve browser games: six for the phone (marble maze, fruit slicer, glider, rock paper scissors, shake duel, tilt pong; one or two players) and six for the laptop camera (air cricket, flick carrom, snooker coach, robot arm twin, air slides, office twin) |

Backend (WebSocket relay): [DigitalTwin-Hand-Backend](https://github.com/Manish2102/DigitalTwin-Hand-Backend)

## Documentation

Full documentation is in [`docs/`](docs/README.md):
[architecture](docs/architecture.md) ·
[hand twin](docs/hand-twin.md) ·
[phone pose twin](docs/pose-twin.md) ·
[arcade games](docs/games.md) ·
[object to 3D](docs/object-scanner.md) ·
[phone page](docs/phone-page.md) ·
[design system](docs/design-system.md) ·
[deployment](docs/deployment.md) ·
[extending](docs/extending.md).
The wire protocol and relay design are documented in the
[backend repository](https://github.com/Manish2102/DigitalTwin-Hand-Backend/tree/main/docs).

```
 Physical side: phone (phone.html)                        Virtual side: laptop (index.html)
   camera -> MediaPipe -> 21 hand joints --+              +--> Hand twin: skeleton, gestures, drawing
   motion sensors -> angles, shock, fall --+--wss-> backend --+--> Parcel twin: 3D parcel, rules, incidents
   shows status, vibrates  <------------------- feedback <-------------
```

## How to use

1. Open the site on a laptop. You get a **private room** (shown in the page header) and a QR code.
   **Connect phone** in the sidebar shows the QR code again.
2. Scan it with your phone, which can be on any network (Wi-Fi or mobile data).
3. Pick a twin in the sidebar. The phone highlights the sensor that twin needs.

### Hand drawing

On the phone, tap **Start camera** and show one hand.

| Gesture | Action |
|---|---|
| Index finger up | Draw |
| Index + middle up | Move without drawing |
| Open palm, held 1 s | Clear |
| Fist | Pause |

Toolbar: pen colours and a custom colour, brush size, undo (Ctrl+Z), clear, save PNG,
**Simulate hand**, and record / replay / download / load. The side panel shows twin state,
analytics, prediction (fingertip forecast 0–300 ms ahead), a gesture guide and an activity log.

### Phone pose twin - smart parcel monitor

Scenario: the phone is the sensor tag on a fragile parcel (lab samples, glassware, electronics) in transit.
On the phone, tap **Share motion sensors**. Tilt it, flip it, bump it, or drop it onto a bed or sofa.

| Rule | Detected from | Penalty |
|---|---|---|
| Tilt beyond the limit (default 45°, adjustable) | Orientation | −5 |
| Upside down (never allowed) | Orientation | −15 |
| Shock above the limit (default 2.0 g, adjustable) | Accelerometer | −10 |
| Drop (free fall for 100 ms or more) | Accelerometer: total acceleration near 0 | −20 |

To avoid false alarms from normal handling:
- An incident ends only once the reading is 8° back inside the limit, so wobbling at the limit counts once.
- Shocks have a 1.5 s cooldown.
- A drop needs at least 100 ms of free fall, not a single low reading.

What you see:
- a 3D parcel (or the phone itself) that follows the real phone
- a status badge, with the stage outlined amber or red when a rule is broken
- a condition score and grade for the whole trip
- live tilt and shock charts with limit lines
- an incident timeline
- a downloadable **delivery report** (JSON)

The phone shows the parcel status and vibrates on each incident.
**Simulate delivery trip** plays a scripted 32-second trip with no phone.

### Arcade - games with the phone or the laptop camera

Pick **Arcade** in the sidebar, choose a game, press **Start**. For phone games, the phone highlights the sensor the game needs.
For laptop camera games, press **Start camera and play**: hand tracking runs in the browser and the picture never leaves the laptop.

| Game | Sensor | Players |
|---|---|---|
| Marble Maze | Tilt | 1 |
| Fruit Slicer | Hand camera | 1 |
| Sky Glider | Hand camera | 1 |
| Rock Paper Scissors | Hand camera | 1 vs computer, or 2 |
| Shake Duel | Accelerometer | 1 or 2 |
| Tilt Pong | Tilt | 1 vs computer, or 2 |
| Air Cricket | Laptop camera | 1 |
| Flick Carrom | Laptop camera | 1 |
| Snooker Coach | Laptop camera | 1 |
| Robot Arm Twin | Laptop camera | 1 |
| Air Slides | Laptop camera | 1 (presenter, not scored) |
| Office Twin | Laptop camera | 1 (live twin, not scored) |

For two players, press **Add player 2** and scan the second QR code with another phone. Every game also works with the
keyboard and mouse, and the phone vibrates on hits and scores. Best scores are kept in the browser.

### GestureDeck - present with a swipe

Pick **GestureDeck**, open a PowerPoint (.pptx) or PDF, press **Present** for full screen and turn **Gestures** on.
Sweep an open hand to your right for the next slide, to your left for the previous one. A cooldown, a "hand must be
still first" rule and a return-stroke filter stop accidental changes; keys and clickers always work too.
Details: [docs/gesturedeck.md](docs/gesturedeck.md).

### Sign language - Indian Sign Language to text

Pick **Sign language**, start the camera, stand back so your hands and shoulders are in view, and sign one word at a
time (lower your hands between words), or switch to **Fingerspelling** for A to Z and 0 to 9. When it is not sure it
says so and offers suggestions instead of guessing. Trained on real ISL recordings (INCLUDE and an ISL fingerspelling
dataset). Details: [docs/sign-language.md](docs/sign-language.md); every supported sign with an illustration:
[docs/isl-reference.md](docs/isl-reference.md).

### Object to 3D - webcam to 3D model

Pick **Object to 3D**. This section uses the **laptop webcam** (or an uploaded photo); the phone is not needed.

1. **Start camera**, hold an object up, press **Capture** (3 second countdown), or **Upload photo**.
2. **Click the object** in the photo to cut it out. Depth estimation has already started in the background.
3. The **3D model** appears. Drag to rotate; the sliders change depth strength, smoothness and back thickness.
4. Enter the object's **real width** (cm), then export **GLB** (with colour) or **STL** (for 3D printing), or **Save to library**.

It builds a 3D *relief* from one photo: the front is estimated, the back is flat. The AI models (about 80 MB in total) run in
the browser and download on first use; the photo never leaves your computer. Details and limits: [docs/object-scanner.md](docs/object-scanner.md).

## Design system

`css/design.css` holds one set of tokens and components shared by both pages: neutral dark
surfaces, soft 1px borders, Inter typography, a 4/8/12/16/24 px spacing scale, buttons,
segmented controls, form fields, cards, metric tiles, badges, chips, lists, empty states, modal,
toasts and tooltips. Icons are inline SVG line icons from `js/icons.js` (no emoji, no icon
library). The sidebar collapses on desktop and becomes a drawer on small screens.

## Deploy to Vercel

It's a static site with no build step.

1. Deploy the backend first and note its URL.
2. Set `DEFAULT_BACKEND` in [`js/config.js`](js/config.js) to that URL, then commit.
3. Import this repository in Vercel (Framework preset: **Other**, no build command). Deploy.

To try a different backend without editing the code, add `?backend=https://...` to the page
URL. The QR code passes it on to the phone.

## Run locally

```bash
python -m http.server 5173
```

Open http://localhost:5173. On `localhost` the page uses the backend at `http://localhost:8000`.
The phone camera and motion sensors need HTTPS, so test real phones against the deployed site.
Locally, use the simulate buttons or the backend's `tools/fake_phone.py`.

## Files

| File | Role |
|---|---|
| `index.html` | App shell (sidebar, page header), the two twin sections, connect-phone modal |
| `phone.html` | Sensor page: camera + hand tracking, motion sensors, streaming, feedback |
| `css/design.css` | Design system: tokens and shared components |
| `js/icons.js` | Line-icon set and helpers |
| `js/ui.js` | Toasts and copy-to-clipboard |
| `js/config.js` | Backend URL and room handling |
| `js/core.js` | Hand twin core: state, gestures, drawing, rendering, data link, event bus |
| `js/nav.js` | Section switching (`#hand` / `#pose`), page header, collapsible sidebar, mobile drawer |
| `js/simulator.js` | Virtual hand |
| `js/recorder.js` | Record and replay |
| `js/analytics.js` | Hand metrics, chart, gesture time, activity log |
| `js/predictor.js` | Fingertip forecasting and accuracy |
| `js/pose.js` | Parcel twin: 3D model, shipping rules, incidents, score, charts, report, simulated trip |
| `js/games.js` | Arcade screen: game menu, toolbar, overlays, side panel, player 2 pairing |
| `js/games/` | `engine.js` (game runtime), `input.js` (phone and camera data to game input), `camera.js` (laptop webcam hand tracking), `physics.js` (ball physics and shot forecast), and one file per game |
| `js/scan.js` | Object to 3D screen: capture, selection, depth, model, export, library |
| `js/scan/` | `camera.js`, `segment.js`, `depth.js` + `depth.worker.js`, `mesh.js`, `viewer.js`, `library.js` |
| `js/vision/` | Laptop camera + MediaPipe hand and pose tracking in a Web Worker (GestureDeck and Sign language) |
| `js/deck.js`, `js/deck/` | GestureDeck screen; `render.js` (.pptx via Pagus, .pdf via pdf.js), `fonts.js` (embedded fonts), `swipe.js` |
| `js/sign.js`, `js/sign/` | Sign language screen; `features.js`, `model.js`, `recognizer.js`, `models/*.json` (trained models) |
| `tools/isl/` | Python: download and landmark extraction, training, reference generation (see docs/sign-language.md) |
