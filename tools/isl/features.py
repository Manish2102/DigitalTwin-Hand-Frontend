"""Python copy of js/sign/features.js (keep them identical; check_features.mjs compares the two)."""
import math
import numpy as np

FRAME_DIM, SEQ_T = 96, 16
REST_Y = 1.25


def is_active(v):
    return (v[0] > 0 and v[2] < REST_Y) or (v[43] > 0 and v[45] < REST_Y)
L_SH, R_SH, L_EL, R_EL, L_WR, R_WR, NOSE = 11, 12, 13, 14, 15, 16, 0


def anchors(pose, aspect):
    if pose is None:
        return None
    l, r = pose[L_SH], pose[R_SH]
    if not (np.isfinite(l[0]) and np.isfinite(r[0])):
        return None
    s = math.hypot((l[0] - r[0]) * aspect, l[1] - r[1])
    if not s > 0.02:
        return None
    return ((l[0] + r[0]) / 2, (l[1] + r[1]) / 2, s)


def _body(p, a, aspect):
    return ((p[0] - a[0]) * aspect) / a[2], (p[1] - a[1]) / a[2]


def frame_features(hands, pose, a, aspect):
    """hands: list of (21, >=2) arrays (NaN rows = missing hand); pose: (33, >=2) or None; a: anchors."""
    f = np.zeros(FRAME_DIM, np.float32)
    valid = [h for h in hands if h is not None and np.isfinite(h[0][0])]
    slots = [None, None]
    if pose is not None and valid:
        wr = [pose[R_WR], pose[L_WR]]
        d = lambda h, k: math.hypot((h[0][0] - wr[k][0]) * aspect, h[0][1] - wr[k][1])
        if len(valid) >= 2:
            h0, h1 = valid[0], valid[1]
            if d(h0, 0) + d(h1, 1) <= d(h0, 1) + d(h1, 0):
                slots = [h0, h1]
            else:
                slots = [h1, h0]
        else:
            h = valid[0]
            slots[0 if d(h, 0) <= d(h, 1) else 1] = h
    elif valid:
        s = sorted(valid, key=lambda h: h[0][0])
        slots[0] = s[0]
        if len(s) > 1:
            slots[1] = s[1]
    o = 0
    for k in range(2):
        h = slots[k]
        if h is None:
            o += 43
            continue
        f[o] = 1; o += 1
        w = _body(h[0], a, aspect); f[o] = w[0]; f[o + 1] = w[1]; o += 2
        hs = math.hypot((h[9][0] - h[0][0]) * aspect, h[9][1] - h[0][1]) or 1e-3
        for i in range(1, 21):
            f[o] = ((h[i][0] - h[0][0]) * aspect) / hs; f[o + 1] = (h[i][1] - h[0][1]) / hs; o += 2
    for i in (R_EL, L_EL, R_WR, L_WR, NOSE):
        p = pose[i] if pose is not None else None
        if p is not None and np.isfinite(p[0]):
            b = _body(p, a, aspect); f[o] = b[0]; f[o + 1] = b[1]
        o += 2
    return f


def sequence_features(frames):
    """frames: list of FRAME_DIM vectors in time order -> (SEQ_T * FRAME_DIM,) or None."""
    has = is_active
    a, b = 0, len(frames) - 1
    while a <= b and not has(frames[a]): a += 1
    while b >= a and not has(frames[b]): b -= 1
    if b - a + 1 < 4:
        return None
    seg = [np.array(v, np.float32) for v in frames[a:b + 1]]
    for off in (0, 43):
        orig = [v[off] > 0 for v in seg]; src = [v[off:off + 43].copy() for v in seg]
        for i in range(len(seg)):
            if orig[i]:
                continue
            found = -1
            for d in range(1, 5):
                if i - d >= 0 and orig[i - d]:
                    found = i - d; break
                if i + d < len(seg) and orig[i + d]:
                    found = i + d; break
            if found >= 0:
                seg[i][off:off + 43] = src[found]
    n = len(seg); out = np.zeros(SEQ_T * FRAME_DIM, np.float32)
    for t in range(SEQ_T):
        pos = t * (n - 1) / (SEQ_T - 1); i = int(math.floor(pos)); u = pos - i; j = min(n - 1, i + 1)
        out[t * FRAME_DIM:(t + 1) * FRAME_DIM] = seg[i] * (1 - u) + seg[j] * u
    return out


def video_frames(hands, pose, aspect):
    """hands (T,2,21,3), pose (T,33,4) -> list of frame vectors, carrying anchors over frames without a pose."""
    out, last = [], None
    for t in range(len(hands)):
        p = pose[t] if np.isfinite(pose[t][0][0]) else None
        a = anchors(p, aspect) or last
        if a is None:
            out.append(np.zeros(FRAME_DIM, np.float32)); continue
        last = a
        hs = [hands[t][k] for k in range(hands.shape[1]) if np.isfinite(hands[t][k][0][0])]
        out.append(frame_features(hs, p, a, aspect))
    return out
