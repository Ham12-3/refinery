"""Track label anchor points through the refinery clip with pyramidal Lucas-Kanade
optical flow and write normalized per-frame positions to data/tracks.json."""
import cv2, json, sys, numpy as np

VIDEO = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data/tracks.json'

# id: (seed_frame, x, y, first_frame, last_frame)  -- pixel coords at 1280x720
# a label may have several segments (e.g. re-seeded after an occlusion)
SEEDS = {
    'flare':     [(0,   588, 100, 0,   100)],
    'column':    [(40,  725, 240, 0,   62)],
    'reactor':   [(40,  462, 600, 0,   122)],
    'heater':    [(0,   600, 600, 0,   40), (80, 628, 660, 41, 112)],
    'tanker':    [(0,   980, 262, 0,   70), (191, 1045, 205, 71, 191)],
    'tankfarm':  [(191, 975, 470, 110, 191)],
    'piperack':  [(191, 745, 520, 135, 191)],
    'jetty':     [(0,   200, 278, 0,   45), (191, 140, 232, 132, 191)],
    'units':     [(191, 455, 140, 140, 191)],
}

cap = cv2.VideoCapture(VIDEO)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY))
N = len(frames); H, W = frames[0].shape
LK = dict(winSize=(31, 31), maxLevel=4,
          criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))

def feats(img, x, y, r=45):
    mask = np.zeros_like(img)
    cv2.rectangle(mask, (int(x-r), int(y-r)), (int(x+r), int(y+r)), 255, -1)
    p = cv2.goodFeaturesToTrack(img, 40, 0.01, 4, mask=mask)
    return p if p is not None else np.array([[[x, y]]], np.float32)

def run(seed, x, y, stop, step):
    out = {seed: (x, y)}
    pts = feats(frames[seed], x, y)
    i = seed
    while i != stop:
        j = i + step
        a, b = frames[i], frames[j]
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, **LK)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(b, a, nxt, None, **LK)
        fb = np.linalg.norm((pts - back).reshape(-1, 2), axis=1)
        good = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < 1.5)
        if good.sum() < 3:
            break
        d = np.median((nxt - pts).reshape(-1, 2)[good], axis=0)
        x, y = x + d[0], y + d[1]
        out[j] = (x, y)
        pts = nxt[good].reshape(-1, 1, 2)
        if len(pts) < 15:
            pts = feats(b, x, y)
        i = j
    return out

tracks = {}
for key, segs in SEEDS.items():
    pos = {}
    for seed, x, y, f0, f1 in segs:
        seg = {seed: (x, y)}
        seg.update(run(seed, x, y, f1, 1) if seed < f1 else {})
        seg.update(run(seed, x, y, f0, -1) if seed > f0 else {})
        pos.update({n: p for n, p in seg.items() if f0 <= n <= f1})
    arr = []
    for n in range(N):
        if n in pos and -40 < pos[n][0] < W+40 and -40 < pos[n][1] < H+40:
            arr.append([round(float(pos[n][0]) / W, 4), round(float(pos[n][1]) / H, 4)])
        else:
            arr.append(None)
    tracks[key] = arr
    ok = [n for n, v in enumerate(arr) if v]
    print(f'{key:9s} frames {ok[0] if ok else "-"}..{ok[-1] if ok else "-"}  ({len(ok)})')

json.dump({'frames': N, 'width': W, 'height': H, 'tracks': tracks}, open(OUT, 'w'))
