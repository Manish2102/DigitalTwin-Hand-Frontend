# Design system

Files: [`css/design.css`](../css/design.css) (tokens and shared components, about 220 lines),
[`js/icons.js`](../js/icons.js), [`js/ui.js`](../js/ui.js). Page-specific layout (app shell, parcel stage,
phone page) lives in each page's own `<style>` block and uses only these tokens.

## Principles

- An application, not a marketing page: calm, neutral, readable for long sessions.
- **Soft 1px borders** and almost no shadows; no decorative gradients.
- One accent colour, plus green, amber and red used **only** for status.
- Consistent spacing and type scales; every control has the same height.
- Predictable layout: every twin has the same toolbar, stage and side panel structure.
- Dark theme only (`color-scheme: dark`).

## Tokens

All tokens are CSS custom properties on `:root`.

### Colour

| Role | Tokens |
|---|---|
| Surfaces (darkest to lightest) | `--bg #0b0d11`, `--surface #111419`, `--surface-2 #161a20`, `--surface-3 #1c2129`, `--surface-hover #222832` |
| Borders | `--border #232932`, `--border-strong #2f3641` |
| Text | `--text #e7e9ec`, `--text-2 #a7aeb8`, `--text-3 #868e9a` |
| Accent | `--accent #7b96ff` (text and outlines), `--accent-solid #4361e8` with hover `#4a68ee` (filled buttons), `--accent-weak`, `--accent-border` |
| Status | `--success #46c068`, `--warning #e0a83a`, `--danger #f2665e`, each with `-weak` (tint) and `-border` variants |

### Shape, spacing, type

| Group | Tokens |
|---|---|
| Radius | `--radius-sm 6px`, `--radius 8px`, `--radius-lg 12px`, `--radius-pill 999px` |
| Spacing | `--s1 4px`, `--s2 8px`, `--s3 12px`, `--s4 16px`, `--s5 20px`, `--s6 24px`, `--s8 32px` |
| Type sizes | `--fs-xs 12px`, `--fs-sm 13px`, `--fs 14px`, `--fs-md 15px`, `--fs-lg 18px`, `--fs-xl 22px` |
| Fonts | `--font` Inter with system fallbacks, `--mono` for codes and numbers |
| Controls | `--control-h 32px` (large buttons are 44 px for touch) |
| Motion | `--ease cubic-bezier(.2,.8,.2,1)`; transitions are 120 to 220 ms |

## Components

### Buttons

| Class | Use |
|---|---|
| `.btn` | Default secondary button |
| `.btn-primary` | The main action in a group (filled accent) |
| `.btn-ghost` | Low emphasis, no border |
| `.btn-icon` | Square, icon only. Always give it `aria-label` and a `data-tip`. |
| `.btn-sm`, `.btn-lg`, `.btn-block` | Size and width variants |
| `.active`, `.is-recording` | State styling (accent outline; red for recording) |

### Controls and forms

| Class | Use |
|---|---|
| `.seg` | Segmented control (pen size, parcel/phone view) |
| `.select`, `.input` | Dropdown and text field; same height and border as buttons |
| `.field`, `.field-label` | A row inside a settings card (label left, control right) |
| `.check` | Checkbox with label |
| `.range-row` | Slider with a value readout |

### Containers and data display

| Class | Use |
|---|---|
| `.card`, `.card-head`, `.card-title`, `.card-meta`, `.card-desc` | Panel with a header row (icon, title, right-aligned meta) |
| `.metrics` (`.cols-3`), `.metric`, `.metric-label`, `.metric-value` | A grid of tiles separated by hairlines; tabular numerals |
| `.badge` (`-success -warning -danger -accent -lg`) | Status pills |
| `.chip` | Header chips (room, source, phone status); a `<button class="chip">` is clickable |
| `.dot` (`.on`, `-warning`, `-danger`) | Presence indicator |
| `.list`, `.list-scroll`, `.log-item` | Lists and the activity log |
| `.empty`, `.empty-title`, `.empty-desc` | Empty states (icon, title, one explanatory line) |
| `.dl` | Definition list used in the "Why this is a digital twin" explainers |
| `canvas.chart`, `.legend` | Chart frame and legend |

### Feedback

| Component | Use |
|---|---|
| **Modal** (`.modal-backdrop`, `.modal`) | The connect-phone dialog. Closes with Esc, the close button, or a click outside. |
| **Toast** (`toast(message, kind)` in `ui.js`) | Brief confirmation, bottom-right. Kinds: `success`, `info`, `warning`, `danger`. Announced politely to screen readers (`role="status"`). |
| **Tooltip** (`data-tip="..."`) | Appears on hover or keyboard focus after a short delay. On a collapsed sidebar, `data-tip-pos="right"` places it beside the icon. |
| **Empty states** | Every list and chart has one, so a blank panel always explains itself |
| **Loading and status** | Buttons change label while working ("Starting…"); badges show "No sensor data" instead of stale values |

### Arcade components

The Arcade adds a few page-level pieces to the shell, built from the same tokens (see the `/* arcade */` block in `index.html`):

| Class | Use |
|---|---|
| `.game-card` | Menu card: icon tile, title, description, chips (sensor, players, best score) |
| `.g-stage`, `.g-frame` | The play area (dotted background) and the framed 16:10 canvas |
| `.g-overlay` | Start, pause and result screen over the canvas. Below 560 px frame width (container query) it shows only the title, status and buttons. |
| `.howto`, `.rank` | Numbered instructions and the rank bubble in the best-scores list |

## Icons

`js/icons.js` is a single set of 24×24 line icons (1.75 stroke, `currentColor`) written as inline SVG, so
there is no icon library and no emoji anywhere in the interface.

```html
<i data-icon="play"></i>               <!-- replaced by the SVG when the page loads -->
```

```js
icon("play", 16)                       // returns an SVG string
setButton(btn, "stop", "Stop")         // sets "icon + label" in one call
```

Unknown names fall back to a help icon. To add one, put its SVG path data into the `P` object
(see [extending.md](extending.md#add-an-icon)).

## Layout system

### App shell (`index.html`)

```
+--------------+--------------------------------------------------+
| Sidebar      | Page header: breadcrumb, title, description,     |
| brand        |              room / source / phone chips         |
| Twins        +--------------------------------------------------+
|  Hand        | Toolbar (groups separated by hairline dividers)  |
|  Pose        +----------------------------------+---------------+
| connection   | Stage (canvas or 3D)             | Side panel    |
| Connect      |                                  | (cards)       |
| Collapse     |                                  |               |
+--------------+----------------------------------+---------------+
```

| Part | Detail |
|---|---|
| Sidebar | 248 px; collapses to a 68 px icon rail (state remembered in `localStorage`), with tooltips for the icons. The active item has an accent outline and tinted background and `aria-current="page"`. |
| Page header | Breadcrumb ("Twins › Hand drawing"), title, one-line description, status chips. Changes with the section. |
| Toolbar | Groups of related controls with small caps labels (Pen, History, View). Wraps on narrow screens. |
| Stage | Fills the remaining space |
| Side panel | 360 px, scrolls independently, cards separated by 12 px |

### Responsive behaviour

| Width | Behaviour |
|---|---|
| Above 1100 px | Sidebar + stage + side panel side by side |
| 1100 px and below | The side panel moves below the stage; the stage keeps a fixed height (62 vh) |
| 760 px and below | The sidebar becomes a slide-out drawer opened with the menu button, with a scrim; the description is hidden; paddings tighten; the modal's QR code stacks above its steps |

The phone page is a single column (maximum width 560 px) designed for touch, with 44 px primary buttons and
safe-area padding at the bottom.

## Accessibility

| Aspect | What is done |
|---|---|
| Keyboard | Every control is a real `<button>`, `<select>` or `<input>`. A visible 2px accent focus ring (`:focus-visible`) is shown. Ctrl+Z undoes a stroke; Esc closes the modal. |
| Names | Icon-only buttons have `aria-label`; the nav marks the current page with `aria-current`; the modal has `role="dialog"`, `aria-modal` and a labelled heading |
| Announcements | Toasts use a polite live region |
| Contrast | Text tokens meet WCAG AA (4.5:1) on the surfaces they are used on. Measured on the page background and the card surface: primary text 15.2 to 16.0:1, secondary 8.3 to 8.7:1, tertiary (`--text-3`) 5.6 to 5.9:1, accent 6.7 to 7.1:1, success 7.9 to 8.3:1, warning 8.6 to 9.1:1, danger 6.0 to 6.3:1. Tertiary text is 5.3:1 on `--surface-2` and 4.9:1 on `--surface-3`; it should not be placed on `--surface-hover` (4.5:1 threshold missed by a hair, 4.48:1). White on the filled primary button is 5.1:1 (4.7:1 on hover). |
| Motion | `prefers-reduced-motion` disables transitions and animations |
| Colour is not the only signal | Status is also written (badge text, "Upside down", "Tilted 62°") and icons accompany levels |
| Touch | Large targets on the phone page |

## Using the system in a new view

1. Link `css/design.css` and use `.card`, `.btn`, `.metrics`, `.badge` instead of writing new styles.
2. Take colours from the tokens; never hard-code a hex value in CSS (canvas drawing code uses the same hex
   values as the tokens because canvases cannot read CSS variables directly).
3. Give every empty list or chart an `.empty` state and every action a `toast` or a visible state change.
