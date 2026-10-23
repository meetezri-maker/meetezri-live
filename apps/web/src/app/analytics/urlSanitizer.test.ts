import { describe, expect, it } from "vitest";
import {
  getSafePageTitle,
  isAnalyticsRouteAllowed,
  sanitizeAnalyticsPath,
} from "./urlSanitizer";

describe("sanitizeAnalyticsPath", () => {
  it("returns only approved static marketing and auth paths", () => {
    expect(sanitizeAnalyticsPath({ pathname: "/" })).toBe("/");
    expect(sanitizeAnalyticsPath({ pathname: "/home" })).toBe("/home");
    expect(sanitizeAnalyticsPath({ pathname: "/how-it-works" })).toBe("/how-it-works");
    expect(sanitizeAnalyticsPath({ pathname: "/early-access" })).toBe("/early-access");
    expect(sanitizeAnalyticsPath({ pathname: "/talk-it-out" })).toBe("/talk-it-out");
    expect(sanitizeAnalyticsPath({ pathname: "/about" })).toBe("/about");
    expect(sanitizeAnalyticsPath({ pathname: "/safety" })).toBe("/safety");
    expect(sanitizeAnalyticsPath({ pathname: "/resources" })).toBe("/resources");
    expect(sanitizeAnalyticsPath({ pathname: "/resources/managing-difficult-days" })).toBe(
      "/resources/managing-difficult-days",
    );

    expect(sanitizeAnalyticsPath({ pathname: "/pricing" })).toBe("/pricing");
    expect(sanitizeAnalyticsPath({ pathname: "/login" })).toBe("/login");
    expect(sanitizeAnalyticsPath({ pathname: "/signup" })).toBe("/signup");
    expect(sanitizeAnalyticsPath({ pathname: "/verify-email" })).toBe("/verify-email");
  });

  it("drops query strings and hashes, including sensitive token-bearing parts", () => {
    expect(sanitizeAnalyticsPath({ pathname: "/pricing", search: "?session_id=secret" })).toBe("/pricing");
    expect(sanitizeAnalyticsPath({ pathname: "/signup", hash: "#refresh_token=secret" })).toBe("/signup");
    expect(sanitizeAnalyticsPath({ pathname: "/", hash: "#access_token=secret" })).toBe("/");
    expect(sanitizeAnalyticsPath({ pathname: "/login", search: "?error_description=secret" })).toBe("/login");
    expect(
      sanitizeAnalyticsPath({
        pathname: "/resources/managing-difficult-days",
        search: "?email=person@example.com&user_id=private",
        hash: "#conversation_id=private",
      }),
    ).toBe("/resources/managing-difficult-days");
  });

  it("normalizes harmless path formatting without preserving raw href data", () => {
    expect(sanitizeAnalyticsPath({ pathname: "pricing", search: "?utm_source=paid" })).toBe("/pricing");
    expect(sanitizeAnalyticsPath({ pathname: "/pricing/", search: "?utm_source=paid" })).toBe("/pricing");
    expect(sanitizeAnalyticsPath({ pathname: "/pricing", search: "?foo=one" })).toBe(
      sanitizeAnalyticsPath({ pathname: "/pricing", search: "?foo=two" }),
    );
  });

  it("excludes wellness, admin, crisis, callback, and unknown routes", () => {
    expect(sanitizeAnalyticsPath({ pathname: "/app/active-session", search: "?sessionId=secret" })).toBeNull();
    expect(sanitizeAnalyticsPath({ pathname: "/auth/callback", search: "?code=secret" })).toBeNull();
    expect(sanitizeAnalyticsPath({ pathname: "/admin/user-details-enhanced/abc" })).toBeNull();
    expect(sanitizeAnalyticsPath({ pathname: "/admin/crisis-event-details", search: "?id=abc" })).toBeNull();
    expect(sanitizeAnalyticsPath({ pathname: "/app/journal", search: "?query=private" })).toBeNull();
    expect(isAnalyticsRouteAllowed({ pathname: "/forgot-password" })).toBe(false);
    expect(sanitizeAnalyticsPath({ pathname: "/resources/person@example.com" })).toBeNull();
    expect(sanitizeAnalyticsPath({ pathname: "/resources/access-token-secret" })).toBeNull();
    expect(
      sanitizeAnalyticsPath({
        pathname: "/resources/123e4567-e89b-12d3-a456-426614174000",
      }),
    ).toBeNull();
  });

  it("returns safe non-identifying titles for approved page views", () => {
    expect(getSafePageTitle("/pricing")).toBe("Pricing");
    expect(getSafePageTitle("/app/active-session")).toBeUndefined();
    expect(getSafePageTitle("/resources/managing-difficult-days")).toBe("Resource");
  });
});
