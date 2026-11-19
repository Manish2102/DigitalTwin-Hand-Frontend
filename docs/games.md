# Arcade: games controlled by the phone

The **Arcade** section turns the same phone that drives the other twins into a **game controller**. The
games run in the browser on the laptop; the phone only senses (tilt, shake, camera) and vibrates.
It is the digital twin idea again: a physical entity (you holding the phone), sensors, a live virtual
model (the game world) and a feedback loop (vibration and score on the phone).

| Part | File |
|---|---|
| Section screen: menu, toolbar, overlays, side panel, player 2 pairing | [`js/games.js`](../js/games.js) |
| Game runtime: loop, countdown, pause, scores, sounds, messages to the phone | [`js/games/engine.js`](../js/games/engine.js) |
| Input: turns phone data into per-player tilt, hand and shake values | [`js/games/input.js`](../js/games/input.js) |
| The games | [`marble.js`](../js/games/marble.js), [`slicer.js`](../js/games/slicer.js), [`glider.js`](../js/games/glider.js), [`rps.js`](../js/games/rps.js), [`shake.js`](../js/games/shake.js), [`pong.js`](../js/games/pong.js) in `js/games/` |

## The games

| Game | Phone sensor | Players | You | Scoring |
|---|---|---|---|---|
| **Marble Maze** | Tilt | 1 | Tilt the phone like a tray to roll the marble into the goal. 5 levels, 3 lives, 45 s per level. Holes swallow the marble; levels 4 and 5 have moving holes. | 100 per level plus 3 per second left; 200 bonus for clearing all five |
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
| Drawing helpers | `text`, `hud`, `grid`, `circle`, `roundRect` and the colour table `C` (same hex values as the design tokens) |

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
All five were checked with a breadth-first search on a 10 px grid (treating static holes as 42 px hazards) to
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

## The Arcade screen ([`games.js`](../js/games.js))

| Area | Behaviour |
|---|---|
| Menu | One card per game: icon, description, sensor chip, player count, best score |
| Toolbar | Back to games, players (1 or 2) selector, **Add player 2**, **Calibrate tilt** (motion games), Pause, sound |
| Stage | The canvas with an overlay for start, pause and results. On small frames the overlay keeps only the title, status and buttons (container query). |
| Side panel | How to play, **Controllers** (live status per player), **Best scores**, and the digital-twin explanation |

## Adding a game

1. Create `js/games/yourgame.js` exporting a default object:

   ```js
   import { W, H, C, text, hud } from "./engine.js";

   export default {
     id: "yourgame", title: "Your Game", icon: "target", sensor: "tilt",   // tilt | hand | shake
     desc: "One sentence for the menu card.",
     phone: "How to hold the phone, or what to show the camera.",
     howto: ["Step one", "Step two"],
     modes: [{ id: "solo", label: "1 player", players: 1, scored: true }],  // add { players: 2 } for duels

     init(g, mode) { return { x: W / 2 }; },                      // build a fresh state object
     update(g, s, dt) {                                           // called 60 times a second
       const i = g.input(1);                                      // i.tx, i.ty, i.hy, i.tip, i.gesture, i.shake ...
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
| With scripted phones | Run `python tools/fake_phone.py --room ROOM --mode pose --player 1` and a second copy with `--player 2` from the [backend repository](https://github.com/Manish2102/DigitalTwin-Hand-Backend); each tilts in an opposite direction |
| Level solvability | Re-run a breadth-first search over `LEVELS` after editing marble layouts |
| Layout | Check the game at 1440, 900 and 390 px wide; the side panel moves below the stage at 1100 px and narrower |

## Known limits

- Hand games rely on the phone's camera frame rate (typically 25 to 30 detections per second), so very fast swipes are sampled coarsely.
- Tilt and shake need a phone with motion sensors; on iOS the permission prompt appears when **Share motion sensors** is tapped.
- `navigator.vibrate` does not exist on iOS, so haptic feedback works on Android only.
- If the second phone's server instance differs from the first phone's, it can miss `game` feedback (see the backend [limitations](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/architecture.md#limitations)); its controls still work.
- Best scores are per browser and can be cleared in the side panel.
