# Hand Digital Twin - Frontend

Your phone's camera watches your hand. A web page keeps a **live virtual copy of the
hand** (its digital twin), recognizes gestures, and draws with your index finger. The
twin also sends feedback to the phone (the current gesture, the pen color, and a
vibration when the drawing is cleared).

Backend (WebSocket relay): [DigitalTwin-Hand-Backend](https://github.com/Manish2102/DigitalTwin-Hand-Backend)

```
 Your hand → Phone (phone.html)                         Laptop / any browser (index.html)
             camera → MediaPipe → 21 joints  ──wss──►  backend  ──wss──►  twin: model, gestures, drawing
             shows gesture, vibrates         ◄──────── feedback ◄────────
```

## How to use

1. Open the site on a laptop. You get a **private room** (for example `Room: K7QF2M`) and a QR code.
2. Scan the QR code with your phone, which can be on any network (Wi-Fi or mobile data).
   Allow the camera and tap **Start camera**.
3. Gestures:

| Gesture | Action |
|---|---|
| ☝️ Index finger up | Draw |
| ✌️ Index + middle up | Move without drawing |
| ✋ Open palm, held 1 s | Clear |
| ✊ Fist | Pause |

Without a phone, press **▶ Simulate hand**.

## Features and the digital twin concepts they show

| Concept | In the app |
|---|---|
| Physical entity | Your hand |
| Sensor | Phone camera + on-device ML (MediaPipe Hand Landmarker). Only joint coordinates leave the phone, never video. |
| Data link | WebSocket, about 30 updates/sec, through the backend, in a private room |
| Virtual model | Live hand skeleton (21 joints) |
| Intelligence | Fingers up → gesture → action |
| Feedback loop | Gesture, color, and vibration sent back to the phone |
| Monitoring | Speed, steadiness, data stalls, gesture time, live chart, event log |
| History | Record, replay (1×/2×/4×), download and load as JSON |
| Simulation | Virtual hand draws a heart and a star with no hardware |
| Prediction | Forecasts the fingertip up to 300 ms ahead and scores its own accuracy |

Toolbar: pen colors and a custom color picker, brush size, undo (Ctrl+Z), clear, save PNG,
simulate, record and replay.

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
The phone camera needs HTTPS, so test real phones against the deployed site. Locally,
use **Simulate hand** or the backend's `tools/fake_phone.py`.

## Files

| File | Role |
|---|---|
| `index.html` | Twin page layout (toolbar, canvas, sidebar) |
| `phone.html` | Sensor page: camera, hand tracking, streaming, feedback display |
| `js/config.js` | Backend URL and room handling |
| `js/core.js` | The twin: state, gesture logic, drawing, rendering, data link, event bus |
| `js/simulator.js` | Virtual hand |
| `js/recorder.js` | Record and replay |
| `js/analytics.js` | Metrics, chart, gesture time, event log |
| `js/predictor.js` | Fingertip forecasting and accuracy |
