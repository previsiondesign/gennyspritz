# genny — Spritz, Elevated · Website Prototypes

Three website directions for **genny**, a wine-based RTD ("Spritz, Elevated") launching January 2027.
Each is a complete, self-contained static site that both **promotes the brand** and **invites investors**.

**Live:** `https://gennyspritz.com` (gennyinc.com forwards here; the old
`https://previsiondesign.github.io/gennyspritz/` URLs redirect automatically).

## The three directions

| # | Direction | Feel | Emphasis |
|---|-----------|------|----------|
| 01 | **[Elevated Editorial](variant-1-editorial/)** | Soft, premium, story-led — mirrors the pitch deck. | Brand & the name story lead. |
| 02 | **[Clean Modern DTC](variant-2-modern/)** | Bright, product-forward — mirrors the can design. | Consumer energy up front. |
| 03 | **[Investor-Forward](variant-3-investor/)** | Structured, data-confident — mirrors the 1-pager. | Built to raise. |

Open **[`index.html`](index.html)** for the launcher that compares all three.

## What every direction includes

- The story behind the name (Genny / Genevieve)
- The three launch flavors + the future flavor roadmap
- Why-now market story, founder credibility, product differentiators
- The $500K raise (SAFE), use-of-capital, and roadmap to launch
- Launch-list email capture

### Investor info is gated

Confidential financials are **teased only** (≈60.6% gross margin, $18.99 4-pack, path to 68–70%). The
full financials, projections, and SAFE terms sit behind a **“Request the deck”** form — never exposed on
the public page. The confidential pitch deck itself is intentionally **not** included in this repo.

## Gated investor area + founder dashboard

The repo includes a real gated flow backed by **Supabase** (Postgres + Edge Functions):

- **`/investors/`** — investors sign in with their email + a unique `GS-XXXX-XXXX` code Natasha
  emails them. Every visit re-validates server-side (and logs a view); revocation is instant.
  Lost codes can be re-requested (lands in the dashboard).
- **`/admin/`** — Natasha's dashboard (passcode-protected): see access requests, grant (generates a
  code + opens a ready-to-send email draft), see per-investor view counts/timestamps, revoke or
  re-issue codes, and **edit every financial figure** investors see, with a live preview.
- The variant-1 "Request access" modal posts to the backend (with a mailto fallback if it's
  unreachable). Until the backend is connected, both pages show a graceful "not connected" card.

Backend bits live in `supabase/` (schema + functions). One-time setup: create a free Supabase
project, run `supabase/schema.sql` in its SQL editor, deploy the functions
(`npx supabase functions deploy`), set the `ADMIN_PASSCODE` secret, and put the project URL into
`assets/api.js`. **No secrets or real figures ever live in this repo** — financials are entered via
the dashboard and stored only in Postgres.

## Forms

The launch-list forms are static prototypes — submitting opens the visitor's email client to
`natashaik@icloud.com`. To capture real signups, wire them to **Formspree** or **Mailchimp**
(the investor-access modal already posts to the Supabase backend).

## Structure

```
index.html                 ← launcher / comparison page
assets/                    ← shared images, brand.css, shared.js
variant-1-editorial/       ← Direction 01
variant-2-modern/          ← Direction 02
variant-3-investor/        ← Direction 03
```

Product photography, the founder portrait, and the “OG Genny” photo were extracted from genny's pitch
deck / 1-pager. Wordmark set in *Fraunces*; deck-style headings in *Playfair Display*.
