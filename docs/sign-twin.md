# Sign twin

**A signed word makes a 3D avatar speak.** You stand in front of the laptop camera and sign a word in Indian Sign Language
(ISL). The app recognises the sign, looks up the sentence you chose for it, and a 3D avatar says that sentence out loud, with
subtitles, a moving mouth and a wave for greetings. Nothing is uploaded: the camera, the recognition and the voice all run in
the browser.

Live site: <https://digitaltwin-hand-frontend-eight.vercel.app> (sidebar: **Sign twin**).

```
 you sign             camera + hand/body tracking          recognise the sign         your line for that sign         avatar
 ┌──────────┐  video  ┌──────────────────────────┐ points ┌───────────────────┐ name  ┌────────────────────────┐  ┌──────────────┐
 │  a word  │ ──────► │ MediaPipe (in the browser)│ ─────► │ ISL word model    │ ────► │ "Welcome" -> "Welcome, │─►│ speaks it,   │
 └──────────┘         └──────────────────────────┘        │ + your own samples│       │  everyone!"            │  │ moves, waves │
                                                           └───────────────────┘       └────────────────────────┘  └──────────────┘
                                                                  │ not sure?
                                                                  └──► says nothing, shows 3 suggestions you can tap
```

## Two ways to make the avatar speak

The avatar speaks through one function, so there are two sources for what it says:

| | **Sign twin page (automatic)** | **Admin app (manual)** |
|---|---|---|
| Who decides | The **sign language that is detected** | A person typing |
| Trigger | A recognised ISL word | The "Say it" button |
| What is spoken | The line you wrote for that sign | Any text you type |
| Where it speaks | The Sign twin page's speakers | The Sign twin page's speakers (same room) |

This document describes the automatic path, which is the point of the application: **the avatar says something because a sign was
recognised, not because someone typed it.** The admin app (`admin.html`) stays available for a presenter who wants to override or
add a sentence by hand; it uses the same room code and the same speaking code.

## What a viewer sees

* **Main area:** the 3D avatar. Its mouth follows the voice, it blinks, nods and raises its brows while talking, and it waves for
  Hello, Welcome, Good Morning, Good afternoon, Good evening and Pleased.
* **Subtitles** at the bottom of the stage show the sentence being spoken.
* **Small box, bottom right:** the camera, with the tracked hands drawn on it.
* **Badge, top left:** what the app is doing (ready, signing, lower your hands, step back).
* **Side panel:** voice controls and a status line, the table of sentences ("What the avatar says"), and the list of recent signs.

## How to use it (presenter)

1. Open **Sign twin**, press **Start camera** and allow the camera. The first start takes about 5 seconds while hand tracking loads.
2. Stand 1 to 1.5 m away with your head, shoulders and both hands in the picture. Light your face from the front.
3. Start with your hands **down**. Raise your hands and make **one sign**. Lower your hands and wait about half a second.
4. The avatar says the sentence for that sign. Repeat with the next sign.
5. If it is **not sure**, it says nothing and shows its three best guesses as buttons. Tap the right one and the avatar says it,
   or sign again.

A sign begins when a hand rises above the dashed "rest line" and ends when the hands come back down, so signs are recognised
one at a time with a short rest between them.

## Which signs and which sentences

The sentences live in [`js/sign/script.js`](../js/sign/script.js) and can be edited on the page ("What the avatar says"). Defaults:

| Sign | The avatar says |
|---|---|
| Welcome | Welcome, everyone! We are glad you are here. |
| Hello | Hello everyone! |
| Thank you | Thank you very much! |
| How are you | How are you doing today? |
| Good Morning | Good morning to all of you! |
| I | I am the Digital Twin Lab avatar. |
| you | And you are our wonderful audience. |
| Pleased | I am very pleased to meet you! |

* The page **only listens for the signs in this table**, plus any signs you taught it. A short list is much more accurate than the
  full 106-word vocabulary.
* A sign with no sentence is spoken as its own name.
* Edits are kept in the browser. "Reset to defaults" restores `script.js`.

### Welcome has to be taught

The training data (INCLUDE) has no "Welcome" sign, so the model cannot know it. On the **Sign language** page, use *Teach it your
signs*: choose **Welcome**, press *Record a sample*, sign it, lower your hands, and do this **3 times the same way**. The
recordings are stored in your browser and shared with the Sign twin page. From then on a sign that closely matches your recordings
counts as Welcome. Teaching also improves any other sign for you personally.

## How recognition works

1. **Tracking.** MediaPipe (hands and upper body) runs in a web worker (about 10 to 35 frames per second, depending on the computer).
2. **Features.** Each frame becomes 96 numbers: hand shapes (normalised by hand size) and where the hands are relative to the
   shoulders (normalised by shoulder width). A sign is the frames between "hands up" and "hands down", resampled to 16 steps.
3. **Word model.** A small neural network trained on the INCLUDE dataset (AI4Bharat and IIT Madras, 1,892 videos, 106 words,
   CC BY 4.0) with the dataset's own train/validation/test split. It runs in plain JavaScript.
4. **Short list.** The probabilities are limited to the signs in your table, and an answer is accepted at 45% confidence with a
   10-point lead over the second guess (a looser bar is safe with few candidates).
5. **Your recordings.** A taught sign gets a boost from how close the sign is to *your* recordings:
   `score = p + (1 - p) * 0.8 * match` for known words, `0.95 * match` for signs the model does not know, with
   `match = exp(-(d / 17)^4)`. A taught sign never lowers the others.
6. **Say it.** An accepted answer looks up its sentence and the avatar speaks it. A "not sure" answer is never spoken.

## What was measured

All numbers are on recordings the model did not train on, replayed through the browser code. They are **not** a live test with a
person in front of a webcam.

| Test | Result |
|---|---|
| 106 words, INCLUDE test videos (335) | 87% right on the first guess, 94% in the top 3; answers 84% of signs and is right 94% of those times |
| The 7 built-in demo signs, 28 test videos | 25 right, 1 wrong (I read as "you"), 2 "not sure" |
| "Welcome" taught from 3 simulated repeats of one signer | 5 of 5 further repeats recognised; none of 29 unrelated videos read as Welcome |
| Real page: three signs replayed | Typed the right words and spoke the right lines |

## Limits to know before presenting

* **One sign at a time**, with a rest between signs. Continuous signing is not understood.
* **Face and grammar are not read.** Questions, negation and the order of ISL grammar are not interpreted.
* **A sign outside the table can be mistaken for one inside it** (a Hospital video was read as "How are you" at 71%). The page can
  only choose among the signs it listens for.
* **Regional differences.** The word recordings are from Chennai. If you sign differently, teach your version.
* **Welcome and any custom sign** depend on your own recordings; if they differ a lot from each other the page warns you.
* **Voice.** The voice is the browser's built-in voice. If nothing is heard, the status line under the voice buttons says why
  (volume, muted tab, or the browser's sound output).
* The recording-based numbers above have not been repeated with a live webcam.

## Files

| File | Role |
|---|---|
| `js/signdemo.js` | The Sign twin page: camera, recognition, subtitles, log, the admin hook |
| `js/sign/avatar3d.js` | The 3D avatar (three.js, built from shapes, no model file) |
| `js/sign/talker.js` | Speech, mouth level, the "What the avatar says" table |
| `js/sign/script.js` | **The default sentences (edit these)** |
| `js/sign/recognizer.js`, `features.js`, `model.js` | Sign recognition (shared with the Sign language page) |
| `js/sign/models/words.json` | The trained word model |
| `js/vision/` | Hand and body tracking in a web worker |
| `admin.html`, `js/admin.js` | The admin app (type a sentence; same room) |
| `tools/isl/` | Training, evaluation and replay scripts (see [sign-language.md](sign-language.md)) |

## Run it

```powershell
# in the frontend folder
python -m http.server 5173
# open http://localhost:5173/#signdemo and allow the camera
```

The page is static files; the camera features need no backend. The relay backend is only used by the phone features and by the
admin app to reach the Sign twin page. Deployment (Vercel, auto-deploy from `main`) is described in [deployment.md](deployment.md).

## Privacy

The camera picture never leaves the browser. Only hand and body points are used, and only in memory. Taught recordings and edited
sentences are stored in this browser's `localStorage` and can be removed with "Forget my recordings" and "Reset to defaults".
