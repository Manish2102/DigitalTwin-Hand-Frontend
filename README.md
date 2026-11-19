# Digital Twin Lab - Frontend

Your phone is the sensor and this web page is the **live virtual copy** (the digital twin).
The app has two twins, which you choose in the sidebar. One phone can feed both at once.

| Section | Physical thing | Phone sensor | What the twin does |
|---|---|---|---|
| **Hand drawing** | Your hand | Camera + on-device hand tracking | Mirrors the hand skeleton, recognizes gestures, draws with your finger |
| **Phone pose twin** | A fragile parcel (the phone is its sensor tag) | Gyroscope + accelerometer | Mirrors the parcel in 3D, enforces shipping rules, scores its condition, writes a delivery report |

Backend (WebSocket relay): [DigitalTwin-Hand-Backend](https://github.com/Manish2102/DigitalTwin-Hand-Backend)

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
