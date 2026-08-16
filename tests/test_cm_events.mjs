import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EVENT_TYPES,
  FORMATS,
  MARKETS,
  SOURCES,
  amazonDestinationFromCatalogue,
  amazonGoPath,
  buildEvent,
  isAllowedAmazonHttpsUrl,
  isKnownBookId,
  normaliseFormat,
  normaliseMarket,
  normaliseSource,
  redirectQueryIsSafe,
  resolveAmazonGoRequest,
  writeAnalyticsEvent
} from "../functions/lib/cm-events.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "data/catalogue.json"), "utf8")
);
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const qrHtml = fs.readFileSync(
  path.join(root, "q/5-10/fish-breathe-underwater/index.html"),
  "utf8"
);
const analyticsJs = fs.readFileSync(path.join(root, "js/cm-analytics.js"), "utf8");
const routes = JSON.parse(fs.readFileSync(path.join(root, "_routes.json"), "utf8"));
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

const MOON = "CM-Y02to05-STO-SCI-MOON";
const FISH = "CM-Y05to10-STO-SCI-BEACH";
const MOON_PAPERBACK = "https://www.amazon.co.uk/dp/B0HDSXDYF4";
const FISH_PAPERBACK = "https://www.amazon.co.uk/dp/B0HFFYSJPY";
const FISH_KINDLE = "https://www.amazon.co.uk/dp/B0HFF176XT";

assert.equal(isKnownBookId(catalogue, MOON), true);
assert.equal(isKnownBookId(catalogue, FISH), true);
assert.equal(isKnownBookId(catalogue, "CM001"), false);
assert.equal(isKnownBookId(catalogue, "CM002"), false);

assert.match(catalogue.books[MOON].title, /Why Does the Moon Change Shape/);
assert.equal(catalogue.books[MOON].amazon_live, true);
assert.equal(catalogue.books[FISH].amazon_live, true);
assert.equal(catalogue.books[FISH].title, "Why Can Fish Breathe Underwater?");

assert.deepEqual(EVENT_TYPES, ["page_view", "amazon_click"]);
assert.deepEqual(SOURCES, ["home", "qr", "book", "related"]);
assert.deepEqual(FORMATS, ["paperback", "kindle"]);
assert.ok(MARKETS.includes("GB"));
assert.ok(MARKETS.includes("INTL"));

assert.equal(normaliseMarket("gb"), "GB");
assert.equal(normaliseMarket("AUTO"), "INTL");
assert.equal(normaliseMarket("ZZ"), null);
assert.equal(normaliseSource("HOME"), "home");
assert.equal(normaliseSource("email"), null);
assert.equal(normaliseFormat("Paperback"), "paperback");
assert.equal(normaliseFormat("KINDLE"), "kindle");
assert.equal(normaliseFormat("audiobook"), null);

const validView = buildEvent(
  {
    book_id: FISH,
    event_type: "page_view",
    source: "qr",
    market: "GB"
  },
  catalogue
);
assert.equal(validView.ok, true);
assert.deepEqual(validView.event, {
  book_id: FISH,
  event_type: "page_view",
  source: "qr",
  market: "GB",
  format: ""
});

assert.equal(
  buildEvent(
    { book_id: "CM001", event_type: "page_view", source: "qr", market: "GB" },
    catalogue
  ).reason,
  "invalid_book_id"
);
assert.equal(
  buildEvent(
    {
      book_id: FISH,
      event_type: "purchase",
      source: "qr",
      market: "GB"
    },
    catalogue
  ).reason,
  "invalid_event_type"
);
assert.equal(
  buildEvent(
    {
      book_id: FISH,
      event_type: "page_view",
      source: "newsletter",
      market: "GB"
    },
    catalogue
  ).reason,
  "invalid_source"
);
assert.equal(
  buildEvent(
    {
      book_id: FISH,
      event_type: "page_view",
      source: "qr",
      market: "XX"
    },
    catalogue
  ).reason,
  "invalid_market"
);
assert.equal(
  buildEvent(
    {
      book_id: FISH,
      event_type: "amazon_click",
      source: "home",
      market: "GB"
    },
    catalogue
  ).reason,
  "invalid_format"
);
assert.equal(
  buildEvent(
    {
      book_id: FISH,
      event_type: "amazon_click",
      source: "home",
      market: "GB",
      format: "audiobook"
    },
    catalogue
  ).reason,
  "invalid_format"
);

assert.equal(isAllowedAmazonHttpsUrl("https://www.amazon.co.uk/dp/B0EXAMPLE"), true);
assert.equal(isAllowedAmazonHttpsUrl("https://www.amazon.com/dp/B0EXAMPLE"), true);
assert.equal(isAllowedAmazonHttpsUrl("http://www.amazon.co.uk/dp/B0EXAMPLE"), false);
assert.equal(isAllowedAmazonHttpsUrl("https://evil.example/amazon.co.uk"), false);
assert.equal(isAllowedAmazonHttpsUrl("https://notamazon.com/dp/x"), false);

const moonPaperback = amazonDestinationFromCatalogue(catalogue, MOON, "GB", "paperback");
assert.equal(moonPaperback.ok, true);
assert.equal(moonPaperback.href, MOON_PAPERBACK);
assert.equal(moonPaperback.format, "paperback");

assert.equal(
  amazonDestinationFromCatalogue(catalogue, MOON, "GB", "kindle").reason,
  "format_unavailable"
);

const fishPaperback = amazonDestinationFromCatalogue(catalogue, FISH, "GB", "paperback");
assert.equal(fishPaperback.ok, true);
assert.equal(fishPaperback.href, FISH_PAPERBACK);

const fishKindle = amazonDestinationFromCatalogue(catalogue, FISH, "GB", "kindle");
assert.equal(fishKindle.ok, true);
assert.equal(fishKindle.href, FISH_KINDLE);

assert.equal(
  amazonDestinationFromCatalogue(catalogue, FISH, "GB", "audiobook").reason,
  "invalid_format"
);
assert.equal(
  amazonDestinationFromCatalogue(catalogue, "CM-UNKNOWN-BOOK", "GB", "paperback").reason,
  "unknown_book"
);

const notLiveCatalogue = {
  books: {
    [FISH]: {
      id: FISH,
      amazon_live: false,
      retailers_by_market: {
        GB: [{ title: "Paperback", format: "paperback", href: FISH_PAPERBACK }]
      }
    }
  }
};
assert.equal(
  amazonDestinationFromCatalogue(notLiveCatalogue, FISH, "GB", "paperback").reason,
  "not_live"
);

const emptyRetailers = {
  books: {
    [MOON]: {
      id: MOON,
      amazon_live: true,
      retailers_by_market: {}
    }
  }
};
assert.equal(
  amazonDestinationFromCatalogue(emptyRetailers, MOON, "GB", "paperback").reason,
  "no_retailer_url"
);

const unsafe = new URLSearchParams(
  "market=GB&format=paperback&src=home&url=https://evil.example/"
);
assert.equal(redirectQueryIsSafe(unsafe), false);
assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "GB",
    source: "home",
    format: "paperback",
    searchParams: unsafe
  }).reason,
  "unsafe_query"
);

const moonResolved = resolveAmazonGoRequest({
  catalogue,
  bookId: MOON,
  market: "GB",
  source: "home",
  format: "paperback",
  searchParams: new URLSearchParams("market=GB&format=paperback&src=home")
});
assert.equal(moonResolved.ok, true);
assert.equal(moonResolved.href, MOON_PAPERBACK);
assert.equal(moonResolved.event.event_type, "amazon_click");
assert.equal(moonResolved.event.book_id, MOON);
assert.equal(moonResolved.event.format, "paperback");
assert.equal(moonResolved.event.source, "home");
assert.equal(moonResolved.event.market, "GB");

const fishPaperResolved = resolveAmazonGoRequest({
  catalogue,
  bookId: FISH,
  market: "GB",
  source: "qr",
  format: "paperback",
  searchParams: new URLSearchParams("market=GB&format=paperback&src=qr")
});
assert.equal(fishPaperResolved.ok, true);
assert.equal(fishPaperResolved.href, FISH_PAPERBACK);
assert.equal(fishPaperResolved.event.format, "paperback");

const fishKindleResolved = resolveAmazonGoRequest({
  catalogue,
  bookId: FISH,
  market: "GB",
  source: "qr",
  format: "kindle",
  searchParams: new URLSearchParams("market=GB&format=kindle&src=qr")
});
assert.equal(fishKindleResolved.ok, true);
assert.equal(fishKindleResolved.href, FISH_KINDLE);
assert.equal(fishKindleResolved.event.format, "kindle");
assert.equal(fishKindleResolved.event.source, "qr");

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "GB",
    source: "home",
    format: "kindle",
    searchParams: new URLSearchParams("market=GB&format=kindle&src=home")
  }).reason,
  "format_unavailable"
);

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "ZZ",
    source: "home",
    format: "paperback",
    searchParams: new URLSearchParams("market=ZZ&format=paperback&src=home")
  }).reason,
  "invalid_market"
);

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "GB",
    source: "newsletter",
    format: "paperback",
    searchParams: new URLSearchParams("market=GB&format=paperback&src=newsletter")
  }).reason,
  "invalid_source"
);

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "GB",
    source: "home",
    format: "audiobook",
    searchParams: new URLSearchParams("market=GB&format=audiobook&src=home")
  }).reason,
  "invalid_format"
);

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: "CM-UNKNOWN-BOOK",
    market: "GB",
    source: "home",
    format: "paperback",
    searchParams: new URLSearchParams("market=GB&format=paperback&src=home")
  }).reason,
  "unknown_book"
);

assert.equal(
  resolveAmazonGoRequest({
    catalogue,
    bookId: MOON,
    market: "GB",
    source: "home",
    format: "paperback",
    searchParams: new URLSearchParams(
      "market=GB&format=paperback&src=home&redirect=https://evil.example/"
    )
  }).ok,
  false
);

const noBinding = await writeAnalyticsEvent({}, moonResolved.event);
assert.equal(noBinding.written, false);
assert.equal(noBinding.reason, "binding_unavailable");

let wrote = 0;
let lastPoint = null;
const mockEnv = {
  CM_EVENTS: {
    writeDataPoint(point) {
      wrote += 1;
      lastPoint = point;
      throw new Error("engine down");
    }
  }
};
const failedWrite = await writeAnalyticsEvent(mockEnv, moonResolved.event);
assert.equal(failedWrite.written, false);
assert.equal(failedWrite.reason, "write_failed");
assert.equal(moonResolved.ok, true);
assert.equal(wrote, 1);
assert.deepEqual(lastPoint.blobs, [MOON, "amazon_click", "home", "GB", "paperback"]);

const successEnv = {
  CM_EVENTS: {
    writeDataPoint(point) {
      lastPoint = point;
    }
  }
};
const okWrite = await writeAnalyticsEvent(successEnv, fishKindleResolved.event);
assert.equal(okWrite.written, true);
assert.deepEqual(lastPoint.blobs, [FISH, "amazon_click", "qr", "GB", "kindle"]);
assert.deepEqual(lastPoint.indexes, [FISH]);
assert.deepEqual(lastPoint.doubles, [1]);

assert.equal(
  amazonGoPath(MOON, "GB", "home", "paperback"),
  "/go/amazon/CM-Y02to05-STO-SCI-MOON?market=GB&format=paperback&src=home"
);
assert.equal(
  amazonGoPath(FISH, "GB", "qr", "kindle"),
  "/go/amazon/CM-Y05to10-STO-SCI-BEACH?market=GB&format=kindle&src=qr"
);

assert.match(indexHtml, /data-book-id="CM-Y02to05-STO-SCI-MOON"/);
assert.match(indexHtml, /Now available/);
assert.equal(/Preparing for publication/i.test(indexHtml), false);
assert.match(
  indexHtml,
  /href="\/go\/amazon\/CM-Y02to05-STO-SCI-MOON\?market=GB&amp;format=paperback&amp;src=home"/
);
assert.match(indexHtml, /Paperback — Amazon UK/);
assert.equal(/format=kindle/i.test(indexHtml), false);
assert.equal(/amazon\.co\.uk\/dp\//i.test(indexHtml), false);
assert.equal(/https:\/\/www\.amazon\./i.test(indexHtml), false);
assert.match(indexHtml, /We count book-page views and shop-link clicks in aggregate/);

assert.match(qrHtml, /data-book-id="CM-Y05to10-STO-SCI-BEACH"/);
assert.match(qrHtml, /data-track-page-view="true"/);
assert.match(qrHtml, /data-track-source="qr"/);
assert.match(qrHtml, /cm-analytics\.js/);
assert.match(
  qrHtml,
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=paperback&amp;src=qr"/
);
assert.match(
  qrHtml,
  /href="\/go\/amazon\/CM-Y05to10-STO-SCI-BEACH\?market=GB&amp;format=kindle&amp;src=qr"/
);
assert.match(qrHtml, /Paperback — Amazon UK/);
assert.match(qrHtml, /Kindle — Amazon UK/);
assert.equal(/Buy now/i.test(qrHtml), false);
assert.equal(/amazon\.co\.uk\/dp\//i.test(qrHtml), false);
assert.equal(/https:\/\/www\.amazon\./i.test(qrHtml), false);

assert.equal(/gtag|googletagmanager|google-analytics|GA_MEASUREMENT|cf-beacon/i.test(indexHtml + qrHtml + analyticsJs), false);
assert.equal(/document\.cookie/i.test(analyticsJs), false);
assert.match(analyticsJs, /\/api\/events/);
assert.match(analyticsJs, /page_view/);
assert.equal(/amazon_click/i.test(analyticsJs), false);

assert.deepEqual(routes.include, [
  "/api/visitor-context",
  "/api/events",
  "/go/amazon/*"
]);
assert.match(headers, /\/api\/events/);
assert.match(headers, /\/go\/amazon\/\*/);
assert.match(readme, /CM_EVENTS/);
assert.match(readme, /format/);
assert.match(readme, /CM-Y02to05-STO-SCI-MOON/);
assert.match(readme, /CM-Y05to10-STO-SCI-BEACH/);

assert.equal(fs.existsSync(path.join(root, "functions/api/events.js")), true);
assert.equal(fs.existsSync(path.join(root, "functions/go/amazon/[bookId].js")), true);
assert.equal(fs.existsSync(path.join(root, "functions/lib/cm-events.js")), true);

console.log("cm-events tests passed");
