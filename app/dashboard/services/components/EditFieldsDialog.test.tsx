/**
 * Tests for EditFieldsDialog — field editor with drag-and-drop reordering.
 *
 * Verifies field rendering, drag handle presence, and the reorder logic
 * (arrayMove). Actual drag events are not tested — dnd-kit owns that layer.
 *
 * @module services/components/EditFieldsDialog.test
 */

import { arrayMove } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientForm, FormField } from "../types";

/* ---- Mock server actions ---- */

const mockUpdateFormFields = vi.fn();

vi.mock("../form-actions", () => ({
  updateFormFields: (...args: unknown[]) => mockUpdateFormFields(...args),
}));

/* ---- Test fixtures ---- */

const testFields: FormField[] = [
  { id: 1, label: "Full Name", type: "text", required: true },
  { id: 2, label: "Email Address", type: "email", required: true },
  { id: 3, label: "Notes", type: "textarea", required: false },
];

function makeForm(overrides: Partial<ClientForm> = {}): ClientForm {
  return {
    id: 10,
    name: "Test Intake Form",
    type: "intake",
    description: "A test form",
    appliesTo: ["All"],
    required: true,
    lastUpdated: "Apr 10, 2026",
    active: true,
    fields: testFields,
    ...overrides,
  };
}

/* ---- Setup ---- */

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateFormFields.mockResolvedValue(undefined);
});

/* ---- Lazy import (after mocks) ---- */

async function renderDialog(form: ClientForm = makeForm()) {
  const { EditFieldsDialog } = await import("./EditFieldsDialog");
  return render(<EditFieldsDialog form={form} onSaved={vi.fn()} onClose={vi.fn()} />);
}

/* ---- Tests ---- */

describe("EditFieldsDialog", () => {
  describe("rendering", () => {
    it("displays all fields in order", async () => {
      await renderDialog();
      const inputs = screen.getAllByRole("textbox");
      const labelInputs = inputs.filter(
        (el) =>
          (el as HTMLInputElement).value === "Full Name" ||
          (el as HTMLInputElement).value === "Email Address" ||
          (el as HTMLInputElement).value === "Notes",
      );
      expect(labelInputs).toHaveLength(3);
      expect((labelInputs[0] as HTMLInputElement).value).toBe("Full Name");
      expect((labelInputs[1] as HTMLInputElement).value).toBe("Email Address");
      expect((labelInputs[2] as HTMLInputElement).value).toBe("Notes");
    });

    it("shows position numbers matching field order", async () => {
      await renderDialog();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("drag handles", () => {
    it("renders a drag handle for each field", async () => {
      await renderDialog();
      const handles = screen.getAllByRole("button", { name: /^Reorder field:/ });
      expect(handles).toHaveLength(3);
    });

    it("includes the field label in the handle aria-label", async () => {
      await renderDialog();
      expect(screen.getByRole("button", { name: "Reorder field: Full Name" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reorder field: Email Address" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reorder field: Notes" })).toBeInTheDocument();
    });
  });

  describe("reorder logic (arrayMove)", () => {
    it("moves an item forward in the array", () => {
      const result = arrayMove([...testFields], 0, 2);
      expect(result.map((f) => f.label)).toEqual(["Email Address", "Notes", "Full Name"]);
    });

    it("moves an item backward in the array", () => {
      const result = arrayMove([...testFields], 2, 0);
      expect(result.map((f) => f.label)).toEqual(["Notes", "Full Name", "Email Address"]);
    });

    it("returns the same order when indices match", () => {
      const result = arrayMove([...testFields], 1, 1);
      expect(result.map((f) => f.label)).toEqual(["Full Name", "Email Address", "Notes"]);
    });
  });
});
