# Arcade: games controlled by the phone or the laptop camera

The **Arcade** section has twelve browser games in two sets:

- **Phone as the controller** (six games): the same phone that drives the other twins senses tilt, shaking or your
  hand and vibrates on hits; the game runs on the laptop.
- **Laptop camera** (six games): the laptop's own webcam tracks your hand **inside the browser** (MediaPipe, the same model
  as the phone page), so you pinch, swipe, swing and steer with no phone at all. These began as the
  *Physical AI Arena* prototypes and were rebuilt on the Arcade engine.

It is the digital twin idea again: a physical entity (you, your hand, a board or an office), sensors, a live virtual
model (the game world) and a feedback loop (vibration, score, the twin's forecast).

| Part | File |
|---|---|
| Section screen: menu, toolbar, overlays, side panel, player 2 pairing | [`js/games.js`](../js/games.js) |
| Game runtime: loop, countdown, pause, scores, sounds, messages to the phone | [`js/games/engine.js`](../js/games/engine.js) |
| Input: turns phone (and laptop camera) data into per-player tilt, hand, shake and pointer values | [`js/games/input.js`](../js/games/input.js) |
| Laptop camera: webcam, in-browser hand tracking, preview | [`js/games/camera.js`](../js/games/camera.js) |
| Ball physics and shot forecast (carrom, snooker) | [`js/games/physics.js`](../js/games/physics.js) |
| Phone games | [`marble.js`](../js/games/marble.js), [`slicer.js`](../js/games/slicer.js), [`glider.js`](../js/games/glider.js), [`rps.js`](../js/games/rps.js), [`shake.js`](../js/games/shake.js), [`pong.js`](../js/games/pong.js) in `js/games/` |
| Laptop camera games | [`cricket.js`](../js/games/cricket.js), [`carrom.js`](../js/games/carrom.js), [`snooker.js`](../js/games/snooker.js), [`robot.js`](../js/games/robot.js), [`slides.js`](../js/games/slides.js), [`office.js`](../js/games/office.js) in `js/games/` |

## The games

| Game | Phone sensor | Players | You | Scoring |
|---|---|---|---|---|
| **Marble Maze** | Tilt | 1 | Tilt the phone like a tray to roll the marble into the goal. 10 levels from easy to moderate, 3 lives (one comes back every third level), 45 s per level. Holes swallow the marble; levels 7 to 10 add slow moving holes. | 100 per level plus 3 per second left; 200 bonus for clearing all ten |
| **Fruit Slicer** | Hand camera | 1 | Swipe the index finger through flying fruit. Avoid the bombs. 3 lives. | 10 per fruit; 5 per extra fruit cut in the same swipe |
| **Sky Glider** | Hand camera | 1 | Raise and lower the hand to fly a glider through gaps in pillars. One life. | 1 per gap |
| **Rock Paper Scissors** | Hand camera | 1 vs computer, or 2 | Fist, open palm, or index and middle finger. First to 3 rounds. | 100 per round, 200 for the match (computer mode is scored) |
| **Shake Duel** | Accelerometer | 1 or 2 | Shake the phone as hard as you can for 10 s. | Power: the sum of how far each reading is above a gentle wobble |
| **Tilt Pong** | Tilt | 1 vs computer, or 2 | Tilt left and right to slide your paddle. First to 7. | 100 per point, 200 for the match (computer mode is scored) |

Every game also works **without a phone**, so it can be tried at a desk:

| Input | Player 1 | Player 2 |
|---|---|---|
| Tilt | W A S D | Arrow keys |
| Shake | Space | Enter |
| Rock, paper, scissors | 1, 2, 3 | 8, 9, 0 |
| Hand (slicer, glider) | Mouse over the game, or W and S for glider height | - |

A keyboard fills in only while that player's phone is **not** sending (no message for 700 ms).

The hand games (Fruit Slicer, Sky Glider, Rock Paper Scissors) can also use the **laptop camera** for player 1:
press **Start camera** in the side panel. While it is on, the phone's hand frames for player 1 are ignored.

## Laptop camera games

| Game | You | Scoring |
|---|---|---|
| **Air Cricket** | Your hand is the bat. Line up with the ball (a red mark shows where it bounces) and swing as it arrives. Twelve balls, three wickets. | 1, 2, 4 or 6 runs by swing speed; a missed ball on the stumps is bowled |
| **Flick Carrom** | Slide the striker, **pinch anywhere**, pull back, **open** to strike. An arrow and a power bar show the shot; **Aim sensitivity** (Gentle, Normal, Quick) sets how long a pull full power needs. The board's twin draws where every coin will go before you shoot. Ten shots. | Coin +1, queen +3, striker in a pocket -1, clearing the board +5 |
| **Snooker Coach** | Point behind the white ball; the cue runs from your hand through it. The twin forecasts first contact, pots, in-offs and where every ball stops. **Pinch** to play. Fifteen shots. | Red 1, colours 2 to 7, white in a pocket -4; colours are re-spotted while reds remain |
| **Robot Arm Twin** | The arm follows your hand (inverse kinematics, servo speed limit); **pinch** closes the gripper. Sort six blocks into bins of their colour in 90 s. | +100 per block, -20 for a wrong bin, time bonus 2 per second left when all are sorted |
| **Air Slides** | Present without a clicker: **swipe** for next and previous, **pinch** for a laser pointer, **hold a fist** to blank the screen. | Not scored |
| **Office Twin** | Rooms coloured by CO2, temperature, occupancy or energy; a what-if slider, an AI autopilot, a 60-minute forecast. All controls are on the canvas and work by pinching. The **Focus Pod is live**: its occupancy is the number of hands the camera sees. | Not scored (a live twin) |

Each one also plays with the **mouse**: a click (or touch) is a pinch, dragging is moving the hand.

### How the laptop camera works ([`camera.js`](../js/games/camera.js))

1. **Start camera and play** (or **Start camera** in the side panel) asks for the webcam (640 x 480, front camera).
2. The first time, the MediaPipe hand landmarker (`@mediapipe/tasks-vision` 0.10.14, about 8 MB) loads from jsDelivr and
   Google's model storage, on the GPU when possible and on the CPU otherwise. It tracks up to two hands.
3. For each new video frame it finds the hands and passes the first hand's 21 points to `input.js` (`feedHand`), the same path the phone's hand frames take.
   The picture never leaves the browser; nothing is sent to the backend.
4. The side panel shows a mirrored preview with the tracked skeleton, the detected gesture and the frame rate.
5. The camera stops when you leave the game, the Arcade, or press **Stop camera**.

### The pointer (`g.ptr()`)

Camera games read one pointer per player from `input.js`. Its source is, in order: a hand seen in the last 350 ms
(laptop camera, or the phone's camera), else the mouse (player 1, while it moved in the last 3 s), else `none`.

| Field | Meaning |
|---|---|
| `x`, `y` | Position 0 to 1, mirrored like a selfie. It is the point between the **thumb tip and index tip**, and the middle of the camera view (x 0.18 to 0.82, y 0.12 to 0.74) covers the whole screen, so the edges are easy to reach. Smoothed (about 55 % per tick), not smoothed for the mouse. |
| `pinch` | Thumb tip to index tip distance below **0.33 palm lengths** (palm = wrist to middle knuckle); it lets go above **0.55** for two frames in a row. The gap and the two frames stop a grab from dropping by accident. |
| `fist`, `open` | Mean fingertip-to-wrist distance below **1.05** (fist) or above **1.55** (open palm) palm lengths, when not pinching |
| `pinchStart`, `pinchEnd` | True for exactly one tick when a pinch starts or ends |
| `vx`, `vy`, `speed` | Velocity over the last 130 ms in screen widths (heights) per second; `speed` is in screen widths per second. For the mouse it is measured from the moment the button went down. |
| `hands` | How many hands the laptop camera sees (0 to 2) |
| `source` | `camera`, `phone`, `mouse` or `none` |

Distances use the camera's aspect ratio, so x and y are measured in the same units. Because opening the fingers
moves the pinch point, carrom and snooker shoot with the aim from **150 ms (carrom) or 130 ms (snooker) before the release**.

## How a game session works

```
  phone sensors ──► backend ──► core.js ──"raw" event──► input.js ──► game.update() ──► canvas
       ▲                                                                   │
       └────────────────── {type:"game", to:p, ...} (buzz, score) ◄────────┘
```

1. The player opens **Arcade** in the sidebar and picks a game. `games.js` calls `engine.load(game, mode)`
   and tells the phone which sensor to use (a `mode` message with `sensor`, `game`, `hint`; see the
   [protocol](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md#mode--which-twin-is-open)).
2. **Start** runs a 3-2-1 countdown. When it ends the engine records the current grip as the neutral tilt
   (`calibrate`) and the game begins.
3. The engine calls `game.update(g, state, dt)` 60 times a second with a fixed step, and `game.draw` once per frame.
4. A game ends with `g.end({ title, win, detail, winner })`. The engine stores the score, shows the result and sends it to the phone.
5. Leaving the Arcade (or hiding the tab) pauses the game and stops the loop.

### Engine ([`engine.js`](../js/games/engine.js))

| Aspect | Detail |
|---|---|
| Canvas | Fixed logical size **960 x 600**. The engine fits it into the stage (16:10) and scales it by the device pixel ratio. Mouse positions are normalized to the canvas. |
| Time step | Fixed `1/60` s. Frames longer than 0.1 s are clamped, so a stalled tab does not teleport objects. |
| States | `idle`, `ready`, `countdown`, `playing`, `paused`, `over`; `onChange(fn)` notifies the screen |
| Scores | `g.score[player]`, with `addScore` and `setScore`. Modes marked `scored` keep the **top 5 per game and mode** in `localStorage` key `dtl.scores` (this browser only). |
| Sound | Small synthesized beeps (`g.sfx("good")`), **muted by default**; the speaker button in the toolbar toggles it |
| Phone feedback | `g.buzz(player, pattern)` sends a vibration; the engine also sends the score every 400 ms and "Go!" / the result at the start and end |
| Drawing helpers | `text`, `hud`, `grid`, `circle`, `roundRect`, `cursor` (the camera pointer) and the colour table `C` (same hex values as the design tokens) |
| Camera games | `g.ptr(p)` returns the pointer above. A mode with `quick: true` starts without the 3-2-1 countdown (Air Slides, Office Twin). A game may define `key(g, state, event)` for its own keys. `gameState()` returns the running game's state (for the console and tests). |

### Input ([`input.js`](../js/games/input.js))

The input module listens for the `raw` event (every phone message, with its player number `m.p`) and keeps
one input object per player:

| Field | Meaning |
|---|---|
| `tx`, `ty` | Tilt in degrees relative to the neutral grip. `tx > 0`: right edge down. `ty > 0`: top edge raised. A ball on the board rolls toward the positive side, exactly like a real one. |
| `shake`, `shakeSeq` | Strongest acceleration (m/s²) in the latest `pose` message, and a counter that increases with every message so a game counts each reading once |
| `hand`, `hx`, `hy` | A hand is visible; palm centre (0 to 1, smoothed). Height is `hy`, where 0 is the top of the camera view. |
| `tip`, `tipSeq` | Index fingertip (0 to 1, **not** smoothed, so the slicer can measure speed) and a counter of new hand frames |
| `gesture` | Debounced hand shape (`fist`, `palm`, `hover`, `draw`, `idle`, `none`), the same classifier and the same 3-frame debounce as the hand twin |

**Tilt without gimbal lock.** The phone's Euler angles (`beta`, `gamma`) become unstable when the phone is held
upright. Instead the input derives the direction of "up" as the phone sees it,
`u = (-cos β sin γ, sin β, cos β cos γ)` (the third row of the W3C rotation matrix), which is smooth in any
grip. At calibration time two axes perpendicular to the neutral `u0` are chosen (the device's right axis flattened
onto the plane, and `u0 x right`), and tilt is the change of `u` along them, converted to degrees with `asin`.
That is why the game works whether the phone is flat like a tray or held upright like a steering wheel.

**Hand mapping.** The same left-right flip as the hand twin is applied for the front camera. Games map the
camera view to the playfield with a margin so the edges are reachable: the slicer uses the central 84 % of the
view, the glider the vertical range 0.2 to 0.8.

**Pointer.** Every tick, `poll` also updates `ptr` (see [The pointer](#the-pointer-gptr)) for the camera games.

**Sensor liveness.** `poseLive(p)`, `handLive(p)` and `phoneLive(p)` are true when that kind of message arrived within the last
700 ms. The screen shows them in the **Controllers** card and in the start overlay.

## Two players

Player 1 is the phone that scanned the page's QR code. **Add player 2** in the toolbar shows a second QR code
for `phone.html?room=ROOM&p=2`. That phone tags every message with `"p": 2`, shows a **Player 2** badge, and
only reacts to `game` messages addressed to it (`to: 2`).

- The backend was **not changed**: the relay already delivers every phone's messages to the twin and every
  twin message to all phones. Player numbers live inside the messages (see the backend
  [protocol](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md#players-two-phones-in-one-room)).
- Player 2's data is ignored by the Hand drawing and Phone pose twins (`core.js` only ingests `p === 1` hand frames and `pose.js` only handles
  `p === 1`), and **hand frames never draw or clear in the Arcade** (`twin.section` must be `hand`).
- Two-player modes are not scored; the winner is shown instead.

## Game details

All numbers are constants at the top of each file, so they are easy to tune.

### Marble Maze (`marble.js`)

| Constant | Value | Meaning |
|---|---|---|
| `ACCEL` | 55 px/s² per degree, tilt clamped to ±30° | Acceleration of the marble |
| `FRICTION` | 1.4 per second | Exponential damping of the speed |
| `MAX_V` | 720 px/s | Speed limit |
| `BALL_R`, `HOLE_R`, `GOAL_R` | 14, 28, 24 px | A hole captures the marble when its centre is within 21 px of the hole's centre; a rim pull starts 8 px outside the hole |
| `LEVEL_TIME` | 45 s | Time per level; running out costs a life |

The level layouts are data (`LEVELS`): start, goal, static holes and moving holes (axis, amplitude, speed).
All ten were checked with a breadth-first search on a 10 px grid (treating static holes as 42 px hazards) to
confirm there is always a route from start to goal.

### Fruit Slicer (`slicer.js`)

Fruit and bombs are thrown upward with gravity 900 px/s². The fingertip positions form a trail that lives
260 ms. For each new fingertip segment longer than 14 px (a slow drift does not cut) the game tests every item with
point-to-segment distance `< radius + 6`. Spawn rate and bomb probability (8 % rising to 22 %) grow with time.

### Sky Glider (`glider.js`)

The glider's height follows the smoothed hand height. The world speed is `250 + 7 per gap` (capped at +200 px/s),
and the gap is `215 - 3 per gap` (never below 150 px). Consecutive gaps never shift by more than 230 px, so the course is always possible.

### Rock Paper Scissors (`rps.js`)

Each round: three 0.7 s countdown beats, then a **1 s "Show" window** during which the most frequent steady
gesture is counted (at least 6 samples, about 0.1 s). The computer's move is chosen *before* the window opens, so it never
reacts to the player. A round without a clear shape is lost; in a two-player game, if neither player shows one the round is a draw.
The winner function `roundWinner(a, b)` is exported for testing.

### Shake Duel (`shake.js`)

Every new `pose` message adds `max(0, acc - 2.5) x 0.1` to the player's power, where `acc` is the strongest linear acceleration in that 50 ms slice.
So holding still scores zero, and a hard shake (about 20 m/s²) scores about 1.75 per message, or around 350 over 10 seconds.

### Tilt Pong (`pong.js`)

The paddle position follows the tilt directly: ±22° sweeps the whole width. The ball starts at 420 px/s and speeds up 5 % per
paddle hit (cap 900); where it hits the paddle sets its sideways speed. The computer follows the ball at `300 + 40 x your points` px/s,
so it can be beaten and gets harder as you score. The player who lost the point receives the next serve.

### Air Cricket (`cricket.js`)

The pitch is drawn in 2.5D: a point at distance `z` (0 bowler, 1 batter) is placed with `z^1.6` so the ball speeds up as it
comes closer. Delivery speed is 118 to 146 km/h plus 1.2 per ball; line, length (bounce at 55 to 78 % of the pitch) and swing are random.
The ball is hittable while `z` is between 0.84 and 1.10. A hit needs the ball within `radius + 22 px` of the **blade** (an 86 px
segment hanging from the hand, tilted by the swing direction) and a swing faster than 0.9 widths per second. The swing speed
is the **peak** over the last 0.16 s, so a short flick between camera frames still counts. Runs: above 3.4 is six, above 2.4 four,
above 1.6 two, otherwise one. A missed ball whose line is within 0.2 of the middle is bowled.

### Flick Carrom (`carrom.js`) and Snooker Coach (`snooker.js`)

Both use [`physics.js`](../js/games/physics.js): four sub-steps per tick, wall bounce, elastic ball collisions with mass,
rolling friction, and pockets. `predict` copies the table, plays the shot forward (carrom 4 s, snooker 6 s at 90 Hz) and returns
every ball's path, what is potted, and the cue ball's first contact. The forecast is recomputed every 80 ms while aiming.

| | Carrom | Snooker |
|---|---|---|
| Table | 1 x 1, pockets r 0.042, wall bounce 0.7 | 2 x 1, six pockets r 0.05, wall bounce 0.8 |
| Power | Pull measured from where you pinched: the first 26 px count as nothing, then `(pull / full)^1.4` with full = 320, 230 or 160 px (Gentle, Normal, Quick; remembered in this browser). Up to 3.4 units/s. Less than 8 % on release cancels the shot. | Hand distance behind the ball (0.06 to 0.66), 0.6 to 4.2 units/s |
| Shot | Pinch to grab, open to strike. For 0.18 s after the pinch the grab point follows the hand (closing the fingers moves it); the aim direction is smoothed (25 % per tick); the striker follows the middle 70 % of the hand's left-right range. | Pinch to strike |
| Limits | 10 shots; the striker cannot be placed on a coin | 15 shots |

### Robot Arm Twin (`robot.js`)

Two links of 30 and 26 units on a shoulder at (0.42 of the width, 76 of 100). The hand position is clamped to the reachable
ring, solved with two-link inverse kinematics (elbow-up), and each joint moves at most **4 rad/s**, like a real servo.
The gripper picks the nearest unsorted block within 6.5 units when you pinch. Blocks fall with gravity and stack.
The telemetry panel shows the two joint angles and the grip, the values you would stream to a real arm.

### Air Slides (`slides.js`)

A swipe is horizontal speed above **1.6 widths per second** and at least 1.6 times the vertical speed, with an open or pointing hand
(the mouse must hold the button). After a swipe there is a 0.7 s pause, and for 1.2 s a swipe the **other way is ignored**, so
bringing the hand back does not undo the slide. A fist held for 0.6 s blanks the screen (a ring shows the progress).

### Office Twin (`office.js`)

Six rooms with a capacity and an air volume. Every 1.5 simulated minutes the occupancy moves toward a daily profile
(desks peak at 11:00 and 15:00, the pantry at 12:50). Per minute, CO2 rises by `people x 30 / volume` and ventilation removes
`0.06 x vent x (CO2 - 420)`; temperature follows heat from people (servers add their own), the HVAC set-point and the outside.
The autopilot sets ventilation to 2.5 above 850 ppm and back to 1 below 600, and releases Meeting Room B's 10:00 booking if it
stays empty for 15 minutes. The forecast runs the same model 60 minutes ahead with and without the boost.

## The Arcade screen ([`games.js`](../js/games.js))

| Area | Behaviour |
|---|---|
| Menu | Two groups (phone games, laptop camera games). One card per game: icon, description, sensor chip, player count, a "Digital twin" chip for the twin demos, best score |
| Toolbar | Back to games, players (1 or 2) selector, **Add player 2**, **Calibrate tilt** (motion games), Pause, sound |
| Stage | The canvas with an overlay for start, pause and results. On small frames the overlay keeps only the title, status and buttons (container query). |
| Start overlay (camera games) | **Start camera and play**, or **Play with the mouse** |
| Side panel | **Laptop camera** (camera and hand games: preview, gesture, frame rate, start and stop), How to play, **Controllers** (live status per player), **Best scores**, and the digital-twin explanation, which each game can set with a `twin: { entity, sensors, model, loop }` field |

## Adding a game

1. Create `js/games/yourgame.js` exporting a default object:

   ```js
   import { W, H, C, text, hud } from "./engine.js";

   export default {
     id: "yourgame", title: "Your Game", icon: "target", sensor: "tilt",   // tilt | hand | shake (phone), webcam (laptop camera)
     desc: "One sentence for the menu card.",
     phone: "How to hold the phone, or what to show the camera.",
     howto: ["Step one", "Step two"],
     modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],  // add { players: 2 } for duels

     init(g, mode) { return { x: W / 2 }; },                      // build a fresh state object
     update(g, s, dt) {                                           // called 60 times a second
       const i = g.input(1);                                      // i.tx, i.ty, i.hy, i.tip, i.gesture, i.shake ...
                                                                  // camera games: const q = g.ptr(); q.x, q.y, q.pinch, q.speed ...
       s.x += i.tx * 20 * dt;
       if (s.x < 0) g.end({ title: "Game over" });                // finish: the engine scores and shows the result
     },
     draw(g, s) { hud(1, "SCORE", g.score[1]); },                 // draw on the 960 x 600 canvas
   };
   ```
2. Add it to the `GAMES` array in [`js/games.js`](../js/games.js) (import it at the top).
3. Use `g.addScore(player, n)`, `g.sfx(name)` and `g.buzz(player, [ms, ...])` for scoring, sound and phone vibration.
4. Add its constants and rules to this document.

No change is needed in the HTML, the phone page or the backend.

## Testing

| What | How |
|---|---|
| Without a phone | Use the keyboard and mouse (table above) |
| Laptop camera without a webcam | Start Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`: the camera starts with a test picture (no hand), which checks the start, model load and stop path. Hand input can then be fed with `feedHand(1, landmarks, { aspect: 4/3 })` from `input.js` in the console. |
| With scripted phones | Run `python tools/fake_phone.py --room ROOM --mode pose --player 1` and a second copy with `--player 2` from the [backend repository](https://github.com/Manish2102/DigitalTwin-Hand-Backend); each tilts in an opposite direction |
| Level solvability | Re-run a breadth-first search over `LEVELS` after editing marble layouts |
| Layout | Check the game at 1440, 900 and 390 px wide; the side panel moves below the stage at 1100 px and narrower |

## Known limits

- The laptop camera needs a secure page (https, or `localhost`), internet access to `cdn.jsdelivr.net` and `storage.googleapis.com` the first time, and reasonable light. Only one hand steers; a second hand only counts for the Office Twin.
- Hand detection runs on the page's main thread. On a laptop GPU it takes a few milliseconds per frame; on a machine without GPU acceleration it can drop to a few frames per second.
- Hand games rely on the phone's camera frame rate (typically 25 to 30 detections per second), so very fast swipes are sampled coarsely.
- Tilt and shake need a phone with motion sensors; on iOS the permission prompt appears when **Share motion sensors** is tapped.
- `navigator.vibrate` does not exist on iOS, so haptic feedback works on Android only.
- If the second phone's server instance differs from the first phone's, it can miss `game` feedback (see the backend [limitations](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/architecture.md#limitations)); its controls still work.
- Best scores are per browser and can be cleared in the side panel.
