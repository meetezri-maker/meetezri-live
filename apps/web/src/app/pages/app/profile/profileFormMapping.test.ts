import { describe, it, expect } from "vitest";
import {
  buildProfileFormDefaults,
  buildProfilePatch,
  computeProfileCompletion,
  createProfileEditSchema,
  joinFullName,
  splitFullName,
} from "./profileFormMapping";

const baseProfile = {
  full_name: "Ada Lovelace",
  email: "profile-column@example.com",
  age: "1990-04-02",
  pronouns: "she/her",
  timezone: "Europe/London",
  phone: "+15551234567",
  in_therapy: "Yes",
  selected_goals: ["sleep"],
  selected_triggers: ["crowds"],
  emergency_contact_name: "Jamie Morgan",
  emergency_contact_relationship: "Sister",
  emergency_contact_phone: "+15559876543",
  emergency_consent: true,
};

describe("name splitting", () => {
  it("splits and rejoins a two-part name", () => {
    expect(splitFullName("Ada Lovelace")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    expect(joinFullName("Ada", "Lovelace")).toBe("Ada Lovelace");
  });

  it("keeps every trailing part in the last name", () => {
    expect(splitFullName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });

  it("handles a single-word and an empty name", () => {
    expect(splitFullName("Prince")).toEqual({ firstName: "Prince", lastName: "" });
    expect(splitFullName(null)).toEqual({ firstName: "", lastName: "" });
    expect(joinFullName("Prince", "")).toBe("Prince");
  });
});

describe("buildProfileFormDefaults", () => {
  it("passes an ISO date of birth through untouched", () => {
    expect(buildProfileFormDefaults(baseProfile).birthday).toBe("1990-04-02");
  });

  it("maps a stored numeric age to display years", () => {
    expect(buildProfileFormDefaults({ ...baseProfile, age: "34" }).birthday).toBe("34");
  });

  it("prefers the authenticated email over the profile column", () => {
    expect(buildProfileFormDefaults(baseProfile, "auth@example.com").emailDisplay).toBe(
      "auth@example.com"
    );
    expect(buildProfileFormDefaults(baseProfile).emailDisplay).toBe(
      "profile-column@example.com"
    );
  });

  it("falls back to the browser timezone when none is stored", () => {
    const defaults = buildProfileFormDefaults({ ...baseProfile, timezone: null });
    expect(defaults.timezone).toBeTruthy();
  });

  it("normalises CSV goals into an array", () => {
    const defaults = buildProfileFormDefaults({
      ...baseProfile,
      selected_goals: "sleep, focus",
    });
    expect(defaults.selected_goals).toEqual(["sleep", "focus"]);
  });

  it("defaults therapist status to Not specified", () => {
    expect(buildProfileFormDefaults({ ...baseProfile, in_therapy: null }).in_therapy).toBe(
      "Not specified"
    );
  });

  it("treats stored contact data as prior consent", () => {
    const defaults = buildProfileFormDefaults({ ...baseProfile, emergency_consent: false });
    expect(defaults.emergency_consent).toBe(true);
  });
});

describe("buildProfilePatch", () => {
  const defaults = buildProfileFormDefaults(baseProfile, "auth@example.com");

  it("returns nothing when no field is dirty", () => {
    expect(buildProfilePatch(defaults, defaults, {})).toEqual({});
  });

  it("never emits email, even when the form object carries one", () => {
    const patch = buildProfilePatch(
      { ...defaults, firstName: "Grace", email: "attacker@example.com" } as any,
      defaults,
      { firstName: true, email: true } as any
    );
    expect(patch).not.toHaveProperty("email");
    expect(patch.full_name).toBe("Grace Lovelace");
  });

  it("composes full_name from first and last name", () => {
    const patch = buildProfilePatch(
      { ...defaults, lastName: "Byron" },
      defaults,
      { lastName: true }
    );
    expect(patch.full_name).toBe("Ada Byron");
  });

  it("omits full_name when the composed value is unchanged", () => {
    const patch = buildProfilePatch(defaults, defaults, { firstName: true, lastName: true });
    expect(patch).not.toHaveProperty("full_name");
  });

  it("sends the whole emergency group plus consent when any contact field changes", () => {
    const patch = buildProfilePatch(
      { ...defaults, emergency_contact_relationship: "Sibling" },
      defaults,
      { emergency_contact_relationship: true }
    );
    expect(patch).toMatchObject({
      emergency_contact_name: "Jamie Morgan",
      emergency_contact_relationship: "Sibling",
      emergency_contact_phone: "+15559876543",
      emergency_consent: true,
    });
  });

  it("sends consent alone when only consent changed", () => {
    const patch = buildProfilePatch(
      { ...defaults, emergency_consent: true },
      defaults,
      { emergency_consent: true }
    );
    expect(patch).toEqual({ emergency_consent: true });
  });

  it("detects a pronoun change by value rather than dirty flag", () => {
    const patch = buildProfilePatch({ ...defaults, pronouns: "they/them" }, defaults, {});
    expect(patch.pronouns).toBe("they/them");
  });

  it("maps birthday to age and timezone to timezone", () => {
    const patch = buildProfilePatch(
      { ...defaults, birthday: "1991-05-06", timezone: "UTC" },
      defaults,
      { birthday: true, timezone: true }
    );
    expect(patch).toMatchObject({ age: "1991-05-06", timezone: "UTC" });
  });
});

describe("createProfileEditSchema", () => {
  const validValues = {
    firstName: "Ada",
    lastName: "Lovelace",
    birthday: "1990-04-02",
    pronouns: "she/her",
    timezone: "Europe/London",
    phone: "",
    in_therapy: "Yes",
    selected_goals: [],
    selected_triggers: [],
    emergency_contact_name: "Jamie Morgan",
    emergency_contact_relationship: "Sister",
    emergency_contact_phone: "+15559876543",
    emergency_consent: true,
  };

  it("accepts a complete profile", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: true }).safeParse(
      validValues
    );
    expect(result.success).toBe(true);
  });

  it("requires a name of at least two characters", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: true }).safeParse({
      ...validValues,
      firstName: "A",
      lastName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a partial emergency contact, matching the backend rule", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: false }).safeParse({
      ...validValues,
      emergency_contact_relationship: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((i) => i.path[0] === "emergency_contact_relationship")
    ).toBe(true);
  });

  it("requires consent whenever contact data is present", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: true }).safeParse({
      ...validValues,
      emergency_consent: false,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path[0] === "emergency_consent")).toBe(true);
  });

  it("rejects clearing a stored contact, which the profile endpoint refuses", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: true }).safeParse({
      ...validValues,
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      emergency_consent: false,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toMatch(/Settings → Emergency Contacts/);
  });

  it("allows an entirely empty contact when none is stored", () => {
    const result = createProfileEditSchema({ hasStoredEmergencyContact: false }).safeParse({
      ...validValues,
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      emergency_consent: false,
    });
    expect(result.success).toBe(true);
  });

  it("enforces the 18+ rule on date of birth", () => {
    const thisYear = new Date().getFullYear();
    const result = createProfileEditSchema({ hasStoredEmergencyContact: true }).safeParse({
      ...validValues,
      birthday: `${thisYear - 10}-01-01`,
    });
    expect(result.success).toBe(false);
  });
});

describe("computeProfileCompletion", () => {
  it("reports 100% for a fully populated profile", () => {
    const defaults = buildProfileFormDefaults(baseProfile, "auth@example.com");
    const completion = computeProfileCompletion(defaults);
    expect(completion.percent).toBe(100);
    expect(completion.isComplete).toBe(true);
    expect(completion.missingFields).toHaveLength(0);
  });

  it("treats 'Not specified' therapist status as unfilled", () => {
    const defaults = buildProfileFormDefaults({ ...baseProfile, in_therapy: null });
    const completion = computeProfileCompletion(defaults);
    expect(completion.isComplete).toBe(false);
    expect(completion.missingFields.map((f) => f.key)).toContain("in_therapy");
  });

  it("lists each missing field for an empty profile", () => {
    const completion = computeProfileCompletion(buildProfileFormDefaults({}));
    expect(completion.percent).toBeLessThan(100);
    expect(completion.missingFields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["name", "phone", "birthday", "emergency_contact_name"])
    );
  });
});
