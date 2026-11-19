"""Extract hand and pose landmark sequences from INCLUDE (Indian Sign Language word videos).

Dataset: INCLUDE, Sridhar et al., ACM Multimedia 2020, AI4Bharat / IIT Madras, https://zenodo.org/records/4010759,
CC BY 4.0. The official train / val / test file lists come from github.com/AI4Bharat/INCLUDE (train_test_paths/).

For each category archive: download (the next one downloads while this one is processed), unzip, run the same
MediaPipe hand (2 hands) and pose models the browser uses on every frame at 640 px wide, save the landmarks,
delete the archive and the videos. Re-running skips archives that are already done.

    python extract_video.py --data C:/Projects/Digital-Twin/isl-data --categories Greetings Pronouns ...

Output: <data>/include/<archive>.npz with one entry per video (hands T x 2 x 21 x 3, side T x 2, pose T x 33 x 4,
fps, path, label, split).
"""
import argparse, os, shutil, subprocess, sys, threading, time, zipfile
from multiprocessing import Pool
import numpy as np

PARTS = {"Greetings": 2, "Pronouns": 2, "People": 5, "Days_and_Time": 3, "Society": 3, "Places": 4,
         "Adjectives": 8, "Animals": 2, "Clothes": 2, "Colours": 2, "Electronics": 2, "Home": 4, "Jobs": 2,
         "Means_of_Transportation": 2, "Seasons": 1}
URL = "https://zenodo.org/records/4010759/files/{}?download=1"
WIDTH = 640
_models = None


def _init(mdir):
    global _models
    _models = mdir


def process(path):
    import cv2, mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(_models, "hand_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO, num_hands=2,
        min_hand_detection_confidence=0.5, min_hand_presence_confidence=0.5, min_tracking_confidence=0.5))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(_models, "pose_landmarker_lite.task")),
        running_mode=vision.RunningMode.VIDEO))
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    H, S, P = [], [], []
    t = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        if w > WIDTH:
            frame = cv2.resize(frame, (WIDTH, int(h * WIDTH / w)), interpolation=cv2.INTER_AREA)
        im = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        ts = int(t * 1000 / fps); t += 1
        hr, pr = hands.detect_for_video(im, ts), pose.detect_for_video(im, ts)
        hh = np.full((2, 21, 3), np.nan, np.float32); ss = np.zeros(2, np.int8)
        for k, lm in enumerate(hr.hand_landmarks[:2]):
            hh[k] = [[p.x, p.y, p.z] for p in lm]
            ss[k] = 1 if hr.handedness[k][0].category_name == "Right" else -1
        pp = np.full((33, 4), np.nan, np.float32)
        if pr.pose_landmarks:
            pp[:] = [[p.x, p.y, p.z, p.visibility] for p in pr.pose_landmarks[0]]
        H.append(hh); S.append(ss); P.append(pp)
    cap.release(); hands.close(); pose.close()
    return path, fps, np.array(H), np.array(S), np.array(P)


def download(name, dest):
    if os.path.exists(dest):                                     # already fetched by prefetch.py
        return True
    tmp = dest + ".part"
    lock = dest + ".lock"
    while os.path.exists(lock):                                  # prefetch.py is downloading it right now
        time.sleep(5)
        if os.path.exists(dest):
            return True
    for k in range(5):
        r = subprocess.run(["curl", "-sL", "--retry", "5", "-C", "-", "-o", tmp, URL.format(name)])
        if r.returncode == 0 and os.path.getsize(tmp) > 1_000_000:
            try:
                zipfile.ZipFile(tmp).close()
                os.replace(tmp, dest); return True
            except zipfile.BadZipFile:
                pass
        time.sleep(10 * (k + 1))
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--categories", nargs="+", required=True)
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    out_dir = os.path.join(a.data, "include"); work = os.path.join(a.data, "work")
    os.makedirs(out_dir, exist_ok=True); os.makedirs(work, exist_ok=True)
    split = {}
    for s in ("train", "val", "test"):
        for line in open(os.path.join(a.data, "include_meta", f"include_{s}.txt"), encoding="utf-8"):
            if line.strip():
                split[line.strip()] = s
    archives = [f"{c}_{i}of{PARTS[c]}.zip" for c in a.categories for i in range(1, PARTS[c] + 1)]
    todo = [z for z in archives if not os.path.exists(os.path.join(out_dir, z.replace(".zip", ".npz")))]
    print(f"{len(todo)} of {len(archives)} archives to do", flush=True)

    fetched = {}
    def prefetch(name):
        fetched[name] = download(name, os.path.join(work, name))
    th = None
    if todo:
        th = threading.Thread(target=prefetch, args=(todo[0],)); th.start()
    with Pool(a.workers, initializer=_init, initargs=(os.path.join(a.data, "models"),)) as pool:
        for n, name in enumerate(todo):
            t0 = time.time()
            th.join()
            if n + 1 < len(todo):
                th = threading.Thread(target=prefetch, args=(todo[n + 1],)); th.start()
            zpath = os.path.join(work, name)
            if not fetched.get(name):
                print(f"FAILED download {name}", flush=True); continue
            xdir = os.path.join(work, name[:-4])
            with zipfile.ZipFile(zpath) as z:
                z.extractall(xdir)
            os.remove(zpath)
            vids = []
            for root, _, files in os.walk(xdir):
                for f in files:
                    if f.lower().endswith((".mov", ".mp4", ".avi")):
                        vids.append(os.path.join(root, f))
            res = pool.map(process, sorted(vids), chunksize=1)
            rec = {"path": [], "label": [], "split": [], "fps": [], "hands": [], "side": [], "pose": []}
            for path, fps, H, S, P in res:
                rel = os.path.relpath(path, xdir).replace("\\", "/")
                parts = rel.split("/")
                key = "/".join(parts[-3:])                       # Category/NN. Word/MVI_xxxx.MOV
                rec["path"].append(key); rec["label"].append(parts[-2]); rec["split"].append(split.get(key, "unknown"))
                rec["fps"].append(fps); rec["hands"].append(H); rec["side"].append(S); rec["pose"].append(P)
            np.savez_compressed(os.path.join(out_dir, name.replace(".zip", ".npz")),
                                path=np.array(rec["path"]), label=np.array(rec["label"]), split=np.array(rec["split"]),
                                fps=np.array(rec["fps"]), hands=np.array(rec["hands"], dtype=object),
                                side=np.array(rec["side"], dtype=object), pose=np.array(rec["pose"], dtype=object))
            shutil.rmtree(xdir, ignore_errors=True)
            unknown = rec["split"].count("unknown")
            print(f"{name}: {len(vids)} videos, {sum(len(h) for h in rec['hands'])} frames, {unknown} not in split lists, "
                  f"{time.time() - t0:.0f}s", flush=True)
    print("all done", flush=True)


if __name__ == "__main__":
    main()
