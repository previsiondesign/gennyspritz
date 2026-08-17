# genny — Spritz, Elevated

The website for **genny**, a wine-based RTD ("Spritz, Elevated") launching January 2027. A static site
that both **promotes the brand** and **invites investors**, backed by a Supabase gated-financials area.

**Live:** `https://gennyspritz.com` (gennyinc.com forwards here; the old
`https://previsiondesign.github.io/gennyspritz/` URLs redirect automatically).

Every page carries `noindex` — link-shareable, but not search-indexed before launch.

## What's on the site

- The story behind the name (Genny / Genevieve)
- The three launch flavors + the future flavor roadmap
- Why-now market story, founder credibility, product differentiators
- The $650K raise (SAFE), use-of-capital, and roadmap to launch
- Launch-list email capture

### Investor info is gated

The public page shows **headline figures only** — the detailed model, projections, and SAFE terms sit
behind the gated investor area. Real financials live **only in the Supabase database**, never in this
repo (it is public). The confidential pitch deck is likewise **not** in this repo.

The homepage's three teaser stats and the use-of-capital donut are painted from the backend by
`assets/teaser-sync.js`, so editing the figures in the dashboard updates the homepage automatically.
The detailed financials preview lower on the page is deliberately hardcoded and **representative** —
see `handoffs/2026-07-13-deck-sync-rebrand.md` before changing that.

## Gated investor area + founder dashboard

The repo includes a real gated flow backed by **Supabase** (Postgres + Edge Functions):

- **`/investors/`** — investors sign in with their email + a unique `GS-XXXX-XXXX` code Natasha
  emails them. Every visit re-validates server-side (and logs a view); revocation is instant.
  Lost codes can be re-requested (lands in the dashboard). Includes a gated pitch-deck download.
- **`/admin/`** — Natasha's dashboard (passcode-protected): see access requests, grant (generates a
  code and emails it automatically via Resend), see per-investor view counts/timestamps, revoke or
  re-issue codes, upload the current pitch deck, and **edit every financial figure** investors see,
  with a live preview.
- The homepage "Request access" modal posts to the backend (with a mailto fallback if it's
  unreachable). If the backend is unreachable, both pages show a graceful "not connected" card.

Backend bits live in `supabase/` (schema + functions). Deploy functions with
`npx supabase functions deploy --project-ref <ref>`. **No secrets or real figures ever live in this
repo** — financials are entered via the dashboard and stored only in Postgres.

## Forms

The launch-list forms are static prototypes — submitting opens the visitor's email client to
`natasha@gennyspritz.com`. To capture real signups, wire them to **Formspree** or **Mailchimp**
(the investor-access modal already posts to the Supabase backend).

## Structure

```
index.html                 ← the site
assets/                    ← images, brand.css (design system), site.css (homepage), shared.js
investors/                 ← gated financials (email + code)
admin/                     ← founder dashboard (passcode)
supabase/                  ← schema.sql + edge functions
handoffs/                  ← session handoffs — READ THESE FIRST
variant-1-editorial/       ← redirect stub only (preserves old shared links → /)
```

Three design directions (Elevated Editorial / Clean Modern DTC / Investor-Forward) were prototyped in
June 2026; Natasha chose **Elevated Editorial**, which became this site. The other two and the
comparison launcher were removed in August 2026 — see git history if you need them back.

Wordmark is the brush-script genny mark (traced from the deck cover, `assets/genny-logo.svg`);
headings in *Playfair Display* / *Fraunces*, body *Albert Sans*, labels *Barlow Semi Condensed*.
