# Curious Minds — public website

Static public site for **Curious Minds**, a FairerMind publishing and learning initiative.

**Public destination:** [https://curiousminds.fairermind.com/](https://curiousminds.fairermind.com/)

## Important separation

This folder is the **public website** only.

It is separate from the private Curious Minds publishing and production workspace at:

`/Users/darrinmeadows/Documents/FairerMind/CuriousMinds/`

Do not publish internal project paths, project identifiers, production assets, or unpublished book files from that workspace onto this site.

## Stack

- Static HTML and CSS
- No JavaScript required for the core page
- Optional Cloudflare Pages Function at `/api/visitor-context` for coarse country/market detection
- Self-hosted Montserrat (no Google Fonts or CDN fonts)

## Local preview

From this directory:

```bash
python3 -m http.server 8081 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8081/](http://127.0.0.1:8081/).

Permanent Book 002 QR destination (local, ages 5–10 edition):

[http://127.0.0.1:8081/q/5-10/fish-breathe-underwater/](http://127.0.0.1:8081/q/5-10/fish-breathe-underwater/)

If port 8081 is busy, choose another free port.

This ordinary static server cannot execute Cloudflare Pages Functions. On localhost, country detection therefore falls back to `INTL`. The visible country selector still works.

Production uses a same-origin Pages Function at `/api/visitor-context`. It reads only Cloudflare’s `request.cf.country` value and returns `{"country":"GB"}` or `{"country":"INTL"}`. The application does not use `/cdn-cgi/trace`.

Checks:

```bash
node tests/test_locale.js
node tests/test_visitor_context.mjs
python3 tests/test_qr_landing.py
```

## Current status

The site introduces Curious Minds and its first book:

**Why Does the Moon Change Shape?**

The book is **preparing for publication**. This page must not claim that the book is already available to purchase.

## Brand assets

Copied for web use (sources left unchanged):

| Asset | Source |
|-------|--------|
| Logo | `Brand/Logos/PNG/512/FairerMind-CuriousMinds.png` |
| Favicon | `Brand/Logos/SVG/FairerMind-Favicon.svg` |
| Fonts | `Brand/Fonts/Montserrat/` (Regular, Medium, SemiBold) |

Visual shell follows `Brand/FAIRERMIND_SITE_SHELL.md`, with PetCarePro and Money as structural references.

## Suggested release workflow

1. Test locally with `python3 -m http.server`
2. Review content, accessibility and responsive layout
3. When ready: create a dedicated Git repository for this website only
4. Push and deploy (for example Cloudflare Pages) to `curiousminds.fairermind.com`

Do not commit or deploy until explicitly asked.

## Contact

[hello@fairermind.com](mailto:hello@fairermind.com)
