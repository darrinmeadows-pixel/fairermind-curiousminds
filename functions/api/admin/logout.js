/**
 * POST /api/admin/logout
 * Clears the __Host- session cookie. Allowed even if the cookie is invalid.
 */

import {
  adminHtmlPage,
  adminJson,
  adminRedirect,
  sameOriginPost,
  sessionClearCookieHeader
} from "../../lib/cm-admin-auth.js";

export async function onRequestPost(context) {
  var request = context.request;
  if (!sameOriginPost(request)) {
    return adminHtmlPage(403, "Sign-out failed", "This sign-out request was rejected.");
  }
  var location;
  try {
    location = new URL("/admin/login/", request.url).toString();
  } catch (err) {
    location = "/admin/login/";
  }
  return adminRedirect(303, location, { "Set-Cookie": sessionClearCookieHeader() });
}

export async function onRequest(context) {
  var method = context.request.method;
  if (method === "POST") return onRequestPost(context);
  return adminJson(405, { ok: false, reason: "method_not_allowed" });
}
