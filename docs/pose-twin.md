# Phone pose twin: smart parcel monitor

File: [`js/pose.js`](../js/pose.js) (about 380 lines), with its markup in the `#sec-pose` section of
[`index.html`](../index.html).

## Scenario

A fragile parcel (lab samples, glassware, electronics) is in transit. The **phone is the sensor tag**
attached to it. The twin on the laptop mirrors the parcel in 3D, checks every reading against shipping
rules, keeps a condition score and incident history, and produces a delivery report. The phone shows the
status and vibrates when something goes wrong.

## Sensors

The phone streams a [`pose` message](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md#pose--motion-sensor-reading)
20 times per second:

| Field | Meaning | Used for |
|---|---|---|
| `alpha`, `beta`, `gamma` | Orientation, degrees (W3C DeviceOrientation) | 3D model, tilt, upside-down |
| `acc` | Strongest linear acceleration since the last message, m/s², gravity removed | Shocks |
| `gmin` | Lowest total acceleration since the last message, m/s², gravity included | Drops (about 9.8 at rest, near 0 in free fall) |

## Maths

### Orientation to rotation matrix

DeviceOrientation defines the rotation of the phone relative to the earth as `R = Rz(α) · Rx(β) · Ry(γ)`,
mapping phone axes (x right, y toward the top, z out of the screen) to earth axes (x east, y north, z up):

```js
R = [[ ca*cg - sa*sb*sg,  -sa*cb,  ca*sg + sa*sb*cg ],
     [ sa*cg + ca*sb*sg,   ca*cb,  sa*sg - ca*sb*cg ],
     [ -cb*sg,             sb,      cb*cg           ]]
```

### Tilt

The parcel's "this side up" direction is the phone's screen normal (its z axis). Tilt is the angle between
that and true up:

```
tilt = acos( R[2][2] )        // 0° flat face-up, 90° on its side, 180° upside down
```

### Rotation to CSS

CSS has its y axis pointing down, so the matrix is conjugated with `S = diag(1, −1, 1)` (`M = S·R·S`) and written
column-major for `matrix3d()`. The result is applied once per animation frame to the 3D model.

## 3D model

Pure CSS 3D, no library. A `perspective` stage contains a tilted floor (`rotateX(58deg)`) with rings, a
grid and a north marker, and one of two models:

| Model | Construction |
|---|---|
| **Parcel** (default) | A 150 × 200 × 100 px box made of six absolutely positioned faces, each translated out by half its depth. The top carries the "this side up" symbol, a tape stripe and a FRAGILE label, so orientation is readable at a glance. |
| **Phone** | A thin 78 × 158 px slab with a front and a back face. |

Faces use `backface-visibility: hidden`. When data stops, the stage fades the faces (not the 3D parent, because
`opacity` on a `preserve-3d` element would flatten the model).

The **Recenter** button subtracts the current heading from `alpha`, so the phone's present direction becomes
"straight ahead".

## Shipping rules

Each reading goes through four rules in `handlePose()`.

| Rule | Condition | Level | Penalty | Ends when |
|---|---|---|---|---|
| **Tilt** | `tilt > maxTilt` (default 45°, adjustable 15 to 80°) | warn | −5 | `tilt < maxTilt − 8°` |
| **Upside down** | `tilt > 135°` | crit | −15 | `tilt < 127°` |
| **Shock** | `acc / 9.81 > shockLimit` (default 2.0 g; options 1.5, 2.0, 2.5, 3.0) | warn, or crit above 2× the limit | −10 | Instant (one incident, then a 1.5 s cooldown) |
| **Drop** | `gmin < 3.0 m/s²` for at least 2 readings in a row (about 100 ms) | crit | −20 | Instant (2.5 s cooldown) |

Behaviours worth knowing:

- **Hysteresis (8°)** keeps a phone resting near a limit from raising dozens of incidents. A tilt incident
  starts when the limit is crossed and ends only once the reading is clearly back inside.
- **A flip also counts as a tilt**, because tilt exceeds the tilt limit on the way. Flipping the parcel costs
  both penalties (−20).
- **A drop is two events in practice**: the fall (drop incident) and the landing (shock incident).
- Incident text is updated when a tilt or flip ends, for example "Tilted up to 70° for 1.5 s".

## Score and status

| Item | Definition |
|---|---|
| **Condition score** | Starts at 100 for a shipment and drops by each incident's penalty, never below 0 |
| **Grade** | 90 and above Excellent, 70 and above Good, 40 and above Damage likely, below 40 Damaged |
| **Within limits** | Share of readings with `tilt ≤ maxTilt` |
| **Max tilt, max shock** | Highest values seen in the shipment |
| **Trip time** | Time since the shipment started (page load, **New shipment**, or the start of a simulated trip) |

The **current state** badge (distinct from the whole-trip score) is, in priority order:

1. **Critical** ("Upside down" while flipped, otherwise "Critical incident" for 2.5 s after a critical incident)
2. **Warning** ("Tilted N° · limit L°" while tilted, otherwise "Rough handling" for 2.5 s after a warning)
3. **OK** ("Parcel OK")

The stage outline turns amber or red, and a brief red flash accompanies critical incidents. If no sensor
data arrives for 1.5 s the stage shows "No sensor data" and the model fades.

## Feedback to the phone

| Message | When |
|---|---|
| `parcel` with `alert: false` | The status text or level changes (not on every degree of tilt) |
| `parcel` with `alert: true` | A new incident occurred; the phone vibrates (one pulse for warn, a triple pulse for crit) |

## Simulated delivery trip

**Simulate delivery trip** replays a scripted 32-second trip through the same `handlePose()` as real data,
at 20 readings per second, with small sensor wobble.

| Time | Event | What it exercises |
|---|---|---|
| 0 to 5 s | Carried by the courier | Normal handling |
| 5 to 9 s | Leaned over to about 62° | Tilt rule |
| 9 to 12 s | On the van shelf | Recovery (incident ends) |
| 12 s | Pothole: 26 m/s² (about 2.7 g) for 150 ms | Shock rule |
| 13 to 16 s | Driving | Normal handling |
| 16 to 21 s | Loaded upside down (beta swings to 180°) | Flip rule |
| 21 to 24 s | Turned right way up | Recovery |
| 24.3 to 24.7 s | Free fall (`gmin` 0.6) | Drop rule |
| 24.7 s | Landing: 42 m/s² (about 4.3 g) | Shock rule |
| 25.5 to 32 s | Delivered | Normal handling |

With the default rules it ends with **6 incidents and a score of 35 (Damaged)**. A toast announces the result
and the toolbar tells the user to download the report. Real sensor data is ignored while a simulation runs.

## Delivery report

**Delivery report** downloads `parcel-report-<timestamp>.json`. If no sensor data has been received it shows a
toast instead of producing an empty report.

```json
{
  "report": "Smart parcel - delivery report",
  "room": "K7QF2M",
  "generatedAt": "2026-11-18T17:30:00.000Z",
  "shipmentStarted": "2026-11-18T17:29:30.000Z",
  "durationSeconds": 30,
  "rules": { "maxTiltDeg": 45, "shockLimitG": 2, "upsideDown": "never", "drop": "never" },
  "summary": {
    "conditionScore": 35,
    "verdict": "Damaged",
    "incidents": 6,
    "maxTiltDeg": 178,
    "maxShockG": 4.3,
    "timeWithinLimitsPct": 78
  },
  "incidents": [
    { "at": "2026-11-18T17:29:36.000Z", "secondsIntoTrip": 6.1, "type": "tilt", "severity": "warn",
      "detail": "Tilted up to 65° for 2.6 s", "penalty": 5 }
  ]
}
```

`type` is one of `tilt`, `flip`, `shock`, `drop`; `severity` is `warn` or `crit`.

## Tuning constants

All at the top of `pose.js`.

| Constant | Value | Effect of changing it |
|---|---|---|
| `FLIP_TILT` | 135° | Angle beyond which the parcel counts as upside down |
| `HYSTERESIS` | 8° | Dead band before a tilt or flip incident ends. Raise it if real sensors still flicker. |
| `FREE_FALL` | 3.0 m/s² | Total acceleration below this counts as falling |
| `FREE_FALL_SAMPLES` | 2 | Consecutive low readings required for a drop (each is 50 ms) |
| `SHOCK_COOLDOWN_MS` | 1500 | Minimum gap between shock incidents |
| `DROP_COOLDOWN_MS` | 2500 | Minimum gap between drop incidents |
| `STALE_MS` | 1500 | Silence after which the stage shows "No sensor data" |
| `PENALTY` | tilt 5, flip 15, shock 10, drop 20 | Score cost per incident |
| `rules` | maxTilt 45, shockG 2.0 | Defaults shown in the Shipping rules card |

## Known limitations

- A phone hand-held by a person produces more motion than a parcel in a van, so default limits are tuned for
  demonstration rather than for real logistics.
- Heading (`alpha`) is relative on many devices, so the compass "N" marker is indicative, not geographic.
- Shock and free-fall detection depend on the phone's accelerometer sampling rate, which the browser does not
  expose; very brief drops may be missed.
- A trip lives in memory; reload or **New shipment** discards it. Download the report first.
