/**
 * Admin book analytics report UI.
 * Fetches aggregate totals from /api/admin/analytics only.
 * Does not talk to Analytics Engine from the browser.
 */
(function () {
  "use strict";

  var DEFAULT_RANGE = "30d";
  var state = {
    range: DEFAULT_RANGE,
    selectedBookId: null,
    report: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatNumber(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return String(Math.round(n));
  }

  function formatPct(value) {
    if (value === null || value === undefined) return "—";
    return String(value) + "%";
  }

  function formatWhen(value) {
    if (!value) return "—";
    try {
      var d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch (err) {
      return String(value);
    }
  }

  function rangeFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      var value = params.get("range");
      if (value === "today" || value === "7d" || value === "30d" || value === "all") {
        return value;
      }
    } catch (err) {
      /* ignore */
    }
    return DEFAULT_RANGE;
  }

  function bookFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      var value = params.get("book_id");
      return value ? String(value) : null;
    } catch (err) {
      return null;
    }
  }

  function setStatus(message, isError) {
    var el = $("report-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("admin-status--error", Boolean(isError));
  }

  function syncRangeInputs(range) {
    var inputs = document.querySelectorAll('input[name="range"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = inputs[i].value === range;
    }
  }

  function renderSummary(report) {
    var summary = report.summary || {};
    $("sum-page-views").textContent = formatNumber(summary.total_page_views);
    $("sum-amazon-clicks").textContent = formatNumber(summary.total_amazon_clicks);
    $("sum-books-active").textContent = formatNumber(summary.books_with_activity);
    var updated = $("report-updated");
    if (updated) {
      updated.setAttribute("datetime", report.generated_at || "");
      updated.textContent = formatWhen(report.generated_at);
    }
  }

  function renderBooks(report) {
    var body = $("books-body");
    if (!body) return;
    body.innerHTML = "";
    var books = report.books || [];
    if (!books.length) {
      var empty = document.createElement("tr");
      empty.innerHTML = '<td colspan="6">No books in catalogue.</td>';
      body.appendChild(empty);
      return;
    }
    for (var i = 0; i < books.length; i++) {
      var book = books[i];
      var tr = document.createElement("tr");
      if (state.selectedBookId === book.book_id) {
        tr.className = "is-selected";
      }
      tr.innerHTML =
        "<td>" +
        escapeHtml(book.title) +
        '</td><td><code>' +
        escapeHtml(book.book_id) +
        "</code></td><td>" +
        formatNumber(book.page_views) +
        "</td><td>" +
        formatNumber(book.amazon_clicks) +
        "</td><td>" +
        formatPct(book.click_view_pct) +
        "</td><td>" +
        escapeHtml(formatWhen(book.last_activity)) +
        "</td>";
      tr.addEventListener(
        "click",
        (function (bookId) {
          return function () {
            selectBook(bookId);
          };
        })(book.book_id)
      );
      tr.tabIndex = 0;
      tr.addEventListener(
        "keydown",
        (function (bookId) {
          return function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectBook(bookId);
            }
          };
        })(book.book_id)
      );
      body.appendChild(tr);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillBreakdown(tbodyId, rows) {
    var body = $(tbodyId);
    if (!body) return;
    body.innerHTML = "";
    var list = rows || [];
    if (!list.length) {
      body.innerHTML = "<tr><td colspan=\"2\">—</td></tr>";
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        escapeHtml(list[i].key) +
        "</td><td>" +
        formatNumber(list[i].count) +
        "</td>";
      body.appendChild(tr);
    }
  }

  function renderDetail(report) {
    var section = $("detail-section");
    var selected = report.selected_book;
    if (!section) return;
    if (!selected) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    $("detail-book-label").textContent =
      selected.title + " (" + selected.book_id + ")";
    fillBreakdown("detail-source", selected.by_source);
    fillBreakdown("detail-market", selected.by_market);
    fillBreakdown("detail-format", selected.by_format);
    fillBreakdown("detail-event", selected.by_event);
  }

  function selectBook(bookId) {
    state.selectedBookId = bookId;
    var url = new URL(window.location.href);
    url.searchParams.set("range", state.range);
    url.searchParams.set("book_id", bookId);
    window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
    loadReport();
  }

  function loadReport() {
    setStatus("Loading report…", false);
    var url =
      "/api/admin/analytics?range=" +
      encodeURIComponent(state.range) +
      (state.selectedBookId
        ? "&book_id=" + encodeURIComponent(state.selectedBookId)
        : "");
    fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (res.status === 401) {
          window.location.replace("/admin/login/");
          return null;
        }
        return res.json().then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (!result) return;
        if (!result.ok || !result.body || result.body.ok !== true) {
          var reason =
            result.body && result.body.reason
              ? result.body.reason
              : "unavailable";
          var hint =
            result.body && result.body.hint ? " " + result.body.hint : "";
          setStatus(
            "Report unavailable (" + reason + ")." + hint,
            true
          );
          return;
        }
        state.report = result.body;
        if (!state.selectedBookId && result.body.books && result.body.books.length) {
          /* keep selection empty until clicked */
        }
        renderSummary(result.body);
        renderBooks(result.body);
        renderDetail(result.body);
        setStatus(
          "Showing " +
            (result.body.range || state.range) +
            " · catalogue books " +
            ((result.body.summary && result.body.summary.books_in_catalogue) || 0),
          false
        );
      })
      .catch(function () {
        setStatus(
          "Report unavailable. The admin API needs Cloudflare Pages Functions and query credentials.",
          true
        );
      });
  }

  function onReady() {
    state.range = rangeFromQuery();
    state.selectedBookId = bookFromQuery();
    syncRangeInputs(state.range);

    var form = $("range-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var selected = form.querySelector('input[name="range"]:checked');
        state.range = selected ? selected.value : DEFAULT_RANGE;
        var url = new URL(window.location.href);
        url.searchParams.set("range", state.range);
        if (state.selectedBookId) {
          url.searchParams.set("book_id", state.selectedBookId);
        } else {
          url.searchParams.delete("book_id");
        }
        window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
        loadReport();
      });
    }

    loadReport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
