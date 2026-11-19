# Extending the app

The app is built so that new twins and message types slot in without touching the backend. This guide
lists the steps, using the existing twins as the model.

## Add a new twin (section)

Example: a "balance" twin that uses the phone's orientation as a spirit level.

1. **Phone: produce the data.** In `phone.html`, add the sensor code and send a new message type, for
   example `send({ type: "level", ts: Date.now(), ... })`. Add a card for it using the design-system
   classes (`.card`, `.card-head`, `.btn`).
2. **Phone: react to feedback.** Handle any new twin-to-phone messages in `ws.onmessage`, and extend the
   `mode` handler so the right card is highlighted.
3. **Twin: add the section markup.** In `index.html`:
   - Add a sidebar button: `<button class="nav-item" data-section="level">` with an icon and title.
   - Add `<section class="section" id="sec-level">` containing a `.toolbar` and a `.workspace`
     (stage plus `.panel` of cards).
4. **Twin: register it.** In `js/nav.js`, add an entry to `SECTIONS`:
   ```js
   level: { title: "Spirit level", desc: "..." }
   ```
5. **Twin: write the logic.** Create `js/level.js`. Subscribe with
   `on("message", m => { if (m.type === "level") ... })`, send feedback with `sendToPhone({...})`, log with
   `logEvent(...)`, notify the user with `toast(...)`.
6. **Twin: load it.** Add `import "./level.js";` to `js/app.js`.
7. **Document it.** Add the message to the backend's `docs/protocol.md` and a page under `docs/`.

No backend change is needed: the relay forwards any JSON.

## Add a message type

See [Adding a message type](https://github.com/Manish2102/DigitalTwin-Hand-Backend/blob/main/docs/protocol.md#adding-a-message-type)
in the protocol document. In short: choose a `type`, send it, handle it on the other side, and ignore unknown
types.

## Add a shipping rule (parcel twin)

In `js/pose.js`, `handlePose()`:

1. Add a penalty to `PENALTY` and an entry to `KIND` (icon and name).
2. Add the check beside the existing rules. Use `addIncident(kind, level, text)` to record it; this also
   updates the score, flashes the stage for critical incidents and notifies the phone.
3. For rules that start and end (like tilt), keep an "active incident" object on `trip` and end it with
   hysteresis so a reading hovering at the limit does not raise many incidents.
4. For instantaneous rules, use a cooldown timestamp.
5. If it needs new sensor data, add a field to the `pose` message in `phone.html` and document it.

## Add a gesture (hand twin)

1. In `core.js`, extend `classify()` with the new finger pattern and add an entry to `GESTURES`
   (label, icon name, colour).
2. Act on it in `ingest()` (next to the `draw` and `palm` branches).
3. Add a row to the gesture guide in `index.html`.
4. Add the colour to the time-per-gesture legend if needed (it reads `GESTURES`).

## Add an icon

Icons are inline SVG in `js/icons.js`. Add the inner SVG markup (paths for a 24×24 viewbox, stroke only) to
the `P` object:

```js
const P = {
  // ...
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
};
```

Use it as `<i data-icon="gauge"></i>` in HTML or `icon("gauge")` in JavaScript. Keep the style consistent: line
only, round caps and joins.

## Add a component style

Add it to `css/design.css` using the existing tokens, and document it in
[design-system.md](design-system.md). Avoid page-specific one-off styles for anything that could be reused.

## Conventions

| Topic | Convention |
|---|---|
| Naming | Element ids are camelCase prefixed by their area (`p...` for the parcel twin, `a...` for analytics) |
| Coordinates | Hand points are normalized 0 to 1 everywhere, converted to pixels only at draw time |
| State | One shared `twin` object for the hand twin; modules keep their own private state |
| Cross-module talk | Only through the event bus and the exports of `core.js`, never by importing another feature module |
| Feedback | Every user action gets a visible result: a state change, a toast, or both |
| Empty states | Every list and chart explains itself when empty |
| Comments | Each module starts with a comment explaining its role in the twin model (sensor, model, intelligence, feedback) |
