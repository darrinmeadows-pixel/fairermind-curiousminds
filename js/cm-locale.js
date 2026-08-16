/**
 * Curious Minds visitor language and country/market resolution.
 * Country is never inferred from language. Values are allowlisted.
 */
(function (root) {
  "use strict";

  var FALLBACK_LANGUAGE = "en-GB";
  var FALLBACK_MARKET = "INTL";
  var UNKNOWN_COUNTRIES = { XX: true, T1: true, ZZ: true };

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function completeLanguages(localeConfig) {
    var languages = (localeConfig && localeConfig.languages) || [];
    var out = [];
    for (var i = 0; i < languages.length; i++) {
      if (languages[i] && languages[i].complete && languages[i].code) {
        out.push(String(languages[i].code));
      }
    }
    return out.length ? out : [FALLBACK_LANGUAGE];
  }

  function marketCodes(localeConfig) {
    var markets = (localeConfig && localeConfig.markets) || [];
    var out = [FALLBACK_MARKET];
    for (var i = 0; i < markets.length; i++) {
      if (markets[i] && markets[i].code && out.indexOf(markets[i].code) === -1) {
        out.push(String(markets[i].code).toUpperCase());
      }
    }
    return out;
  }

  function matchLanguage(raw, supported) {
    if (!raw || typeof raw !== "string") return null;
    var value = raw.trim().replace(/_/g, "-");
    if (!value) return null;
    var i;
    for (i = 0; i < supported.length; i++) {
      if (supported[i].toLowerCase() === value.toLowerCase()) return supported[i];
    }
    var primary = value.split("-")[0].toLowerCase();
    for (i = 0; i < supported.length; i++) {
      if (supported[i].split("-")[0].toLowerCase() === primary) return supported[i];
    }
    return null;
  }

  function parseCountry(raw, markets, fromDetection) {
    if (raw === null || raw === undefined) {
      return fromDetection ? { status: "ok", country: FALLBACK_MARKET } : { status: "missing" };
    }
    if (typeof raw !== "string") return { status: "invalid" };
    var value = raw.trim().toUpperCase();
    if (!value) {
      return fromDetection ? { status: "ok", country: FALLBACK_MARKET } : { status: "missing" };
    }
    if (UNKNOWN_COUNTRIES[value]) return { status: "ok", country: FALLBACK_MARKET };
    if (value === FALLBACK_MARKET) return { status: "ok", country: FALLBACK_MARKET };
    if (!/^[A-Z]{2}$/.test(value)) return { status: "invalid" };
    if (markets.indexOf(value) !== -1) return { status: "ok", country: value };
    return fromDetection ? { status: "ok", country: FALLBACK_MARKET } : { status: "invalid" };
  }

  function firstHeaderLanguage(acceptLanguage) {
    if (!acceptLanguage || typeof acceptLanguage !== "string") return [];
    return acceptLanguage.split(",").map(function (part) {
      return part.split(";")[0].trim();
    }).filter(Boolean);
  }

  function resolveLanguage(input, localeConfig) {
    var supported = completeLanguages(localeConfig);
    var fallback = (localeConfig && localeConfig.default_language) || FALLBACK_LANGUAGE;
    var sources = [
      { name: "explicit", value: input && input.explicitLanguage },
      { name: "saved", value: input && input.savedLanguage },
      { name: "url", value: input && input.urlLanguage }
    ];
    var i;
    for (i = 0; i < sources.length; i++) {
      var matched = matchLanguage(sources[i].value, supported);
      if (matched) {
        return { language: matched, source: sources[i].name };
      }
    }
    var browser = (input && input.browserLanguages) || [];
    if (input && input.acceptLanguage) {
      browser = browser.concat(firstHeaderLanguage(input.acceptLanguage));
    }
    for (i = 0; i < browser.length; i++) {
      matched = matchLanguage(browser[i], supported);
      if (matched) {
        return { language: matched, source: "browser" };
      }
    }
    return { language: fallback, source: "fallback" };
  }

  function resolveCountry(input, localeConfig) {
    var markets = marketCodes(localeConfig);
    var sources = [
      { name: "explicit", value: input && input.explicitCountry },
      { name: "saved", value: input && input.savedCountry },
      { name: "url", value: input && input.urlCountry }
    ];
    var i;
    for (i = 0; i < sources.length; i++) {
      var parsed = parseCountry(sources[i].value, markets, false);
      if (parsed.status === "ok") {
        return { country: parsed.country, source: sources[i].name, automatic: false };
      }
    }
    var detected = parseCountry(input && input.detectedCountry, markets, true);
    if (detected.status === "ok") {
      return { country: detected.country, source: "detection", automatic: true };
    }
    return { country: FALLBACK_MARKET, source: "fallback", automatic: true };
  }

  function countryFromVisitorContext(data) {
    if (!isObject(data) || Array.isArray(data)) return FALLBACK_MARKET;
    if (typeof data.country !== "string") return FALLBACK_MARKET;
    var value = data.country.trim().toUpperCase();
    if (!value || UNKNOWN_COUNTRIES[value]) return FALLBACK_MARKET;
    if (value === FALLBACK_MARKET) return FALLBACK_MARKET;
    if (!/^[A-Z]{2}$/.test(value)) return FALLBACK_MARKET;
    return value;
  }

  function countryFromVisitorContextText(text) {
    if (typeof text !== "string") return FALLBACK_MARKET;
    try {
      return countryFromVisitorContext(JSON.parse(text));
    } catch (err) {
      return FALLBACK_MARKET;
    }
  }

  function httpsUrl(value) {
    if (!value || typeof value !== "string") return null;
    var url = value.trim();
    if (url.indexOf("https://") !== 0) return null;
    if (url.indexOf("https://localhost") === 0) return null;
    return url;
  }

  var SHOP_FORMATS = ["paperback", "kindle"];

  function normaliseShopFormat(raw) {
    if (raw === null || raw === undefined || raw === "") return null;
    var value = String(raw).trim().toLowerCase();
    if (SHOP_FORMATS.indexOf(value) === -1) return null;
    return value;
  }

  function amazonGoHref(bookId, market, format, source) {
    var src = source || "book";
    return (
      "/go/amazon/" +
      encodeURIComponent(bookId) +
      "?market=" +
      encodeURIComponent(market) +
      "&format=" +
      encodeURIComponent(format) +
      "&src=" +
      encodeURIComponent(src)
    );
  }

  function visibleItems(items) {
    if (!items || !items.length) return [];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !item.title) continue;
      var href = item.href || item.url;
      var abs = httpsUrl(href);
      var internal = typeof href === "string" && href.charAt(0) === "/" && href.indexOf("//") !== 0;
      if (!abs && !internal) continue;
      out.push({
        title: item.title,
        href: abs || href,
        external: Boolean(abs)
      });
    }
    return out;
  }

  /**
   * Retailer CTAs for a book/market. Amazon format entries become same-origin
   * /go/amazon paths so raw Amazon product URLs stay catalogue-only.
   */
  function retailerLinks(book, country, options) {
    if (!book || !isObject(book.retailers_by_market)) return [];
    var source = options && options.source ? String(options.source) : "book";
    var marketLinks = book.retailers_by_market[country] || [];
    if ((!marketLinks || !marketLinks.length) && country !== FALLBACK_MARKET) {
      return [];
    }
    if ((!marketLinks || !marketLinks.length) && country === FALLBACK_MARKET) {
      marketLinks = book.retailers_by_market[FALLBACK_MARKET] || [];
    }
    if (!marketLinks || !marketLinks.length) return [];

    var out = [];
    var bookId = book.id || book.book_id;
    for (var i = 0; i < marketLinks.length; i++) {
      var item = marketLinks[i];
      if (!item || !item.title) continue;
      var format = normaliseShopFormat(item.format);
      var href = item.href || item.url;
      if (format && bookId && httpsUrl(href)) {
        out.push({
          title: item.title,
          href: amazonGoHref(bookId, country, format, source),
          external: false,
          format: format
        });
        continue;
      }
      var abs = httpsUrl(href);
      var internal = typeof href === "string" && href.charAt(0) === "/" && href.indexOf("//") !== 0;
      if (!abs && !internal) continue;
      out.push({
        title: item.title,
        href: abs || href,
        external: Boolean(abs)
      });
    }
    return out;
  }

  function affiliateLinks(book, country) {
    if (!book || book.affiliate_authorised !== true) return [];
    if (!book.affiliate_disclosure) return [];
    if (!isObject(book.affiliate_links_by_market)) return [];
    var marketLinks = book.affiliate_links_by_market[country] || [];
    return visibleItems(marketLinks);
  }

  function qrRouteKey(ageBand, slug) {
    return String(ageBand || "") + "/" + String(slug || "");
  }

  function bookIdForQrRoute(catalogue, ageBand, slug) {
    if (!catalogue || !catalogue.qr_routes) return null;
    var route = catalogue.qr_routes[qrRouteKey(ageBand, slug)];
    return route && route.book_id ? route.book_id : null;
  }

  var api = {
    FALLBACK_LANGUAGE: FALLBACK_LANGUAGE,
    FALLBACK_MARKET: FALLBACK_MARKET,
    completeLanguages: completeLanguages,
    marketCodes: marketCodes,
    matchLanguage: matchLanguage,
    parseCountry: parseCountry,
    resolveLanguage: resolveLanguage,
    resolveCountry: resolveCountry,
    visibleItems: visibleItems,
    retailerLinks: retailerLinks,
    amazonGoHref: amazonGoHref,
    affiliateLinks: affiliateLinks,
    httpsUrl: httpsUrl,
    countryFromVisitorContext: countryFromVisitorContext,
    countryFromVisitorContextText: countryFromVisitorContextText,
    qrRouteKey: qrRouteKey,
    bookIdForQrRoute: bookIdForQrRoute
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.CMLocale = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
