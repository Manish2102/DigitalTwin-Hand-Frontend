"""Run an exported model JSON with numpy on cached letter features; dump inputs + probabilities for check_model.mjs."""
import base64, json, sys, numpy as np
m = json.load(open(sys.argv[1])); z = np.load(sys.argv[2])
f = lambda s: np.frombuffer(base64.b64decode(s), np.float32)
X, Y = z["Xte"][:400], z["Yte"][:400]
a = (X - f(m["mean"])) / f(m["std"])
for k, l in enumerate(m["layers"]):
    W = f(l["w"]).reshape(l["rows"], l["cols"]); a = a @ W.T + f(l["b"])
    if k < len(m["layers"]) - 1: a = np.maximum(a, 0)
a = a / m["temperature"]; a -= a.max(1, keepdims=True); P = np.exp(a); P /= P.sum(1, keepdims=True)
print(f"numpy: accuracy {(P.argmax(1) == Y).mean():.3f} on {len(Y)} adult images (the final model saw these signers)")
json.dump({"X": X.tolist(), "Y": Y.tolist(), "P": P.tolist()}, open(sys.argv[3], "w"))
