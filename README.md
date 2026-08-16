# Curious Minds — public website

Static public site for **Curious Minds**, a FairerMind publishing and learning initiative.

**Public destination:** [https://curiousminds.fairermind.com/](https://curiousminds.fairermind.com/)

## Important separation

This folder is the **public website** only.

It is separate from the private Curious Minds publishing and production workspace at:

`/Users/darrinmeadows/Documents/FairerMind/CuriousMindsBooks`

Do not publish internal project paths, production assets, or unpublished book files from that workspace onto this site.

Canonical **publishing book IDs** are used on purpose for catalogue and analytics (for example `CM-Y02to05-STO-SCI-MOON`). Do not invent parallel aliases such as `CM001`.

## Stack

- Static HTML and CSS
- Progressive enhancement JavaScript for QR landings and aggregate analytics beacons
- Cloudflare Pages Functions:
  - `/api/visitor-context` — coarse country/market detection (`request.cf.country` only)
  - `/api/events` — aggregate `page_view` / `amazon_click` events
  - `/go/amazon/:bookId` — catalogue-only Amazon redirect with optional click count
- Self-hosted Montserrat (no Google Fonts or CDN fonts)

## Book status (website)

| Book ID | Title | Website status |
|---------|-------|----------------|
| `CM-Y02to05-STO-SCI-MOON` | Why Does the Moon Change Shape?: Understanding Moon Phases | Live. Homepage has **Paperback — Amazon UK** via `/go/amazon/...`. Kindle not offered until a verified UK Kindle URL is supplied. |
| `CM-Y05to10-STO-SCI-BEACH` | Why Can Fish Breathe Underwater? | QR landing live with **Paperback** and **Kindle** Amazon UK buttons via `/go/amazon/...`. |

Shop destinations live only in `data/catalogue.json` (`retailers_by_market` + `format`). Page HTML must link to `/go/amazon/<book-id>`, never to raw Amazon product URLs.

## Analytics (aggregate only)

Curious Minds counts book interest without identifying visitors.

Event fields:

- `book_id` — canonical publishing ID
- `event_type` — `page_view` or `amazon_click`
- `source` — `home`, `qr`, `book`, or `related`
- `market` — `GB`, `US`, `INTL`, and other allowlisted markets
- `format` — for `amazon_click`: `paperback` or `kindle` (extensible allowlist). Empty for `page_view`.
- platform timestamp from Cloudflare Analytics Engine

Not collected: IP, user ID, email, city/coordinates, user-agent fingerprint, Amazon account data, analytics cookies, Google Analytics, or Cloudflare Web Analytics snippets.

Page views fire only on book-specific pages that set `data-track-page-view` (for example the Book 002 QR page). The homepage Book 001 teaser has `data-book-id` but does **not** count as a Book 001 page view.

### Amazon redirect

Tracked shop links use a same-origin path:

```text
/go/amazon/CM-Y02to05-STO-SCI-MOON?market=GB&format=paperback&src=home
/go/amazon/CM-Y05to10-STO-SCI-BEACH?market=GB&format=kindle&src=qr
```

The Function:

1. allowlists `book_id`, `src`, `market`, and `format`
2. rejects request-supplied redirect URLs (`url`, `redirect`, `dest`, `href`)
3. looks up HTTPS Amazon destinations only from `retailers_by_market` in `data/catalogue.json` for the requested format
4. writes an `amazon_click` event when possible
5. 302-redirects to Amazon

If analytics is unavailable, a valid Amazon redirect still proceeds. If no catalogue Amazon URL exists for that book/market/format, the Function returns a safe HTML error page.

### Cloudflare Analytics Engine binding

Production binding name: **`CM_EVENTS`**

Local static preview and unbound Functions degrade gracefully (`binding_unavailable`). Site pages still render.

Dashboard setup still required (not done from this repository):

1. Open the Cloudflare Pages project for this site
2. Create / enable an Analytics Engine dataset
3. Bind it to the Pages project as `CM_EVENTS`
4. Redeploy so `/api/events` and `/go/amazon/*` can write datapoints

`_routes.json` already includes `/api/visitor-context`, `/api/events`, and `/go/amazon/*`.

## Local preview

From this directory:

```bash
python3 -m http.server 8081 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8081/](http://127.0.0.1:8081/).

Permanent Book 002 QR destination (local, ages 5–10 edition):

[http://127.0.0.1:8081/q/5-10/fish-breathe-underwater/](http://127.0.0.1:8081/q/5-10/fish-breathe-underwater/)

This ordinary static server cannot execute Cloudflare Pages Functions. Country detection falls back to `INTL`. `/api/events` and `/go/amazon/*` return 404 locally unless you use `wrangler pages dev`. Shop buttons still appear in HTML; clicking them only works in a Pages/Functions environment.

Checks:

```bash
node tests/test_locale.js
node tests/test_visitor_context.mjs
node tests/test_cm_events.mjs
python3 tests/test_qr_landing.py
```

## Brand assets

Copied for web use (sources left unchanged):

| Asset | Source |
|-------|--------|
| Logo | `Brand/Logos/PNG/512/FairerMind-CuriousMinds.png` |
| Favicon | `Brand/Logos/SVG/FairerMind-Favicon.svg` |
| Fonts | `Brand/Fonts/Montserrat/` (Regular, Medium, SemiBold) |

Visual shell follows `Brand/FAIRERMIND_SITE_SHELL.md`, with PetCarePro and Money as structural references.

## Suggested release workflow

1. Run the checks above
2. Review content, accessibility and responsive layout
3. Configure the `CM_EVENTS` Analytics Engine binding in Cloudflare Pages
4. Push and deploy to `curiousminds.fairermind.com` when asked

Do not commit or deploy until explicitly asked.

## Contact

[hello@fairermind.com](mailto:hello@fairermind.com)
