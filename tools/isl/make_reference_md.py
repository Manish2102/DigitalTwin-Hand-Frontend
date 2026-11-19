"""Write docs/isl-reference.md from docs/isl/index.json (made by make_reference.py) and the models' evaluation.

    python make_reference_md.py --docs ../../docs --models ../../js/sign/models
"""
import argparse, json, os

INTRO = """# Indian Sign Language (ISL) reference

This is every sign the [Sign language](sign-language.md) section recognises, with a picture and a short
description of how it is made. **Nothing here is drawn or written by hand:** for each sign, the most typical recording
in the training data (the one closest to the average of all recordings of that sign) is drawn as a skeleton, and the
description is measured from the same recording: how many hands, the hand shape (which fingers are straight), where the
sign is made, which way the hand moves, and whether the movement repeats.

**Reading the pictures.** You see the signer facing you, as on a video call, so the signer's **right hand (blue)** is on
the **left** of the picture and the left hand (orange) on the right. A grey hand is resting. Word signs show the start,
middle and end of the movement, with the path of each wrist dashed on the middle figure and an arrow at its end.
Letters and numbers show the whole person and, beside it, an enlarged view of the hands.

**Accuracy** is how often the app recognised that sign correctly in recordings it was not trained on (words: INCLUDE's
test videos; letters and numbers: adult signers, while training used kids and teenagers). A blank means too few test
recordings.

**Learning ISL.** These pictures are a reminder, not a course. To learn signs properly, use the video dictionary of the
[Indian Sign Language Research and Training Centre (ISLRTC)](https://islrtc.nic.in/) and learn from Deaf signers.
Signs vary between regions; the word signs here were recorded in Chennai.

Sources: words from **INCLUDE** (Sridhar, Ganesan, Kumar, Khapra; AI4Bharat and IIT Madras; ACM Multimedia 2020),
[zenodo.org/records/4010759](https://zenodo.org/records/4010759), CC BY 4.0. Letters and numbers from **Static gestures
of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals**, Mendeley Data,
[doi 10.17632/7tsw22y96w.1](https://data.mendeley.com/datasets/7tsw22y96w), CC BY 4.0. The pictures and descriptions
are derived from these datasets (landmarks only) and are shared under the same licence.
"""

PHRASES = [
    ("HELLO + HOW ARE YOU", "Hello, how are you?"),
    ("GOOD MORNING + THANK YOU", "Good morning, thank you."),
    ("I + PLEASED", "I am pleased."),
    ("YOU + FRIEND", "You are a friend."),
    ("MOTHER + FATHER + HOUSE", "Mother and father are at home."),
    ("TOMORROW + I + SCHOOL", "Tomorrow I go to school."),
    ("TODAY + MONDAY", "Today is Monday."),
    ("FRIEND + HOSPITAL + TODAY", "A friend is in hospital today."),
    ("BROTHER + OFFICE + EVENING", "Brother is at the office in the evening."),
    ("WE + MARKET + SATURDAY", "We go to the market on Saturday."),
]

CAT_ORDER = [("Greetings", "Greetings and everyday expressions"), ("Pronouns", "Pronouns"), ("People", "People and family"),
             ("Days and Time", "Days and time"), ("Places", "Places"), ("Society", "Society")]


def pct(x):
    return "" if x is None else f"{round(x * 100)} %"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", required=True); ap.add_argument("--models", required=True)
    a = ap.parse_args()
    idx = json.load(open(os.path.join(a.docs, "isl", "index.json")))
    wm = json.load(open(os.path.join(a.models, "words.json"))); lm = json.load(open(os.path.join(a.models, "letters.json")))
    we, le = wm["eval"], lm["eval"]
    out = [INTRO]
    out.append("## Contents\n\n" + "\n".join(f"- [{t}](#{t.lower().replace(' ', '-').replace(',', '')})" for t in
               ["Overview and accuracy", "Fingerspelling: letters A to Z", "Numbers 0 to 9"] + [c[1] for c in CAT_ORDER] +
               ["Questions", "Phrases and sentences", "Signs that look alike", "What is not supported yet"]) + "\n")
    out.append(f"""## Overview and accuracy

| | Signs | Correct on first guess | Right answer in top 3 | When it answers |
|---|---|---|---|---|
| Words | {len(wm['labels'])} | {pct(we['top1'])} of {we['n']} test videos | {pct(we['top3'])} | answers {pct(we['coverage'])} of the time, and is right {pct(we['precision'])} of those times |
| Letters and numbers | {len(lm['labels'])} | {pct(le['top1'])} of {le['n']} single images of unseen signers | {pct(le['top3'])} | single images: answers {pct(le['coverage'])}, right {pct(le['precision'])}; live, letters are held for half a second, which makes it answer far more often |

When it is not sure, the app says so and shows its best three guesses instead of writing a wrong word.
""")

    def table(rows, letter):
        t = ["| Sign | Picture | How it is made | Accuracy |", "|---|---|---|---|"]
        for r in rows:
            t.append(f"| **{r['label']}** | <img src=\"{r['svg']}\" width=\"{240 if letter else 340}\" alt=\"ISL sign {r['label']}\"> | {r['text']} | {pct(r.get('accuracy'))} |")
        return "\n".join(t) + "\n"

    letters = [r for r in idx["letters"] if not r["label"].isdigit()]
    numbers = [r for r in idx["letters"] if r["label"].isdigit()]
    out.append("## Fingerspelling: letters A to Z\n\nISL fingerspelling mostly uses **both hands**. Hold each letter still for about half a second; "
               "lower your hands to end a word. E has two common forms in the dataset; both are recognised. H, J and Y involve movement, "
               "but the dataset records their final position, which is what the app recognises.\n\n" + table(letters, True))
    out.append("## Numbers 0 to 9\n\nNumbers are mostly one hand. **0 and the letter O share one hand shape**: the app writes 0 after another digit "
               "and O otherwise. 9 has two common forms in the dataset; both are recognised.\n\n" + table(numbers, True))
    for cat, title in CAT_ORDER:
        rows = sorted([r for r in idx["words"] if r["category"] == cat], key=lambda r: r["label"].lower())
        out.append(f"## {title}\n\n" + table(rows, False))
    out.append("""## Questions

The vocabulary has one question sign, **HOW ARE YOU** (see Greetings). In ISL, questions are mostly marked with the face
(raised or lowered eyebrows) and with question signs such as WHAT, WHERE and WHY. The app does not read facial expressions
and these question signs are not in the trained vocabulary yet, so it cannot tell a question from a statement. A question
mark is not added automatically.

## Phrases and sentences

The app recognises **one sign at a time** and writes the signs in the order they were made (ISL gloss order). You can sign
these sequences with a short rest (hands down) between signs. The English line is the usual meaning; ISL grammar also uses
space, direction and facial expression, which the app does not read, and the app does not translate the gloss into English.

| Sign sequence (one sign at a time) | Usual meaning |
|---|---|
""" + "\n".join(f"| {s} | {m} |" for s, m in PHRASES) + "\n")
    conf = we.get("confusions", []) + le.get("confusions", [])
    out.append("## Signs that look alike\n\nThese pairs were confused most often in the test recordings. Make the difference clear "
               "(hand shape, place, movement) and, if the app shows *Not sure*, tap the right suggestion.\n\n| Signed | Sometimes read as | Times |\n|---|---|---|\n" +
               "\n".join(f"| {x} | {y} | {n} |" for x, y, n in conf) + "\n")
    out.append("""## What is not supported yet

- Words outside the list above (INCLUDE has 263 signs in 15 categories; six categories are used so far), continuous signing
  without a rest between signs, facial expressions and mouthing, ISL grammar (space, direction, classifier signs), Hindi
  vowels in the fingerspelling dataset, and two-person conversations.
- More vocabulary can be added by extracting more INCLUDE categories and retraining (see [sign-language.md](sign-language.md)).
""")
    open(os.path.join(a.docs, "isl-reference.md"), "w", encoding="utf-8").write("\n".join(out))
    print("wrote isl-reference.md:", len(idx["letters"]), "letters/numbers,", len(idx["words"]), "words")


if __name__ == "__main__":
    main()
