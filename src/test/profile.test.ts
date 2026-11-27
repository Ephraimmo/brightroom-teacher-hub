import { describe, expect, it } from "vitest";

import {
  avatarFileProblem,
  formatSaMobile,
  normalizeSaMobile,
  profileErrorFor,
  validateProfile,
  type ProfileForm,
} from "@/domain/profile";

const valid: ProfileForm = {
  fullName: "Amy Learner",
  displayName: "Amy",
  phone: "082 123 4567",
  language: "zu",
  contactEmail: true,
  contactSms: true,
  contactWhatsapp: true,
};

describe("South African mobile numbers", () => {
  it.each([
    "082 123 4567",
    "0821234567",
    "+27 82 123 4567",
    "27821234567",
    "(082) 123-4567",
    "+27821234567",
  ])("accepts %s", (input) => {
    expect(normalizeSaMobile(input)).toBe("+27821234567");
  });

  it.each(["011 123 4567", "082 123 456", "+44 7911 123456", "phone", ""])(
    "rejects %s",
    (input) => {
      expect(normalizeSaMobile(input)).toBeNull();
    },
  );

  it("formats numbers the local way", () => {
    expect(formatSaMobile("+27821234567")).toBe("082 123 4567");
    expect(formatSaMobile(null)).toBe("");
  });
});

describe("validateProfile", () => {
  it("accepts a complete profile", () => {
    expect(validateProfile(valid)).toEqual({});
  });

  it("explains each problem next to its field", () => {
    expect(
      validateProfile({
        ...valid,
        fullName: " ",
        displayName: "x".repeat(61),
        phone: "011 123 4567",
        language: "fr" as ProfileForm["language"],
      }),
    ).toEqual({
      fullName: expect.any(String),
      displayName: expect.any(String),
      phone: expect.any(String),
      language: expect.any(String),
    });
  });

  it("needs a mobile number for SMS or WhatsApp, but not for email", () => {
    expect(validateProfile({ ...valid, phone: "" }).contact).toMatch(/mobile number/);
    expect(
      validateProfile({ ...valid, phone: "", contactSms: false, contactWhatsapp: false }),
    ).toEqual({});
  });
});

describe("profile photos", () => {
  it("accepts small JPG, PNG and WebP pictures only", () => {
    expect(avatarFileProblem({ type: "image/webp", size: 500_000 })).toBeNull();
    expect(avatarFileProblem({ type: "image/gif", size: 500_000 })).toMatch(/JPG, PNG or WebP/);
    expect(avatarFileProblem({ type: "image/png", size: 3_000_000 })).toMatch(/2 MB/);
  });
});

describe("database errors", () => {
  it("land on the right field", () => {
    expect(profileErrorFor({ code: "LBR12" })?.field).toBe("phone");
    expect(profileErrorFor({ code: "LBR14" })?.field).toBe("contact");
    expect(profileErrorFor({ code: "42501" })).toBeNull();
  });
});
