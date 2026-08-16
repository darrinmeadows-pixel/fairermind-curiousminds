const assert = require("assert");
const locale = require("../js/cm-locale.js");
const localeConfig = require("../data/locale.json");
const catalogue = require("../data/catalogue.json");

const book = catalogue.books["CM-Y05to10-STO-SCI-BEACH"];

function lang(input) {
  return locale.resolveLanguage(input, localeConfig);
}

function country(input) {
  return locale.resolveCountry(input, localeConfig);
}

assert.strictEqual(lang({}).language, "en-GB");
assert.strictEqual(lang({}).source, "fallback");

assert.strictEqual(lang({
  acceptLanguage: "en-GB,en;q=0.9",
  browserLanguages: ["en-GB"]
}).language, "en-GB");

assert.strictEqual(lang({
  acceptLanguage: "en-US,en;q=0.9",
  browserLanguages: ["en-US"]
}).language, "en-GB");

assert.strictEqual(lang({
  browserLanguages: ["fr-FR", "de"]
}).language, "en-GB");
assert.strictEqual(lang({
  browserLanguages: ["fr-FR", "de"]
}).source, "fallback");

assert.strictEqual(lang({
  explicitLanguage: "en-GB",
  browserLanguages: ["fr-FR"]
}).source, "explicit");

assert.strictEqual(lang({
  savedLanguage: "en-GB",
  browserLanguages: ["fr-FR"]
}).source, "saved");

assert.strictEqual(lang({
  urlLanguage: "en",
  browserLanguages: ["fr"]
}).language, "en-GB");

assert.strictEqual(lang({
  urlLanguage: "zz-ZZ",
  browserLanguages: ["fr"]
}).source, "fallback");

assert.strictEqual(lang({
  explicitLanguage: "not-a-language",
  savedLanguage: "en-GB"
}).source, "saved");

assert.strictEqual(country({}).country, "INTL");
assert.strictEqual(country({}).automatic, true);

assert.strictEqual(country({ detectedCountry: null }).country, "INTL");
assert.strictEqual(country({ detectedCountry: "XX" }).country, "INTL");
assert.strictEqual(country({ detectedCountry: "T1" }).country, "INTL");
assert.strictEqual(country({ detectedCountry: "GB" }).country, "GB");
assert.strictEqual(country({ detectedCountry: "US" }).country, "US");

assert.strictEqual(country({
  explicitCountry: "US",
  detectedCountry: "GB"
}).country, "US");
assert.strictEqual(country({
  explicitCountry: "US",
  detectedCountry: "GB"
}).automatic, false);

assert.strictEqual(country({
  savedCountry: "AU",
  detectedCountry: "GB"
}).country, "AU");

assert.strictEqual(country({
  urlCountry: "CA",
  detectedCountry: "GB"
}).country, "CA");

assert.strictEqual(country({
  urlCountry: "not-a-country",
  detectedCountry: "GB"
}).country, "GB");

assert.strictEqual(country({
  explicitCountry: "UK",
  detectedCountry: "IE"
}).country, "IE");

assert.strictEqual(locale.countryFromVisitorContext({ country: "GB" }), "GB");
assert.strictEqual(locale.countryFromVisitorContext({ country: "US" }), "US");
assert.strictEqual(locale.countryFromVisitorContext({ country: "gb" }), "GB");
assert.strictEqual(locale.countryFromVisitorContext({ country: "us" }), "US");
assert.strictEqual(locale.countryFromVisitorContext({}), "INTL");
assert.strictEqual(locale.countryFromVisitorContext({ country: "XX" }), "INTL");
assert.strictEqual(locale.countryFromVisitorContext({ country: "T1" }), "INTL");
assert.strictEqual(locale.countryFromVisitorContext({ country: "ZZ" }), "INTL");
assert.strictEqual(locale.countryFromVisitorContext({ country: "GBR" }), "INTL");
assert.strictEqual(locale.countryFromVisitorContext({ country: "" }), "INTL");
assert.strictEqual(locale.countryFromVisitorContext(null), "INTL");
assert.strictEqual(locale.countryFromVisitorContext([]), "INTL");
assert.strictEqual(locale.countryFromVisitorContext("GB"), "INTL");
assert.strictEqual(
  locale.countryFromVisitorContext({ country: "DE", ip: "1.2.3.4", city: "Berlin" }),
  "DE"
);
assert.strictEqual(locale.countryFromVisitorContextText('{"country":"GB"}'), "GB");
assert.strictEqual(locale.countryFromVisitorContextText("{"), "INTL");
assert.strictEqual(locale.countryFromVisitorContextText("not-json"), "INTL");
assert.strictEqual(locale.countryFromVisitorContextText(""), "INTL");
assert.strictEqual(locale.countryFromVisitorContextText(null), "INTL");

assert.strictEqual(country({
  explicitCountry: "US",
  savedCountry: "AU",
  urlCountry: "CA",
  detectedCountry: "GB"
}).country, "US");
assert.strictEqual(country({
  savedCountry: "AU",
  urlCountry: "CA",
  detectedCountry: "GB"
}).source, "saved");
assert.strictEqual(country({
  detectedCountry: "not-json"
}).country, "INTL");

assert.strictEqual(lang({
  browserLanguages: ["fr-FR"],
  explicitLanguage: null
}).language, "en-GB");
assert.strictEqual(country({
  detectedCountry: "GB"
}).country, "GB");
assert.notStrictEqual(
  lang({ browserLanguages: ["fr-FR"] }).language,
  country({ detectedCountry: "FR" }).country
);
assert.strictEqual(
  country({
    savedCountry: "US",
    detectedCountry: "FR"
  }).country,
  "US"
);
assert.strictEqual(
  lang({
    savedLanguage: "en-GB",
    browserLanguages: ["fr-FR"]
  }).language,
  "en-GB"
);

assert.strictEqual(country({
  explicitCountry: "GB",
  detectedCountry: locale.countryFromVisitorContextText("{")
}).country, "GB");
assert.strictEqual(country({
  savedCountry: "US",
  detectedCountry: locale.countryFromVisitorContextText("not-json")
}).country, "US");
assert.strictEqual(country({
  detectedCountry: locale.countryFromVisitorContextText("{")
}).country, "INTL");

assert.deepStrictEqual(locale.retailerLinks(book, "GB", { source: "qr" }), [
  {
    title: "Paperback — Amazon UK",
    href: "/go/amazon/CM-Y05to10-STO-SCI-BEACH?market=GB&format=paperback&src=qr",
    external: false,
    format: "paperback"
  },
  {
    title: "Kindle — Amazon UK",
    href: "/go/amazon/CM-Y05to10-STO-SCI-BEACH?market=GB&format=kindle&src=qr",
    external: false,
    format: "kindle"
  }
]);
assert.deepStrictEqual(locale.retailerLinks(book, "US"), []);
assert.deepStrictEqual(locale.retailerLinks(book, "INTL"), []);
assert.deepStrictEqual(locale.affiliateLinks(book, "GB"), []);
assert.deepStrictEqual(locale.visibleItems(book.teacher_notes), []);
assert.deepStrictEqual(locale.visibleItems(book.parent_carer_guidance), []);
assert.deepStrictEqual(locale.visibleItems(book.same_age_books), []);
assert.deepStrictEqual(locale.visibleItems(book.similar_science_books), []);
assert.deepStrictEqual(locale.visibleItems(book.similar_nature_books), []);

assert.strictEqual(
  locale.bookIdForQrRoute(catalogue, "5-10", "fish-breathe-underwater"),
  "CM-Y05to10-STO-SCI-BEACH"
);
assert.strictEqual(
  locale.bookIdForQrRoute(catalogue, "8-12", "fish-breathe-underwater"),
  null
);

const twoAgeCatalogue = {
  qr_routes: {
    "5-10/fish-breathe-underwater": { book_id: "CM-Y05to10-STO-SCI-BEACH" },
    "8-12/fish-breathe-underwater": { book_id: "CM-Y08to12-STO-SCI-BEACH" }
  }
};
assert.notStrictEqual(
  locale.bookIdForQrRoute(twoAgeCatalogue, "5-10", "fish-breathe-underwater"),
  locale.bookIdForQrRoute(twoAgeCatalogue, "8-12", "fish-breathe-underwater")
);

const unauthorisedAffiliate = {
  affiliate_authorised: false,
  affiliate_disclosure: "Disclosure",
  affiliate_links_by_market: {
    GB: [{ title: "Shop", href: "https://example.com/a" }]
  }
};
assert.deepStrictEqual(locale.affiliateLinks(unauthorisedAffiliate, "GB"), []);

const authorisedNoDisclosure = {
  affiliate_authorised: true,
  affiliate_disclosure: null,
  affiliate_links_by_market: {
    GB: [{ title: "Shop", href: "https://example.com/a" }]
  }
};
assert.deepStrictEqual(locale.affiliateLinks(authorisedNoDisclosure, "GB"), []);

const gbOnly = {
  retailers_by_market: {
    GB: [{ title: "UK shop", href: "https://example.com/uk" }]
  }
};
assert.strictEqual(locale.retailerLinks(gbOnly, "US").length, 0);
assert.strictEqual(locale.retailerLinks(gbOnly, "INTL").length, 0);
assert.strictEqual(locale.retailerLinks(gbOnly, "GB").length, 1);

console.log("locale tests passed");
