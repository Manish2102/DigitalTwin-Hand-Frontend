# Sign language: Indian Sign Language (ISL) to text

The **Sign language** section (sidebar, *Communicate*) watches a person signing **Indian Sign Language** through the
laptop camera and writes what they sign as text, which a hearing person can read or have spoken aloud. It recognises
**real ISL signs learned from published recordings of ISL signers**, not custom gestures, and it says
"not sure" instead of guessing when a sign is unclear.

Every supported sign, with an illustration and a description measured from real signers, is in the
[ISL reference](isl-reference.md).

| Part | File |
|---|---|
| Screen: camera view, live status, text, suggestions, vocabulary, accuracy | [`js/sign.js`](../js/sign.js) |
| Landmarks to features (same maths as training) | [`js/sign/features.js`](../js/sign/features.js) |
| Running the trained networks in the browser | [`js/sign/model.js`](../js/sign/model.js) |
| Word segmentation, letter holding, "not sure" decisions | [`js/sign/recognizer.js`](../js/sign/recognizer.js) |
| Trained models (weights, labels, threshold, measured accuracy) | [`js/sign/models/words.json`](../js/sign/models/words.json), [`letters.json`](../js/sign/models/letters.json) |
| Camera and hand + pose tracking in a Web Worker | [`js/vision/vision.js`](../js/vision/vision.js) |
| Data preparation, training, reference generation (Python) | [`tools/isl/`](../tools/isl) |

## What it understands

| Mode | Vocabulary | How to sign |
|---|---|---|
| **Words** | ISL word signs from six INCLUDE categories: Greetings, Pronouns, People, Days and Time, Society, Places (see the [reference](isl-reference.md) for the full list) | Start with your hands down, sign **one word**, lower your hands below the rest line. The next word starts when you raise them again. |
| **Fingerspelling** | The ISL manual alphabet **A to Z** and numbers **0 to 9** | Hold each letter still for about half a second. Lower your hands for about a second to end a spelled word (a space is added). |

Recognised words and spelled words are joined into a running text. **Speak** reads it aloud with the browser's
voice (an Indian English voice when available), **Copy** copies it, **Undo** removes the last item.

The text follows the order of the signs (ISL gloss order). ISL grammar is not the same as English grammar: for
example, ISL often puts the verb last and marks questions with facial expressions. The app does not rewrite the
gloss into English sentences.

## How it works

```
 laptop camera ─► worker: MediaPipe hands (2) + pose ─► features (96 per frame) ─┬─► letters network (per frame)
                                                                               └─► sign segment ─► 16 steps ─► words network
                                                     answer above the threshold? ─► text   otherwise ─► "not sure" + suggestions
```

**Landmarks.** MediaPipe's hand landmarker (21 points per hand, both hands) and pose landmarker (shoulders, elbows,
wrists, nose) run in a Web Worker on every camera frame. These are the same models that extracted the training data.

**Features** ([`features.js`](../js/sign/features.js), 96 numbers per frame), chosen so that the person's position,
size and distance from the camera do not matter:

| Group | Numbers | Meaning |
|---|---|---|
| Per hand (signer's right, then left) | 1 + 2 + 40 | Seen or not; wrist position relative to the shoulders, in shoulder widths; 20 finger points relative to the wrist, in hand lengths (the hand shape) |
| Arms | 8 | Elbows and wrists from the pose, in shoulder widths |
| Face | 2 | Nose position (for signs made at the face) |

Hands are assigned to the signer's right or left by the nearest pose wrist, which is more reliable than MediaPipe's
own left/right label. x is multiplied by the camera's aspect ratio so x and y use the same units.

**A word** is the part between the first and the last frame in which a wrist is above the **rest line**
(1.25 shoulder widths below the shoulders; the INCLUDE signers rest their hands at about 1.5 to 1.75). That part is
resampled to **16 steps**, so slow and fast signing look the same. Short gaps in hand detection (up to 4 frames)
are filled from the nearest frame. The live recogniser does exactly the same, and the Python and JavaScript
feature code are checked against each other on real videos (`node tools/isl/check_features.mjs`, max difference
3 x 10^-7).

**Models** ([`model.js`](../js/sign/model.js)): standardised features, two hidden layers with ReLU, softmax.
Words: 1536 inputs, 256 and 128 hidden units. Letters: 96 inputs, 128 and 64 hidden units. They run in plain
JavaScript in well under a millisecond; no machine learning library is downloaded.

**When it is not sure.** An answer is shown only when (1) its probability is above the model's **threshold** and
(2) it is at least 0.12 ahead of the second answer (two similar signs). The threshold was chosen on held-out data
so that accepted answers are right at least 95 % of the time. Otherwise the app shows **Not sure** with its top
three guesses as buttons: the user can tap the right one or sign again. Nothing uncertain is added to the text.

**Live segmentation** ([`recognizer.js`](../js/sign/recognizer.js)): a word starts when a wrist rises above the rest
line and ends 0.28 s after both hands are back down (or after 4.5 s, then it waits for the hands to come down).
Movements shorter than 0.35 s are ignored. Letters: the per-frame answers are averaged over the last 12 frames; a
letter is accepted after 0.65 s of the same confident answer, and the same letter again only after the hand changes
or rests.

## Data and training

| | Words | Letters and numbers |
|---|---|---|
| Dataset | **INCLUDE** (AI4Bharat and IIT Madras, ACM Multimedia 2020), [zenodo.org/records/4010759](https://zenodo.org/records/4010759), CC BY 4.0. Isolated ISL word videos (4,292 videos, 263 signs). | **Static gestures of Indian Sign Language for English alphabet, Hindi vowels and numerals**, Mendeley Data, [doi 10.17632/7tsw22y96w.1](https://data.mendeley.com/datasets/7tsw22y96w), CC BY 4.0. 33 signers (kids, teenagers, adults), full and half sleeves, varied backgrounds and light. |
| Used | Categories Greetings, Pronouns, People, Days and Time, Society, Places | A to Z (two variants of E) and 0 to 9 (two variants of 9), 60 images per sign from each of the six age/sleeve groups |
| Split | INCLUDE's official train / validation / test lists | Unseen signers: trained on kids and teenagers, tested on adults |

Pipeline (in [`tools/isl`](../tools/isl)), run on a laptop CPU:

1. `extract_static.py` downloads the sampled images one by one, runs the hand and pose models, keeps only the landmarks.
2. `prefetch.py` + `extract_video.py` download the INCLUDE category archives (several at once), run the same models on
   every frame at 640 px wide, keep only the landmarks, delete the videos.
3. `train.py` augments on the raw landmarks (mirror for left-handed signers with the pose sides swapped, rotation
   ±10°, scale ±10 %, landmark noise, missed hand detections, trimmed starts and ends, dropped frames), trains, picks
   the threshold on held-out data, and exports `js/sign/models/*.json` with the measured accuracy.
4. `make_reference.py` builds the [ISL reference](isl-reference.md) from the same data.

## Measured accuracy

All numbers are on recordings the models were **not** trained on.

| Test | Result |
|---|---|
| **Words**, INCLUDE official test videos (335 videos, 106 signs) | **87 %** correct on the first guess, 94 % within the top 3. With the threshold: answers 84 % of the signs, and **94 %** of those answers are right; the rest are "not sure" |
| **Letters and numbers**, single images of **unseen signers** (trained on kids and teenagers, tested on the 6 adults; 2,055 images, 36 classes) | **81 %** correct on the first guess, 95 % within the top 3. Single images: answers 43 %, right 95 % of those |
| **End to end, words**: 80 INCLUDE test videos played frame by frame (25 fps, with the signers' own rest before and after) through the browser recogniser, segmentation included (`node tools/isl/replay.mjs`) | 66 correct, 5 wrong, 8 "not sure" (the right word was among the 3 suggestions for 6 of them), 1 not detected: **93 %** of answers right |
| **End to end, letters**: 150 unseen-signer images, each held for 1.2 s with small jitter, then hands down | 120 correct, **0 wrong**, 30 held back as "not sure" |
| **Browser page**: six test videos and five letters replayed through the page's own camera callbacks in headless Chrome | Text: "King Brother Queen Good night School How are you U5ZCX" for King, Brother, Queen, Good evening, School, How are you, U, 5, Z, C, X (Good evening was read as Good night, the most confused pair) |
| Browser model = Python model | Same answer on 400 / 400 inputs, probabilities within 10^-6 (`tools/isl/check_model.mjs`) |
| Browser features = Python features | Within 3 x 10^-7 on real videos (`tools/isl/check_features.mjs`) |

**Similar signs** confused most often: Good evening / Good night, Wife / Husband, he / she, Street or Road / Today
(words); X / E, D / X, T / K, M / N, N / R (letters); O / 0 share one hand shape and are told apart by context.

**What was tried for letters.** MLPs of two sizes, an RBF SVM, logistic regression, extra trees and k-nearest-neighbours
all reached 75 to 83 % on unseen signers; adding finger depth and hand-to-hand features added about one point. The
limit is the data (about 27 training signers), so the app relies on calibrated confidence: probabilities are
temperature-scaled on held-out signers (T = 2.1 for letters, 1.9 for words) before the threshold is applied.


## Limitations

- **Isolated signs only.** Sign one word at a time with a short rest between words. Continuous signing (signs flowing
  into each other without resting) is not segmented.
- **Vocabulary**: the words listed in the reference, A to Z and 0 to 9. Anything else is either "not sure" or, rarely,
  mistaken for a similar known sign.
- **Facial expressions and mouthing are not used** (MediaPipe's face model is not run). ISL uses them for questions,
  negation and emphasis, so "How are you" is recognised as a sign but a question asked only with the eyebrows is not.
- **Regional variation**: INCLUDE was recorded in Chennai; signers from other regions may use different signs for the
  same word. Letters: some letters (H, J, Y) involve movement, but the dataset has their last frame, so they are
  recognised from the final hand position.
- **Conditions**: the shoulders must be in view (the features are measured relative to them), and very low light or
  hands leaving the picture reduce accuracy. The accuracy above is on recorded data; live use with a webcam is usually
  somewhat lower, especially for people whose signing differs from the dataset signers.
- **Not a substitute for an interpreter.** This is a demonstration of the technology and a help for short exchanges.


## Demo signs and "Teach it your signs"

For a talk or demo, the Words mode has three sets (the buttons next to the mode switch):

- **Demo signs** (default): seven easy, distinct signs (Thank you, Hello, How are you, Good Morning, I, you, Pleased) plus anything
  you taught it (such as **Welcome**). The recogniser only chooses among these and uses a looser confidence threshold (0.45, margin 0.10),
  because with few candidates a lower probability is still reliable. Replayed end to end through the browser code on INCLUDE test
  videos of unseen signers (`tools/isl/replay_demo.mjs`): the seven signs 25 of 28 right, 1 wrong (I read as you), 2 not sure.
  For comparison, all 106 words gave 49 of 67 right on the wider phrase test (`tools/isl/replay_phrases.mjs`).
- **My signs**: appears once two or more signs are taught. Only the signs you taught.
- **All words**: the full 106-word vocabulary.

**Teach it your signs.** Choose a sign (or type a name), press *Record a sample*, sign, lower your hands; 3 times per sign.
**Welcome is not in INCLUDE**, so the network cannot know it: it works only through your recordings. A taught sign gets a boost
`s = p + (1 - p) * 0.8 * match` (known signs) or `0.95 * match` (signs the network does not know), where
`match = exp(-(d / 17)^4)` and `d` is the distance (standardised 16-step feature vectors) to the nearest of your recordings. A taught sign
never lowers the other signs. Distance scale: simulated repeats of one signer measured 8 to 14, other signs 17 and up
(`tools/isl/experiment_match.py`; repeats are augmented copies without mirroring, an optimistic stand-in for a real person).
The page warns if your recordings of one sign look too different from each other. Recordings are stored in this browser
(`localStorage`, key `dtl.signTemplates`) and never leave it.

Replay with simulated repeats of one signer taught as "Welcome" (`tools/isl/dump_repeats.py`): 5 of 5 held-out repeats recognised,
the other demo signs unchanged (22 right, 1 wrong, 2 not sure of 25), and none of 29 unrelated recordings was read as Welcome.
This has not been measured with a real person signing live.

A printable guide with pictures, a set-up checklist and a demo script: [isl-presentation-guide.pdf](isl-presentation-guide.pdf)
(built by `tools/isl/make_guide.py`).
