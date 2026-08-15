/**
 * Same-origin visitor market endpoint for Cloudflare Pages.
 * Reads only request.cf.country. Never logs location data.
 * Never returns IP, city, coordinates, or connection details.
 */

export var VISITOR_CONTEXT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

export function normaliseDetectedCountry(raw) {
  if (raw === null || raw === undefined) return "INTL";
  var value = String(raw).trim().toUpperCase();
  if (!value) return "INTL";
  if (value === "XX" || value === "T1" || value === "ZZ") return "INTL";
  if (value === "INTL") return "INTL";
  if (!/^[A-Z]{2}$/.test(value)) return "INTL";
  return value;
}

export function createVisitorContextResult(method, rawCountry) {
  var allowed = method === "GET";
  return {
    status: allowed ? 200 : 405,
    headers: VISITOR_CONTEXT_HEADERS,
    body: {
      country: allowed ? normaliseDetectedCountry(rawCountry) : "INTL"
    }
  };
}

export function visitorContextJSON(result) {
  return JSON.stringify({ country: result.body.country });
}

function cfCountry(request) {
  return request && request.cf ? request.cf.country : undefined;
}

function toResponse(result) {
  return new Response(visitorContextJSON(result), {
    status: result.status,
    headers: result.headers
  });
}

export async function onRequestGet(context) {
  var raw = cfCountry(context && context.request);
  return toResponse(createVisitorContextResult("GET", raw));
}

export async function onRequest(context) {
  var method = context && context.request ? context.request.method : "";
  if (method !== "GET") {
    return toResponse(createVisitorContextResult(method, undefined));
  }
  return onRequestGet(context);
}
