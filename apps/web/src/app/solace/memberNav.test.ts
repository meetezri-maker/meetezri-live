import { describe, expect, it } from "vitest";
import { MEMBER_NAV_ITEMS, findActiveNavPath } from "./memberNav";

describe("findActiveNavPath", () => {
  it("matches an item on an exact path", () => {
    expect(findActiveNavPath("/app/settings")).toBe("/app/settings");
    expect(findActiveNavPath("/app/progress")).toBe("/app/progress");
    expect(findActiveNavPath("/app/session-history")).toBe("/app/session-history");
    expect(findActiveNavPath("/app/billing")).toBe("/app/billing");
    expect(findActiveNavPath("/app/user-profile")).toBe("/app/user-profile");
    expect(findActiveNavPath("/app/community")).toBe("/app/community");
    expect(findActiveNavPath("/app/dashboard")).toBe("/app/dashboard");
  });

  it("prefers the longest match when nested items overlap", () => {
    expect(findActiveNavPath("/app/settings/achievements")).toBe("/app/settings/achievements");
    expect(findActiveNavPath("/app/settings/help-support")).toBe("/app/settings/help-support");
  });

  it("matches nested routes against their parent item", () => {
    expect(findActiveNavPath("/app/settings/appearance")).toBe("/app/settings");
    expect(findActiveNavPath("/app/journal/42")).toBe("/app/journal");
  });

  it("does not activate Home for routes nested under the dashboard", () => {
    expect(findActiveNavPath("/app/dashboard/example")).toBeNull();
  });

  it("returns null for an unknown member route", () => {
    expect(findActiveNavPath("/app/not-a-real-page")).toBeNull();
  });

  it("does not treat a path prefix as a match without a segment boundary", () => {
    expect(findActiveNavPath("/app/billing-history")).toBeNull();
  });

  it("accepts an explicit item list", () => {
    const items = MEMBER_NAV_ITEMS.filter((item) => item.path === "/app/journal");
    expect(findActiveNavPath("/app/settings", items)).toBeNull();
    expect(findActiveNavPath("/app/journal", items)).toBe("/app/journal");
  });
});
