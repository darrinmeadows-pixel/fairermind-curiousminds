import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AE_DATASET_DEFAULT,
  AE_FIELD_MAPPING,
  DEFAULT_REPORT_RANGE,
  assertAggregateOnlyReport,
  buildAnalyticsReport,
  buildAnalyticsSql,
  displayFormat,
  normaliseReportRange,
  parseAnalyticsSqlResponse,
  sqlTimePredicate
} from "../functions/lib/cm-analytics-report.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "data/catalogue.json"), "utf8")
);
const routes = JSON.parse(fs.readFileSync(path.join(root, "_routes.json"), "utf8"));
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const adminHtml = fs.readFileSync(
  path.join(root, "admin/analytics/index.html"),
  "utf8"
);
const adminJs = fs.readFileSync(path.join(root, "js/cm-admin-analytics.js"), "utf8");
const reportFn = fs.readFileSync(
  path.join(root, "functions/api/admin/analytics.js"),
  "utf8"
);
const writeLib = fs.readFileSync(path.join(root, "functions/lib/cm-events.js"), "utf8");

assert.deepEqual(AE_FIELD_MAPPING, {
  index1: "book_id",
  blob1: "book_id",
  blob2: "event_type",
  blob3: "source",
  blob4: "market",
  blob5: "format",
  double1: "count_unit"
});
assert.equal(AE_DATASET_DEFAULT, "curious_minds_events");
assert.equal(DEFAULT_REPORT_RANGE, "30d");

assert.match(writeLib, /blobs:\s*\[[\s\S]*event\.book_id/);
assert.match(writeLib, /event\.event_type/);
assert.match(writeLib, /event\.source/);
assert.match(writeLib, /event\.market/);
assert.match(writeLib, /event\.format/);
assert.match(writeLib, /CM_EVENTS/);

assert.equal(normaliseReportRange(null), "30d");
assert.equal(normaliseReportRange("7d"), "7d");
assert.equal(normaliseReportRange("TODAY"), "today");
assert.equal(normaliseReportRange("weird"), "30d");
assert.equal(sqlTimePredicate("all"), null);
assert.match(sqlTimePredicate("30d"), /INTERVAL '30' DAY/);
assert.match(sqlTimePredicate("today"), /toStartOfDay/);

assert.equal(displayFormat("kindle"), "ebook");
assert.equal(displayFormat("paperback"), "paperback");
assert.equal(displayFormat("hardcover"), "hardcover");
assert.equal(displayFormat(""), "unknown");
assert.equal(displayFormat(null), "unknown");

const badSql = buildAnalyticsSql("30d", "curious; DROP");
assert.equal(badSql.ok, false);

const goodSql = buildAnalyticsSql("30d", "curious_minds_events");
assert.equal(goodSql.ok, true);
assert.match(goodSql.sql, /blob1 AS book_id/);
assert.match(goodSql.sql, /blob2 AS event_type/);
assert.match(goodSql.sql, /blob3 AS source/);
assert.match(goodSql.sql, /blob4 AS market/);
assert.match(goodSql.sql, /blob5 AS format/);
assert.match(goodSql.sql, /SUM\(_sample_interval \* double1\)/);
assert.match(goodSql.sql, /FROM curious_minds_events/);
assert.match(goodSql.sql, /INTERVAL '30' DAY/);

assert.deepEqual(
  parseAnalyticsSqlResponse({ data: [{ book_id: "X", event_count: 1 }] }),
  [{ book_id: "X", event_count: 1 }]
);

const rows = [
  {
    book_id: "CM-Y02to05-STO-SCI-MOON",
    event_type: "amazon_click",
    source: "home",
    market: "GB",
    format: "paperback",
    event_count: 1,
    last_seen: "2026-08-16 20:00:00"
  },
  {
    book_id: "CM-Y05to10-STO-SCI-BEACH",
    event_type: "page_view",
    source: "qr",
    market: "GB",
    format: "",
    event_count: 4,
    last_seen: "2026-08-16 19:00:00"
  },
  {
    book_id: "CM-Y05to10-STO-SCI-BEACH",
    event_type: "amazon_click",
    source: "qr",
    market: "US",
    format: "kindle",
    event_count: 2,
    last_seen: "2026-08-16 19:30:00"
  }
];

const report = buildAnalyticsReport(catalogue, rows, {
  range: "30d",
  book_id: "CM-Y05to10-STO-SCI-BEACH",
  generated_at: "2026-08-16T21:00:00.000Z"
});

assert.equal(report.ok, true);
assert.equal(report.range, "30d");
assert.equal(report.summary.total_page_views, 4);
assert.equal(report.summary.total_amazon_clicks, 3);
assert.equal(report.summary.books_with_activity, 2);
assert.equal(report.summary.books_in_catalogue, 2);
assert.equal(report.books.length, 2);

const moon = report.books.find((b) => b.book_id === "CM-Y02to05-STO-SCI-MOON");
const fish = report.books.find((b) => b.book_id === "CM-Y05to10-STO-SCI-BEACH");
assert.ok(moon);
assert.ok(fish);
assert.match(moon.title, /Moon Change Shape/);
assert.equal(moon.page_views, 0);
assert.equal(moon.amazon_clicks, 1);
assert.equal(moon.click_view_pct, null);
assert.equal(fish.page_views, 4);
assert.equal(fish.amazon_clicks, 2);
assert.equal(fish.click_view_pct, 50);
assert.equal(fish.last_activity, "2026-08-16 19:30:00");

const zeroReport = buildAnalyticsReport(catalogue, [], { range: "all" });
assert.equal(zeroReport.books.length, 2);
assert.equal(zeroReport.summary.total_page_views, 0);
assert.equal(zeroReport.summary.books_with_activity, 0);
assert.equal(zeroReport.books[0].page_views, 0);
assert.equal(zeroReport.books[1].amazon_clicks, 0);

assert.ok(report.selected_book);
assert.equal(report.selected_book.book_id, "CM-Y05to10-STO-SCI-BEACH");
assert.deepEqual(report.selected_book.by_event, [
  { key: "page_view", count: 4 },
  { key: "amazon_click", count: 2 }
]);
assert.ok(report.selected_book.by_source.some((x) => x.key === "qr" && x.count === 6));
assert.ok(report.selected_book.by_market.some((x) => x.key === "US" && x.count === 2));
assert.ok(report.selected_book.by_format.some((x) => x.key === "ebook" && x.count === 2));
assert.ok(report.selected_book.by_format.some((x) => x.key === "paperback" && x.count === 0));

const privacy = assertAggregateOnlyReport(report);
assert.equal(privacy.ok, true);
assert.equal(
  assertAggregateOnlyReport({ ok: true, visitor_id: "x" }).ok,
  false
);

assert.equal(/adminAccessAllowed|accessJwtPresent/.test(reportFn), false);
assert.equal(/CM_ADMIN_ACCESS_REQUIRED|Cf-Access-Jwt-Assertion/.test(reportFn), false);
assert.match(reportFn, /verifyAdminSession/);
assert.equal(
  /adminAccessAllowed|accessJwtPresent|CM_ADMIN_ACCESS_REQUIRED|Cf-Access-Jwt-Assertion/.test(
    fs.readFileSync(path.join(root, "functions/lib/cm-analytics-report.js"), "utf8")
  ),
  false
);

assert.deepEqual(routes.include, [
  "/api/visitor-context",
  "/api/events",
  "/api/admin/*",
  "/admin/*",
  "/go/amazon/*"
]);
assert.match(headers, /\/api\/admin\/\*/);
assert.match(headers, /\/admin\/\*/);
assert.match(headers, /noindex/);

assert.match(adminHtml, /Book Analytics/);
assert.match(adminHtml, /noindex, nofollow/);
assert.match(adminHtml, /cm-admin-analytics\.js/);
assert.equal(/api\.cloudflare\.com/i.test(adminHtml + adminJs), false);
assert.equal(/CM_AE_API_TOKEN|CLOUDFLARE_API_TOKEN/i.test(adminJs), false);
assert.equal(/document\.cookie/i.test(adminJs), false);
assert.match(adminJs, /\/api\/admin\/analytics/);
assert.match(adminJs, /\/admin\/login\//);
assert.match(adminHtml, /\/api\/admin\/logout/);

assert.match(reportFn, /queryAnalyticsEngineSql/);
assert.match(reportFn, /CM_AE_ACCOUNT_ID/);
assert.match(reportFn, /CM_AE_API_TOKEN/);
assert.equal(/writeDataPoint/i.test(reportFn), false);

assert.equal(
  fs.existsSync(path.join(root, "functions/lib/cm-analytics-report.js")),
  true
);
assert.equal(
  fs.existsSync(path.join(root, "functions/api/admin/analytics.js")),
  true
);
assert.equal(fs.existsSync(path.join(root, "admin/analytics/index.html")), true);

console.log("cm-analytics-report tests passed");
