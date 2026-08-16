/**
 * Curious Minds aggregate analytics event model.
 * Counts book interest only. Does not identify visitors.
 */

export var EVENT_TYPES = ["page_view", "amazon_click"];
export var SOURCES = ["home", "qr", "book", "related"];
export var MARKETS = ["INTL", "GB", "US", "IE", "AU", "CA", "NZ"];
/** Allowlisted shop formats. Add new values here as formats expand. */
export var FORMATS = ["paperback", "kindle"];

var AMAZON_HOST_RE = /^(?:www\.)?amazon\.(?:com|co\.uk|com\.au|ca|de|fr|it|es|co\.jp|in|com\.mx|com\.br|nl|se|pl|com\.be|ae|sg|com\.tr)$/i;

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function catalogueBookIds(catalogue) {
  if (!isObject(catalogue) || !isObject(catalogue.books)) return [];
  return Object.keys(catalogue.books);
}

export function isKnownBookId(catalogue, bookId) {
  if (!bookId || typeof bookId !== "string") return false;
  return catalogueBookIds(catalogue).indexOf(bookId) !== -1;
}

export function normaliseMarket(raw) {
  if (raw === null || raw === undefined || raw === "") return "INTL";
  var value = String(raw).trim().toUpperCase();
  if (!value || value === "AUTO") return "INTL";
  if (MARKETS.indexOf(value) === -1) return null;
  return value;
}

export function normaliseSource(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  var value = String(raw).trim().toLowerCase();
  if (SOURCES.indexOf(value) === -1) return null;
  return value;
}

export function normaliseEventType(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  var value = String(raw).trim().toLowerCase();
  if (EVENT_TYPES.indexOf(value) === -1) return null;
  return value;
}

export function normaliseFormat(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  var value = String(raw).trim().toLowerCase();
  if (FORMATS.indexOf(value) === -1) return null;
  return value;
}

export function isAllowedAmazonHttpsUrl(href) {
  if (!href || typeof href !== "string") return false;
  var url;
  try {
    url = new URL(href.trim());
  } catch (err) {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return AMAZON_HOST_RE.test(url.hostname);
}

function retailerListForMarket(book, market) {
  var markets = isObject(book.retailers_by_market) ? book.retailers_by_market : {};
  var links = markets[market] || [];
  if ((!links || !links.length) && market !== "INTL") {
    links = markets.INTL || [];
  }
  return Array.isArray(links) ? links : [];
}

function firstAmazonHrefForFormat(links, format) {
  for (var i = 0; i < links.length; i++) {
    var item = links[i];
    if (!item) continue;
    var itemFormat = normaliseFormat(item.format);
    if (itemFormat !== format) continue;
    var href = item.href || item.url;
    if (isAllowedAmazonHttpsUrl(href)) {
      return {
        ok: true,
        href: String(href).trim(),
        title: item.title || "Amazon",
        format: format
      };
    }
  }
  return null;
}

/**
 * Destination must come from catalogue retailers_by_market only.
 * Never accept a redirect URL from the request.
 * format is required (paperback, kindle, …).
 */
export function amazonDestinationFromCatalogue(catalogue, bookId, market, format) {
  if (!isKnownBookId(catalogue, bookId)) {
    return { ok: false, reason: "unknown_book" };
  }
  var normalisedFormat = normaliseFormat(format);
  if (!normalisedFormat) {
    return { ok: false, reason: "invalid_format" };
  }
  var book = catalogue.books[bookId];
  if (book.amazon_live === false) {
    return { ok: false, reason: "not_live" };
  }
  var links = retailerListForMarket(book, market);
  if (!links.length) {
    return { ok: false, reason: "no_retailer_url" };
  }
  var match = firstAmazonHrefForFormat(links, normalisedFormat);
  if (match) return match;
  return { ok: false, reason: "format_unavailable" };
}

/**
 * Build a validated aggregate event.
 * format is required for amazon_click; optional/empty for page_view.
 */
export function buildEvent(input, catalogue) {
  var bookId = input && typeof input.book_id === "string" ? input.book_id.trim() : "";
  var eventType = normaliseEventType(input && input.event_type);
  var source = normaliseSource(input && input.source);
  var market = normaliseMarket(input && input.market);
  var rawFormat = input && input.format;
  var format = normaliseFormat(rawFormat);

  if (!bookId || !isKnownBookId(catalogue, bookId)) {
    return { ok: false, reason: "invalid_book_id" };
  }
  if (!eventType) return { ok: false, reason: "invalid_event_type" };
  if (!source) return { ok: false, reason: "invalid_source" };
  if (!market) return { ok: false, reason: "invalid_market" };

  if (eventType === "amazon_click") {
    if (rawFormat === null || rawFormat === undefined || rawFormat === "") {
      return { ok: false, reason: "invalid_format" };
    }
    if (!format) return { ok: false, reason: "invalid_format" };
  } else if (rawFormat !== null && rawFormat !== undefined && rawFormat !== "") {
    if (!format) return { ok: false, reason: "invalid_format" };
  } else {
    format = "";
  }

  return {
    ok: true,
    event: {
      book_id: bookId,
      event_type: eventType,
      source: source,
      market: market,
      format: format
    }
  };
}

/**
 * Write one aggregate datapoint. Never throws to callers that catch.
 * Binding name: CM_EVENTS (Cloudflare Analytics Engine).
 */
export async function writeAnalyticsEvent(env, event) {
  if (!event || !event.book_id || !event.event_type) return { written: false, reason: "invalid_event" };
  if (!env || !env.CM_EVENTS || typeof env.CM_EVENTS.writeDataPoint !== "function") {
    return { written: false, reason: "binding_unavailable" };
  }
  try {
    env.CM_EVENTS.writeDataPoint({
      indexes: [event.book_id],
      blobs: [
        event.book_id,
        event.event_type,
        event.source,
        event.market,
        event.format || ""
      ],
      doubles: [1]
    });
    return { written: true };
  } catch (err) {
    return { written: false, reason: "write_failed" };
  }
}

export function redirectQueryIsSafe(searchParams) {
  if (!searchParams) return true;
  if (searchParams.has("url") || searchParams.has("redirect") || searchParams.has("dest") || searchParams.has("href")) {
    return false;
  }
  return true;
}

/**
 * Pure redirect resolver used by /go/amazon/:bookId.
 * Destination always comes from the catalogue, never from the request URL.
 */
export function resolveAmazonGoRequest(input) {
  var catalogue = input && input.catalogue;
  var bookId = input && input.bookId ? String(input.bookId) : "";
  var searchParams = input && input.searchParams;

  if (!redirectQueryIsSafe(searchParams)) {
    return { ok: false, status: 400, reason: "unsafe_query" };
  }

  var market = normaliseMarket(input && input.market);
  var source = normaliseSource((input && input.source) || "book");
  var format = normaliseFormat(input && input.format);
  if (!market) return { ok: false, status: 400, reason: "invalid_market" };
  if (!source) return { ok: false, status: 400, reason: "invalid_source" };
  if (!format) return { ok: false, status: 400, reason: "invalid_format" };

  var dest = amazonDestinationFromCatalogue(catalogue, bookId, market, format);
  if (!dest.ok) {
    return { ok: false, status: 404, reason: dest.reason };
  }

  var built = buildEvent(
    {
      book_id: bookId,
      event_type: "amazon_click",
      source: source,
      market: market,
      format: format
    },
    catalogue
  );

  return {
    ok: true,
    status: 302,
    href: dest.href,
    event: built.ok ? built.event : null
  };
}

export function amazonGoPath(bookId, market, source, format) {
  var m = normaliseMarket(market) || "INTL";
  var s = normaliseSource(source) || "book";
  var f = normaliseFormat(format) || "paperback";
  return (
    "/go/amazon/" +
    encodeURIComponent(bookId) +
    "?market=" +
    encodeURIComponent(m) +
    "&format=" +
    encodeURIComponent(f) +
    "&src=" +
    encodeURIComponent(s)
  );
}
