"""Download INCLUDE archives ahead of extract_video.py, several at once (Zenodo is about 2 MB/s per connection).

    python prefetch.py --data <isl-data> --categories ... --parallel 3 --ahead 4

Keeps at most `ahead` finished-but-unprocessed archives on disk. Files go to <data>/work/<name> (with a .lock file
while downloading); extract_video.py picks them up and deletes them after processing.
"""
import argparse, os, subprocess, time, zipfile
from concurrent.futures import ThreadPoolExecutor
from extract_video import PARTS, URL


def fetch(work, name):
    dest = os.path.join(work, name); tmp = dest + ".part"; lock = dest + ".lock"
    if os.path.exists(dest):
        return name, True
    open(lock, "w").close()
    try:
        for k in range(6):
            r = subprocess.run(["curl", "-sL", "--retry", "5", "-C", "-", "-o", tmp, URL.format(name)])
            if r.returncode in (0, 33) and os.path.exists(tmp) and os.path.getsize(tmp) > 1_000_000:
                try:
                    zipfile.ZipFile(tmp).close(); os.replace(tmp, dest); return name, True
                except zipfile.BadZipFile:
                    pass
            time.sleep(10 * (k + 1))
        return name, False
    finally:
        os.remove(lock)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--categories", nargs="+", required=True)
    ap.add_argument("--parallel", type=int, default=3); ap.add_argument("--ahead", type=int, default=4)
    a = ap.parse_args()
    out, work = os.path.join(a.data, "include"), os.path.join(a.data, "work")
    os.makedirs(work, exist_ok=True)
    todo = [f"{c}_{i}of{PARTS[c]}.zip" for c in a.categories for i in range(1, PARTS[c] + 1)]
    todo = [z for z in todo if not os.path.exists(os.path.join(out, z.replace(".zip", ".npz")))]
    with ThreadPoolExecutor(a.parallel) as ex:
        futs = []
        for name in todo:
            while sum(f.endswith(".zip") for f in os.listdir(work)) + sum(not f.done() for f in futs) >= a.ahead + a.parallel - 1:
                time.sleep(10)
            futs.append(ex.submit(fetch, work, name))
        for f in futs:
            n, ok = f.result(); print(n, "ok" if ok else "FAILED", flush=True)


if __name__ == "__main__":
    main()
