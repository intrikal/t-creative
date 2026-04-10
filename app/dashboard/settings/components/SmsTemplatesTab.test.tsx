/**
 * Tests for SmsTemplatesTab — admin SMS template editor UI.
 *
 * Verifies template card rendering, editor opening, character count,
 * and variable chip insertion. Server actions are mocked.
 *
 * @module settings/components/SmsTemplatesTab.test
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SmsTemplate } from "@/lib/sms-templates";

/* ---- Mock server actions ---- */

const mockUpdateTemplate = vi.fn();
const mockPreviewTemplate = vi.fn();
const mockResetTemplate = vi.fn();

vi.mock("../sms-template-actions", () => ({
  updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
  previewTemplate: (...args: unknown[]) => mockPreviewTemplate(...args),
  resetTemplate: (...args: unknown[]) => mockResetTemplate(...args),
}));

/* ---- Test fixtures ---- */

const now = new Date().toISOString();

function makeTemplate(overrides: Partial<SmsTemplate> = {}): SmsTemplate {
  return {
    id: 1,
    slug: "booking-reminder",
    name: "Booking Reminder",
    description: "Sent 24h before appointment",
    body: "Hi {{clientFirstName}}! Reminder: your {{serviceName}} appt is tomorrow.",
    variables: ["clientFirstName", "serviceName", "businessName", "startsAtFormatted"],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SmsTemplate;
}

const template1 = makeTemplate();
const template2 = makeTemplate({
  id: 2,
  slug: "birthday-promo",
  name: "Birthday Promo",
  description: "Birthday discount message",
  body: "Happy birthday {{firstName}}! Use code {{promoCode}}.",
  variables: ["firstName", "promoCode", "discountPercent", "businessName"],
  isActive: false,
});

/* ---- Setup ---- */

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateTemplate.mockResolvedValue({ success: true, data: undefined });
  mockPreviewTemplate.mockResolvedValue({ success: true, data: "Preview text" });
  mockResetTemplate.mockResolvedValue({ success: true, data: undefined });
});

/* ---- Lazy import (after mocks) ---- */

async function renderTab(templates: SmsTemplate[] = [template1, template2]) {
  const { SmsTemplatesTab } = await import("./SmsTemplatesTab");
  return render(<SmsTemplatesTab initialTemplates={templates} />);
}

/* ---- Tests ---- */

describe("SmsTemplatesTab", () => {
  describe("rendering", () => {
    it("displays all template cards", async () => {
      await renderTab();
      expect(screen.getByText("Booking Reminder")).toBeInTheDocument();
      expect(screen.getByText("Birthday Promo")).toBeInTheDocument();
    });

    it("shows active/inactive badges", async () => {
      await renderTab();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("shows character count on cards", async () => {
      await renderTab();
      expect(screen.getByText(`${template1.body.length} chars`)).toBeInTheDocument();
    });

    it("shows description text", async () => {
      await renderTab();
      expect(screen.getByText("Sent 24h before appointment")).toBeInTheDocument();
      expect(screen.getByText("Birthday discount message")).toBeInTheDocument();
    });

    it("shows empty state when no templates", async () => {
      await renderTab([]);
      expect(screen.getByText("No SMS templates configured yet.")).toBeInTheDocument();
    });
  });

  describe("editor", () => {
    it("opens when a card is clicked", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      expect(screen.getByText("All templates")).toBeInTheDocument();
      expect(screen.getByDisplayValue(template1.body)).toBeInTheDocument();
    });

    it("goes back to list when back button is clicked", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      expect(screen.getByText("All templates")).toBeInTheDocument();
      fireEvent.click(screen.getByText("All templates"));
      expect(screen.getByText("Booking Reminder")).toBeInTheDocument();
      expect(screen.getByText("Birthday Promo")).toBeInTheDocument();
    });

    it("shows variable chips", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      expect(screen.getByText("{{clientFirstName}}")).toBeInTheDocument();
      expect(screen.getByText("{{serviceName}}")).toBeInTheDocument();
      expect(screen.getByText("{{businessName}}")).toBeInTheDocument();
    });
  });

  describe("character count", () => {
    it("updates as user types", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      const textarea = screen.getByDisplayValue(template1.body) as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: "Short" } });
      expect(screen.getByText("5/320")).toBeInTheDocument();
      expect(screen.getByText("1 SMS segment")).toBeInTheDocument();
    });

    it("shows 2 segments for 161+ chars", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      const textarea = screen.getByDisplayValue(template1.body) as HTMLTextAreaElement;

      const longText = "A".repeat(161);
      fireEvent.change(textarea, { target: { value: longText } });
      expect(screen.getByText("161/320")).toBeInTheDocument();
      expect(screen.getByText("2 SMS segments")).toBeInTheDocument();
    });
  });

  describe("variable chip insertion", () => {
    it("inserts variable at cursor position", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Booking Reminder"));
      const textarea = screen.getByDisplayValue(template1.body) as HTMLTextAreaElement;

      // Set cursor to start
      textarea.setSelectionRange(0, 0);
      fireEvent.click(screen.getByText("{{businessName}}"));

      expect(textarea.value).toBe(`{{businessName}}${template1.body}`);
    });
  });
});
