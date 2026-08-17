/**
 * Curious Minds central analytics report helpers.
 * Aggregate book-interest reporting only. No visitor identifiers.
 *
 * Phase 1 write mapping (functions/lib/cm-events.js → Analytics Engine):
 *   indexes[0] / index1 = book_id
 *   blobs[0] / blob1    = book_id
 *   blobs[1] / blob2    = event_type
 *   blobs[2] / blob3    = source
 *   blobs[3] / blob4    = market
 *   blobs[4] / blob5    = format (empty string for page_view)
 *   doubles[0] / double1 = 1 (event count unit)
 */

export var AE_FIELD_MAPPING = {
  index1: "book_id",
  blob1: "book_id",
  blob2: "event_type",
  blob3: "source",
  blob4: "market",
  blob5: "format",
  double1: "count_unit"
};

export var AE_DATASET_DEFAULT = "curious_minds_events";

export var REPORT_RANGES = ["today", "7d", "30d", "all"];
export var DEFAULT_REPORT_RANGE = "30d";

/** Report display formats (Phase 1 stores kindle; report maps it to ebook). */
export var REPORT_FORMATS = ["paperback", "hardcover", "ebook", "unknown"];

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normaliseReportRange(raw) {
  if (raw === null || raw === undefined || raw === "") return DEFAULT_REPORT_RANGE;
  var value = String(raw).trim().toLowerCase();
  if (REPORT_RANGES.indexOf(value) === -1) return DEFAULT_REPORT_RANGE;
  return value;
}

/**
 * Map stored format blob to report display category.
 * kindle → ebook; empty/missing → unknown.
 */
export function displayFormat(raw) {
  if (raw === null || raw === undefined) return "unknown";
  var value = String(raw).trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "kindle" || value === "ebook") return "ebook";
  if (value === "paperback") return "paperback";
  if (value === "hardcover") return "hardcover";
  return "unknown";
}

export function sqlTimePredicate(range) {
  var r = normaliseReportRange(range);
  if (r === "today") return "timestamp >= toStartOfDay(NOW())";
  if (r === "7d") return "timestamp >= NOW() - INTERVAL '7' DAY";
  if (r === "30d") return "timestamp >= NOW() - INTERVAL '30' DAY";
  return null;
}

export function isSafeDatasetName(name) {
  return typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name) && name.length <= 64;
}

/**
 * Build the Analytics Engine SQL used by the admin report API.
 * Never interpolates untrusted user strings into identifiers.
 */
export function buildAnalyticsSql(range, dataset) {
  var ds = dataset || AE_DATASET_DEFAULT;
  if (!isSafeDatasetName(ds)) {
    return { ok: false, reason: "invalid_dataset" };
  }
  var where = sqlTimePredicate(range);
  var sql =
    "SELECT " +
    "blob1 AS book_id, " +
    "blob2 AS event_type, " +
    "blob3 AS source, " +
    "blob4 AS market, " +
    "blob5 AS format, " +
    "SUM(_sample_interval * double1) AS event_count, " +
    "MAX(timestamp) AS last_seen " +
    "FROM " +
    ds +
    (where ? " WHERE " + where : "") +
    " GROUP BY book_id, event_type, source, market, format " +
    "FORMAT JSON";
  return { ok: true, sql: sql, range: normaliseReportRange(range), dataset: ds };
}

export function parseAnalyticsSqlResponse(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (isObject(payload) && Array.isArray(payload.data)) return payload.data;
  if (isObject(payload) && Array.isArray(payload.result)) return payload.result;
  return [];
}

function toCount(value) {
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function normaliseRow(row) {
  if (!isObject(row)) return null;
  return {
    book_id: row.book_id != null ? String(row.book_id) : "",
    event_type: row.event_type != null ? String(row.event_type) : "",
    source: row.source != null ? String(row.source) : "",
    market: row.market != null ? String(row.market) : "",
    format: displayFormat(row.format),
    event_count: toCount(row.event_count),
    last_seen: row.last_seen != null ? String(row.last_seen) : null
  };
}

function clickViewPct(pageViews, amazonClicks) {
  if (!pageViews || pageViews <= 0) return null;
  return Math.round((amazonClicks / pageViews) * 1000) / 10;
}

function maxTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
}

function emptyBreakdown(keys) {
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    out.push({ key: keys[i], count: 0 });
  }
  return out;
}

function bumpBreakdown(map, key, count) {
  var k = key || "unknown";
  map[k] = (map[k] || 0) + count;
}

function mapToSortedList(map, preferredOrder) {
  var keys = Object.keys(map);
  keys.sort(function (a, b) {
    var ia = preferredOrder.indexOf(a);
    var ib = preferredOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    out.push({ key: keys[i], count: map[keys[i]] });
  }
  return out;
}

/**
 * Join AE aggregate rows to the catalogue and build the report payload.
 * Always includes every catalogue book (zeros when no rows).
 */
export function buildAnalyticsReport(catalogue, rawRows, options) {
  options = options || {};
  var range = normaliseReportRange(options.range);
  var selectedBookId =
    options.book_id && typeof options.book_id === "string" ? options.book_id.trim() : "";
  var booksMap = isObject(catalogue) && isObject(catalogue.books) ? catalogue.books : {};
  var bookIds = Object.keys(booksMap).sort();

  var totalsByBook = {};
  for (var b = 0; b < bookIds.length; b++) {
    totalsByBook[bookIds[b]] = {
      book_id: bookIds[b],
      title: booksMap[bookIds[b]].title || bookIds[b],
      page_views: 0,
      amazon_clicks: 0,
      click_view_pct: null,
      last_activity: null
    };
  }

  var normalised = [];
  var rows = Array.isArray(rawRows) ? rawRows : [];
  for (var i = 0; i < rows.length; i++) {
    var row = normaliseRow(rows[i]);
    if (!row || !row.book_id || !row.event_count) continue;
    normalised.push(row);
    if (!totalsByBook[row.book_id]) {
      /* Unknown book IDs outside catalogue are ignored for the main table. */
      continue;
    }
    var slot = totalsByBook[row.book_id];
    if (row.event_type === "page_view") slot.page_views += row.event_count;
    else if (row.event_type === "amazon_click") slot.amazon_clicks += row.event_count;
    slot.last_activity = maxTimestamp(slot.last_activity, row.last_seen);
  }

  var books = [];
  var totalPageViews = 0;
  var totalAmazonClicks = 0;
  var booksWithActivity = 0;
  for (var j = 0; j < bookIds.length; j++) {
    var item = totalsByBook[bookIds[j]];
    item.click_view_pct = clickViewPct(item.page_views, item.amazon_clicks);
    totalPageViews += item.page_views;
    totalAmazonClicks += item.amazon_clicks;
    if (item.page_views + item.amazon_clicks > 0) booksWithActivity += 1;
    books.push(item);
  }

  var selected = null;
  if (selectedBookId && totalsByBook[selectedBookId]) {
    var bySource = {};
    var byMarket = {};
    var byFormat = {};
    var byEvent = { page_view: 0, amazon_click: 0 };
    for (var k = 0; k < normalised.length; k++) {
      var r = normalised[k];
      if (r.book_id !== selectedBookId) continue;
      bumpBreakdown(bySource, r.source || "unknown", r.event_count);
      bumpBreakdown(byMarket, r.market || "unknown", r.event_count);
      if (r.event_type === "amazon_click") {
        bumpBreakdown(byFormat, r.format, r.event_count);
      }
      if (r.event_type === "page_view" || r.event_type === "amazon_click") {
        byEvent[r.event_type] += r.event_count;
      }
    }
    selected = {
      book_id: selectedBookId,
      title: totalsByBook[selectedBookId].title,
      by_source: mapToSortedList(bySource, ["home", "qr", "book", "related"]),
      by_market: mapToSortedList(byMarket, ["GB", "US", "IE", "AU", "CA", "NZ", "INTL"]),
      by_format: (function () {
        var base = emptyBreakdown(REPORT_FORMATS);
        var list = mapToSortedList(byFormat, REPORT_FORMATS);
        var seen = {};
        for (var x = 0; x < list.length; x++) seen[list[x].key] = list[x].count;
        for (var y = 0; y < base.length; y++) {
          if (seen[base[y].key] != null) base[y].count = seen[base[y].key];
        }
        return base;
      })(),
      by_event: [
        { key: "page_view", count: byEvent.page_view || 0 },
        { key: "amazon_click", count: byEvent.amazon_click || 0 }
      ]
    };
  }

  return {
    ok: true,
    range: range,
    generated_at: options.generated_at || new Date().toISOString(),
    summary: {
      total_page_views: totalPageViews,
      total_amazon_clicks: totalAmazonClicks,
      books_with_activity: booksWithActivity,
      books_in_catalogue: bookIds.length
    },
    books: books,
    selected_book: selected,
    field_mapping: AE_FIELD_MAPPING
  };
}

/**
 * Ensure report JSON never includes visitor-identifying keys.
 */
export function assertAggregateOnlyReport(report) {
  var forbidden = [
    "ip",
    "ip_address",
    "user_agent",
    "ua",
    "visitor_id",
    "user_id",
    "email",
    "cookie",
    "fingerprint",
    "cf_connecting_ip"
  ];
  var text = JSON.stringify(report || {}).toLowerCase();
  for (var i = 0; i < forbidden.length; i++) {
    if (text.indexOf('"' + forbidden[i] + '"') !== -1) {
      return { ok: false, reason: "forbidden_field:" + forbidden[i] };
    }
  }
  return { ok: true };
}

export async function queryAnalyticsEngineSql(env, sql) {
  var accountId = env && (env.CM_AE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID);
  var token = env && (env.CM_AE_API_TOKEN || env.CLOUDFLARE_API_TOKEN);
  if (!accountId || !token) {
    return { ok: false, reason: "query_credentials_unavailable" };
  }
  var url =
    "https://api.cloudflare.com/client/v4/accounts/" +
    encodeURIComponent(String(accountId)) +
    "/analytics_engine/sql";
  try {
    var res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + String(token),
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: sql
    });
    var text = await res.text();
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, reason: "invalid_sql_response", status: res.status };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: "sql_query_failed",
        status: res.status,
        error: parsed && (parsed.errors || parsed.error || parsed.message)
      };
    }
    return { ok: true, rows: parseAnalyticsSqlResponse(parsed), raw: parsed };
  } catch (err) {
    return { ok: false, reason: "sql_query_error" };
  }
}
