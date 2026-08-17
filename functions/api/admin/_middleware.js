/**
 * Gate /api/admin/*. Login and logout POST are public entry points.
 * Fail closed. Do not fall through to static assets on exception.
 */

import {
  adminApiAuthResponse,
  adminJson,
  isPublicAdminLoginPost,
  isPublicAdminLogoutPost,
  requestPathname,
  verifyAdminSession
} from "../../lib/cm-admin-auth.js";

export async function onRequest(context) {
  try {
    var request = context.request;
    var pathname = requestPathname(request);
    var method = request.method;
    if (method === "POST" && (isPublicAdminLoginPost(pathname) || isPublicAdminLogoutPost(pathname))) {
      return context.next();
    }
    var verified = await verifyAdminSession(context.env || {}, request);
    if (!verified.ok) {
      return adminApiAuthResponse(verified);
    }
    return context.next();
  } catch (err) {
    return adminJson(503, { ok: false, reason: "auth_unavailable" });
  }
}
