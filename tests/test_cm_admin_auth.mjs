import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COOKIE_NAME,
  LOGIN_BODY_LIMIT,
  SESSION_MAX_AGE_SECONDS,
  comparePassphrase,
  createSessionValue,
  hexToBytes,
  isAdminApiPath,
  isAdminUiPath,
  isPublicAdminLoginPage,
  isPublicAdminLoginPost,
  isPublicAdminLogoutPost,
  parseSessionValue,
  readLimitedFormBody,
  sameOriginPost,
  sessionClearCookieHeader,
  sessionSetCookieHeader,
  verifyAdminSession
} from "../functions/lib/cm-admin-auth.js";
import { onRequest as adminUiMiddleware } from "../functions/admin/_middleware.js";
import { onRequest as adminApiMiddleware } from "../functions/api/admin/_middleware.js";
import { onRequestPost as loginPost } from "../functions/api/admin/login.js";
import { onRequestPost as logoutPost } from "../functions/api/admin/logout.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://curiousminds.fairermind.com";
const ENV = {
  CM_ADMIN_PASSPHRASE: "test-operator-passphrase-not-for-production",
  CM_ADMIN_SESSION_SECRET:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
};

const authSrc = fs.readFileSync(
  path.join(root, "functions/lib/cm-admin-auth.js"),
  "utf8"
);
const uiMiddlewareSrc = fs.readFileSync(
  path.join(root, "functions/admin/_middleware.js"),
  "utf8"
);
const apiMiddlewareSrc = fs.readFileSync(
  path.join(root, "functions/api/admin/_middleware.js"),
  "utf8"
);
const loginSrc = fs.readFileSync(
  path.join(root, "functions/api/admin/login.js"),
  "utf8"
);
const logoutSrc = fs.readFileSync(
  path.join(root, "functions/api/admin/logout.js"),
  "utf8"
);
const analyticsSrc = fs.readFileSync(
  path.join(root, "functions/api/admin/analytics.js"),
  "utf8"
);
const loginHtml = fs.readFileSync(
  path.join(root, "admin/login/index.html"),
  "utf8"
);
const adminJs = fs.readFileSync(
  path.join(root, "js/cm-admin-analytics.js"),
  "utf8"
);

const functionSources = [
  authSrc,
  uiMiddlewareSrc,
  apiMiddlewareSrc,
  loginSrc,
  logoutSrc,
  analyticsSrc
].join("\n");

assert.match(authSrc, /crypto\.subtle\.sign/);
assert.match(authSrc, /crypto\.subtle\.verify/);
assert.equal(/Math\.random/.test(functionSources), false);
assert.equal(/passThroughOnException\s*\(/.test(functionSources), false);
assert.equal(/diff\s*\|=/.test(authSrc), false);
assert.equal(/adminAccessAllowed|Cf-Access-Jwt-Assertion|CM_ADMIN_ACCESS_REQUIRED/.test(functionSources), false);
assert.equal(/CM_AE_API_TOKEN|CM_ADMIN_PASSPHRASE|CM_ADMIN_SESSION_SECRET/.test(loginHtml), false);
assert.equal(/CM_AE_API_TOKEN|CM_ADMIN_PASSPHRASE|CM_ADMIN_SESSION_SECRET/.test(adminJs), false);
assert.equal(/document\.cookie/i.test(adminJs), false);
assert.match(adminJs, /\/admin\/login\//);
assert.match(loginHtml, /\/api\/admin\/login/);
assert.match(loginHtml, /noindex, nofollow/);

assert.equal(isPublicAdminLoginPage("/admin/login"), true);
assert.equal(isPublicAdminLoginPage("/admin/login/"), true);
assert.equal(isPublicAdminLoginPage("/admin/analytics/"), false);
assert.equal(isPublicAdminLoginPost("/api/admin/login"), true);
assert.equal(isPublicAdminLogoutPost("/api/admin/logout"), true);
assert.equal(isPublicAdminLoginPost("/api/admin/analytics"), false);
assert.equal(isAdminUiPath("/admin/analytics"), true);
assert.equal(isAdminUiPath("/admin/analytics/"), true);
assert.equal(isAdminApiPath("/api/admin/analytics"), true);
assert.equal(isAdminApiPath("/api/events"), false);
assert.equal(isAdminUiPath("/api/events"), false);

const cookieHeader = sessionSetCookieHeader("v1.1.aa.bb");
assert.match(cookieHeader, new RegExp("^" + COOKIE_NAME + "="));
assert.match(cookieHeader, /HttpOnly/);
assert.match(cookieHeader, /Secure/);
assert.match(cookieHeader, /SameSite=Strict/);
assert.match(cookieHeader, /Path=\//);
assert.match(cookieHeader, new RegExp("Max-Age=" + SESSION_MAX_AGE_SECONDS));
assert.equal(/Domain=/i.test(cookieHeader), false);

const clearHeader = sessionClearCookieHeader();
assert.match(clearHeader, /Max-Age=0/);
assert.match(clearHeader, /HttpOnly/);
assert.match(clearHeader, /Secure/);
assert.match(clearHeader, /SameSite=Strict/);
assert.match(clearHeader, /Path=\//);
assert.equal(/Domain=/i.test(clearHeader), false);

assert.equal(hexToBytes("zz"), null);
assert.equal(hexToBytes("abc"), null);
assert.deepEqual(Array.from(hexToBytes("00ff")), [0, 255]);

function originRequest(path, init) {
  var headers = Object.assign(
    { Host: "curiousminds.fairermind.com" },
    init && init.headers ? init.headers : {}
  );
  return new Request(ORIGIN + path, Object.assign({}, init, { headers: headers }));
}

assert.equal(
  sameOriginPost(
    originRequest("/api/admin/login", {
      method: "POST",
      headers: { Origin: ORIGIN, Host: "curiousminds.fairermind.com" }
    })
  ),
  true
);
assert.equal(
  sameOriginPost(
    originRequest("/api/admin/login", {
      method: "POST",
      headers: { Host: "curiousminds.fairermind.com" }
    })
  ),
  false
);
assert.equal(
  sameOriginPost(
    originRequest("/api/admin/login", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Host: "curiousminds.fairermind.com"
      }
    })
  ),
  false
);

const oversizeBody = "passphrase=" + "x".repeat(LOGIN_BODY_LIMIT);
const oversize = await readLimitedFormBody(
  originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: oversizeBody
  }),
  LOGIN_BODY_LIMIT
);
assert.equal(oversize.ok, false);
assert.equal(oversize.reason, "payload_too_large");

const jsonBody = await readLimitedFormBody(
  originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ passphrase: "x" })
  }),
  LOGIN_BODY_LIMIT
);
assert.equal(jsonBody.ok, false);
assert.equal(jsonBody.reason, "unsupported_media_type");

assert.equal((await comparePassphrase({}, "x")).ok, false);
assert.equal((await comparePassphrase({}, "x")).reason, "auth_not_configured");
assert.equal(
  (await comparePassphrase({ CM_ADMIN_PASSPHRASE: "x", CM_ADMIN_SESSION_SECRET: "short" }, "x"))
    .reason,
  "auth_not_configured"
);
assert.equal((await comparePassphrase(ENV, ENV.CM_ADMIN_PASSPHRASE)).ok, true);
assert.equal((await comparePassphrase(ENV, "wrong-passphrase")).ok, false);
assert.equal((await comparePassphrase(ENV, "wrong-passphrase")).status, 401);

const missingSecrets = await verifyAdminSession({}, originRequest("/admin/analytics/"));
assert.equal(missingSecrets.ok, false);
assert.equal(missingSecrets.status, 503);

const created = await createSessionValue(ENV);
assert.equal(created.ok, true);
const parsed = parseSessionValue(created.value);
assert.equal(parsed.ok, true);

const validRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + created.value
  }
});
assert.equal((await verifyAdminSession(ENV, validRequest)).ok, true);

const accessFlagIgnored = await verifyAdminSession(
  Object.assign({ CM_ADMIN_ACCESS_REQUIRED: "true" }, ENV),
  originRequest("/api/admin/analytics")
);
assert.equal(accessFlagIgnored.ok, false);
assert.equal(accessFlagIgnored.status, 401);

const expired = await createSessionValue(ENV, {
  nowMs: Date.now() - 9 * 60 * 60 * 1000
});
assert.equal(expired.ok, true);
const expiredRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + expired.value
  }
});
assert.equal((await verifyAdminSession(ENV, expiredRequest)).ok, false);

const parts = created.value.split(".");
parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === "a" ? "b" : "a");
const tamperedRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + parts.join(".")
  }
});
assert.equal((await verifyAdminSession(ENV, tamperedRequest)).ok, false);

const truncated = created.value.slice(0, -2);
assert.equal(parseSessionValue(truncated).ok, false);
const truncatedRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + truncated
  }
});
assert.equal((await verifyAdminSession(ENV, truncatedRequest)).ok, false);

const malformedMac = parsed.payload + ".zzzz";
assert.equal(parseSessionValue(malformedMac).ok, false);
const malformedRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + malformedMac
  }
});
assert.equal((await verifyAdminSession(ENV, malformedRequest)).ok, false);

const shortMac = parsed.payload + ".ab";
const shortMacRequest = originRequest("/api/admin/analytics", {
  headers: {
    Host: "curiousminds.fairermind.com",
    Cookie: COOKIE_NAME + "=" + shortMac
  }
});
const shortMacResult = await verifyAdminSession(ENV, shortMacRequest);
assert.equal(shortMacResult.ok, false);
assert.equal(shortMacResult.status, 401);

async function nextOk() {
  return new Response("next", { status: 200 });
}

const loginPage = await adminUiMiddleware({
  request: originRequest("/admin/login/"),
  env: {},
  next: nextOk
});
assert.equal(loginPage.status, 200);
assert.equal(await loginPage.text(), "next");

const blockedHtml = await adminUiMiddleware({
  request: originRequest("/admin/analytics/"),
  env: ENV,
  next: nextOk
});
assert.equal(blockedHtml.status, 302);
assert.equal(blockedHtml.headers.get("Location"), ORIGIN + "/admin/login/");

const missingSecretHtml = await adminUiMiddleware({
  request: originRequest("/admin/analytics/"),
  env: {},
  next: nextOk
});
assert.equal(missingSecretHtml.status, 503);

const allowedApiLogin = await adminApiMiddleware({
  request: originRequest("/api/admin/login", { method: "POST" }),
  env: {},
  next: nextOk
});
assert.equal(allowedApiLogin.status, 200);

const blockedApi = await adminApiMiddleware({
  request: originRequest("/api/admin/analytics"),
  env: ENV,
  next: nextOk
});
assert.equal(blockedApi.status, 401);
const blockedApiBody = await blockedApi.json();
assert.equal(blockedApiBody.ok, false);
assert.equal(blockedApiBody.reason, "auth_required");

const authedApi = await adminApiMiddleware({
  request: validRequest,
  env: ENV,
  next: nextOk
});
assert.equal(authedApi.status, 200);

const loginDeniedOrigin = await loginPost({
  request: originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "passphrase=" + encodeURIComponent(ENV.CM_ADMIN_PASSPHRASE)
  }),
  env: ENV
});
assert.equal(loginDeniedOrigin.status, 403);

const loginWrong = await loginPost({
  request: originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "passphrase=wrong"
  }),
  env: ENV
});
assert.equal(loginWrong.status, 401);
assert.match(await loginWrong.text(), /Sign-in failed/);

const loginOk = await loginPost({
  request: originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "passphrase=" + encodeURIComponent(ENV.CM_ADMIN_PASSPHRASE)
  }),
  env: ENV
});
assert.equal(loginOk.status, 303);
assert.equal(loginOk.headers.get("Location"), ORIGIN + "/admin/analytics/");
const setCookie = loginOk.headers.get("Set-Cookie");
assert.match(setCookie, new RegExp("^" + COOKIE_NAME + "="));
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Strict/);
assert.match(setCookie, /Path=\//);
assert.match(setCookie, new RegExp("Max-Age=" + SESSION_MAX_AGE_SECONDS));
assert.equal(/Domain=/i.test(setCookie), false);

const loginTooBig = await loginPost({
  request: originRequest("/api/admin/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "passphrase=" + "x".repeat(LOGIN_BODY_LIMIT)
  }),
  env: ENV
});
assert.equal(loginTooBig.status, 413);

const logoutDenied = await logoutPost({
  request: originRequest("/api/admin/logout", { method: "POST" }),
  env: ENV
});
assert.equal(logoutDenied.status, 403);

const logoutOk = await logoutPost({
  request: originRequest("/api/admin/logout", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Host: "curiousminds.fairermind.com"
    }
  }),
  env: ENV
});
assert.equal(logoutOk.status, 303);
assert.equal(logoutOk.headers.get("Location"), ORIGIN + "/admin/login/");
assert.match(logoutOk.headers.get("Set-Cookie"), /Max-Age=0/);

assert.equal(fs.existsSync(path.join(root, "functions/_middleware.js")), false);
assert.equal(fs.existsSync(path.join(root, "functions/api/_middleware.js")), false);
assert.equal(fs.existsSync(path.join(root, "admin/login/index.html")), true);
assert.equal(fs.existsSync(path.join(root, "functions/admin/_middleware.js")), true);
assert.equal(fs.existsSync(path.join(root, "functions/api/admin/_middleware.js")), true);

console.log("cm-admin-auth tests passed");
