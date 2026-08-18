/**
 * Public book listing helpers: search threshold and learning-resource rendering.
 * Does not write analytics events or handle admin authentication.
 */
(function (root) {
  "use strict";

  var MIN_BOOKS_FOR_SEARCH = 6;
  var RESOURCE_AUDIENCES = ["families", "educators", "both"];
  var RESOURCE_TYPES = ["discussion", "activity", "guide", "printable"];

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function shouldRevealBookSearch(publicBookCount) {
    return Number(publicBookCount) >= MIN_BOOKS_FOR_SEARCH;
  }

  function validLearningResources(items) {
    if (!items || !items.length) return [];
    var out = [];
    var i;
    var item;
    var audience;
    var type;
    var url;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (!item || !item.title) continue;
      audience = String(item.audience || "").trim().toLowerCase();
      type = String(item.type || "").trim().toLowerCase();
      url = item.url || item.href;
      if (RESOURCE_AUDIENCES.indexOf(audience) === -1) continue;
      if (RESOURCE_TYPES.indexOf(type) === -1) continue;
      if (typeof url !== "string") continue;
      if (url.charAt(0) !== "/" || url.indexOf("//") === 0) continue;
      out.push({
        title: String(item.title),
        audience: audience,
        type: type,
        url: url
      });
    }
    return out;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function learningResourcesHTML(items) {
    var valid = validLearningResources(items);
    var i;
    var html;
    if (!valid.length) return "";
    html =
      "<div class=\"container narrow\">" +
      "<p class=\"eyebrow\">For grown-ups and educators</p>" +
      "<h2 id=\"explore-more-heading\">Explore More</h2>" +
      "<ul class=\"resource-list\">";
    for (i = 0; i < valid.length; i++) {
      html +=
        "<li><a href=\"" +
        escapeHtml(valid[i].url) +
        "\">" +
        escapeHtml(valid[i].title) +
        "</a></li>";
    }
    html += "</ul></div>";
    return html;
  }

  function renderLearningResources(section, items) {
    if (!section) return false;
    var html = learningResourcesHTML(items);
    if (!html) {
      section.hidden = true;
      section.innerHTML = "";
      return false;
    }
    section.innerHTML = html;
    section.hidden = false;
    if (typeof section.removeAttribute === "function") {
      section.removeAttribute("hidden");
    }
    if (typeof section.setAttribute === "function") {
      section.setAttribute("aria-labelledby", "explore-more-heading");
    }
    return true;
  }

  function bookMatchesQuery(book, query) {
    var q = String(query || "").trim().toLowerCase();
    var hay;
    var parts;
    var i;
    if (!q) return true;
    if (!isObject(book)) return false;
    hay = [
      book.title,
      book.description,
      book.age_label,
      book.age_range,
      Array.isArray(book.topics) ? book.topics.join(" ") : ""
    ]
      .join(" ")
      .toLowerCase();
    parts = q.split(/\s+/);
    for (i = 0; i < parts.length; i++) {
      if (hay.indexOf(parts[i]) === -1) return false;
    }
    return true;
  }

  function applyBookSearch(cards, query, statusEl) {
    var q = String(query || "").trim().toLowerCase();
    var parts = q ? q.split(/\s+/) : [];
    var shown = 0;
    var i;
    var card;
    var hay;
    var match;
    var p;
    for (i = 0; i < cards.length; i++) {
      card = cards[i];
      hay = String(card.getAttribute("data-search") || "").toLowerCase();
      match = true;
      for (p = 0; p < parts.length; p++) {
        if (hay.indexOf(parts[p]) === -1) {
          match = false;
          break;
        }
      }
      card.hidden = !match;
      if (match) shown += 1;
    }
    if (statusEl) {
      if (!q) statusEl.textContent = "";
      else if (shown === 0) statusEl.textContent = "No books match that search.";
      else if (shown === 1) statusEl.textContent = "1 book matches.";
      else statusEl.textContent = shown + " books match.";
    }
    return shown;
  }

  function initBookSearch(doc) {
    var root = doc || (typeof document !== "undefined" ? document : null);
    if (!root || typeof root.querySelector !== "function") {
      return { revealed: false, count: 0 };
    }
    var container = root.querySelector("#book-search");
    var cards = root.querySelectorAll("[data-public-book]");
    var count = cards && cards.length ? cards.length : 0;
    var input;
    var status;
    if (!container) return { revealed: false, count: count };
    if (!shouldRevealBookSearch(count)) {
      container.hidden = true;
      if (typeof container.setAttribute === "function") {
        container.setAttribute("hidden", "");
      }
      return { revealed: false, count: count };
    }
    container.hidden = false;
    if (typeof container.removeAttribute === "function") {
      container.removeAttribute("hidden");
    }
    input = container.querySelector("#book-search-input");
    status = container.querySelector("#book-search-status");
    if (input && typeof input.addEventListener === "function") {
      input.addEventListener("input", function () {
        applyBookSearch(cards, input.value, status);
      });
    }
    return { revealed: true, count: count };
  }

  function initLearningResources(doc, catalogue) {
    var root = doc || (typeof document !== "undefined" ? document : null);
    var section;
    var holder;
    var bookId;
    var book;
    if (!root || typeof root.querySelector !== "function") return false;
    section = root.querySelector("#explore-more");
    holder = root.querySelector("[data-book-id][data-track-source='book']");
    if (!section || !holder) return false;
    bookId = holder.getAttribute("data-book-id");
    book =
      catalogue && catalogue.books && bookId ? catalogue.books[bookId] : null;
    return renderLearningResources(section, book && book.learning_resources);
  }

  function onReady() {
    initBookSearch(document);
    var section = document.getElementById("explore-more");
    if (!section) return;
    fetch("/data/catalogue.json", { cache: "no-store", credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("unavailable");
        return res.json();
      })
      .then(function (catalogue) {
        initLearningResources(document, catalogue);
      })
      .catch(function () {
        renderLearningResources(section, []);
      });
  }

  var api = {
    MIN_BOOKS_FOR_SEARCH: MIN_BOOKS_FOR_SEARCH,
    shouldRevealBookSearch: shouldRevealBookSearch,
    validLearningResources: validLearningResources,
    learningResourcesHTML: learningResourcesHTML,
    renderLearningResources: renderLearningResources,
    bookMatchesQuery: bookMatchesQuery,
    applyBookSearch: applyBookSearch,
    initBookSearch: initBookSearch,
    initLearningResources: initLearningResources
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.CMBooks = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady);
    } else {
      onReady();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
