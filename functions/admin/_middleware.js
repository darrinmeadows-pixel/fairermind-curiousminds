/**
 * Gate static /admin/* pages. Login HTML is public GET/HEAD only.
 * Fail closed. Do not fall through to static assets on exception.
 */

import {
  adminHtmlPage,
  adminUiAuthResponse,
  isPublicAdminLoginPage,
  requestPathname,
  verifyAdminSession
} from "../lib/cm-admin-auth.js";

export async function onRequest(context) {
  try {
    var request = context.request;
    var pathname = requestPathname(request);
    var method = request.method;
    if ((method === "GET" || method === "HEAD") && isPublicAdminLoginPage(pathname)) {
      return context.next();
    }
    var verified = await verifyAdminSession(context.env || {}, request);
    if (!verified.ok) {
      return adminUiAuthResponse(verified, request);
    }
    return context.next();
  } catch (err) {
    return adminHtmlPage(
      503,
      "Temporarily unavailable",
      "This private report is not available right now."
    );
  }
}
