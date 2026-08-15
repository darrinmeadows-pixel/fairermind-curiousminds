/**
 * Progressive enhancement for Curious Minds QR landing pages.
 * The HTML already contains the current book in English / INTL.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "cm:visitor-prefs";
  var localeConfig = null;
  var catalogue = null;

  function loadJSON(url) {
    return fetch(url, { cache: "no-store", credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    });
  }

  function readPrefs() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writePrefs(prefs) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      /* localStorage may be unavailable */
    }
  }

  function queryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      var value = params.get(name);
      return value === null ? null : value;
    } catch (err) {
      return null;
    }
  }

  function detectCountry() {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () {
        controller.abort();
      }, 2500);
    }
    return fetch("/api/visitor-context", {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) return "INTL";
      return res.text();
    }).then(function (data) {
      if (data === "INTL") return "INTL";
      if (!window.CMLocale || typeof window.CMLocale.countryFromVisitorContextText !== "function") {
        return "INTL";
      }
      return window.CMLocale.countryFromVisitorContextText(data);
    }).catch(function () {
      return "INTL";
    }).then(function (country) {
      if (timer) clearTimeout(timer);
      return country || "INTL";
    });
  }

  function countryAlreadyChosen() {
    var prefs = readPrefs();
    var resolved = window.CMLocale.resolveCountry({
      explicitCountry: null,
      savedCountry: prefs.country || null,
      urlCountry: queryParam("country"),
      detectedCountry: null
    }, localeConfig);
    return resolved.source === "saved" || resolved.source === "url";
  }

  function bookFromPage() {
    var root = document.getElementById("qr-book");
    if (!root || !catalogue || !catalogue.books) return null;
    return catalogue.books[root.getAttribute("data-book-id")] || null;
  }

  function setRegionLabel(country, automatic) {
    var output = document.getElementById("current-region");
    var select = document.getElementById("country-select");
    if (!output || !select || !localeConfig) return;
    var markets = localeConfig.markets || [];
    var label = country;
    for (var i = 0; i < markets.length; i++) {
      if (markets[i].code === country) {
        label = markets[i].label;
        break;
      }
    }
    output.textContent = automatic ? label + " (automatic)" : label;
    select.value = automatic ? "AUTO" : country;
  }

  function hideEmpty(id, items) {
    var section = document.getElementById(id);
    if (!section) return;
    if (!items || !items.length) {
      section.hidden = true;
      section.innerHTML = "";
    }
  }

  function applyOptionalSections(book, country) {
    if (!window.CMLocale || !book) return;
    hideEmpty("more-same-age", window.CMLocale.visibleItems(book.same_age_books));
    hideEmpty("similar-science", window.CMLocale.visibleItems(book.similar_science_books));
    hideEmpty("similar-nature", window.CMLocale.visibleItems(book.similar_nature_books));
    hideEmpty("teacher-notes", window.CMLocale.visibleItems(book.teacher_notes));
    hideEmpty("parent-guidance", window.CMLocale.visibleItems(book.parent_carer_guidance));
    hideEmpty("where-to-find", window.CMLocale.retailerLinks(book, country));
    hideEmpty("affiliate-block", window.CMLocale.affiliateLinks(book, country));
  }

  function applyResolution(resolution) {
    document.documentElement.lang = resolution.language.language;
    setRegionLabel(resolution.country.country, resolution.country.automatic);
    applyOptionalSections(bookFromPage(), resolution.country.country);
  }

  function resolveWith(detectedCountry, explicitCountry, explicitLanguage) {
    var prefs = readPrefs();
    var language = window.CMLocale.resolveLanguage({
      explicitLanguage: explicitLanguage,
      savedLanguage: prefs.language || null,
      urlLanguage: queryParam("lang"),
      browserLanguages: navigator.languages || [navigator.language]
    }, localeConfig);
    var country = window.CMLocale.resolveCountry({
      explicitCountry: explicitCountry,
      savedCountry: prefs.country || null,
      urlCountry: queryParam("country"),
      detectedCountry: detectedCountry
    }, localeConfig);
    return { language: language, country: country };
  }

  function onReady() {
    if (!window.CMLocale) return;
    var root = document.getElementById("qr-landing");
    if (!root) return;

    Promise.all([
      loadJSON("/data/locale.json"),
      loadJSON("/data/catalogue.json")
    ]).then(function (results) {
      localeConfig = results[0];
      catalogue = results[1];
      if (countryAlreadyChosen()) return null;
      return detectCountry();
    }).then(function (detected) {
      applyResolution(resolveWith(detected, null, null));

      var form = document.getElementById("region-form");
      var select = document.getElementById("country-select");
      var autoButton = document.getElementById("use-automatic-region");
      if (form && select) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();
        });
        select.addEventListener("change", function () {
          var prefs = readPrefs();
          if (select.value === "AUTO") {
            delete prefs.country;
            writePrefs(prefs);
            detectCountry().then(function (detected) {
              applyResolution(resolveWith(detected, null, null));
            });
            return;
          }
          prefs.country = select.value;
          writePrefs(prefs);
          applyResolution(resolveWith(null, select.value, null));
        });
      }
      if (autoButton) {
        autoButton.addEventListener("click", function (event) {
          event.preventDefault();
          var prefs = readPrefs();
          delete prefs.country;
          writePrefs(prefs);
          detectCountry().then(function (detected) {
            applyResolution(resolveWith(detected, null, null));
          });
        });
      }
    }).catch(function () {
      document.documentElement.lang = "en-GB";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
