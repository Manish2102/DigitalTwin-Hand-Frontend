# Digital Twin Lab - documentation

Digital Twin Lab turns a **phone into a sensor** and a **web page into the digital twin** (a live
virtual copy) of whatever the phone senses. It has two twins:

| Twin | Physical thing | Phone sensor | What the twin does |
|---|---|---|---|
| **Hand drawing** | Your hand | Camera + on-device hand tracking | Mirrors the hand skeleton, recognizes gestures, draws with your finger |
| **Phone pose twin** (smart parcel) | A fragile parcel, with the phone as its sensor tag | Gyroscope + accelerometer | Mirrors the parcel in 3D, enforces shipping rules, scores its condition, writes a delivery report |

## How the pieces fit

```
   PHYSICAL SIDE                       CLOUD                           VIRTUAL SIDE
 +-----------------+            +-------------------+            +------------------------+
 |  Phone browser  |  wss       |  Backend          |  wss       |  Twin page (laptop)    |
 |  phone.html     | ---------> |  FastAPI relay    | ---------> |  index.html            |
 |                 | /ws/phone  |  rooms + roles    | /ws/twin   |                        |
 |  camera -> hand |  ?room=X   |                   |  ?room=X   |  hand twin   (drawing) |
 |  motion -> pose | <--------- |  optional Redis   | <--------- |  parcel twin (rules)   |
 |  vibrates       |  feedback  |  pub/sub          |  feedback  |                        |
 +-----------------+            +-------------------+            +------------------------+
```

- The **phone** only senses and streams raw readings. It decides nothing.
- The **backend** copies messages between the phone and the twin that share a **room** code. It
  never reads them. See the
  [backend docs](https://github.com/Manish2102/DigitalTwin-Hand-Backend/tree/main/docs).
- The **twin page** holds all the intelligence: it interprets readings, acts on them, and sends
  feedback back to the phone.

That split is the core digital twin idea: the virtual model is where state is understood and decisions
are made, and the physical side receives the outcome.

### Digital twin concepts and where they live

| Concept | Hand twin | Parcel twin |
|---|---|---|
| Physical entity | Your hand | The parcel (your phone) |
| Sensors | Camera + MediaPipe (only joint coordinates leave the phone, never video) | Gyroscope, accelerometer |
| Data link | WebSocket, about 30 messages/s | WebSocket, 20 messages/s |
| Virtual model | Live 21-joint skeleton | Live 3D parcel |
| Intelligence | Fingers up → gesture → action | Readings → shipping rules → incidents |
| Feedback loop | Gesture, colour, vibration | Status, score, vibration on incidents |
| Monitoring | Speed, steadiness, stalls, gesture time | Score, max tilt and shock, time within limits, charts |
| History | Record and replay | Incident timeline, delivery report |
| Simulation | Virtual hand | Simulated delivery trip |
| Prediction | Fingertip forecast with an accuracy score | - |

## Documents

| Document | What it covers |
|---|---|
| [architecture.md](architecture.md) | App structure: files, load order, module graph, the event bus, shared state, rooms, data flow, rendering |
| [hand-twin.md](hand-twin.md) | The hand twin in depth: gesture algorithm, drawing, simulator, recorder, analytics, predictor |
| [pose-twin.md](pose-twin.md) | The parcel twin in depth: sensor maths, rules, scoring, simulation, report format, tuning constants |
| [phone-page.md](phone-page.md) | The sensor page: camera pipeline, motion sensors, feedback, requirements |
| [design-system.md](design-system.md) | Tokens, components, icons, accessibility and responsive behaviour |
| [deployment.md](deployment.md) | Running locally, deploying to Vercel, configuration, troubleshooting |
| [extending.md](extending.md) | How to add a twin, a message type, an icon or a rule |

Backend documentation: [architecture](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/architecture.md),
[protocol](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md),
[deployment](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/deployment.md).

## Using the app

1. Open the site on a laptop. The page creates a **private room** (shown in the header) and offers a
   QR code. **Connect phone** in the sidebar shows it again.
2. Scan the code with the phone. Any network works, including mobile data.
3. Choose a twin in the sidebar. The phone highlights the sensor that twin needs.

| Twin | On the phone, tap | Then |
|---|---|---|
| Hand drawing | **Start camera** | Show one hand. Index finger up draws; two fingers moves; open palm held for 1 s clears; a fist pauses. |
| Phone pose twin | **Share motion sensors** | Tilt, flip, bump or drop the phone onto a soft surface and watch the parcel twin react. |

No phone to hand? **Simulate hand** and **Simulate delivery trip** drive the twins without one.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | App shell (sidebar, page header), both twin sections, connect-phone modal |
| `phone.html` | Sensor page for the phone |
| `css/design.css` | Design system: tokens and shared components |
| `js/config.js` | Backend URL and room handling |
| `js/core.js` | Hand twin core: state, gestures, drawing, rendering, data link, event bus |
| `js/nav.js` | Section switching, page header, collapsible sidebar, mobile drawer |
| `js/simulator.js` | Virtual hand |
| `js/recorder.js` | Record and replay |
| `js/analytics.js` | Hand metrics, charts, activity log |
| `js/predictor.js` | Fingertip forecasting |
| `js/pose.js` | Parcel twin |
| `js/icons.js` | Line-icon set |
| `js/ui.js` | Toasts and copy-to-clipboard |
| `vercel.json` | `/phone` rewrite and camera permission header |
| `docs/` | This documentation |
