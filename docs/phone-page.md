# The phone page (sensor)

File: [`phone.html`](../phone.html). Served at `/phone` (rewrite in `vercel.json`) and `/phone.html`.

The phone is the **physical side**. It senses and streams; it never interprets. Everything it shows
(gesture, parcel status, vibration) comes back from the twin.

## Requirements

| Requirement | Why |
|---|---|
| **HTTPS** (or `localhost`) | Browsers expose the camera and motion sensors only on secure pages. The Vercel deployment satisfies this. |
| Camera permission | For the hand twin |
| Motion sensor access | For the parcel twin. **iOS Safari** shows a permission prompt when the button is tapped; **Android Chrome** allows it on HTTPS pages. |
| Internet on first use | The hand model (about 8 MB) and its runtime download from public CDNs the first time |
| A current mobile browser | Chrome on Android, Safari on iOS |

## Entering a room

| How the page was opened | Behaviour |
|---|---|
| `phone.html?room=K7QF2M` (from the QR code) | Connects to that room immediately |
| No `room` parameter | Shows a **Join a room** card with a code field; camera and sensor buttons stay disabled until a room is joined |

The room code is validated by `roomFromUrl()` (4 to 12 characters, uppercased). The backend can be overridden
with `?backend=` exactly as on the twin page.

## Screen layout

Single column, maximum width 560 px, using the shared [design system](design-system.md).

| Card | Content |
|---|---|
| Header | Brand, "Sensor · Physical side", room badge |
| Status tiles | **Link to backend** (online or offline) and **Digital twin** (listening or waiting) |
| Mode hint | Appears when the twin reports which section is open, and tells the user what to tap. In the Arcade it names the selected game and how to hold the phone. |
| **Game** | Visible only while the Arcade is open: game name, a **Player 1** or **Player 2** badge, the score, and the latest status text |
| **Hand camera** | Live preview with skeleton overlay, **Start camera**, **Flip**, detections per second, round-trip time |
| **Motion sensors** | **Share motion sensors** and a live readout of the angles and shock |
| **From the twin** | Feedback: your hand (gesture and pen colour), parcel status, parcel condition |

When the twin sends `mode`, the card for that twin gets an accent outline and a "Needed now" tag, its button
becomes the primary action, and the page scrolls to it. This is advice only: both sensors can run at once.

## Hand camera pipeline

```
getUserMedia (facing "user", ideal 640×480)
   -> <video> element
   -> requestAnimationFrame loop
        new video frame?  ->  HandLandmarker.detectForVideo()
        draw skeleton on the preview canvas
        throttle to one send per 33 ms  ->  {"type":"hand", ...}
        hand lost?  ->  send {"type":"hand","landmarks":null} once
```

| Detail | Value |
|---|---|
| Model | MediaPipe Hand Landmarker (float16), from `storage.googleapis.com/mediapipe-models/...` |
| Runtime | `@mediapipe/tasks-vision` 0.10.14 from jsDelivr (ES module + WASM) |
| Hands | 1 |
| Delegate | GPU first, falls back to CPU if GPU initialisation fails |
| Send rate | At most 1 per 33 ms (about 30 per second) |
| Coordinates | Normalized image coordinates, plus `mirrored: true` for the front camera so the twin flips them |
| Preview | Mirrored with CSS for the front camera so it behaves like a mirror |
| Screen | A wake lock is requested so the screen stays on |
| Privacy | Video never leaves the phone; only the 21 joint coordinates are sent |

**Start camera** goes through these states: *Starting…* (model loading), *Camera on* (success, with a status
line), or an error message under the card (for example "open this page with https://"). **Flip** switches
between front and back cameras.

## Motion sensor pipeline

```
deviceorientation  ->  alpha, beta, gamma  (latest values kept)
devicemotion       ->  accPeak = max linear acceleration since last send
                       gMin    = min total acceleration since last send
every 50 ms        ->  {"type":"pose", alpha, beta, gamma, absolute, acc, gmin}
                       reset accPeak and gMin
```

| Detail | Value |
|---|---|
| Send rate | Every 50 ms (20 per second) |
| `acc` | `devicemotion.acceleration` magnitude (gravity removed). If the device lacks it, `abs(|accelerationIncludingGravity| − 9.81)` is used. |
| `gmin` | Magnitude of `accelerationIncludingGravity`; minimum since the last send. About 9.8 at rest, near 0 in free fall. |
| Why peak and minimum | Brief spikes (a knock) and dips (a fall) last only a few milliseconds. Reporting extremes between sends means 20 messages per second do not hide them. |
| No data | After 2 s without orientation values the readout says the device may lack the sensors |

## Feedback from the twin

| Message | What the page does |
|---|---|
| `pong` | Computes round-trip time, shown in the Hand camera card and sent inside `hand.rtt` |
| `feedback` | Updates the gesture label and pen colour dot. Vibrates twice on `event: "cleared"` and once on `event: "color"`. |
| `parcel` | Shows the status badge (green, amber or red) and `score / 100`. Vibrates when `alert` is true: one pulse for `warn`, three for `crit`. |
| `mode` | Highlights the relevant card (see above). For `scan` (Object to 3D) it highlights nothing and says the laptop uses its own webcam, so the phone is not needed. For `scan` (Object to 3D) it highlights nothing and says the laptop uses its own webcam, so the phone is not needed. For `games` it highlights the motion sensors card (tilt and shake games) or the camera card (hand games) and shows the game's hint. |
| `game` | Only if `to` equals this phone's player number: vibrates on `buzz` (with the given pattern), updates the score on `score`, shows `text` on `info` and `over`, and gives a short buzz on `start` |

### Player number

The page reads `?p=2` from its URL (default `1`) and adds `"p": <player>` to **every** message it sends. A second phone
therefore joins the same room as **Player 2** for the two-player games. It also ignores `pong` replies and `game` messages meant for the other player.
The twin page's **Add player 2** button shows a QR code with this URL.

`navigator.vibrate` is not available on iOS, so haptic feedback works on Android only.

## Connection behaviour

| Aspect | Behaviour |
|---|---|
| Reconnect | After 1 s on any close |
| `ping` | Every second; also drives the "Digital twin: Listening" tile, which means a message was received from the twin in the last 3 s |
| Status tiles | Updated every second |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Could not start the camera: open this page with https://" | The page is on plain HTTP. Use the Vercel URL. |
| Camera permission denied | Allow it in the browser's site settings and tap Start camera again |
| "Share motion sensors" does nothing on iPhone | Motion permission was denied; reload the page and allow it when asked |
| "No motion sensor data" | The device or browser has no gyroscope or accelerometer access |
| "Digital twin: Waiting" stays on | The twin page is not open in the same room, or its tab is asleep. Compare the room codes. |
| Hand model loads slowly | First load downloads about 8 MB; later loads are cached |
