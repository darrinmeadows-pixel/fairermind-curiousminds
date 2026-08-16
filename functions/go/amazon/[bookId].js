/**
 * GET /go/amazon/:bookId?market=GB&format=paperback&src=home
 * Catalogue-only Amazon redirect with optional aggregate click count.
 * Never accepts an external redirect URL from the request.
 * Analytics failure must never block a valid Amazon destination.
 */

import {
  resolveAmazonGoRequest,
  writeAnalyticsEvent
} from "../../lib/cm-events.js";

var HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

function htmlPage(status, title, message) {
  var body =
    "<!DOCTYPE html><html lang=\"en-GB\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<meta name=\"robots\" content=\"noindex\">" +
    "<title>" +
    title +
    "</title></head><body>" +
    "<main><h1>" +
    title +
    "</h1><p>" +
    message +
    '</p><p><a href="/">Return to Curious Minds</a></p></main></body></html>';
  return new Response(body, { status: status, headers: HTML_HEADERS });
}

async function loadCatalogue(request) {
  var res = await fetch(new URL("/data/catalogue.json", request.url), {
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!res.ok) throw new Error("catalogue_unavailable");
  return res.json();
}

function errorMessage(reason) {
  if (reason === "unsafe_query") {
    return "This shopping link does not accept an external redirect address.";
  }
  if (reason === "invalid_market") {
    return "Choose a supported country or region market.";
  }
  if (reason === "invalid_source") {
    return "This shopping link used an unsupported source value.";
  }
  if (reason === "invalid_format") {
    return "Choose a supported book format such as paperback or Kindle.";
  }
  if (reason === "unknown_book") {
    return "That book is not listed in the Curious Minds catalogue.";
  }
  if (reason === "not_live") {
    return "This book is not yet available to buy on Amazon through Curious Minds.";
  }
  if (reason === "format_unavailable") {
    return "That format is not yet available to buy on Amazon through Curious Minds.";
  }
  return "An Amazon destination for this book has not been configured yet.";
}

export async function handleAmazonGo(context) {
  var request = context.request;
  var url = new URL(request.url);
  var bookId = context.params && context.params.bookId ? String(context.params.bookId) : "";

  var catalogue;
  try {
    catalogue = await loadCatalogue(request);
  } catch (err) {
    return htmlPage(503, "Temporarily unavailable", "We could not look up shop links right now.");
  }

  var resolved = resolveAmazonGoRequest({
    catalogue: catalogue,
    bookId: bookId,
    market: url.searchParams.get("market"),
    source: url.searchParams.get("src") || "book",
    format: url.searchParams.get("format"),
    searchParams: url.searchParams
  });

  if (!resolved.ok) {
    return htmlPage(resolved.status || 404, "Shop link unavailable", errorMessage(resolved.reason));
  }

  if (resolved.event) {
    try {
      await writeAnalyticsEvent(context.env, resolved.event);
    } catch (err) {
      /* analytics must never block redirect */
    }
  }

  return Response.redirect(resolved.href, 302);
}

export async function onRequestGet(context) {
  return handleAmazonGo(context);
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return htmlPage(405, "Method not allowed", "Use a GET request for shop links.");
  }
  return handleAmazonGo(context);
}
