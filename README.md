# Digital Twin Lab - Frontend

Your phone is the sensor and this web page is the **live virtual copy** (the digital twin).
The page has two twins, which you choose in the left navigation. One phone can feed both at once.

| Section | Physical thing | Phone sensor | What the twin does |
|---|---|---|---|
| ✍️ **Hand drawing** | Your hand | Camera + on-device hand tracking | Mirrors the hand skeleton, recognizes gestures, draws with your finger |
| 📦 **Phone pose twin** | A fragile parcel (the phone is its sensor tag) | Gyroscope + accelerometer | Mirrors the parcel in 3D, enforces shipping rules, scores its condition, writes a delivery report |

Backend (WebSocket relay): [DigitalTwin-Hand-Backend](https://github.com/Manish2102/DigitalTwin-Hand-Backend)

```
 Physical side: phone (phone.html)                       Virtual side: laptop (index.html)
   camera → MediaPipe → 21 hand joints ─┐               ┌─► ✍️ hand twin: skeleton, gestures, drawing
   motion sensors → α β γ, shock, fall ─┴─wss─► backend ─┴─► 📦 parcel twin: 3D parcel, rules, incidents
   shows status, vibrates  ◄──────────────── feedback ◄────────────
```

## How to use

1. Open the site on a laptop. You get a **private room** (for example `Room: K7QF2M`) and a QR code.
   **📲 Connect phone** in the left navigation shows the QR code again.
2. Scan it with your phone, which can be on any network (Wi-Fi or mobile data).
3. Pick a twin on the left. The phone highlights the button that twin needs.

### ✍️ Hand drawing

On the phone, tap **Start camera** and show one hand.

| Gesture | Action |
|---|---|
| ☝️ Index finger up | Draw |
| ✌️ Index + middle up | Move without drawing |
| ✋ Open palm, held 1 s | Clear |
| ✊ Fist | Pause |

Toolbar: pen colors and a custom color picker, brush size, undo (Ctrl+Z), clear, save PNG,
**▶ Simulate hand**, and record / replay / download / load. The sidebar has twin state,
analytics, prediction (forecasting the fingertip 0–300 ms ahead), and an event log.

### 📦 Phone pose twin - smart parcel monitor

Scenario: the phone is the sensor tag on a fragile parcel (lab samples, glassware, electronics) in transit.
On the phone, tap **📱 Share phone pose**. Tilt it, flip it, bump it, or drop it onto a bed or sofa.

| Rule | Detected from | Penalty |
|---|---|---|
| Tilt beyond the limit (default 45°, adjustable) | Orientation | −5 |
| Upside down (never allowed) | Orientation | −15 |
| Shock above the limit (default 1.5 g, adjustable) | Accelerometer | −10 |
| Drop (free fall) | Accelerometer: total acceleration near 0 | −20 |

What you see:
- a 3D parcel (or the phone itself) that follows the real phone
- a status banner (OK / warning / critical)
- a condition score and grade (Excellent, Good, Damage likely, Damaged)
- live tilt and shock charts with limit lines
- an incident timeline
- a downloadable **delivery report** (JSON)

The phone shows the parcel status and vibrates on every incident.

**▶ Simulate delivery trip** plays a scripted 32-second trip with no phone: carried, leaned over,
a pothole, loaded upside down, then dropped. It ends with a final score and the report.

## Digital twin concepts shown

| Concept | Hand twin | Parcel twin |
|---|---|---|
| Physical entity | Your hand | The parcel (your phone) |
| Sensors | Camera + MediaPipe (only joint coordinates leave the phone, never video) | Gyroscope, accelerometer |
| Data link | WebSocket, about 30 updates/sec, private room | WebSocket, 20 updates/sec, private room |
| Virtual model | Live 21-joint skeleton | Live 3D parcel |
| Intelligence | Fingers → gesture → action | Readings → shipping rules → incidents |
| Feedback loop | Gesture, color, vibration | Status, score, vibration on incidents |
| Monitoring | Speed, steadiness, stalls, gesture time | Score, max tilt and shock, time within limits, charts |
| History | Record and replay | Incident timeline, delivery report |
| Simulation | Virtual hand | Simulated delivery trip |
| Prediction | Fingertip forecast with accuracy score | - |

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
| `index.html` | Page layout: left navigation, the two twin sections, connect-phone pop-up |
| `phone.html` | Sensor page: camera + hand tracking, motion sensors, streaming, feedback display |
| `js/config.js` | Backend URL and room handling |
| `js/core.js` | Hand twin core: state, gestures, drawing, rendering, data link, event bus |
| `js/nav.js` | Switching between the twins (URL `#hand` / `#pose`), tells the phone which is open |
| `js/simulator.js` | Virtual hand |
| `js/recorder.js` | Record and replay |
| `js/analytics.js` | Hand metrics, chart, gesture time, event log |
| `js/predictor.js` | Fingertip forecasting and accuracy |
| `js/pose.js` | Parcel twin: 3D model (CSS 3D), shipping rules, incidents, score, charts, report, simulated trip |
