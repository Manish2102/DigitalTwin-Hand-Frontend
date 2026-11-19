# GestureDeck: present your slides and change them with a swipe

**GestureDeck** (sidebar, *Communicate*) opens your own PowerPoint or PDF in the browser and lets you move through
it with a hand swipe seen by the laptop camera. Keyboard, mouse and clicker keys keep working at all times, so a
gesture problem can never strand a talk.

| Part | File |
|---|---|
| Screen: stage, toolbar, slide list, camera preview, full screen, keys, gesture navigation | [`js/deck.js`](../js/deck.js) |
| Opening files and drawing slides (.pptx, .pdf) | [`js/deck/render.js`](../js/deck/render.js) |
| Fonts embedded in a .pptx | [`js/deck/fonts.js`](../js/deck/fonts.js) |
| Swipe detection | [`js/deck/swipe.js`](../js/deck/swipe.js) |
| Laptop camera and hand tracking in a worker (shared with Sign language) | [`js/vision/vision.js`](../js/vision/vision.js), [`js/vision/vision.worker.js`](../js/vision/vision.worker.js) |
| Swipe tests | [`tools/deck/swipe_test.mjs`](../tools/deck/swipe_test.mjs) |

## Using it

1. **Open presentation** (or drop a file on the stage). The file is read in the browser; nothing is uploaded.
2. **Present** (or <kbd>F</kbd>) for full screen. <kbd>Esc</kbd> leaves it.
3. **Gestures** on (or <kbd>G</kbd>), allow the camera. A small preview appears in a corner.
4. Open your hand and sweep it sideways in one quick movement: **right = next slide, left = previous slide**
   (as you, the presenter, see it). A green flash confirms the change. *Reverse direction* swaps them.

| Key | Action |
|---|---|
| <kbd>→</kbd> <kbd>↓</kbd> <kbd>Page Down</kbd> <kbd>Space</kbd> <kbd>Enter</kbd> <kbd>N</kbd> | Next slide (clickers send Page Down) |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>Page Up</kbd> <kbd>Backspace</kbd> <kbd>P</kbd> | Previous slide |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last slide |
| <kbd>F</kbd> or <kbd>F5</kbd> | Full screen on and off |
| <kbd>B</kbd> or <kbd>.</kbd> | Black screen on and off |
| <kbd>G</kbd> | Gestures on and off |
| <kbd>C</kbd> | Show or hide the camera preview |

The **camera preview** floats in a corner of the slide area (also in full screen). Drag it; it snaps to the nearest
corner so it never sits in the middle of a slide. The size button cycles small, medium and large; the eye button and
<kbd>C</kbd> hide it (gestures keep working). Its bar shows whether a hand is seen, and the green meter at the bottom
shows how close the current movement is to a swipe. Position and size are remembered in the browser.

## Files

| File | How it is shown | Fidelity |
|---|---|---|
| **.pptx** | Parsed and drawn as vector graphics (SVG) by [Pagus](https://pagus-kit.github.io/Pagus/) (MIT, runs in the browser) | Layout, text, shapes, pictures, tables, charts and theme backgrounds. **Fonts embedded in the file are loaded** (PowerPoint stores them as EOT; `fonts.js` converts them). Other fonts are mapped to close Google Fonts, otherwise a similar font is used and the slide notes say which. **Animations, transitions, audio and video are not played**: each slide shows its final state. |
| **.pdf** | Drawn by [pdf.js](https://mozilla.github.io/pdf.js/) at the screen's resolution | Exactly like the original. For a pixel-perfect talk, export the deck to PDF in PowerPoint (*File, Export, PDF*). |
| **.ppt** (PowerPoint 97-2003) | Not supported | Browsers cannot read this binary format without a conversion server. The app recognises it and says how to convert it (*File, Save As, PowerPoint Presentation*, or export to PDF). |

Files are checked by their content, not their name: a renamed or damaged file gets a clear message, and the
presentation that was open stays open. The limit is 200 MB.

**Why Pagus.** Three in-browser renderers were compared on test decks and on real PowerPoint-authored decks against
PowerPoint's own PDF export: pptx-browser dropped body text, PptxViewJS lost theme background pictures (white slides
with black text on a themed deck), Pagus was closest overall once embedded fonts were added.

## Swipe detection

[`swipe.js`](../js/deck/swipe.js) reads the hand landmarks (21 points per hand) and reports a swipe only when **all**
of these hold:

1. **An open hand** (at least 3 of 4 fingers straight) for most of the movement. A closed hand, pointing or a
   relaxed half-closed hand while talking does not count.
2. **The hand was already in view and fairly still** just before the movement (it moved less than 0.6 palm lengths
   in the `settle` time). A hand entering the frame, or the tail of another movement, does not count.
3. **Far enough sideways, measured in palm lengths** (and at least a minimum fraction of the frame), so it works
   whether you stand close to the camera or far away.
4. **Fast and straight**: within `maxMs`, mostly horizontal (vertical drift at most `straight` x the sideways
   distance) and nearly every step in the same direction (`mono`).
5. **Not a tracking glitch**: at least 4 frames, and no single frame jump larger than half the distance (MediaPipe can
   briefly swap two hands, which would look like a very fast swipe).
6. **Not during the cooldown** after the previous swipe, and **not back the other way** soon after: bringing the hand
   back after a swipe never undoes it.

The presenter's hand is the biggest one in view (closest to the camera). The sensitivity menu picks a preset:

| Preset | Distance | Within | Straightness | Same direction | Cooldown | Return ignored for | Still before |
|---|---|---|---|---|---|---|---|
| Careful | 2.8 palm lengths, at least 16 % of frame width | 520 ms | 0.5 | 85 % of steps | 1.1 s | 1.6 s | 250 ms |
| Normal | 2.2 palm lengths, at least 12 % | 620 ms | 0.6 | 80 % | 0.9 s | 1.4 s | 200 ms |
| Easy | 1.7 palm lengths, at least 9 % | 760 ms | 0.7 | 75 % | 0.8 s | 1.2 s | 150 ms |

## Reliability

- **Every slide is drawn when the file opens** (PPTX) or the next one is drawn ahead (PDF), so a slide change is a
  swap of ready-made content with a 180 ms fade; nothing is computed in front of the audience.
- **Hand tracking runs in a Web Worker.** The page sends camera frames as `ImageBitmap`s one at a time and drops
  frames while the worker is busy, so tracking can never delay a slide change or build up lag. (MediaPipe's loader
  needs `importScripts`, which module workers lack; the worker provides a small synchronous replacement.)
- If the camera is unplugged or taken by another app, gestures turn off with a message; keys keep working.
- Leaving GestureDeck turns the camera off and leaves full screen. Hiding the tab resets the swipe tracker.
- Only one request to show a slide wins (fast key repeats show the last one asked for).

## Testing

| What | How | Result (Nov 2026) |
|---|---|---|
| Swipe rules | `node tools/deck/swipe_test.mjs`: 15 synthetic scenarios (still hand 10 s, slow drift, swipes both ways, swipe and return, repeated swipes, hand entering the frame, fist, vertical, diagonal, far presenter, tiny nudge, talking movements, one-frame glitch, two hands swapping) | 15/15, repeated runs with random jitter |
| Whole page in headless Chrome | Real worker and fake camera; synthetic hands fed through the same callbacks: 4 s still, swipe right, return, swipe left, fist sweep, 3 s of talking movements; 5 swipes in a row; reverse direction | Exactly one slide per swipe, nothing from the rest |
| Files | Synthetic decks (16:9, 4:3, pictures, shapes, table, chart, dark background, 60 slides), three real PowerPoint-authored decks, a PDF export, a real .ppt saved by PowerPoint, a broken file, a text file | All open or fail with the right message |
| Long deck | 60 slides: 70 key presses forward and 70 back at 30 ms | Ends on slide 60 and slide 1, one slide in the page at a time, no errors |

## Known limits

- Animations, slide transitions, embedded audio and video are not played (.pptx and .pdf).
- PPTX rendering is very good but not identical to PowerPoint: unusual effects (3D, some gradients, SmartArt) and
  fonts that are neither embedded nor available may differ. Use PDF when exact looks matter.
- .ppt files must be converted first.
- Gestures need a reasonably lit hand in view of the camera; the first start downloads the hand model (about 8 MB).
- Full screen must be started by a click or key (a browser rule).
