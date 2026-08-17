/**
 * Curious Minds admin session auth.
 * Passphrase and HMAC key come from Pages secrets only.
 * Session cookie carries expiry and nonce — not visitor identity.
 */

export var COOKIE_NAME = "__Host-cm_admin_session";
export var SESSION_MAX_AGE_SECONDS = 28800;
export var LOGIN_BODY_LIMIT = 2048;
export var SESSION_VERSION = "v1";
export var NONCE_HEX_LENGTH = 32;
export var MAC_HEX_LENGTH = 64;

var encoder = new TextEncoder();
var HEX_RE = /^[0-9a-fA-F]+$/;
var DIGITS_RE = /^\d+$/;

var JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow"
};

var HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow"
};

function utf8(value) {
  return encoder.encode(String(value == null ? "" : value));
}

export function bytesToHex(bytes) {
  var out = "";
  var i;
  var hex;
  for (i = 0; i < bytes.length; i++) {
    hex = bytes[i].toString(16);
    out += hex.length === 1 ? "0" + hex : hex;
  }
  return out;
}

export function hexToBytes(hex) {
  if (!hex || typeof hex !== "string" || hex.length % 2 !== 0 || !HEX_RE.test(hex)) {
    return null;
  }
  var out = new Uint8Array(hex.length / 2);
  var i;
  for (i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function secretToKeyBytes(secret) {
  var value = String(secret);
  if (value.length >= 64 && value.length % 2 === 0 && HEX_RE.test(value)) {
    return hexToBytes(value);
  }
  return utf8(value);
}

async function importHmacKey(secretBytes) {
  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function loadAdminCrypto(env) {
  var passphrase = env && env.CM_ADMIN_PASSPHRASE != null ? String(env.CM_ADMIN_PASSPHRASE) : "";
  var sessionSecret =
    env && env.CM_ADMIN_SESSION_SECRET != null ? String(env.CM_ADMIN_SESSION_SECRET) : "";
  if (!passphrase || !sessionSecret) {
    return { ok: false, reason: "auth_not_configured", status: 503 };
  }
  var keyBytes = secretToKeyBytes(sessionSecret);
  if (!keyBytes || keyBytes.length < 32) {
    return { ok: false, reason: "auth_not_configured", status: 503 };
  }
  try {
    var key = await importHmacKey(keyBytes);
    return { ok: true, passphrase: passphrase, key: key };
  } catch (err) {
    return { ok: false, reason: "auth_not_configured", status: 503 };
  }
}

export function requestPathname(request) {
  try {
    return new URL(request.url).pathname;
  } catch (err) {
    return "";
  }
}

export function isPublicAdminLoginPage(pathname) {
  return pathname === "/admin/login" || pathname === "/admin/login/";
}

export function isPublicAdminLoginPost(pathname) {
  return pathname === "/api/admin/login" || pathname === "/api/admin/login/";
}

export function isPublicAdminLogoutPost(pathname) {
  return pathname === "/api/admin/logout" || pathname === "/api/admin/logout/";
}

export function isAdminUiPath(pathname) {
  return pathname === "/admin" || pathname.indexOf("/admin/") === 0;
}

export function isAdminApiPath(pathname) {
  return pathname === "/api/admin" || pathname.indexOf("/api/admin/") === 0;
}

export function sameOriginPost(request) {
  if (!request || !request.headers || typeof request.headers.get !== "function") return false;
  var originHeader = request.headers.get("Origin");
  if (originHeader == null) return false;
  var origin = String(originHeader).trim();
  if (!origin) return false;
  var hostHeader = request.headers.get("Host");
  if (hostHeader == null) return false;
  var host = String(hostHeader).trim();
  if (!host) return false;
  try {
    var url = new URL(request.url);
    var originUrl = new URL(origin);
    if (originUrl.origin !== url.origin) return false;
    if (host.toLowerCase() !== url.host.toLowerCase()) return false;
    return true;
  } catch (err) {
    return false;
  }
}

export async function readLimitedFormBody(request, limit) {
  var maxBytes = typeof limit === "number" ? limit : LOGIN_BODY_LIMIT;
  if (!request || typeof request.headers.get !== "function") {
    return { ok: false, reason: "invalid_body" };
  }
  var contentType = request.headers.get("Content-Type") || "";
  var mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded") {
    return { ok: false, reason: "unsupported_media_type" };
  }
  var lengthHeader = request.headers.get("Content-Length");
  if (lengthHeader != null && String(lengthHeader).trim() !== "") {
    var declared = Number(lengthHeader);
    if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) {
      return { ok: false, reason: "payload_too_large" };
    }
  }
  var buffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (err) {
    return { ok: false, reason: "invalid_body" };
  }
  if (!buffer || buffer.byteLength > maxBytes) {
    return { ok: false, reason: "payload_too_large" };
  }
  var text = new TextDecoder("utf-8").decode(buffer);
  var params = new URLSearchParams(text);
  return { ok: true, params: params };
}

export function readCookie(request, name) {
  if (!request || !request.headers || typeof request.headers.get !== "function") return null;
  var header = request.headers.get("Cookie");
  if (!header) return null;
  var pieces = String(header).split(";");
  var i;
  var piece;
  var eq;
  var key;
  var value;
  for (i = 0; i < pieces.length; i++) {
    piece = pieces[i];
    eq = piece.indexOf("=");
    if (eq === -1) continue;
    key = piece.slice(0, eq).trim();
    if (key !== name) continue;
    value = piece.slice(eq + 1).trim();
    return value;
  }
  return null;
}

export function parseSessionValue(value) {
  if (!value || typeof value !== "string") {
    return { ok: false, reason: "auth_required" };
  }
  var parts = value.split(".");
  if (parts.length !== 4) {
    return { ok: false, reason: "auth_required" };
  }
  var version = parts[0];
  var expRaw = parts[1];
  var nonceHex = parts[2];
  var macHex = parts[3];
  if (version !== SESSION_VERSION) {
    return { ok: false, reason: "auth_required" };
  }
  if (!DIGITS_RE.test(expRaw)) {
    return { ok: false, reason: "auth_required" };
  }
  if (!nonceHex || nonceHex.length !== NONCE_HEX_LENGTH || !HEX_RE.test(nonceHex)) {
    return { ok: false, reason: "auth_required" };
  }
  if (!macHex || macHex.length !== MAC_HEX_LENGTH || !HEX_RE.test(macHex)) {
    return { ok: false, reason: "auth_required" };
  }
  var exp = Number(expRaw);
  if (!Number.isFinite(exp)) {
    return { ok: false, reason: "auth_required" };
  }
  return {
    ok: true,
    payload: version + "." + expRaw + "." + nonceHex,
    exp: exp,
    nonceHex: nonceHex,
    macHex: macHex
  };
}

export function sessionSetCookieHeader(value) {
  return (
    COOKIE_NAME +
    "=" +
    value +
    "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" +
    SESSION_MAX_AGE_SECONDS
  );
}

export function sessionClearCookieHeader() {
  return COOKIE_NAME + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

export async function createSessionValue(env, options) {
  var loaded;
  try {
    loaded = await loadAdminCrypto(env);
  } catch (err) {
    return { ok: false, reason: "auth_unavailable", status: 503 };
  }
  if (!loaded.ok) return loaded;
  var nowMs = options && typeof options.nowMs === "number" ? options.nowMs : Date.now();
  var ttl =
    options && typeof options.ttlSeconds === "number"
      ? options.ttlSeconds
      : SESSION_MAX_AGE_SECONDS;
  var exp = Math.floor(nowMs / 1000) + ttl;
  var nonce = new Uint8Array(NONCE_HEX_LENGTH / 2);
  crypto.getRandomValues(nonce);
  var payload = SESSION_VERSION + "." + String(exp) + "." + bytesToHex(nonce);
  var macBuf;
  try {
    macBuf = await crypto.subtle.sign("HMAC", loaded.key, utf8(payload));
  } catch (err) {
    return { ok: false, reason: "auth_unavailable", status: 503 };
  }
  var value = payload + "." + bytesToHex(new Uint8Array(macBuf));
  return { ok: true, value: value, exp: exp };
}

export async function createAdminSessionCookie(env, options) {
  var created = await createSessionValue(env, options);
  if (!created.ok) return created;
  return {
    ok: true,
    value: created.value,
    header: sessionSetCookieHeader(created.value)
  };
}

export async function verifyAdminSession(env, request) {
  try {
    var loaded = await loadAdminCrypto(env);
    if (!loaded.ok) {
      return { ok: false, reason: loaded.reason, status: loaded.status || 503 };
    }
    var cookie = readCookie(request, COOKIE_NAME);
    if (!cookie) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    var parsed = parseSessionValue(cookie);
    if (!parsed.ok) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    var macBytes = hexToBytes(parsed.macHex);
    if (!macBytes) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    var valid;
    try {
      valid = await crypto.subtle.verify(
        { name: "HMAC", hash: "SHA-256" },
        loaded.key,
        macBytes,
        utf8(parsed.payload)
      );
    } catch (err) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    if (!valid) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    var now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "auth_unavailable", status: 503 };
  }
}

export async function comparePassphrase(env, supplied) {
  try {
    var loaded = await loadAdminCrypto(env);
    if (!loaded.ok) {
      return { ok: false, reason: loaded.reason, status: loaded.status || 503 };
    }
    var expectedMac;
    try {
      expectedMac = await crypto.subtle.sign("HMAC", loaded.key, utf8(loaded.passphrase));
    } catch (err) {
      return { ok: false, reason: "auth_unavailable", status: 503 };
    }
    var matches;
    try {
      matches = await crypto.subtle.verify(
        { name: "HMAC", hash: "SHA-256" },
        loaded.key,
        expectedMac,
        utf8(supplied)
      );
    } catch (err) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    if (!matches) {
      return { ok: false, reason: "auth_required", status: 401 };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "auth_unavailable", status: 503 };
  }
}

export function adminJson(status, body) {
  return new Response(JSON.stringify(body), { status: status, headers: JSON_HEADERS });
}

export function adminHtmlPage(status, title, message) {
  var body =
    "<!DOCTYPE html><html lang=\"en-GB\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<meta name=\"robots\" content=\"noindex, nofollow\">" +
    "<title>" +
    title +
    "</title></head><body><main><h1>" +
    title +
    "</h1><p>" +
    message +
    '</p><p><a href="/admin/login/">Return to sign in</a></p></main></body></html>';
  return new Response(body, { status: status, headers: HTML_HEADERS });
}

export function adminRedirect(status, location, extraHeaders) {
  var headers = {
    Location: location,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow"
  };
  var key;
  if (extraHeaders) {
    for (key in extraHeaders) {
      if (Object.prototype.hasOwnProperty.call(extraHeaders, key)) {
        headers[key] = extraHeaders[key];
      }
    }
  }
  return new Response(null, { status: status, headers: headers });
}

export function adminUiAuthResponse(verified, request) {
  if (!verified || verified.ok) {
    return adminHtmlPage(503, "Temporarily unavailable", "This private report is not available right now.");
  }
  if (verified.status === 503 || verified.reason === "auth_not_configured" || verified.reason === "auth_unavailable") {
    return adminHtmlPage(
      503,
      "Temporarily unavailable",
      "This private report is not available right now."
    );
  }
  var loginUrl;
  try {
    loginUrl = new URL("/admin/login/", request.url).toString();
  } catch (err) {
    loginUrl = "/admin/login/";
  }
  return adminRedirect(302, loginUrl);
}

export function adminApiAuthResponse(verified) {
  var status = verified && verified.status ? verified.status : 401;
  var reason = verified && verified.reason ? verified.reason : "auth_required";
  return adminJson(status, { ok: false, reason: reason });
}
