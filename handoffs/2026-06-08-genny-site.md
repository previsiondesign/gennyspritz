# Handoff — genny Spritz site (session 2026-06-08)

Repo = this folder (`site/`), pushed to `previsiondesign/gennyspritz`, branch `main`.
Live: https://previsiondesign.github.io/gennyspritz/ . Deploy = commit + push (Pages rebuilds ~1 min,
CDN edge lags another ~20–30s before the change shows).

## 1. Working tree
Clean and in sync with origin/main. Nothing uncommitted.

## 2. In-flight / deferred
- **Unused assets:** user supplied `genny_people_3.png` and `genny_people_4.png` (project root) —
  NOT placed yet. Only `lifestyle-people.jpg` (_1) + `lifestyle-people-2.jpg` (_2) are used (two-photo
  collage in the "Meet the genny drinker" / `#drinker` section, all 3 variants).
- **Forms** are mailto prototypes → wire to Netlify Forms / Formspree / Mailchimp for real signups.
- Waiting on **Natasha's input** (copy edits via the Word decks) before further changes.

## 3. Design rationale / decisions (NOT in commit msgs)
- **Financials are DUMMY/illustrative** numbers, deliberately gated behind "Request the deck" (blurred
  lock, unlocks on form submit via `[data-financials]`). Keep them gated; don't publish real figures.
- Repo was made **PUBLIC** (needed for free Pages); every page carries **`noindex`** so it's
  link-shareable but not search-indexed before the **Jan 2027** launch. Don't remove noindex yet.
- **Photo licensing:** confirm Natasha has commercial rights to the lifestyle photos before they stay
  on the public page (flagged to user; not yet confirmed).

## 4. Iterations / dead-ends a fresh session should know
- **Cans:** original PDF-extracted cutouts ghosted (flood-fill ate the white bodies). Re-did with a
  row-fill + connected-component method, THEN replaced entirely with the user's clean cutouts now in the
  `cans/` folder (project root) → these are the good source. `_build... ` not involved.
- **Rough comp drafts** (compositing clean cans onto the deck's Target-Consumer people photos) were
  built then DISCARDED in favor of the user's supplied `genny_people*` shots. Don't resurrect them.
- **Mobile menu** (expanded grouped jump-nav, mobile-only; desktop unchanged):
  - Header `backdrop-filter: blur()` makes the header a *containing block* for the fixed menu → menu
    broke after scroll. Fix: drop blur at mobile widths. Keep it dropped.
  - Tap-outside-to-close scrim must live **inside the header's stacking context** (z190, below the
    z200 panel) or it covers the menu. Verified layering: menu > scrim > page.
  - Jump landing: reduced mobile `scroll-margin-top` (→54/56px) + section top-padding (→40px) so
    anchor jumps land ~45px below the header, not ~130px.
  - `?shot` and `?navopen` are harmless test-only query hooks left in `shared.js`.
- **Copy decks** (`Copy Decks/` + `_build_copydecks.py`, both OUTSIDE this repo): user manually deleted
  the "Floating navigation button" section from the decks. **Hand-edit the decks** — re-running the
  generator re-adds that section.

## Tooling gotchas (this environment)
- Preview-MCP `preview_screenshot` is broken → use **headless Chrome** (`--screenshot`) or `preview_eval`.
- Headless `--force-device-scale-factor=N` with `--window-size=W` makes the CSS viewport `W/N` — to get
  a true 390px mobile viewport use e.g. `--window-size=1170` `--force-device-scale-factor=3`.
- `curl` to external hosts is sandboxed (returns 000); use `gh` or `preview_eval` `fetch()` instead.
- Preview browser caches `shared.js` (script tag, no cache-bust) — verify JS changes on a fresh load.
