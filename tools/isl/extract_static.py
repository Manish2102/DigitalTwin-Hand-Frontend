"""Extract hand and pose landmarks from the ISL static-gesture image dataset (alphabet and numerals).

Dataset: "Static gestures of Indian Sign Language (ISL) for English Alphabet, Hindi Vowels and Numerals",
Mendeley Data, doi 10.17632/7tsw22y96w.1, CC BY 4.0. 33 signers (kids, teenagers, adults), full and half sleeves.

The script samples PER_GROUP images per sign from each of the six age/sleeve groups, downloads them one by one,
runs the same MediaPipe hand and pose models the browser uses, stores only the landmarks, and deletes the image.

    python extract_static.py --data C:/Projects/Digital-Twin/isl-data

Output: <data>/static_raw.npz with, per sample: label, group, both hands (21 x 3, image coordinates 0..1,
NaN when missing), handedness score, pose (33 x 4), image size.
"""
import argparse, json, os, random, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

PER_GROUP = 60
API = "https://data.mendeley.com/public-api/datasets/7tsw22y96w"


def folder_paths(folders):
    F = {f["id"]: f for f in folders}
    def path(fid):
        p = []
        while fid in F:
            p.append(F[fid]["name"]); fid = F[fid].get("parent_id")
        return list(reversed(p))
    return path


def fetch(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (dataset-download)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            time.sleep(2 + 3 * k)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--per-group", type=int, default=PER_GROUP)
    a = ap.parse_args()
    meta = json.load(open(os.path.join(a.data, "mendeley_meta.json"), encoding="utf-8"))
    folders = json.load(open(os.path.join(a.data, "mendeley_folders.json"), encoding="utf-8"))
    path = folder_paths(folders)

    groups = {}
    for f in meta["files"]:
        p = path(f["folder_id"])
        if len(p) < 5 or p[3] not in ("English Alphabet", "Numerals"):
            continue
        label, group = p[4], f"{p[1][:2]}{'F' if 'Full' in p[2] else 'H'}"   # e.g. "2.F" = teenagers, full sleeves
        groups.setdefault((label, group), []).append(f["content_details"]["download_url"])
    rnd = random.Random(7)
    jobs = []
    for (label, group), urls in sorted(groups.items()):
        for u in rnd.sample(urls, min(a.per_group, len(urls))):
            jobs.append((label, group, u))
    print(f"{len(jobs)} images from {len(groups)} sign/group folders", flush=True)

    mdir = os.path.join(a.data, "models")
    hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(mdir, "hand_landmarker.task")),
        running_mode=vision.RunningMode.IMAGE, num_hands=2, min_hand_detection_confidence=0.3))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(mdir, "pose_landmarker_lite.task")),
        running_mode=vision.RunningMode.IMAGE))

    out = {"label": [], "group": [], "hands": [], "hscore": [], "hside": [], "pose": [], "size": []}
    t0 = time.time()
    with ThreadPoolExecutor(12) as ex:
        for n, (job, data) in enumerate(zip(jobs, ex.map(lambda j: fetch(j[2]), jobs))):
            label, group, _ = job
            if not data:
                continue
            img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                continue
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            im = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            hr, pr = hands.detect(im), pose.detect(im)
            H = np.full((2, 21, 3), np.nan, np.float32); S = np.zeros(2, np.float32); side = np.zeros(2, np.int8)
            for k, lm in enumerate(hr.hand_landmarks[:2]):
                H[k] = [[p.x, p.y, p.z] for p in lm]
                S[k] = hr.handedness[k][0].score
                side[k] = 1 if hr.handedness[k][0].category_name == "Right" else -1
            P = np.full((33, 4), np.nan, np.float32)
            if pr.pose_landmarks:
                P[:] = [[p.x, p.y, p.z, p.visibility] for p in pr.pose_landmarks[0]]
            out["label"].append(label); out["group"].append(group); out["hands"].append(H); out["hscore"].append(S)
            out["hside"].append(side); out["pose"].append(P); out["size"].append(img.shape[:2])
            if n % 500 == 0:
                print(f"{n}/{len(jobs)}  {time.time() - t0:.0f}s", flush=True)
    np.savez_compressed(os.path.join(a.data, "static_raw.npz"),
                        label=np.array(out["label"]), group=np.array(out["group"]), hands=np.array(out["hands"]),
                        hscore=np.array(out["hscore"]), hside=np.array(out["hside"]), pose=np.array(out["pose"]),
                        size=np.array(out["size"]))
    found = np.array([np.isfinite(h[:, 0, 0]).sum() for h in out["hands"]])
    print(f"done: {len(out['label'])} samples, hands found 0/1/2: {np.bincount(found, minlength=3).tolist()}, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
