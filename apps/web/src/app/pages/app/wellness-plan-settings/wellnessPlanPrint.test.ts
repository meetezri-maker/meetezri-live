import { describe, it, expect } from "vitest";
import { buildWellnessPlanPrintSnapshot, wellnessPlanPrintStatus, type WellnessPlanPrintInput } from "./wellnessPlanPrint";
import { addWellnessPlanSectionItem, createEmptyWellnessPlanSections, wellnessPlanSectionsToUpsertBody } from "./wellnessPlanModel";

const input = (over: Partial<WellnessPlanPrintInput> = {}): WellnessPlanPrintInput => ({
  userId: "user-a",
  planOwnerId: "user-a",
  planId: "plan-1",
  confirmed: { userId: "user-a", body: wellnessPlanSectionsToUpsertBody(createEmptyWellnessPlanSections()) },
  loadState: "ready",
  saveStatus: "idle",
  isDirty: false,
  sections: createEmptyWellnessPlanSections(),
  recoveryPercent: 0,
  contacts: [],
  contactsLoading: false,
  resources: [],
  now: new Date("2026-10-28T10:00:00.000Z"),
  ...over,
});

describe("wellness plan print status", () => {
  it("is 'saved' only when the printed content equals confirmed saved content for the same account", () => {
    const edited = addWellnessPlanSectionItem(createEmptyWellnessPlanSections(), "warning-signs", "B");
    // The editor says clean, but the content differs from what the server confirmed.
    expect(wellnessPlanPrintStatus(input({ sections: edited }))).toBe("unconfirmed");
    expect(wellnessPlanPrintStatus(input({ confirmed: null }))).toBe("unconfirmed");
    expect(wellnessPlanPrintStatus(input({ confirmed: { ...input().confirmed!, userId: "user-b" } }))).toBe("unconfirmed");
    expect(
      wellnessPlanPrintStatus(input({ sections: edited, confirmed: { userId: "user-a", body: wellnessPlanSectionsToUpsertBody(edited) } }))
    ).toBe("saved");
  });

  it("is 'saved' only when nothing is unsaved and the plan was confirmed for this account", () => {
    expect(wellnessPlanPrintStatus(input())).toBe("saved");
    expect(wellnessPlanPrintStatus(input({ isDirty: true }))).toBe("unsaved");
    expect(wellnessPlanPrintStatus(input({ saveStatus: "saving" }))).toBe("saving");
    expect(wellnessPlanPrintStatus(input({ saveStatus: "saving", isDirty: true }))).toBe("saving");
    // Finished loading is not enough: the loaded plan must belong to this account.
    expect(wellnessPlanPrintStatus(input({ planOwnerId: null }))).toBe("unconfirmed");
    expect(wellnessPlanPrintStatus(input({ planOwnerId: "user-b" }))).toBe("unconfirmed");
    expect(wellnessPlanPrintStatus(input({ loadState: "error" }))).toBe("unconfirmed");
    // Loaded, but the account has never saved a plan.
    expect(wellnessPlanPrintStatus(input({ planId: null }))).toBe("not-saved");
    expect(wellnessPlanPrintStatus(input({ planId: null, isDirty: true }))).toBe("unsaved");
  });
});

describe("wellness plan print snapshot", () => {
  it("copies the displayed sections, contacts for this account only, and the resources shown", () => {
    const sections = createEmptyWellnessPlanSections().map((s, i) =>
      i === 0 ? { ...s, items: [{ id: "1", text: "آج بہت سکون ہے۔ Calm (3)" }] } : s
    );
    const snap = buildWellnessPlanPrintSnapshot(
      input({
        sections,
        recoveryPercent: 17,
        contacts: [
          { id: "c1", name: "Sam", phone: "+92 300 0000000", user_id: "user-a" },
          { id: "c2", name: "Other account", phone: "1", user_id: "user-b" },
          { id: "c3", name: "No owner", phone: "2" },
        ],
        resources: [{ name: "Crisis line", phone: "1234" }, { name: "No phone", phone: null }, undefined],
      })
    )!;
    expect(snap.plan?.sections).toHaveLength(6);
    expect(snap.plan?.sections[0].items[0].text).toBe("آج بہت سکون ہے۔ Calm (3)");
    expect(snap.plan?.recoveryPercent).toBe(17);
    expect(snap.contacts).toEqual([{ id: "c1", name: "Sam", phone: "+92 300 0000000" }]);
    expect(snap.resources).toEqual([{ name: "Crisis line", phone: "1234" }]);
    expect(snap.printedAt.text).toMatch(/^\d{1,2} \w{3} 2026, \d{2}:\d{2}$/);
  });

  it("is a copy: later edits don't change it", () => {
    const sections = createEmptyWellnessPlanSections();
    const snap = buildWellnessPlanPrintSnapshot(input({ sections }))!;
    sections[0].items.push({ id: "x", text: "later" });
    expect(snap.plan?.sections[0].items).toEqual([]);
  });

  it("leaves the plan out until it has loaded for this account, and contacts out while loading", () => {
    expect(buildWellnessPlanPrintSnapshot(input({ loadState: "loading" }))?.plan).toBeNull();
    expect(buildWellnessPlanPrintSnapshot(input({ planOwnerId: "user-b" }))?.plan).toBeNull();
    expect(buildWellnessPlanPrintSnapshot(input({ contactsLoading: true }))?.contacts).toBeNull();
    expect(buildWellnessPlanPrintSnapshot(input({ userId: null }))).toBeNull();
  });
});
