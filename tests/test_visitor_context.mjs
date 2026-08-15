import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createVisitorContextResult,
  normaliseDetectedCountry,
  onRequest,
  onRequestGet,
  visitorContextJSON,
  VISITOR_CONTEXT_HEADERS
} from "../functions/api/visitor-context.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const landingSrc = fs.readFileSync(path.join(root, "js/cm-qr-landing.js"), "utf8");
const localeSrc = fs.readFileSync(path.join(root, "js/cm-locale.js"), "utf8");
const functionSrc = fs.readFileSync(
  path.join(root, "functions/api/visitor-context.js"),
  "utf8"
);

assert.equal(normaliseDetectedCountry("GB"), "GB");
assert.equal(normaliseDetectedCountry("US"), "US");
assert.equal(normaliseDetectedCountry("gb"), "GB");
assert.equal(normaliseDetectedCountry("us"), "US");
assert.equal(normaliseDetectedCountry(undefined), "INTL");
assert.equal(normaliseDetectedCountry(null), "INTL");
assert.equal(normaliseDetectedCountry(""), "INTL");
assert.equal(normaliseDetectedCountry("XX"), "INTL");
assert.equal(normaliseDetectedCountry("T1"), "INTL");
assert.equal(normaliseDetectedCountry("ZZ"), "INTL");
assert.equal(normaliseDetectedCountry("GBR"), "INTL");
assert.equal(normaliseDetectedCountry("1A"), "INTL");
assert.equal(normaliseDetectedCountry("g b"), "INTL");

const locationFields = [
  "ip",
  "city",
  "colo",
  "latitude",
  "longitude",
  "postalCode",
  "region",
  "timezone",
  "asOrganization",
  "metroCode",
  "continent",
  "clientTcpRtt",
  "httpProtocol",
  "tlsVersion",
  "tlsCipher"
];

function richCf(country) {
  return {
    country,
    city: "London",
    colo: "LHR",
    continent: "EU",
    latitude: "51.5074",
    longitude: "-0.1278",
    postalCode: "SW1A",
    region: "England",
    timezone: "Europe/London",
    asOrganization: "Example ISP",
    metroCode: "234",
    clientTcpRtt: 12,
    httpProtocol: "HTTP/2",
    tlsVersion: "TLSv1.3",
    tlsCipher: "AEAD-AES128-GCM-SHA256"
  };
}

function contextFor(country, method) {
  return {
    request: {
      method: method || "GET",
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "203.0.113.10",
        "true-client-ip": "203.0.113.10"
      },
      cf: country === "NO_CF" ? undefined : richCf(country)
    }
  };
}

async function jsonFrom(response) {
  const text = await response.text();
  return { text, data: JSON.parse(text), response };
}

async function assertSafeResponse(response, expectedCountry, expectedStatus) {
  const parsed = await jsonFrom(response);
  assert.equal(parsed.response.status, expectedStatus);
  assert.deepEqual(parsed.data, { country: expectedCountry });
  assert.deepEqual(Object.keys(parsed.data), ["country"]);
  assert.equal(parsed.text, JSON.stringify({ country: expectedCountry }));
  assert.match(
    parsed.response.headers.get("Content-Type"),
    /^application\/json; charset=utf-8$/i
  );
  assert.equal(parsed.response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(parsed.response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(parsed.response.headers.get("Access-Control-Allow-Origin"), null);
  for (const field of locationFields) {
    assert.equal(Object.prototype.hasOwnProperty.call(parsed.data, field), false);
    assert.equal(new RegExp('"' + field + '"').test(parsed.text), false);
  }
  assert.equal(parsed.text.includes("203.0.113.10"), false);
  assert.equal(parsed.text.includes("London"), false);
  assert.equal(parsed.text.includes("51.5074"), false);
  assert.equal(parsed.text.includes("SW1A"), false);
  assert.equal(parsed.text.includes("Europe/London"), false);
  assert.equal(parsed.text.includes("LHR"), false);
  return parsed;
}

const gb = await onRequestGet(contextFor("GB"));
await assertSafeResponse(gb, "GB", 200);

const us = await onRequestGet(contextFor("US"));
await assertSafeResponse(us, "US", 200);

const lower = await onRequestGet(contextFor("gb"));
await assertSafeResponse(lower, "GB", 200);

const missing = await onRequestGet(contextFor(undefined));
await assertSafeResponse(missing, "INTL", 200);

const noCf = await onRequestGet(contextFor("NO_CF"));
await assertSafeResponse(noCf, "INTL", 200);

const xx = await onRequestGet(contextFor("XX"));
await assertSafeResponse(xx, "INTL", 200);

const t1 = await onRequestGet(contextFor("T1"));
await assertSafeResponse(t1, "INTL", 200);

const invalid = await onRequestGet(contextFor("GBR"));
await assertSafeResponse(invalid, "INTL", 200);

const post = await onRequest(contextFor("GB", "POST"));
await assertSafeResponse(post, "INTL", 405);

const built = createVisitorContextResult("GET", "ie");
assert.equal(built.status, 200);
assert.deepEqual(built.body, { country: "IE" });
assert.equal(visitorContextJSON(built), '{"country":"IE"}');
assert.equal(VISITOR_CONTEXT_HEADERS["Cache-Control"], "private, no-store");
assert.equal(VISITOR_CONTEXT_HEADERS["Content-Type"], "application/json; charset=utf-8");

assert.equal(landingSrc.includes("/cdn-cgi/trace"), false);
assert.equal(landingSrc.includes("parseTrace"), false);
assert.equal(localeSrc.includes("/cdn-cgi/trace"), false);
assert.equal(functionSrc.includes("/cdn-cgi/trace"), false);
assert.equal(landingSrc.includes("/api/visitor-context"), true);
assert.equal(landingSrc.includes("countryAlreadyChosen"), true);
assert.equal(/while\s*\(.*fetch/.test(landingSrc), false);
assert.equal(landingSrc.includes("location.reload"), false);
assert.equal(landingSrc.includes("window.location.href"), false);
assert.equal(/console\.(log|info|debug|warn)/.test(functionSrc), false);
assert.equal(functionSrc.includes("request.cf.country"), true);
assert.equal(functionSrc.includes("cf-connecting-ip"), false);
assert.equal(fs.existsSync(path.join(root, "functions/lib/country.js")), false);

console.log("visitor-context tests passed");
