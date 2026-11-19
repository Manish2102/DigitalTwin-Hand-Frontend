# Hand drawing twin

Files: [`js/core.js`](../js/core.js), [`js/simulator.js`](../js/simulator.js),
[`js/recorder.js`](../js/recorder.js), [`js/analytics.js`](../js/analytics.js),
[`js/predictor.js`](../js/predictor.js).

The phone sends 21 joint positions per frame; the twin keeps a live skeleton, recognizes gestures,
and draws with the index fingertip.

## Input sources

All three produce the same `hand` message and enter through one function, `ingest(message, source)`.
The twin cannot tell them apart, which is what makes simulation and replay possible.

| Source | Produced by | When |
|---|---|---|
| `phone` | The WebSocket | Default |
| `simulation` | `simulator.js` | After pressing **Simulate hand** |
| `replay` | `recorder.js` | After pressing **Replay** |

`setSource(name)` switches source, clears the hand state, and emits `source`. `ingest` ignores frames
whose source is not the current one, so a live phone cannot disturb a replay.

## Gesture recognition

Implemented in `fingersUp()` and `classify()` in `core.js`. It uses only joint distances in the image
plane, so it works for any hand size and camera distance.

### Which fingers are up

For each finger, compare how far the **fingertip** and the **middle joint** (PIP) are from the **wrist**:

```
finger is up   when   dist(tip, wrist) > dist(pip, wrist) × 1.1
```

| Finger | Tip | Middle joint |
|---|---|---|
| Index | 8 | 6 |
| Middle | 12 | 10 |
| Ring | 16 | 14 |
| Pinky | 20 | 18 |
| Thumb | 4 | 3, measured against the middle-finger base (9): `dist(4, 9) > dist(3, 9) × 1.1` |

### Fingers to gesture

| Index | Middle | Ring | Pinky | Gesture | Meaning |
|:-:|:-:|:-:|:-:|---|---|
| up | down | down | down | `draw` | Draw |
| up | up | down | down | `hover` | Move without drawing (pen up) |
| up | up | up | up | `palm` | Hold for 1 s to clear |
| down | down | down | down | `fist` | Pause |
| anything else | | | | `idle` | Unknown, ignored |

The thumb is shown in the finger bars but does not affect the gesture.

### Debouncing and smoothing

| Step | Rule |
|---|---|
| Debounce | A new gesture is adopted only after **3 identical classifications in a row**, which removes one-frame flicker |
| Pointer | The index tip is smoothed with `p ← p + (tip − p) × 0.5` before it is used for drawing |
| Hand lost | A frame with `landmarks: null` resets the debounce and sets the gesture to `none` |

## Drawing

A **stroke** is `{ color, width, pts: [[x, y], ...] }` with normalized coordinates.

| Event | Effect |
|---|---|
| Gesture becomes `draw` | A new stroke starts when the next frame arrives |
| Each frame while drawing | The smoothed pointer is appended and one line segment is painted |
| Gesture leaves `draw`, colour or brush changes, undo of the active stroke | The current stroke ends |
| `palm` held for 1000 ms | Canvas cleared (once per palm; the user must lower the palm to arm it again). A yellow ring shows progress. |

Controls: six preset colours and a custom colour, three brush sizes, **Undo** (button or Ctrl+Z, one stroke
at a time), **Clear**, **Save PNG** (shows a toast instead if the canvas is empty).

## Feedback to the phone

`sendFeedback(event)` sends a `feedback` message on every gesture change, colour change, clear, and when a
phone connects. The phone vibrates twice after a clear and once after a colour change.

## Simulator

`simulator.js` generates synthetic hand frames at 30 per second (every 33 ms) and runs a scripted loop
of **14.8 seconds**.

| Step | Pose | Duration | Fingertip path |
|---|---|---|---|
| 1 | hover | 1.0 s | Moves to the start of the heart |
| 2 | draw | 5.0 s | Draws a heart (parametric curve) |
| 3 | hover | 1.2 s | Moves to the star, pen up |
| 4 | draw | 4.0 s | Draws a five-point star |
| 5 | hover | 0.8 s | Pen up |
| 6 | fist | 1.0 s | Moves to the centre, paused |
| 7 | palm | 1.8 s | Holds an open palm, clearing the canvas |

Each pose is a table of 21 joint offsets from the wrist; the whole hand is positioned so the index tip sits
on the path. Gaussian noise (standard deviation 0.0015 of the image) is added so the analytics see realistic
jitter. The message is marked `mirrored: false`, `aspect: 4/3`, `fps: 30`.

## Recorder

| Aspect | Detail |
|---|---|
| Capture | Listens to the `frame` event and stores `[msSinceStart, message]` for every frame |
| Replay | A `requestAnimationFrame` loop feeds stored frames back through `ingest(..., "replay")` when `elapsed × speed` reaches their timestamp. Speed is 1×, 2× or 4×. |
| On replay start | Source becomes `replay` and the canvas is cleared so the drawing is rebuilt from the recording |
| On replay end | Source returns to `phone`; a thin progress bar under the toolbar tracks position |
| Saving | **Download** writes `hand-twin-recording.json`; **Load** reads one back |

Recording file format:

```json
{
  "version": 1,
  "recordedAt": "2026-11-18T17:00:00.000Z",
  "frames": [[0, { "type": "hand", "landmarks": [ ... ], "mirrored": true, "aspect": 1.33, "...": "..." }],
             [33, { "type": "hand", "...": "..." }]]
}
```

The loader accepts any JSON with a `frames` array; anything else shows an error toast.

## Analytics

Computed in `analytics.js` from the `state` event and refreshed every 250 ms.

| Metric | Definition |
|---|---|
| **Fingertip speed** | Pixel distance between consecutive smoothed pointers divided by elapsed time, smoothed with `s ← 0.8·s + 0.2·v`. Gaps over 250 ms are not counted as motion. |
| **Steadiness** (0 to 100) | Over the last 20 raw fingertip samples, the mean distance of each sample from the midpoint of its neighbours. `100 − (jitter / 0.01) × 100`, clamped to 0..100. Smooth motion scores high; sensor noise or shaky hands score low. |
| **Data stalls** | Count of gaps over 250 ms between frames while a hand was visible |
| **Strokes** | `twin.strokes.length` |
| **Time per gesture** | Milliseconds spent in each gesture while a hand is visible, shown as a stacked bar and legend |
| **Chart** | Speed and round-trip time, 120 samples (30 s) |
| **Activity log** | Latest 60 events from `logEvent`, newest first |

The **Reset** button clears the stall count, gesture times and chart data.

## Predictor

A small "predictive twin" in `predictor.js`.

1. **Velocity** from the smoothed pointer: `v ← 0.6·v + 0.4·(Δp / Δt)` (reset after a gap over 250 ms).
2. **Forecast**: `predicted = pointer + v × lookahead`, with a look-ahead of 0 to 300 ms (default 150).
3. **Score**: each forecast is queued with the time it is due. When that moment arrives, the real
   fingertip position is compared with the forecast, and also with the "no prediction" baseline (the finger
   stays where it was).
4. **Report**: both errors are averaged over time (`e ← 0.95·e + 0.05·x`) and shown in pixels, plus the
   improvement `1 − error_with / error_without` as a percentage. Forecasts that arrive more than 100 ms late
   are skipped as unfair.
5. **Display**: a dashed amber line and ring from the pointer to the forecast, drawn through the `render` event.

## Known limitations

- One hand only (`numHands: 1`).
- The drawing is held in memory; reloading clears it. Use **Save PNG** first.
- The skeleton is a 2D mirror with depth only hinted by joint size; there is no 3D hand model.
