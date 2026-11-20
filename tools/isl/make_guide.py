"""Build docs/isl-presentation-guide.html (and the PDF, with Chrome) for the presentation phrases.

    python make_guide.py --docs ../../docs --models ../../js/sign/models --chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"

Pictures and descriptions come from docs/isl/index.json (measured from real INCLUDE signers, see make_reference.py).
"""
import argparse, html, json, os, subprocess, pathlib

PHRASES = ["Hello", "How are you", "Thank you", "Good Morning", "Good afternoon", "Pleased", "I", "you", "Friend", "Mother", "Father", "Today", "Tomorrow"]
MEANING = {"Hello": "Greeting", "How are you": "Asking how someone is", "Thank you": "Thanks", "Good Morning": "Morning greeting",
           "Good afternoon": "Afternoon greeting", "Pleased": "Pleased to meet you / happy", "I": "I, me", "you": "You (one person)",
           "Friend": "A friend", "Mother": "Mother", "Father": "Father", "Today": "Today", "Tomorrow": "Tomorrow"}
CSS = """
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1c2430; font-size: 11pt; line-height: 1.45; }
h1 { font-size: 26pt; margin: 0 0 4mm; } h2 { font-size: 15pt; margin: 6mm 0 2mm; border-bottom: 2px solid #4f6ef7; padding-bottom: 1mm; }
h3 { font-size: 12.5pt; margin: 0; }
.sub { color: #5a6677; } .box { border: 1px solid #cfd6e0; border-radius: 6px; padding: 3mm 4mm; margin: 3mm 0; background: #f6f8fb; }
.warn { background: #fff7e6; border-color: #f0c36d; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; } th, td { border: 1px solid #cfd6e0; padding: 1.6mm 2.4mm; text-align: left; vertical-align: top; }
th { background: #eef2f8; }
.card { break-inside: avoid; border: 1px solid #cfd6e0; border-radius: 8px; padding: 3mm 4mm 4mm; margin: 0 0 5mm; }
.card svg { width: 100%; height: auto; display: block; margin: 2mm 0; border: 1px solid #e3e8ef; border-radius: 6px; }
.tag { display: inline-block; font-size: 9pt; padding: 0 2mm; border-radius: 9px; background: #e5ebff; color: #2d46b9; margin-left: 2mm; }
.tag.low { background: #fde7e1; color: #a3361c; } .tag.ok { background: #e1f5e8; color: #1c7a3a; }
.pb { break-before: page; } ol, ul { margin: 1mm 0 1mm 5mm; padding: 0; } li { margin: 0.8mm 0; }
.steps li b { color: #2d46b9; }
"""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--docs", required=True); ap.add_argument("--models", required=True); ap.add_argument("--chrome")
    a = ap.parse_args()
    idx = json.load(open(os.path.join(a.docs, "isl", "index.json"), encoding="utf-8"))
    byl = {w["label"]: w for w in idx["words"]}
    wm = json.load(open(os.path.join(a.models, "words.json"), encoding="utf-8"))
    E = html.escape
    out = [f"<!doctype html><html><head><meta charset='utf-8'><title>ISL presentation guide</title><style>{CSS}</style></head><body>"]
    out.append("""<h1>Indian Sign Language: presentation guide</h1>
<p class="sub">13 everyday signs the Digital Twin Lab recognises reliably, and how to use them live. Seen from the camera, the signer's
<b>right hand is blue</b> and the left is orange; a grey hand is resting.</p>
<div class="box"><b>The 13 signs:</b> Hello, How are you, Thank you, Good Morning, Good afternoon, Pleased, I, you, Friend, Mother, Father, Today, Tomorrow.
On unseen signers in the INCLUDE test videos this list was recognised <b>43 of 48 times, with 1 wrong answer</b>; the rest were "not sure", never a wrong word.</div>

<h2>1. Before your presentation (5 minutes)</h2>
<ol class="steps">
<li><b>Set up.</b> Open <i>Sign language</i> in the app, press <i>Start camera</i> and wait until the badge says "Ready" (the first start takes about 5 seconds to load).</li>
<li><b>Position.</b> Sit or stand 1 to 1.5 m from the camera. Your head, both shoulders and both hands must be in the picture. Face a light (a window or lamp in front of you, not behind you).</li>
<li><b>Choose the set.</b> Keep <i>Presentation phrases</i> selected. This limits the app to the 13 signs above, which is far more accurate than all 106 words.</li>
<li><b>Teach it your signs (recommended).</b> In <i>Teach it your signs</i>, choose a sign, press <i>Record a sample</i>, sign it the way you will on stage, and lower your hands. Do it <b>3 times per sign</b> for the signs you will use. The app then switches to <i>My signs</i>: it looks only for those signs and compares them with your own recordings. Recordings stay in your browser.</li>
<li><b>Rehearse.</b> Sign each phrase once and check the text. If a sign comes out as "Not sure", tap the right suggestion, then record one more sample of that sign.</li>
</ol>

<h2>2. How to sign so it is detected</h2>
<table>
<tr><th style="width:32%">Do</th><th>Why</th></tr>
<tr><td><b>Start with hands down</b>, below the dashed rest line on screen</td><td>A sign begins when a hand rises above the line.</td></tr>
<tr><td><b>Sign one word, then lower your hands</b> and wait about half a second</td><td>Lowering the hands is what ends the sign. The word then appears.</td></tr>
<tr><td>Make the sign <b>clearly and a little slowly</b>, in front of your chest</td><td>Fast, small or hidden movements are missed.</td></tr>
<tr><td>Keep both shoulders in the picture; do not cover your hands with each other unless the sign needs it</td><td>The app measures where your hands are relative to your body.</td></tr>
<tr><td>Use the <b>Sign reference</b> button or the picture cards below to check the shape</td><td>Signs vary by region; teaching your own samples matches your style.</td></tr>
</table>
<div class="box warn"><b>What it cannot do:</b> read facial expressions, understand ISL grammar, or follow continuous signing without a rest between signs. It turns single signs into words, in the order you sign them.</div>

<h2>3. A short script for the talk</h2>
<table>
<tr><th>Sign these, with a rest between each</th><th>Text on screen</th></tr>
<tr><td>Hello</td><td>Hello</td></tr>
<tr><td>Hello, How are you</td><td>Hello How are you</td></tr>
<tr><td>I, Pleased</td><td>I Pleased</td></tr>
<tr><td>Good Morning, Friend</td><td>Good Morning Friend</td></tr>
<tr><td>Thank you</td><td>Thank you</td></tr>
</table>
<p class="sub">Tip: use the <i>Speak</i> button to read the text aloud for the audience.</p>
""")
    out.append("<div class='pb'></div><h2>4. The signs</h2>")
    out.append("<p class='sub'>Each picture shows the start, middle and end of the movement, drawn from the most typical recording of a real signer. The line under the picture is measured from the same recording. These pictures are a reminder, not a course: for a precise model of each sign, watch the ISLRTC video dictionary (islrtc.nic.in) or ask a Deaf signer.</p>")
    for l in PHRASES:
        w = byl.get(l)
        if not w:
            continue
        acc = w.get("accuracy")
        if acc is None:
            tag = "<span class='tag'>too few test videos to measure</span>"
        elif acc >= 0.9:
            tag = f"<span class='tag ok'>right in {round(acc * 100)}% of its test videos (only a few per sign)</span>"
        else:
            tag = f"<span class='tag low'>right in only {round(acc * 100)}% of its test videos: teach it your sign</span>"
        svg = open(os.path.join(a.docs, w["svg"]), encoding="utf-8").read()
        out.append(f"<div class='card'><h3>{E(l)}{tag}</h3><div class='sub'>{E(MEANING.get(l, ''))}</div>{svg}<div>{E(w['text'])}</div></div>")
    out.append("""<div class="pb"></div><h2>5. If something goes wrong on the day</h2>
<table>
<tr><th style="width:36%">Problem</th><th>What to do</th></tr>
<tr><td>Nothing happens when you sign</td><td>Check the badge says "Ready" and your hands go above the dashed rest line; make sure both shoulders are in view.</td></tr>
<tr><td>"Not sure" with suggestions</td><td>Tap the correct suggestion, or sign it again a little slower. Record another sample of that sign beforehand.</td></tr>
<tr><td>A different word appears</td><td>Use <i>Undo</i>. Record 3 samples of the sign in <i>Teach it your signs</i> and use <i>My signs</i>.</td></tr>
<tr><td>It is slow or the camera freezes</td><td>Close other tabs and apps that use the camera, press <i>Stop camera</i>, then <i>Start camera</i>.</td></tr>
<tr><td>The room is dark or very bright behind you</td><td>Light your face and hands from the front. Backlight makes the hands hard to track.</td></tr>
<tr><td>You need to be sure</td><td>Type or tap the words you need: tap a sign chip in "Signs it knows" to show its picture, and use <i>Speak</i> on the text.</td></tr>
</table>
<h2>6. About the data</h2>
<p>Words come from INCLUDE (Sridhar, Ganesan, Kumar, Khapra; AI4Bharat and IIT Madras), CC BY 4.0, recorded in Chennai.
The recogniser was trained on those recordings (landmarks only). Measured accuracy for the whole 106-word vocabulary is about
87% on the first guess for signers it has not seen; it is higher for a short list and for signs you have taught it.
Regional differences exist: if your sign differs from the picture, teach it your version.
Full reference: <b>docs/isl-reference.md</b> in the project.</p>
</body></html>""")
    p = os.path.join(a.docs, "isl-presentation-guide.html")
    open(p, "w", encoding="utf-8").write("\n".join(out))
    print("wrote", p)
    if a.chrome:
        pdf = os.path.join(a.docs, "isl-presentation-guide.pdf")
        subprocess.run([a.chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={os.path.abspath(pdf)}", pathlib.Path(os.path.abspath(p)).as_uri()], check=True, timeout=120)
        print("wrote", pdf, os.path.getsize(pdf) // 1024, "KB")


if __name__ == "__main__":
    main()
