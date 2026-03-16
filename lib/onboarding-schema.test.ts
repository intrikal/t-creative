import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  assistantOnboardingSchema,
  adminOnboardingSchema,
  STEPS,
  ASSISTANT_STEPS,
} from "./onboarding-schema";

// ---------------------------------------------------------------------------
// Fixtures — minimal valid inputs for each schema
// ---------------------------------------------------------------------------

const validClientData = {
  firstName: "Alice",
  lastName: "Smith",
  interests: ["lash"] as const,
  allergies: {
    adhesive: false,
    latex: false,
    nickel: false,
    fragrances: false,
    none: true,
    notes: "",
  },
  email: "alice@example.com",
  phone: "",
  availability: {
    weekdays: true,
    weekends: false,
    mornings: false,
    afternoons: true,
    evenings: false,
  },
  source: "instagram" as const,
  notifications: { sms: false, email: true, marketing: false },
  referral: { referrerCode: "", skipped: true },
  waiverAgreed: true,
  cancellationAgreed: true,
  photoConsent: "yes" as const,
  birthday: "",
};

const validAssistantData = {
  firstName: "Bea",
  preferredTitle: "",
  skills: ["lash"] as const,
  experienceLevel: "mid" as const,
  bio: "",
  availableDefaultStart: "09:00",
  availableDefaultEnd: "17:00",
  availableDates: "[]",
  availableDateOverrides: "{}",
  availableLunchBreak: false,
  availableLunchStart: "12:00",
  availableLunchDuration: "30",
  emergencyContactName: "Mom",
  emergencyContactPhone: "555-0100",
  emergencyContactRelation: "",
  certifications: [],
  workStyle: "client_facing" as const,
  email: "bea@example.com",
  phone: "",
  instagramHandle: "",
  notifications: { sms: false, email: true, marketing: false },
  offersTraining: false,
  trainingFormats: [],
  portfolioInstagram: "",
  tiktokHandle: "",
  portfolioWebsite: "",
  policyClientPhotos: true,
  policyConfidentiality: true,
  policyConduct: true,
  policyCompensation: true,
};

const serviceSlot = { enabled: true, price: "150", duration: "90", deposit: "50" };

const validAdminData = {
  firstName: "Trini",
  lastName: "Admin",
  email: "trini@tcreativestudio.com",
  phone: "555-0200",
  notifySms: false,
  notifyEmail: true,
  studioName: "T Creative",
  bio: "Studio owner",
  locationType: "home_studio" as const,
  locationArea: "ATL",
  bookingNotice: "24",
  socials: {
    instagram: "@tcreative",
    instagram2: "",
    instagram3: "",
    instagram4: "",
    tiktok: "",
    facebook: "",
    youtube: "",
    pinterest: "",
    linkedin: "",
    google: "",
    website: "",
  },
  services: {
    lash: serviceSlot,
    jewelry: serviceSlot,
    crochet: serviceSlot,
    consulting: serviceSlot,
  },
  waitlist: {
    lash: false,
    jewelry: false,
    crochet: false,
    consulting: "off" as const,
  },
  intake: {
    lash: {
      prep: "",
      adhesiveAllergy: true,
      contactLenses: true,
      previousLashes: false,
      desiredLook: true,
    },
    jewelry: { prep: "", metalAllergy: false, designPreference: true },
    crochet: { prep: "", hairType: true, desiredStyle: true, scalpSensitivity: false },
    consulting: { prep: "", serviceInterest: true, previousExperience: false, goal: true },
  },
  workingHours: {
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
    appointmentGap: "15",
    lunchBreak: true,
    lunchStart: "12:00",
    lunchDuration: "30",
    selectedDates: "[]",
    dayOverrides: "{}",
  },
  bookingConfirmation: "manual" as const,
  cancellationFee: "50",
  cancellationWindow: "24",
  noShowFee: "25",
  rewards: {
    enabled: false,
    pointsPerDollar: "1",
    pointsToRedeem: "100",
    firstBookingBonus: "50",
    birthdayBonus: "25",
    referralBonus: "100",
    refereeBonus: "50",
    reviewBonus: "25",
    rebookBonus: "10",
    milestoneBonus: "50",
    milestone10thBonus: "100",
    socialShareBonus: "15",
    productPurchaseBonus: "5",
    profileCompleteBonus: "20",
    anniversaryBonus: "30",
    newServiceBonus: "20",
    classAttendanceBonus: "25",
    packagePurchaseBonus: "30",
    programCompleteBonus: "50",
    certificationBonus: "100",
    tier1Name: "Bronze",
    tier1Threshold: "0",
    tier1Multiplier: "1",
    tier2Name: "Silver",
    tier2Threshold: "500",
    tier2Multiplier: "1.5",
    tier3Name: "Gold",
    tier3Threshold: "1000",
    tier3Multiplier: "2",
    tier4Name: "Platinum",
    tier4Threshold: "2500",
    tier4Multiplier: "3",
    pointsExpiry: "365",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("onboardingSchema (client)", () => {
  it("parses a fully valid client submission", () => {
    const result = onboardingSchema.safeParse(validClientData);
    expect(result.success).toBe(true);
  });

  it("fails when firstName is empty", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("fails when email is invalid", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("fails when an invalid interest is provided", () => {
    const result = onboardingSchema.safeParse({
      ...validClientData,
      interests: ["yoga"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty interests array", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, interests: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a valid birthday in MM/DD format", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, birthday: "06/15" });
    expect(result.success).toBe(true);
  });

  it("fails when birthday format is invalid", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, birthday: "June 15" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty string birthday (field is optional)", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, birthday: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid referral code matching the pattern", () => {
    const result = onboardingSchema.safeParse({
      ...validClientData,
      referral: { referrerCode: "SARAH-A1B2C3", skipped: false },
    });
    expect(result.success).toBe(true);
  });

  it("fails when the referral code does not match the pattern", () => {
    const result = onboardingSchema.safeParse({
      ...validClientData,
      referral: { referrerCode: "invalid-code", skipped: false },
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty referral code (skipped)", () => {
    const result = onboardingSchema.safeParse({
      ...validClientData,
      referral: { referrerCode: "", skipped: true },
    });
    expect(result.success).toBe(true);
  });

  it("fails when source is not one of the allowed enum values", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, source: "newspaper" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty string for optional phone", () => {
    const result = onboardingSchema.safeParse({ ...validClientData, phone: "" });
    expect(result.success).toBe(true);
  });
});

describe("assistantOnboardingSchema", () => {
  it("parses a fully valid assistant submission", () => {
    const result = assistantOnboardingSchema.safeParse(validAssistantData);
    expect(result.success).toBe(true);
  });

  it("fails when firstName is empty", () => {
    const result = assistantOnboardingSchema.safeParse({ ...validAssistantData, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("fails when skills array is empty", () => {
    const result = assistantOnboardingSchema.safeParse({ ...validAssistantData, skills: [] });
    expect(result.success).toBe(false);
  });

  it("fails when experienceLevel is invalid", () => {
    const result = assistantOnboardingSchema.safeParse({
      ...validAssistantData,
      experienceLevel: "expert",
    });
    expect(result.success).toBe(false);
  });

  it("fails when emergencyContactName is empty", () => {
    const result = assistantOnboardingSchema.safeParse({
      ...validAssistantData,
      emergencyContactName: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when emergencyContactPhone is empty", () => {
    const result = assistantOnboardingSchema.safeParse({
      ...validAssistantData,
      emergencyContactPhone: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple skills", () => {
    const result = assistantOnboardingSchema.safeParse({
      ...validAssistantData,
      skills: ["lash", "jewelry"],
    });
    expect(result.success).toBe(true);
  });

  it("fails when email is invalid", () => {
    const result = assistantOnboardingSchema.safeParse({
      ...validAssistantData,
      email: "bad-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("adminOnboardingSchema", () => {
  it("parses a fully valid admin submission", () => {
    const result = adminOnboardingSchema.safeParse(validAdminData);
    expect(result.success).toBe(true);
  });

  it("fails when firstName is empty", () => {
    const result = adminOnboardingSchema.safeParse({ ...validAdminData, firstName: "" });
    expect(result.success).toBe(false);
  });

  it("fails when email is invalid", () => {
    const result = adminOnboardingSchema.safeParse({ ...validAdminData, email: "not-valid" });
    expect(result.success).toBe(false);
  });

  it("fails when locationType is not one of the allowed values", () => {
    const result = adminOnboardingSchema.safeParse({
      ...validAdminData,
      locationType: "virtual",
    });
    expect(result.success).toBe(false);
  });

  it("fails when bookingConfirmation is invalid", () => {
    const result = adminOnboardingSchema.safeParse({
      ...validAdminData,
      bookingConfirmation: "auto",
    });
    expect(result.success).toBe(false);
  });

  it("fails when consulting waitlist value is invalid", () => {
    const result = adminOnboardingSchema.safeParse({
      ...validAdminData,
      waitlist: { ...validAdminData.waitlist, consulting: "yes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("STEPS", () => {
  it("has 6 steps", () => {
    expect(STEPS).toHaveLength(6);
  });

  it("each step has an id and title", () => {
    for (const step of STEPS) {
      expect(typeof step.id).toBe("string");
      expect(step.id.length).toBeGreaterThan(0);
      expect(typeof step.title).toBe("string");
      expect(step.title.length).toBeGreaterThan(0);
    }
  });

  it("contains required step IDs", () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids).toContain("name");
    expect(ids).toContain("interests");
    expect(ids).toContain("contact");
    expect(ids).toContain("policies");
  });
});

describe("ASSISTANT_STEPS", () => {
  it("has 7 steps", () => {
    expect(ASSISTANT_STEPS).toHaveLength(7);
  });

  it("each step has an id and title", () => {
    for (const step of ASSISTANT_STEPS) {
      expect(typeof step.id).toBe("string");
      expect(step.id.length).toBeGreaterThan(0);
      expect(typeof step.title).toBe("string");
      expect(step.title.length).toBeGreaterThan(0);
    }
  });

  it("contains required step IDs", () => {
    const ids = ASSISTANT_STEPS.map((s) => s.id);
    expect(ids).toContain("name");
    expect(ids).toContain("role_skills");
    expect(ids).toContain("shift_availability");
    expect(ids).toContain("policies");
  });
});
