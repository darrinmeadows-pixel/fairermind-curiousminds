/**
 * POST /api/events — aggregate book page_view / amazon_click events.
 * Does not identify visitors. Fails soft when CM_EVENTS is unbound.
 */

import {
  buildEvent,
  writeAnalyticsEvent
} from "../lib/cm-events.js";

var HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
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

export async function onRequestPost(context) {
  var request = context.request;
  var payload;
  try {
    payload = await request.json();
  } catch (err) {
    return json(400, { ok: false, reason: "invalid_json" });
  }

  var catalogue;
  try {
    catalogue = await loadCatalogue(request);
  } catch (err) {
    return json(503, { ok: false, reason: "catalogue_unavailable" });
  }

  var built = buildEvent(payload, catalogue);
  if (!built.ok) {
    return json(400, { ok: false, reason: built.reason });
  }

  var write = await writeAnalyticsEvent(context.env, built.event);
  return json(200, {
    ok: true,
    recorded: write.written === true,
    reason: write.written ? undefined : write.reason
  });
}

export async function onRequest(context) {
  var method = context.request.method;
  if (method === "POST") return onRequestPost(context);
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        Allow: "POST, OPTIONS"
      }
    });
  }
  return json(405, { ok: false, reason: "method_not_allowed" });
}
