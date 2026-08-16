/**
 * First-party aggregate page_view beacon for book-specific pages.
 * Requires [data-book-id][data-track-page-view] on the book element.
 * Does not set cookies. Fails silently. Never blocks rendering.
 */
(function () {
  "use strict";

  function marketFromPrefs() {
    try {
      var raw = window.localStorage.getItem("cm:visitor-prefs");
      if (!raw) return "INTL";
      var prefs = JSON.parse(raw);
      if (prefs && typeof prefs.country === "string" && prefs.country) {
        return String(prefs.country).toUpperCase();
      }
    } catch (err) {
      /* ignore */
    }
    return "INTL";
  }

  function queryMarket() {
    try {
      var params = new URLSearchParams(window.location.search);
      var value = params.get("country") || params.get("market");
      if (!value || value === "AUTO") return null;
      return String(value).toUpperCase();
    } catch (err) {
      return null;
    }
  }

  function sendPageView(root) {
    var bookId = root.getAttribute("data-book-id");
    if (!bookId) return;
    var source = root.getAttribute("data-track-source") || "book";
    var market = queryMarket() || marketFromPrefs() || "INTL";
    var body = JSON.stringify({
      book_id: bookId,
      event_type: "page_view",
      source: source,
      market: market
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/events", blob);
        return;
      }
    } catch (err) {
      /* fall through */
    }
    try {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        credentials: "omit",
        keepalive: true,
        cache: "no-store"
      }).catch(function () {});
    } catch (err2) {
      /* silent */
    }
  }

  function onReady() {
    var nodes = document.querySelectorAll("[data-book-id][data-track-page-view]");
    for (var i = 0; i < nodes.length; i++) {
      sendPageView(nodes[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
