/**
 * GET /api/admin/analytics?range=30d&book_id=CM-...
 * Server-side Analytics Engine report. Aggregate book interest only.
 *
 * Requires a signed __Host- admin session cookie (see cm-admin-auth.js).
 * Cloudflare Access / Zero Trust is not used.
 *
 * Query credentials (Pages secrets — never sent to the browser):
 *   CM_AE_ACCOUNT_ID
 *   CM_AE_API_TOKEN   (Account Analytics Read)
 * Optional:
 *   CM_AE_DATASET     (default curious_minds_events)
 */

import { verifyAdminSession } from "../../lib/cm-admin-auth.js";
import {
  AE_DATASET_DEFAULT,
  buildAnalyticsReport,
  buildAnalyticsSql,
  assertAggregateOnlyReport,
  normaliseReportRange,
  queryAnalyticsEngineSql
} from "../../lib/cm-analytics-report.js";

var HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow"
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status: status, headers: HEADERS });
}

async function loadCatalogue(request) {
  var res = await fetch(new URL("/data/catalogue.json", request.url), {
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!res.ok) throw new Error("catalogue_unavailable");
  return res.json();
}

export async function onRequestGet(context) {
  var request = context.request;
  var env = context.env || {};

  var session = await verifyAdminSession(env, request);
  if (!session.ok) {
    return json(session.status || 401, {
      ok: false,
      reason: session.reason || "auth_required"
    });
  }

  var url = new URL(request.url);
  var range = normaliseReportRange(url.searchParams.get("range"));
  var bookId = url.searchParams.get("book_id") || "";

  var catalogue;
  try {
    catalogue = await loadCatalogue(request);
  } catch (err) {
    return json(503, { ok: false, reason: "catalogue_unavailable" });
  }

  var dataset = env.CM_AE_DATASET || AE_DATASET_DEFAULT;
  var builtSql = buildAnalyticsSql(range, dataset);
  if (!builtSql.ok) {
    return json(400, { ok: false, reason: builtSql.reason });
  }

  var queried = await queryAnalyticsEngineSql(env, builtSql.sql);
  if (!queried.ok) {
    return json(503, {
      ok: false,
      reason: queried.reason,
      hint:
        queried.reason === "query_credentials_unavailable"
          ? "Set CM_AE_ACCOUNT_ID and CM_AE_API_TOKEN Pages secrets."
          : undefined
    });
  }

  var report = buildAnalyticsReport(catalogue, queried.rows, {
    range: range,
    book_id: bookId,
    generated_at: new Date().toISOString()
  });

  var privacy = assertAggregateOnlyReport(report);
  if (!privacy.ok) {
    return json(500, { ok: false, reason: "privacy_guard" });
  }

  return json(200, report);
}

export async function onRequest(context) {
  var method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        Allow: "GET, OPTIONS",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }
  return json(405, { ok: false, reason: "method_not_allowed" });
}
