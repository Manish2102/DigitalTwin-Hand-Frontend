# Deployment and configuration

The frontend is a **static site with no build step**. Any static host works; the instructions below are for
Vercel, which is what the project uses.

## Prerequisite: the backend

The app needs the relay backend for the phone and the twin to talk. Deploy it first and note its URL. See
the [backend deployment guide](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/deployment.md).

## Configuration

There is one setting, in [`js/config.js`](../js/config.js):

```js
const DEFAULT_BACKEND = "https://digitaltwin-hand-backend.vercel.app";   // your backend, no trailing slash
const LOCAL_BACKEND   = "http://localhost:8000";                          // used when the page runs on localhost
```

| Situation | Backend used |
|---|---|
| Page URL contains `?backend=https://...` | That URL (useful for testing a different deployment; the QR code passes it on to the phone) |
| Page served from `localhost` or `127.0.0.1` | `LOCAL_BACKEND` |
| Anything else | `DEFAULT_BACKEND` |

There are no environment variables and no secrets in the frontend.

## `vercel.json`

```json
{
  "rewrites": [{ "source": "/phone", "destination": "/phone.html" }],
  "headers": [{ "source": "/(.*)", "headers": [{ "key": "Permissions-Policy", "value": "camera=(self)" }] }]
}
```

| Entry | Purpose |
|---|---|
| Rewrite | `/phone` serves `phone.html` (the QR code links to `phone.html?room=...` directly; the short path is a convenience) |
| `Permissions-Policy: camera=(self)` | Explicitly allows the page to use the camera |

## Deploy to Vercel

1. In Vercel, create a project from the `DigitalTwin-Hand-Frontend` repository.
2. Framework preset: **Other**. No build command and no output directory.
3. Make sure `DEFAULT_BACKEND` in `js/config.js` matches your backend, commit, and push.
4. Every push to `main` deploys to production automatically.

### Current production setup

| Item | Value |
|---|---|
| URL | `https://digitaltwin-hand-frontend.vercel.app` |
| Backend | `https://digitaltwin-hand-backend.vercel.app` (region `bom1`) |
| Deploys | Automatic from the `main` branch |

## Run locally

```bash
python -m http.server 5173
```

Open `http://localhost:5173`. The page uses `http://localhost:8000`, so run the backend too
(`uvicorn app:app --port 8000` in the backend repo).

| What works locally | What does not |
|---|---|
| Both twins, **Simulate hand**, **Simulate delivery trip**, record and replay, the design system | A real phone: the camera and motion sensors need HTTPS. Test those against the deployed site. |
| Streaming fake data with the backend's `tools/fake_phone.py --room <ROOM>` | |

To exercise the full path from a real phone, deploy (or use a tunnel) and open the Vercel URL on the laptop.

## External resources

The page loads these at runtime, so it needs internet access:

| Resource | Used by | Purpose |
|---|---|---|
| `cdnjs.cloudflare.com` (`qrcodejs`) | Twin page | QR code in the connect dialog |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Both pages | Inter font (falls back to system fonts) |
| `cdn.jsdelivr.net` (`@mediapipe/tasks-vision` 0.10.14) | Phone page | Hand tracking runtime |
| `storage.googleapis.com` (hand landmarker model) | Phone page | The model file (about 8 MB, cached by the browser) |

If a CDN is blocked, the page degrades rather than breaks (no QR code or fallback font), except that the phone
page cannot track hands without the MediaPipe resources.

## Release checklist

- [ ] Backend deployed, `/api/health` returns `"redis": "connected"`
- [ ] `DEFAULT_BACKEND` points at it
- [ ] Open the site, confirm the header shows a room code and the connect dialog shows a QR code
- [ ] Press **Simulate hand** and **Simulate delivery trip** and confirm both twins react
- [ ] Open the phone link on a real phone, confirm "Phone connected", then test the camera and the motion sensors
- [ ] Download a delivery report and a recording

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Header says "Phone offline" with a phone open | Different rooms, or the backend URL differs between the two pages | Compare the room codes; if you used `?backend=`, scan the QR code from the same page |
| Activity log never shows "Linked to backend" | Backend unreachable or `DEFAULT_BACKEND` wrong | Open `<backend>/api/health` in the browser |
| Phone: "open this page with https://" | Page opened over HTTP | Use the HTTPS URL |
| Changes not visible after a push | Browser or CDN cache | Hard refresh; confirm the deployment finished in Vercel |
| QR code missing | `cdnjs.cloudflare.com` blocked | Use the copy button for the link instead |
| Works locally, not deployed | `DEFAULT_BACKEND` still points at an old URL | Update `js/config.js` and push |
