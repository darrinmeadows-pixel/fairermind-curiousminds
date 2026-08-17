/**
 * POST /api/admin/login
 * Same-origin form post. Sets a signed __Host- session cookie.
 */

import {
  LOGIN_BODY_LIMIT,
  adminHtmlPage,
  adminJson,
  adminRedirect,
  comparePassphrase,
  createAdminSessionCookie,
  readLimitedFormBody,
  sameOriginPost
} from "../../lib/cm-admin-auth.js";

export async function onRequestPost(context) {
  var request = context.request;
  if (!sameOriginPost(request)) {
    return adminHtmlPage(403, "Sign-in failed", "This sign-in request was rejected.");
  }

  var body = await readLimitedFormBody(request, LOGIN_BODY_LIMIT);
  if (!body.ok) {
    if (body.reason === "payload_too_large") {
      return adminHtmlPage(413, "Sign-in failed", "This sign-in request was too large.");
    }
    if (body.reason === "unsupported_media_type") {
      return adminHtmlPage(415, "Sign-in failed", "This sign-in request was rejected.");
    }
    return adminHtmlPage(400, "Sign-in failed", "This sign-in request was rejected.");
  }

  var supplied = body.params.get("passphrase");
  var compared = await comparePassphrase(context.env || {}, supplied);
  if (compared.reason === "auth_not_configured" || compared.reason === "auth_unavailable") {
    return adminHtmlPage(
      compared.status || 503,
      "Temporarily unavailable",
      "This private report is not available right now."
    );
  }
  if (!compared.ok) {
    return adminHtmlPage(401, "Sign-in failed", "Sign-in failed.");
  }

  var session = await createAdminSessionCookie(context.env || {});
  if (!session.ok) {
    return adminHtmlPage(
      session.status || 503,
      "Temporarily unavailable",
      "This private report is not available right now."
    );
  }

  var location;
  try {
    location = new URL("/admin/analytics/", request.url).toString();
  } catch (err) {
    location = "/admin/analytics/";
  }
  return adminRedirect(303, location, { "Set-Cookie": session.header });
}

export async function onRequest(context) {
  var method = context.request.method;
  if (method === "POST") return onRequestPost(context);
  return adminJson(405, { ok: false, reason: "method_not_allowed" });
}
