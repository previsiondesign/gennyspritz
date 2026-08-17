# Handoff — July deck sync, rebrand, use-of-funds (session 2026-06-22 → 07-15)

Repo = `site/`, pushed to `previsiondesign/gennyspritz`, branch `main`. Live at **https://gennyspritz.com**
(custom domain; Pages rebuild ~1 min + ~30s CDN). Deploy = commit + push.

Commits this session: `a5b1982` (July deck sync) · `3f357dd` (rebrand) · `5144d75` (use of funds) ·
`ce4b448` (drinker card copy). Earlier: `12ca64b`, `5ae092c` (dashboard pitch-deck section).

## 1. Working tree
Clean vs origin/main. **One untracked dir: `assets/archive/`** — Adam's stash of the OLD lifestyle
photos, kept untracked ON PURPOSE (committing would republish superseded photos at a live URL).
Leave untracked or move it out of the repo. Don't `git add -A` blindly.

## 2. State — everything below is DONE and verified
- **July 10 2026 deck is the current source of truth** (`pitch deck/genny pitch deck. July 10.2026.pdf`,
  project root). Model went **5-year → 7-year**; raise went **$500K → $650K**.
- **DB financials updated + verified live** (`GET /functions/v1/financials` → 53.7% / $16.99 /
  "Margin path by Year 7" 65%). Use-of-capital = real 5-way split (Production 30 / Logistics 17 /
  Marketing & trade 17 / Team 11 / Operations 25).
- **Brand refreshed**: brush-script wordmark + new can design + new lifestyle photos.

## 3. Design rationale (NOT in commit messages)

**Confidentiality model — the load-bearing decision.** Adam chose "Option 1": the PUBLIC homepage shows
**accurate headline numbers** (retail price, launch/scale margins, category benchmarks) but keeps
**granular figures representative** (case counts, waterfall dollars are `~` rounded). Real financials
live ONLY in the Supabase DB. This is exactly why the homepage's detailed financials preview is
**hardcoded HTML, not data-driven** — do NOT "improve" it by wiring it to the API without asking; that
would publish the exact model into a public repo. Only the 3 teaser stats + use-of-capital donut are
DB-driven (via `assets/teaser-sync.js` → `computePublicTeaser`).

**Deck-as-printed, flag-don't-fix.** The deck's p14 has an internal inconsistency: headline **53.7%** Y1
gross margin vs its own waterfall math ($16.99 − 5.95 − 2.98 − 3.85 = $4.21 ÷ $8.06 FOB = **52.2%**).
Adam chose to publish **the deck as printed** and flag it to Natasha rather than silently reconcile.
An email was drafted (not yet sent) listing 3 review items:
1. 53.7% vs 52.2% waterfall mismatch (+ minor: printed "+pts" deltas are off by ~0.1 from rounding).
2. Two COGS figures on one slide — $3.85 (Y1, in waterfall) vs "$3.24 Year 2+ at scale" (stat card).
   Site shows both, labeled `"$3.85 per 4-pack · Y1 → $3.24 at scale"`.
3. Benchmark bars have no printed values → site still uses June's 50% / 57%. Need new figures if moved.

**Deliberately NOT published** (awaiting Adam's call, both offered and declined-for-now):
- **SAFE cap $3,000,000 + 10% discount** — present in Natasha's use-of-funds xlsx. SAFE terms stay
  gated / "available on request" site-wide. Don't publish without an explicit ask.
- **Dollar amounts in the donut legend** ($195K/$110.5K/$110.5K/$71.5K/$162.5K). Donut is **% only** —
  showing dollars makes the exact raise allocation public.

**Logo is TRACED ART, not a font.** `assets/genny-logo.svg` is the real mark lifted from the deck
cover's embedded 1379px image (deck p1, image index 3) — extracted via pypdf `page.images`, isolated as
the largest 4-connected component, soft-alpha thresholded, embedded as PNG-in-SVG. There is **no vector
source on disk**. If it ever needs redoing, that's the method (script pattern in scratchpad, not
committed). Consequences:
- Ratio changed **3.374:1 → 1.595:1** (wide serif → tall script), so the shared `.wordmark` mask block
  in `brand.css` was resized (1.25em/1.99em; hero 1.15em/1.83em). All lockups (header, hero, footer,
  investor, admin) inherit from that ONE block — edit it, not per-page CSS.
- **Cache-bust `?v=script1` on the mask URL is REQUIRED** — same filename + new content meant browsers
  served the stale serif indefinitely. Bump it if the logo changes again.
- Old serif mark preserved at `assets/genny-logo-serif.svg`.
- **Mid-sentence `.wordmark` text (the pull-quote) intentionally still renders Fraunces** — only
  standalone brand lockups use the mask. Not a bug.

**Deliberately left alone:**
- **Favicon** — still the old taupe serif-'g'. The script 'g' crop was tested and is illegible at 32px.
  Needs a real monogram asset from Natasha.
- ~~**variant-2 / variant-3** archived prototypes still show the OLD can design (incl. `cans-trio.png`).
  They're noindex prototype archives; only `$650K`/"7-year" text was updated there.~~
  **SUPERSEDED 2026-08-17:** variants 2/3 and `/directions/` were purged. The live stylesheet moved
  `variant-1-editorial/style.css` → **`assets/site.css`** (root `index.html` was its only consumer);
  `variant-1-editorial/index.html` survives as a redirect stub ONLY, to keep old shared links alive.
  Recover the variants from git history before `ad3a23b` if ever needed.
- Homepage market stat still reads **"25–55"** (broad market) alongside the new drinker card
  **"Target age 28–38"** (core target). Coexisting on purpose; flagged to Adam, he left it.

**`.fin-years` grid** changed `repeat(5,1fr)` → `repeat(auto-fit, minmax(88px,1fr))` so the 5-year and
7-year strips both lay out without further CSS churn.

## 4. Dead ends / evaluated-and-rejected
- **Supabase↔GitHub integration: REJECTED, don't enable.** No `supabase/migrations/` workflow exists
  (schema is hand-run SQL), no PR workflow (everything goes straight to main), Branching Compute bills
  **outside the org Spend Cap**, and merge-to-apply would remove the SQL-editor review gate on a PUBLIC
  repo holding real investor data. Revisit only if a real migrations + PR workflow is adopted.
- **AI "Sync financials from deck" feature — designed + approved, NOT built.** Full plan at
  `Deck-to-Financials-AI-Sync-Plan.md` (**project root, OUTSIDE this repo** — see §5). Approved
  decisions: **review-then-publish** (never auto-publish to the investor page), scope = **financials
  data only** (not the hardcoded homepage preview), model **`claude-opus-4-8`**. Blocked only on Adam
  creating an `ANTHROPIC_API_KEY` + `supabase secrets set` + redeploying `admin`. This session's manual
  deck→site sync is exactly the workflow that feature would automate.

## 5. Tooling gotchas (this environment) — supplements the 2026-06-08 handoff
- **`Deck-to-Financials-AI-Sync-Plan.md`, `july-2026-financials.sql`, `use-of-funds-update.sql`,
  `pitch deck/`, `Copy Decks/`, `Gated-Access-Dashboard-Handoff.md` all live at the PROJECT ROOT,
  outside this git repo** — they do NOT transfer by cloning `site/`. Copy them manually to a new
  machine. (Deliberate: SQL contains real financials; repo is public.)
- **Screenshots are unreliable**: the old `preview_screenshot` AND the newer Browser-pane
  `computer{action:"screenshot"}` both time out/wedge. **Verify numerically instead** via
  `javascript_tool` — e.g. donut correctness was proven by summing `stroke-dasharray` to 339.3 (=2πr,
  r=54) and reading `getComputedStyle().stroke`. DOM read-back on the same tab keeps working when
  screenshots don't.
- **`WebFetch` reaches the Supabase functions endpoint** (curl still returns 000 for every host). It's
  the fastest way to verify DB state: `WebFetch https://rhblnawzobuxcaroyfmc.supabase.co/functions/v1/financials`.
  Add a `?v=x` param to dodge the 15-min WebFetch cache when re-verifying after a SQL run.
- **PowerShell is blocked by the user's deny rules** — script with Node or Python instead.
- **poppler/pdftoppm is NOT installed** → the Read tool cannot render PDF pages. Extract text with
  pypdf `page.extract_text(extraction_mode="layout")`. `pdfplumber`/`PyMuPDF` are absent; `pypdf`,
  `openpyxl`, `PIL`, `numpy` are present.
- **Pull the live deck from storage**: `supabase link --project-ref rhblnawzobuxcaroyfmc` first, then
  `supabase storage cp ss:///deck/current.pdf ./rel-name.pdf --experimental`. A Windows drive-letter
  destination silently fails — use a **relative** dst, then move.
- **Machine-local memory does not travel.** Session notes live in
  `~/.claude/projects/D--Dev-Genny-Spritz/memory/` on the desktop only. This handoff is the portable copy.

## 6. Open / next
Nothing blocking; site, DB, and deck are consistent. Optional queue:
1. Send Natasha the 3-item discrepancy email (§3).
2. Decide on publishing SAFE cap/discount, and dollar amounts in the donut.
3. Build the AI deck-sync feature (needs the Anthropic key).
4. Favicon monogram; real photo-licensing confirmation (still open from the June handoff).
